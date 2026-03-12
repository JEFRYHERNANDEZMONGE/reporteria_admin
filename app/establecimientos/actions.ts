"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEstablishmentImportRow } from "@/lib/establishments/import-template";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EstablishmentFormState = {
  error: string | null;
};

export type DeleteEstablishmentState = {
  error: string | null;
  success: boolean;
};

export type EstablishmentImportState = {
  error: string | null;
  success: string | null;
  details: string[];
};

type AuthorizedEstablishmentContext =
  | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; role: "admin" | "editor" }
  | { error: string };

type ImportedEstablishmentRow = {
  routeName: string;
  name: string;
  direction: string;
  province: string;
  canton: string;
  district: string;
  lat: number | null;
  long: number | null;
  is_active: boolean;
};

function parseIsActive(value: FormDataEntryValue | null) {
  return String(value ?? "active") === "active";
}

function parseRouteId(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalCoordinate(
  value: FormDataEntryValue | null,
  min: number,
  max: number
) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: null as number | null, error: null as string | null };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return { value: null as number | null, error: "Las coordenadas deben ser numericas." };
  }

  if (parsed < min || parsed > max) {
    return {
      value: null as number | null,
      error: `Las coordenadas deben estar entre ${min} y ${max}.`,
    };
  }

  return { value: parsed, error: null as string | null };
}

function parseProductIds(formData: FormData) {
  const parsed = formData
    .getAll("productIds")
    .map((value) => Number(String(value ?? "").trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(parsed));
}

async function getAuthorizedEstablishmentClient(): Promise<AuthorizedEstablishmentContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (!role || (role !== "admin" && role !== "editor")) {
    return { error: "No tienes permisos para administrar establecimientos." };
  }

  return { supabase, role };
}

async function validateRouteExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  routeId: number | null
) {
  if (!routeId) return true;

  const { data, error } = await supabase
    .from("route")
    .select("route_id")
    .eq("route_id", routeId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function validateProductsExist(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  productIds: number[]
) {
  if (productIds.length === 0) return true;

  const { data, error } = await supabase
    .from("product")
    .select("product_id")
    .in("product_id", productIds);

  if (error || !data) return false;
  return data.length === productIds.length;
}

async function syncEstablishmentProducts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: number,
  productIds: number[]
) {
  const { data: currentRows, error: currentError } = await supabase
    .from("products_establishment")
    .select("product_id")
    .eq("establishment_id", establishmentId);

  if (currentError) {
    return { error: "No se pudieron consultar los productos del establecimiento." };
  }

  const currentIds = new Set((currentRows ?? []).map((row) => row.product_id));
  const nextIds = new Set(productIds);

  const toInsert = productIds.filter((productId) => !currentIds.has(productId));
  const toDelete = Array.from(currentIds).filter((productId) => !nextIds.has(productId));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("products_establishment")
      .delete()
      .eq("establishment_id", establishmentId)
      .in("product_id", toDelete);

    if (error) {
      return { error: "No se pudieron remover productos del establecimiento." };
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products_establishment").insert(
      toInsert.map((productId) => ({
        establishment_id: establishmentId,
        product_id: productId,
      }))
    );

    if (error) {
      return { error: "No se pudieron asignar productos al establecimiento." };
    }
  }

  return { error: null as string | null };
}

const IMPORT_ERROR_LIMIT = 12;
const TEMPLATE_HEADER_LABELS = [
  "ruta",
  "nombre",
  "direccion",
  "provincia",
  "canton",
  "distrito",
  "coordenadas",
  "estado",
] as const;

function validateRequiredLocationFields(input: {
  direction: string;
  province: string;
  canton: string;
  district: string;
}) {
  if (!input.direction) {
    return "La direccion detallada es obligatoria.";
  }

  if (!input.province) {
    return "La provincia es obligatoria.";
  }

  if (!input.canton) {
    return "El canton es obligatorio.";
  }

  if (!input.district) {
    return "El distrito es obligatorio.";
  }

  return null;
}

