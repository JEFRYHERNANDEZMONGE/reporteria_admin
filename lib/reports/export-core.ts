import type { AppRole } from "@/lib/auth/roles";
import type { ReportType } from "@/lib/reports/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_ROWS = 2000;

type CompanyRef = { name?: string } | Array<{ name?: string }> | null;

type RawRow = {
  record_id: number;
  system_inventory: number | null;
  real_inventory: number | null;
  evidence_num: number | null;
  comments: string | null;
  time_date: string;
  product:
    | {
        product_id?: number;
        sku?: string;
        name?: string;
        company_id?: number;
        company?: CompanyRef;
      }
    | Array<{
        product_id?: number;
        sku?: string;
        name?: string;
        company_id?: number;
        company?: CompanyRef;
      }>
    | null;
  establishment:
    | {
        establishment_id?: number;
        name?: string;
        route_id?: number;
      }
    | Array<{
        establishment_id?: number;
        name?: string;
        route_id?: number;
      }>
    | null;
  reporter:
    | { user_id?: number; name?: string }
    | Array<{ user_id?: number; name?: string }>
    | null;
};

export type FlatRow = {
  recordId: number;
  systemInventory: number | null;
  realInventory: number | null;
  evidenceNum: number | null;
  comments: string | null;
  timeDate: string;
  productId: number | null;
  productSku: string | null;
  productName: string | null;
  companyId: number | null;
  companyName: string | null;
  establishmentId: number | null;
  establishmentName: string | null;
  routeId: number | null;
  userId: number | null;
  userName: string | null;
};

export type ReportFilters = {
  companyId: number | null;
  userId: number | null;
  routeId: number | null;
  establishmentId: number | null;
  productId: number | null;
  from: string | null;
  to: string | null;
};

export type EvidenceRow = {
  evidence_id: number;
  url: string;
  record_id: number;
  geo_info: string | null;
};

