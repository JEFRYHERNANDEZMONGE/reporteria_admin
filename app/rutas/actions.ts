"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RouteFormState = {
  error: string | null;
};

export type DeleteRouteState = {
  error: string | null;
  success: boolean;
};

type RouteManagerContext =
  | {
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      role: "admin" | "editor";
    }
  | { error: string };

function parseIsActive(value: FormDataEntryValue | null) {
  return String(value ?? "active") === "active";
}

function parseAssignedUserId(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseEstablishmentIds(formData: FormData) {
  const rawValues = formData.getAll("establishmentIds");
  const parsed = rawValues
    .map((value) => Number(String(value ?? "").trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(parsed));
}

async function getRouteManager(): Promise<RouteManagerContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile || !profile.isActive) {
    return { error: "No tienes un perfil activo para esta accion." };
  }

  if (profile.role !== "admin" && profile.role !== "editor") {
    return { error: "No tienes permisos para administrar rutas." };
  }

  return { supabase, role: profile.role };
}

async function validateAssignedUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  assignedUserId: number | null
) {
  if (!assignedUserId) return true;

  const { data, error } = await supabase
    .from("user_profile")
    .select("user_id, role, is_active")
    .eq("user_id", assignedUserId)
    .maybeSingle();

  if (error || !data) return false;
  if (data.role !== "rutero") return false;
  if (data.is_active === false) return false;
  return true;
}

async function validateUnassignedEstablishments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentIds: number[]
) {
  if (establishmentIds.length === 0) return true;

  const { data, error } = await supabase
    .from("establishment")
    .select("establishment_id")
    .in("establishment_id", establishmentIds)
    .is("route_id", null);

  if (error || !data) return false;
  return data.length === establishmentIds.length;
}

async function getRouteEstablishments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  routeId: number
) {
  const { data, error } = await supabase
    .from("establishment")
    .select("establishment_id")
    .eq("route_id", routeId);

  if (error || !data) return null;
  return data.map((row) => row.establishment_id);
}

async function assignEstablishmentsToRoute(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  routeId: number,
  establishmentIds: number[]
) {
  if (establishmentIds.length === 0) return { error: null as string | null };

  const { error } = await supabase
    .from("establishment")
    .update({ route_id: routeId })
    .in("establishment_id", establishmentIds)
    .is("route_id", null);

  if (error) {
    return { error: "No se pudieron asignar establecimientos a la ruta. (RUT-ASG-01)" };
  }

  return { error: null as string | null };
}

async function unassignEstablishmentsFromRoute(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  routeId: number,
  establishmentIds: number[]
) {
  if (establishmentIds.length === 0) return { error: null as string | null };

  const { error } = await supabase
    .from("establishment")
    .update({ route_id: null })
    .eq("route_id", routeId)
    .in("establishment_id", establishmentIds);

  if (error) {
    return { error: "No se pudieron remover establecimientos de la ruta. (RUT-REM-01)" };
  }

  return { error: null as string | null };
}

export async function createRouteAction(
  _prevState: RouteFormState,
  formData: FormData
): Promise<RouteFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const visitPeriod = String(formData.get("visitPeriod") ?? "").trim();
  const day = String(formData.get("day") ?? "").trim();
  const assignedUserId = parseAssignedUserId(formData.get("assignedUserId"));
  const establishmentIds = parseEstablishmentIds(formData);
  const isActive = parseIsActive(formData.get("status"));

  if (!nombre) {
    return { error: "El nombre de la ruta es obligatorio." };
  }

  const context = await getRouteManager();
  if ("error" in context) return { error: context.error };

  const { supabase } = context;
  const isAssignedUserValid = await validateAssignedUser(supabase, assignedUserId);
  if (!isAssignedUserValid) {
    return { error: "El usuario asignado no es valido o no esta activo." };
  }

  const areEstablishmentsValid = await validateUnassignedEstablishments(supabase, establishmentIds);
  if (!areEstablishmentsValid) {
    return {
      error: "Alguno de los establecimientos seleccionados ya tiene ruta asignada.",
    };
  }

  const { data: createdRoute, error } = await supabase
    .from("route")
    .insert({
      nombre,
      visit_period: visitPeriod || null,
      day: day || null,
      assigned_user: assignedUserId,
      is_active: isActive,
    })
    .select("route_id")
    .single();

  if (error || !createdRoute) {
    return { error: "No se pudo crear la ruta. Verifica los datos e intenta nuevamente. (RUT-CRE-01)" };
  }

  const assignResult = await assignEstablishmentsToRoute(
    supabase,
    createdRoute.route_id,
    establishmentIds
  );
  if (assignResult.error) {
    return { error: assignResult.error };
  }

  revalidatePath("/rutas");
  revalidatePath(`/rutas/${createdRoute.route_id}`);
  redirect("/rutas");
}