function summarizeImportErrors(errors: string[]) {
  if (errors.length <= IMPORT_ERROR_LIMIT) return errors;
  const omitted = errors.length - IMPORT_ERROR_LIMIT;
  return [...errors.slice(0, IMPORT_ERROR_LIMIT), `... y ${omitted} error(es) adicional(es).`];
}

function findTemplateHeaderRow(sheet: ExcelJS.Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 8); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = TEMPLATE_HEADER_LABELS.map((_, index) =>
      row.getCell(index + 1).text.trim().toLowerCase()
    );

    if (values.every((value, index) => value === TEMPLATE_HEADER_LABELS[index])) {
      return rowNumber;
    }
  }

  return 1;
}

async function resolveImportedRouteIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  routeNames: string[]
) {
  if (routeNames.length === 0) {
    return { ok: true as const, routeIdByName: new Map<string, number>() };
  }

  const uniqueRouteNames = Array.from(new Set(routeNames));

  const { data: existingRoutes, error: existingRoutesError } = await supabase
    .from("route")
    .select("route_id, nombre")
    .in("nombre", uniqueRouteNames);

  if (existingRoutesError) {
    return {
      ok: false as const,
      error: "No se pudieron consultar las rutas del archivo.",
    };
  }

  const routeIdByName = new Map<string, number>();
  for (const route of existingRoutes ?? []) {
    if (!routeIdByName.has(route.nombre)) {
      routeIdByName.set(route.nombre, route.route_id);
    }
  }

  const missingRouteNames = uniqueRouteNames.filter((routeName) => !routeIdByName.has(routeName));
  if (missingRouteNames.length === 0) {
    return { ok: true as const, routeIdByName };
  }

  const { data: createdRoutes, error: createdRoutesError } = await supabase
    .from("route")
    .insert(
      missingRouteNames.map((routeName) => ({
        nombre: routeName,
        visit_period: null,
        day: null,
        assigned_user: null,
        is_active: true,
      }))
    )
    .select("route_id, nombre");

  if (createdRoutesError) {
    return {
      ok: false as const,
      error: "No se pudieron crear las rutas faltantes del archivo.",
    };
  }

  for (const route of createdRoutes ?? []) {
    routeIdByName.set(route.nombre, route.route_id);
  }

  const unresolvedRouteNames = missingRouteNames.filter((routeName) => !routeIdByName.has(routeName));
  if (unresolvedRouteNames.length > 0) {
    return {
      ok: false as const,
      error: "No se pudieron resolver todas las rutas del archivo.",
    };
  }

  return { ok: true as const, routeIdByName };
}