export type FetchReportRowsResult = {
  rows: FlatRow[];
  visitorCompanyMissing: boolean;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function toFlatRow(row: RawRow): FlatRow {
  const product = first(row.product);
  const establishment = first(row.establishment);
  const reporter = first(row.reporter);
  const company = first(product?.company);

  return {
    recordId: row.record_id,
    systemInventory: row.system_inventory,
    realInventory: row.real_inventory,
    evidenceNum: row.evidence_num,
    comments: row.comments,
    timeDate: row.time_date,
    productId: product?.product_id ?? null,
    productSku: product?.sku ?? null,
    productName: product?.name ?? null,
    companyId: product?.company_id ?? null,
    companyName: company?.name ?? null,
    establishmentId: establishment?.establishment_id ?? null,
    establishmentName: establishment?.name ?? null,
    routeId: establishment?.route_id ?? null,
    userId: reporter?.user_id ?? null,
    userName: reporter?.name ?? null,
  };
}

export function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function toExclusiveEndDate(value: string | null): string | null {
  if (!value) return null;
  const base = new Date(`${value}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function reportTitle(type: ReportType): string {
  if (type === "completo") return "Reporte completo";
  if (type === "presentacion") return "Reporte presentacion";
  if (type === "eficiencia") return "Eficiencia operativa";
  if (type === "ajustes") return "Ajustes de inventario";
  if (type === "auditoria") return "Auditoria de usuarios";
  return "Productividad";
}

export function pdfName(type: ReportType): string {
  return `reporte_${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

export function xlsxName(type: ReportType): string {
  return `reporte_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    companyId: parsePositiveInt(searchParams.get("companyId")),
    userId: parsePositiveInt(searchParams.get("userId")),
    routeId: parsePositiveInt(searchParams.get("routeId")),
    establishmentId: parsePositiveInt(searchParams.get("establishmentId")),
    productId: parsePositiveInt(searchParams.get("productId")),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  };
}

export async function fetchReportRows(params: {
  supabase: SupabaseClient;
  role: AppRole;
  authUserId: string;
  filters: ReportFilters;
}): Promise<FetchReportRowsResult> {
  const { supabase, role, authUserId, filters } = params;
  let visitorCompanyMissing = false;

  let dataQuery = supabase
    .from("check_record")
    .select(
      "record_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name, company_id, company:company_id(name)), establishment:establishment_id(establishment_id, name, route_id), reporter:user_id(user_id, name)"
    )
    .order("time_date", { ascending: false })
    .limit(MAX_ROWS);

  if (filters.from) {
    dataQuery = dataQuery.gte("time_date", `${filters.from}T00:00:00`);
  }

  const toExclusive = toExclusiveEndDate(filters.to);
  if (toExclusive) {
    dataQuery = dataQuery.lt("time_date", `${toExclusive}T00:00:00`);
  }

  if (role === "visitante") {
    const ownCompanyRes = await supabase
      .from("user_profile")
      .select("company_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const ownCompanyId = ownCompanyRes.data?.company_id ?? null;

    if (!ownCompanyId) {
      visitorCompanyMissing = true;
      dataQuery = dataQuery.in("product_id", [-1]);
    } else {
      const { data: companyProducts } = await supabase
        .from("product")
        .select("product_id")
        .eq("company_id", ownCompanyId);

      const visitorProductIds = (companyProducts ?? []).map((row) => row.product_id);
      if (visitorProductIds.length === 0) {
        dataQuery = dataQuery.in("product_id", [-1]);
      } else {
        dataQuery = dataQuery.in("product_id", visitorProductIds);
      }
    }
  }

  if (filters.companyId && (role === "admin" || role === "editor")) {
    const { data: companyProducts } = await supabase
      .from("product")
      .select("product_id")
      .eq("company_id", filters.companyId);

    const companyProductIds = (companyProducts ?? []).map((row) => row.product_id);
    if (companyProductIds.length === 0) {
      dataQuery = dataQuery.in("product_id", [-1]);
    } else {
      dataQuery = dataQuery.in("product_id", companyProductIds);
    }
  }

  if (filters.userId && (role === "admin" || role === "editor")) {
    dataQuery = dataQuery.eq("user_id", filters.userId);
  }

  if (filters.productId) {
    dataQuery = dataQuery.eq("product_id", filters.productId);
  }

  if (filters.establishmentId) {
    dataQuery = dataQuery.eq("establishment_id", filters.establishmentId);
  }

  if (filters.routeId) {
    const { data: routeEstablishments } = await supabase
      .from("establishment")
      .select("establishment_id")
      .eq("route_id", filters.routeId);

    const establishmentIds = (routeEstablishments ?? []).map((row) => row.establishment_id);
    if (establishmentIds.length === 0) {
      dataQuery = dataQuery.in("establishment_id", [-1]);
    } else {
      dataQuery = dataQuery.in("establishment_id", establishmentIds);
    }
  }

  const { data, error } = await dataQuery;
  if (error) {
    throw new Error(`No se pudo generar el reporte: ${error.message}`);
  }

  return {
    rows: ((data ?? []) as RawRow[]).map(toFlatRow),
    visitorCompanyMissing,
  };
}

export async function fetchEvidenceRows(
  supabase: SupabaseClient,
  recordIds: number[]
): Promise<Map<number, EvidenceRow[]>> {
  const map = new Map<number, EvidenceRow[]>();
  if (recordIds.length === 0) return map;

  const { data, error } = await supabase
    .from("evidence")
    .select("evidence_id, url, record_id, geo_info")
    .in("record_id", recordIds)
    .order("evidence_id", { ascending: true });

  if (error) {
    throw new Error(`No se pudo cargar evidencias: ${error.message}`);
  }

  const rows = (data ?? []) as EvidenceRow[];
  rows.forEach((row) => {
    const bucket = map.get(row.record_id) ?? [];
    bucket.push(row);
    map.set(row.record_id, bucket);
  });

  return map;
}