export async function updateRouteAction(
  _prevState: RouteFormState,
  formData: FormData
): Promise<RouteFormState> {
  const routeId = Number(formData.get("routeId"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const visitPeriod = String(formData.get("visitPeriod") ?? "").trim();
  const day = String(formData.get("day") ?? "").trim();
  const assignedUserId = parseAssignedUserId(formData.get("assignedUserId"));
  const establishmentIds = parseEstablishmentIds(formData);
  const isActive = parseIsActive(formData.get("status"));

  if (!routeId || Number.isNaN(routeId)) {
    return { error: "Ruta invalida." };
  }

  if (!nombre) {
    return { error: "El nombre de la ruta es obligatorio." };
  }

  const context = await getRouteManager();
  if ("error" in context) return { error: context.error };

  const { supabase } = context;
  const isAssignedUserValid = await validateAssignedUser(supabase, assignedUserId);
  if (!isAssignedUserValid) {
    return { error: "El usuario asignado no es valido o no esta activo." };
  }

  const currentEstablishmentIds = await getRouteEstablishments(supabase, routeId);
  if (!currentEstablishmentIds) {
    return { error: "No se pudieron consultar los establecimientos de la ruta. (RUT-CON-01)" };
  }

  const selectedSet = new Set(establishmentIds);
  const currentSet = new Set(currentEstablishmentIds);

  const establishmentsToAssign = establishmentIds.filter((id) => !currentSet.has(id));
  const establishmentsToUnassign = currentEstablishmentIds.filter((id) => !selectedSet.has(id));

  const areEstablishmentsValid = await validateUnassignedEstablishments(
    supabase,
    establishmentsToAssign
  );
  if (!areEstablishmentsValid) {
    return {
      error: "Alguno de los establecimientos seleccionados ya tiene ruta asignada.",
    };
  }

  const { error } = await supabase
    .from("route")
    .update({
      nombre,
      visit_period: visitPeriod || null,
      day: day || null,
      assigned_user: assignedUserId,
      is_active: isActive,
    })
    .eq("route_id", routeId);

  if (error) {
    return { error: "No se pudo actualizar la ruta. Intenta nuevamente. (RUT-UPD-01)" };
  }

  const unassignResult = await unassignEstablishmentsFromRoute(
    supabase,
    routeId,
    establishmentsToUnassign
  );
  if (unassignResult.error) {
    return { error: unassignResult.error };
  }

  const assignResult = await assignEstablishmentsToRoute(
    supabase,
    routeId,
    establishmentsToAssign
  );
  if (assignResult.error) {
    return { error: assignResult.error };
  }

  revalidatePath("/rutas");
  revalidatePath(`/rutas/${routeId}`);
  redirect("/rutas");
}

export async function deleteRouteAction(
  _prevState: DeleteRouteState,
  formData: FormData
): Promise<DeleteRouteState> {
  const routeId = Number(formData.get("routeId"));

  if (!routeId || Number.isNaN(routeId)) {
    return { error: "Ruta invalida.", success: false };
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

  const profile = await getCurrentUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    return { error: "Solo admin puede eliminar rutas.", success: false };
  }

  const { error } = await supabase.from("route").delete().eq("route_id", routeId);
  if (error) {
    return {
      error: "No se pudo eliminar la ruta. Verifica dependencias relacionadas. (RUT-DEL-01)",
      success: false,
    };
  }

  revalidatePath("/rutas");
  redirect("/rutas");
}