export async function importEstablishmentsTemplateAction(
  _prevState: EstablishmentImportState,
  formData: FormData
): Promise<EstablishmentImportState> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return {
      error: "Selecciona un archivo Excel (.xlsx) para importar.",
      success: null,
      details: [],
    };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      error: "El archivo debe tener extension .xlsx.",
      success: null,
      details: [],
    };
  }

  const context = await getAuthorizedEstablishmentClient();
  if ("error" in context) {
    return {
      error: context.error,
      success: null,
      details: [],
    };
  }

  const { supabase } = context;

  const workbook = new ExcelJS.Workbook();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbookBuffer = Buffer.from(arrayBuffer) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(workbookBuffer);
  } catch {
    return {
      error: "No se pudo leer el archivo Excel. Verifica el formato de la plantilla.",
      success: null,
      details: [],
    };
  }

  const sheet = workbook.getWorksheet("Establecimientos") ?? workbook.worksheets[0];

  if (!sheet) {
    return {
      error: "El archivo no contiene hojas para importar.",
      success: null,
      details: [],
    };
  }

  const headerRow = findTemplateHeaderRow(sheet);
  const rowsToImport: ImportedEstablishmentRow[] = [];
  const errors: string[] = [];

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const route = row.getCell(1).text.trim();
    const name = row.getCell(2).text.trim();
    const direction = row.getCell(3).text.trim();
    const province = row.getCell(4).text.trim();
    const canton = row.getCell(5).text.trim();
    const district = row.getCell(6).text.trim();
    const coordinates = row.getCell(7).text.trim();
    const status = row.getCell(8).text.trim();

    if (!route && !name && !direction && !province && !canton && !district && !coordinates && !status) {
      continue;
    }

    const parsed = parseEstablishmentImportRow({
      rowNumber,
      route,
      name,
      direction,
      province,
      canton,
      district,
      coordinates,
      status,
    });

    if (!parsed.ok) {
      errors.push(parsed.error);
      continue;
    }

    rowsToImport.push({
      routeName: parsed.data.routeName,
      name: parsed.data.name,
      direction: parsed.data.direction,
      province: parsed.data.province,
      canton: parsed.data.canton,
      district: parsed.data.district,
      lat: parsed.data.lat,
      long: parsed.data.lng,
      is_active: parsed.data.isActive,
    });
  }

  if (rowsToImport.length === 0) {
    return {
      error:
        errors.length > 0
          ? "No se importo ningun establecimiento por errores de validacion."
          : "La plantilla no contiene filas con datos para importar.",
      success: null,
      details: summarizeImportErrors(errors),
    };
  }

  const resolvedRoutes = await resolveImportedRouteIds(
    supabase,
    rowsToImport.map((row) => row.routeName)
  );

  if (!resolvedRoutes.ok) {
    return {
      error: resolvedRoutes.error,
      success: null,
      details: summarizeImportErrors(errors),
    };
  }

  const rowsToInsert: Array<{
    name: string;
    direction: string;
    province: string;
    canton: string;
    district: string;
    lat: number | null;
    long: number | null;
    is_active: boolean;
    route_id: number;
  }> = [];
  for (const row of rowsToImport) {
    const routeId = resolvedRoutes.routeIdByName.get(row.routeName);
    if (!routeId) {
      return {
        error: `No se pudo resolver la ruta "${row.routeName}" para importar los establecimientos.`,
        success: null,
        details: summarizeImportErrors(errors),
      };
    }

    rowsToInsert.push({
      name: row.name,
      direction: row.direction,
      province: row.province,
      canton: row.canton,
      district: row.district,
      lat: row.lat,
      long: row.long,
      is_active: row.is_active,
      route_id: routeId,
    });
  }

  const { error } = await supabase.from("establishment").insert(rowsToInsert);
  if (error) {
    return {
      error: "No se pudo completar la importacion. Intenta nuevamente.",
      success: null,
      details: summarizeImportErrors(errors),
    };
  }

  revalidatePath("/establecimientos");

  const importedCount = rowsToInsert.length;
  const skippedCount = errors.length;
  const success =
    skippedCount > 0
      ? `Se importaron ${importedCount} establecimiento(s). ${skippedCount} fila(s) fueron omitidas.`
      : `Se importaron ${importedCount} establecimiento(s).`;

  return {
    error: null,
    success,
    details: summarizeImportErrors(errors),
  };
}

export async function createEstablishmentAction(
  _prevState: EstablishmentFormState,
  formData: FormData
): Promise<EstablishmentFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const routeId = parseRouteId(formData.get("routeId"));
  const direction = String(formData.get("direction") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const canton = String(formData.get("canton") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const latResult = parseOptionalCoordinate(formData.get("lat"), -90, 90);
  const lngResult = parseOptionalCoordinate(formData.get("lng"), -180, 180);
  const isActive = parseIsActive(formData.get("status"));
  const productIds = parseProductIds(formData);

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const locationError = validateRequiredLocationFields({
    direction,
    province,
    canton,
    district,
  });
  if (locationError) {
    return { error: locationError };
  }

  if (latResult.error || lngResult.error) {
    return { error: latResult.error ?? lngResult.error };
  }

  const context = await getAuthorizedEstablishmentClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;

  const routeExists = await validateRouteExists(supabase, routeId);
  if (!routeExists) {
    return { error: "La ruta seleccionada no existe." };
  }

  const productsExist = await validateProductsExist(supabase, productIds);
  if (!productsExist) {
    return { error: "Uno o mas productos seleccionados no existen." };
  }

  const { data: created, error } = await supabase
    .from("establishment")
    .insert({
      name,
      route_id: routeId,
      direction,
      province,
      canton,
      district,
      lat: latResult.value,
      long: lngResult.value,
      is_active: isActive,
    })
    .select("establishment_id")
    .single();

  if (error || !created) {
    return { error: "No se pudo crear el establecimiento. Intenta nuevamente." };
  }

  const syncResult = await syncEstablishmentProducts(supabase, created.establishment_id, productIds);
  if (syncResult.error) {
    return { error: syncResult.error };
  }

  revalidatePath("/establecimientos");
  revalidatePath(`/establecimientos/${created.establishment_id}`);
  redirect("/establecimientos");
}

export async function updateEstablishmentAction(
  _prevState: EstablishmentFormState,
  formData: FormData
): Promise<EstablishmentFormState> {
  const establishmentId = Number(formData.get("establishmentId"));
  const name = String(formData.get("name") ?? "").trim();
  const routeId = parseRouteId(formData.get("routeId"));
  const direction = String(formData.get("direction") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const canton = String(formData.get("canton") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const latResult = parseOptionalCoordinate(formData.get("lat"), -90, 90);
  const lngResult = parseOptionalCoordinate(formData.get("lng"), -180, 180);
  const isActive = parseIsActive(formData.get("status"));
  const productIds = parseProductIds(formData);

  if (!establishmentId || Number.isNaN(establishmentId)) {
    return { error: "Establecimiento invalido." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const locationError = validateRequiredLocationFields({
    direction,
    province,
    canton,
    district,
  });
  if (locationError) {
    return { error: locationError };
  }

  if (latResult.error || lngResult.error) {
    return { error: latResult.error ?? lngResult.error };
  }

  const context = await getAuthorizedEstablishmentClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;

  const routeExists = await validateRouteExists(supabase, routeId);
  if (!routeExists) {
    return { error: "La ruta seleccionada no existe." };
  }

  const productsExist = await validateProductsExist(supabase, productIds);
  if (!productsExist) {
    return { error: "Uno o mas productos seleccionados no existen." };
  }

  const { error } = await supabase
    .from("establishment")
    .update({
      name,
      route_id: routeId,
      direction,
      province,
      canton,
      district,
      lat: latResult.value,
      long: lngResult.value,
      is_active: isActive,
    })
    .eq("establishment_id", establishmentId);

  if (error) {
    return { error: "No se pudo actualizar el establecimiento. Intenta nuevamente." };
  }

  const syncResult = await syncEstablishmentProducts(supabase, establishmentId, productIds);
  if (syncResult.error) {
    return { error: syncResult.error };
  }

  revalidatePath("/establecimientos");
  revalidatePath(`/establecimientos/${establishmentId}`);
  redirect("/establecimientos");
}

export async function deleteEstablishmentAction(
  _prevState: DeleteEstablishmentState,
  formData: FormData
): Promise<DeleteEstablishmentState> {
  const establishmentId = Number(formData.get("establishmentId"));

  if (!establishmentId || Number.isNaN(establishmentId)) {
    return { error: "Establecimiento invalido.", success: false };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Tu sesion ha expirado. Inicia sesion nuevamente.",
      success: false,
    };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (role !== "admin") {
    return { error: "Solo admin puede eliminar establecimientos.", success: false };
  }

  const { error: linkError } = await supabase
    .from("products_establishment")
    .delete()
    .eq("establishment_id", establishmentId);

  if (linkError) {
    return {
      error: "No se pudieron remover relaciones de productos del establecimiento.",
      success: false,
    };
  }

  const { error } = await supabase
    .from("establishment")
    .delete()
    .eq("establishment_id", establishmentId);

  if (error) {
    return {
      error:
        "No se pudo eliminar el establecimiento. Verifica si tiene registros relacionados.",
      success: false,
    };
  }

  revalidatePath("/establecimientos");
  redirect("/establecimientos");
}
