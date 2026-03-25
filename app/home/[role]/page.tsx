import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/home/actions";
import { RouteRealtimeSummaryCard } from "@/app/home/_components/route-realtime-summary-card";
import { getCurrentUserProfile, getUserRoleFromProfile } from "@/lib/auth/profile";
import { APP_ROLE_COOKIE, isAppRole, roleHomePath, type AppRole } from "@/lib/auth/roles";
import {
  buildRouteRealtimeSummary,
  type RouteRealtimeSummary,
  type RouteSummaryEstablishment,
  type RouteSummaryRecord,
  type RouteSummaryRoute,
} from "@/lib/routes/realtime-summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{
    range?: string;
    adjustmentsRange?: string;
    activityRange?: string;
    routeId?: string;
  }>;
};

type DashboardRange = 7 | 14 | 30 | 90 | 365;

type BasicRelation = {
  name?: string;
};

type ProductRelation = {
  product_id?: number;
  sku?: string;
  name?: string;
};

type DashboardRecordRow = {
  record_id: number;
  product_id: number | null;
  establishment_id: number | null;
  system_inventory: number | null;
  real_inventory: number | null;
  evidence_num: number | null;
  comments: string | null;
  time_date: string;
  product?: ProductRelation | ProductRelation[] | null;
  establishment?: BasicRelation | BasicRelation[] | null;
  reporter?: BasicRelation | BasicRelation[] | null;
};

type TaskRelation = {
  task_id?: number;
  title?: string;
  priority?: string;
  due_to?: string | null;
};

type UserTaskRow = {
  task_id: number;
  task_state: string;
  task?: TaskRelation | TaskRelation[] | null;
};

type RouteRow = {
  route_id: number;
  nombre: string;
  day: string | null;
  is_active: boolean;
};

type KpiItem = {
  label: string;
  value: string;
  hint: string;
};

type RankedItem = {
  label: string;
  value: number;
  extra?: string;
};

type TrendPoint = {
  label: string;
  value: number;
};

type TrendGranularity = "day" | "week" | "month";

type AdminEditorDashboardData = {
  kpis: KpiItem[];
  trend: TrendPoint[];
  topAdjustmentsByEstablishment: RankedItem[];
  recentRecords: DashboardRecordRow[];
};

type RuteroDashboardTask = {
  taskId: number;
  title: string;
  priority: string;
  dueTo: string | null;
  state: string;
};

type RuteroDashboardData = {
  kpis: KpiItem[];
  upcomingTasks: RuteroDashboardTask[];
  routes: RouteRow[];
  recentRecords: DashboardRecordRow[];
  alerts: string[];
};

type VisitanteDashboardData = {
  companyId: number | null;
  companyName: string | null;
  kpis: KpiItem[];
  adjustmentsTrend: TrendPoint[];
  topAdjustmentsByEstablishment: RankedItem[];
  topProductsByVariation: RankedItem[];
  recentRecords: DashboardRecordRow[];
};

type RouteSummaryOption = {
  routeId: number;
  name: string;
};

type RouteSummaryCardData = {
  routes: RouteSummaryOption[];
  selectedRouteId: number | null;
  summary: RouteRealtimeSummary | null;
  emptyText: string;
};

const RANGE_OPTIONS_BY_ROLE: Record<AppRole, DashboardRange[]> = {
  admin: [30, 90, 365],
  editor: [30, 90, 365],
  visitante: [30],
  rutero: [7, 14, 30],
};

const ROLE_COPY: Record<AppRole, { heading: string; message: string }> = {
  admin: {
    heading: "Dashboard operativo",
    message: "Vista global del sistema para seguimiento de operacion y decisiones.",
  },
  editor: {
    heading: "Dashboard operativo",
    message: "Vista global para seguimiento y coordinacion diaria.",
  },
  rutero: {
    heading: "Mi jornada",
    message: "Tu avance diario en tareas, rutas y registros.",
  },
  visitante: {
    heading: "Monitoreo de mi empresa",
    message: "Indicadores y actividad de la empresa asignada.",
  },
};

function parseRange(
  value: string | undefined,
  allowedOptions: readonly DashboardRange[],
  fallback: DashboardRange
): DashboardRange {
  const parsed = Number(value);
  if (allowedOptions.some((option) => option === parsed)) {
    return parsed as DashboardRange;
  }

  return fallback;
}

function parsePositiveInt(value: string | undefined) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function getRangeOptionsForRole(role: AppRole): readonly DashboardRange[] {
  return RANGE_OPTIONS_BY_ROLE[role];
}

function getVisitedTrendGranularity(range: DashboardRange): TrendGranularity {
  if (range === 30) return "day";
  if (range === 90) return "week";
  return "month";
}

function trendGranularityLabel(granularity: TrendGranularity) {
  if (granularity === "day") return "por dia";
  if (granularity === "week") return "por semana";
  return "por mes";
}

function takeFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfPeriodIso(days: DashboardRange) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOnOrAfter(value: string, thresholdIso: string) {
  const valueTime = new Date(value).getTime();
  const thresholdTime = new Date(thresholdIso).getTime();

  if (Number.isNaN(valueTime) || Number.isNaN(thresholdTime)) return false;
  return valueTime >= thresholdTime;
}

function formatCompactDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
}

function getInventoryDelta(record: Pick<DashboardRecordRow, "system_inventory" | "real_inventory">) {
  if (record.system_inventory == null || record.real_inventory == null) return null;
  return record.real_inventory - record.system_inventory;
}

function extractProductLabel(record: DashboardRecordRow) {
  const product = takeFirst(record.product);
  if (!product) return "-";
  const name = product.name ?? "Producto";
  return product.sku ? `${name} (${product.sku})` : name;
}

function extractEstablishmentName(record: DashboardRecordRow) {
  return takeFirst(record.establishment)?.name ?? "-";
}

function extractReporterName(record: DashboardRecordRow) {
  return takeFirst(record.reporter)?.name ?? "-";
}

function buildDailyTrend(
  records: DashboardRecordRow[],
  days: DashboardRange,
  predicate: (record: DashboardRecordRow) => boolean
): TrendPoint[] {
  const buckets = new Map<string, number>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, 0);
  }

  for (const record of records) {
    if (!predicate(record)) continue;
    const key = record.time_date.slice(0, 10);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: formatCompactDay(key),
    value,
  }));
}

function buildVisitedEstablishmentsTrend(records: DashboardRecordRow[], days: DashboardRange): TrendPoint[] {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const granularity = getVisitedTrendGranularity(days);
  const buckets = new Map<string, { label: string; establishments: Set<number> }>();

  const startOfWeek = (dateValue: Date) => {
    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    const weekday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - weekday);
    return date;
  };

  if (granularity === "day") {
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const current = new Date(endDate);
      current.setDate(endDate.getDate() - offset);
      const key = current.toISOString().slice(0, 10);
      buckets.set(key, { label: formatCompactDay(key), establishments: new Set<number>() });
    }
  } else if (granularity === "week") {
    const weekCursor = startOfWeek(startDate);
    while (weekCursor <= endDate) {
      const key = weekCursor.toISOString().slice(0, 10);
      buckets.set(key, {
        label: `Sem ${formatCompactDay(key)}`,
        establishments: new Set<number>(),
      });
      weekCursor.setDate(weekCursor.getDate() + 7);
    }
  } else {
    const monthCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (monthCursor <= endMonth) {
      const key = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, {
        label: monthCursor.toLocaleDateString("es-MX", {
          month: "short",
          year: "2-digit",
        }),
        establishments: new Set<number>(),
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }
  }

  for (const record of records) {
    if (typeof record.establishment_id !== "number") continue;

    const recordDate = new Date(record.time_date);
    if (Number.isNaN(recordDate.getTime())) continue;

    recordDate.setHours(0, 0, 0, 0);
    if (recordDate < startDate || recordDate > endDate) continue;

    let key: string;
    if (granularity === "day") {
      key = recordDate.toISOString().slice(0, 10);
    } else if (granularity === "week") {
      key = startOfWeek(recordDate).toISOString().slice(0, 10);
    } else {
      key = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
    }

    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.establishments.add(record.establishment_id);
  }

  return Array.from(buckets.values()).map((bucket) => ({
    label: bucket.label,
    value: bucket.establishments.size,
  }));
}

function mapTopItems(itemsMap: Map<string, { label: string; value: number; extra?: string }>, top = 5) {
  return Array.from(itemsMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, top)
    .map((item) => ({ label: item.label, value: item.value, extra: item.extra }));
}

async function getAdminEditorDashboardData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  adjustmentsRange: DashboardRange,
  activityRange: DashboardRange
): Promise<AdminEditorDashboardData> {
  const kpiRange: DashboardRange = 30;
  const maxRange = Math.max(adjustmentsRange, activityRange, kpiRange) as DashboardRange;
  const periodStart = startOfPeriodIso(maxRange);

  const [periodRecordsRes, recentRecordsRes, taskAssignmentsRes, activeEstablishmentsRes] =
    await Promise.all([
      supabase
        .from("check_record")
        .select(
          "record_id, product_id, establishment_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name), establishment:establishment_id(name), reporter:user_id(name)"
        )
        .gte("time_date", periodStart)
        .order("time_date", { ascending: false })
        .limit(2000),
      supabase
        .from("check_record")
        .select(
          "record_id, product_id, establishment_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name), establishment:establishment_id(name), reporter:user_id(name)"
        )
        .order("time_date", { ascending: false })
        .limit(10),
      supabase
        .from("user_tasks")
        .select("task_id, task_state, task:task_id(task_id, due_to)"),
      supabase
        .from("establishment")
        .select("establishment_id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

  const periodRecords = (periodRecordsRes.data ?? []) as DashboardRecordRow[];
  const recentRecords = (recentRecordsRes.data ?? []) as DashboardRecordRow[];
  const taskAssignments = (taskAssignmentsRes.data ?? []) as UserTaskRow[];

  const kpiStart = startOfPeriodIso(kpiRange);
  const activityStart = startOfPeriodIso(activityRange);
  const adjustmentsStart = startOfPeriodIso(adjustmentsRange);

  const kpiRecords = periodRecords.filter((record) => isOnOrAfter(record.time_date, kpiStart));
  const activityRecords = periodRecords.filter((record) => isOnOrAfter(record.time_date, activityStart));
  const adjustmentsRecords = periodRecords.filter((record) =>
    isOnOrAfter(record.time_date, adjustmentsStart)
  );

  const visitedEstablishments = new Set<number>();
  for (const row of kpiRecords) {
    if (typeof row.establishment_id === "number") {
      visitedEstablishments.add(row.establishment_id);
    }
  }

  const activeEstablishments = activeEstablishmentsRes.count ?? 0;
  const pendingTasks = taskAssignments.filter((row) => row.task_state === "Pendiente").length;
  const overdueTasks = taskAssignments.filter((row) => row.task_state === "Atrasada").length;
  const completedTasks = taskAssignments.filter((row) => row.task_state === "Completada").length;

  const adjustmentsByEstablishment = new Map<string, { label: string; value: number }>();
  for (const record of adjustmentsRecords) {
    const delta = getInventoryDelta(record);
    if (!delta) continue;

    const key = String(record.establishment_id ?? extractEstablishmentName(record));
    const current = adjustmentsByEstablishment.get(key) ?? {
      label: extractEstablishmentName(record),
      value: 0,
    };
    current.value += 1;
    adjustmentsByEstablishment.set(key, current);
  }

  return {
    kpis: [
      {
        label: "Establecimientos visitados",
        value: String(visitedEstablishments.size),
        hint: `Ultimos ${kpiRange} dias`,
      },
      {
        label: "Establecimientos pendientes",
        value: String(Math.max(activeEstablishments - visitedEstablishments.size, 0)),
        hint: "Activos sin registro en el periodo",
      },
      {
        label: "Tareas pendientes",
        value: String(pendingTasks),
        hint: "Estado Pendiente",
      },
      {
        label: "Tareas atrasadas",
        value: String(overdueTasks),
        hint: "Estado Atrasada",
      },
      {
        label: "Tareas completadas",
        value: String(completedTasks),
        hint: "Estado Completada",
      },
    ],
    trend: buildVisitedEstablishmentsTrend(activityRecords, activityRange),
    topAdjustmentsByEstablishment: mapTopItems(adjustmentsByEstablishment),
    recentRecords,
  };
}

async function getRuteroDashboardData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authUserId: string
): Promise<RuteroDashboardData | null> {
  const profile = await getCurrentUserProfile(authUserId);
  if (!profile) return null;

  const todayStart = startOfTodayIso();

  const [assignmentsRes, routesRes, recentRecordsRes, todayRecordsCountRes] = await Promise.all([
    supabase
      .from("user_tasks")
      .select("task_id, task_state, task:task_id(task_id, title, priority, due_to)")
      .eq("user_id", profile.userId),
    supabase
      .from("route")
      .select("route_id, nombre, day, is_active")
      .eq("assigned_user", profile.userId)
      .order("is_active", { ascending: false }),
    supabase
      .from("check_record")
      .select(
        "record_id, product_id, establishment_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name), establishment:establishment_id(name), reporter:user_id(name)"
      )
      .eq("user_id", profile.userId)
      .order("time_date", { ascending: false })
      .limit(10),
    supabase
      .from("check_record")
      .select("record_id", { count: "exact", head: true })
      .eq("user_id", profile.userId)
      .gte("time_date", todayStart),
  ]);

  const assignments = (assignmentsRes.data ?? []) as UserTaskRow[];
  const routes = (routesRes.data ?? []) as RouteRow[];
  const recentRecords = (recentRecordsRes.data ?? []) as DashboardRecordRow[];

  const tasks: RuteroDashboardTask[] = assignments.map((row) => {
    const task = takeFirst(row.task);
    return {
      taskId: row.task_id,
      title: task?.title ?? `Tarea #${row.task_id}`,
      priority: task?.priority ?? "-",
      dueTo: task?.due_to ?? null,
      state: row.task_state,
    };
  });

  const pendingTasks = tasks.filter((task) => task.state === "Pendiente").length;
  const completedTasks = tasks.filter((task) => task.state === "Completada").length;

  const overdueTaskIds = new Set<number>();
  const nowTime = Date.now();
  for (const task of tasks) {
    if (task.state === "Atrasada") {
      overdueTaskIds.add(task.taskId);
      continue;
    }

    if (task.state === "Completada" || !task.dueTo) continue;
    const dueTime = new Date(task.dueTo).getTime();
    if (!Number.isNaN(dueTime) && dueTime < nowTime) {
      overdueTaskIds.add(task.taskId);
    }
  }

  const upcomingTasks = tasks
    .filter((task) => task.state !== "Completada")
    .sort((a, b) => {
      if (!a.dueTo && !b.dueTo) return a.taskId - b.taskId;
      if (!a.dueTo) return 1;
      if (!b.dueTo) return -1;
      return new Date(a.dueTo).getTime() - new Date(b.dueTo).getTime();
    })
    .slice(0, 6);

  const alerts: string[] = [];
  if (overdueTaskIds.size > 0) {
    alerts.push(`Tienes ${overdueTaskIds.size} tarea(s) atrasada(s) que requieren atencion.`);
  }
  if (routes.length === 0) {
    alerts.push("No tienes rutas asignadas por el momento.");
  }
  if ((todayRecordsCountRes.count ?? 0) === 0) {
    alerts.push("Aun no has cargado registros hoy.");
  }

  return {
    kpis: [
      {
        label: "Tareas asignadas",
        value: String(tasks.length),
        hint: "Total vigentes",
      },
      {
        label: "Tareas pendientes",
        value: String(pendingTasks),
        hint: "Estado Pendiente",
      },
      {
        label: "Tareas atrasadas",
        value: String(overdueTaskIds.size),
        hint: "Por estado o fecha vencida",
      },
      {
        label: "Registros hoy",
        value: String(todayRecordsCountRes.count ?? 0),
        hint: "Creados en tu jornada",
      },
      {
        label: "Tareas completadas",
        value: String(completedTasks),
        hint: "Estado Completada",
      },
    ],
    upcomingTasks,
    routes,
    recentRecords,
    alerts,
  };
}

async function getVisitanteDashboardData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authUserId: string,
  range: DashboardRange
): Promise<VisitanteDashboardData> {
  const ownProfile = await supabase
    .from("user_profile")
    .select("company_id, company:company_id(name)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const companyId = ownProfile.data ? ((ownProfile.data.company_id as number | null) ?? null) : null;
  const companyData = ownProfile.data
    ? ((ownProfile.data.company as BasicRelation | BasicRelation[] | null) ?? null)
    : null;
  const companyName = Array.isArray(companyData)
    ? (companyData[0]?.name ?? null)
    : (companyData?.name ?? null);

  if (!companyId) {
    return {
      companyId: null,
      companyName,
      kpis: [
        { label: "Registros", value: "0", hint: "Sin empresa asignada" },
        { label: "Productos con ajustes", value: "0", hint: "Sin empresa asignada" },
        { label: "Establecimientos con incidencias", value: "0", hint: "Sin empresa asignada" },
        { label: "Cumplimiento evidencias", value: "0%", hint: "Sin empresa asignada" },
      ],
      adjustmentsTrend: [],
      topAdjustmentsByEstablishment: [],
      topProductsByVariation: [],
      recentRecords: [],
    };
  }

  const periodStart = startOfPeriodIso(range);
  const productsRes = await supabase
    .from("product")
    .select("product_id")
    .eq("company_id", companyId);

  const productIds = (productsRes.data ?? []).map((row) => row.product_id);

  if (productIds.length === 0) {
    return {
      companyId,
      companyName,
      kpis: [
        { label: "Registros", value: "0", hint: `Ultimos ${range} dias` },
        { label: "Productos con ajustes", value: "0", hint: "Sin productos vinculados" },
        { label: "Establecimientos con incidencias", value: "0", hint: "Sin productos vinculados" },
        { label: "Cumplimiento evidencias", value: "0%", hint: "Sin registros" },
      ],
      adjustmentsTrend: [],
      topAdjustmentsByEstablishment: [],
      topProductsByVariation: [],
      recentRecords: [],
    };
  }

  const [periodRecordsRes, recentRecordsRes] = await Promise.all([
    supabase
      .from("check_record")
      .select(
        "record_id, product_id, establishment_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name), establishment:establishment_id(name), reporter:user_id(name)"
      )
      .in("product_id", productIds)
      .gte("time_date", periodStart)
      .order("time_date", { ascending: false })
      .limit(1000),
    supabase
      .from("check_record")
      .select(
        "record_id, product_id, establishment_id, system_inventory, real_inventory, evidence_num, comments, time_date, product:product_id(product_id, sku, name), establishment:establishment_id(name), reporter:user_id(name)"
      )
      .in("product_id", productIds)
      .order("time_date", { ascending: false })
      .limit(10),
  ]);

  const periodRecords = (periodRecordsRes.data ?? []) as DashboardRecordRow[];
  const recentRecords = (recentRecordsRes.data ?? []) as DashboardRecordRow[];

  const adjustedProducts = new Set<number>();
  const adjustedEstablishments = new Set<number>();
  let recordsWithEvidence = 0;

  const adjustmentsByEstablishment = new Map<string, { label: string; value: number }>();
  const variationByProduct = new Map<string, { label: string; value: number; extra?: string }>();

  for (const record of periodRecords) {
    const delta = getInventoryDelta(record);

    if ((record.evidence_num ?? 0) > 0) {
      recordsWithEvidence += 1;
    }

    if (!delta) continue;

    if (typeof record.product_id === "number") {
      adjustedProducts.add(record.product_id);
    }

    if (typeof record.establishment_id === "number") {
      adjustedEstablishments.add(record.establishment_id);
    }

    const establishmentKey = String(record.establishment_id ?? extractEstablishmentName(record));
    const establishmentCurrent = adjustmentsByEstablishment.get(establishmentKey) ?? {
      label: extractEstablishmentName(record),
      value: 0,
    };
    establishmentCurrent.value += 1;
    adjustmentsByEstablishment.set(establishmentKey, establishmentCurrent);

    const product = takeFirst(record.product);
    const productKey = String(record.product_id ?? extractProductLabel(record));
    const variationCurrent = variationByProduct.get(productKey) ?? {
      label: extractProductLabel(record),
      value: 0,
      extra: product?.sku ? `SKU ${product.sku}` : undefined,
    };

    variationCurrent.value += Math.abs(delta);
    variationByProduct.set(productKey, variationCurrent);
  }

  const evidencePercent =
    periodRecords.length === 0 ? 0 : Math.round((recordsWithEvidence / periodRecords.length) * 100);

  return {
    companyId,
    companyName,
    kpis: [
      {
        label: "Registros de mi empresa",
        value: String(periodRecords.length),
        hint: `Ultimos ${range} dias`,
      },
      {
        label: "Productos con ajustes",
        value: String(adjustedProducts.size),
        hint: "Con diferencia de inventario",
      },
      {
        label: "Establecimientos con incidencias",
        value: String(adjustedEstablishments.size),
        hint: "Con ajustes detectados",
      },
      {
        label: "Cumplimiento evidencias",
        value: `${evidencePercent}%`,
        hint: "Registros con al menos una evidencia",
      },
    ],
    adjustmentsTrend: buildDailyTrend(periodRecords, range, (record) => (getInventoryDelta(record) ?? 0) !== 0),
    topAdjustmentsByEstablishment: mapTopItems(adjustmentsByEstablishment),
    topProductsByVariation: mapTopItems(variationByProduct),
    recentRecords,
  };
}

async function buildRouteSummaryForSelection(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  route: RouteSummaryRoute;
  establishments: RouteSummaryEstablishment[];
  productIds?: number[];
}) {
  const { supabase, route, establishments, productIds } = params;
  const baseSummary = buildRouteRealtimeSummary({
    route,
    establishments,
    records: [],
  });

  let records: RouteSummaryRecord[] = [];
  if (
    baseSummary.period.active &&
    baseSummary.period.startAt &&
    baseSummary.period.endAt &&
    establishments.length > 0
  ) {
    let recordsQuery = supabase
      .from("check_record")
      .select("establishment_id, time_date")
      .in(
        "establishment_id",
        establishments.map((item) => item.establishment_id)
      )
      .gte("time_date", baseSummary.period.startAt)
      .lt("time_date", baseSummary.period.endAt)
      .order("time_date", { ascending: false });

    if (productIds && productIds.length > 0) {
      recordsQuery = recordsQuery.in("product_id", productIds);
    }

    const { data: recordsData } = await recordsQuery;
    records = (recordsData ?? []) as RouteSummaryRecord[];
  }

  return buildRouteRealtimeSummary({
    route,
    establishments,
    records,
  });
}

async function getAdminRouteSummaryCardData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  selectedRouteIdRaw: string | undefined
): Promise<RouteSummaryCardData> {
  const { data: routesData } = await supabase
    .from("route")
    .select("route_id, nombre, day, visit_period, is_active")
    .order("is_active", { ascending: false })
    .order("nombre", { ascending: true });

  const routes = (routesData ?? []) as RouteSummaryRoute[];
  if (routes.length === 0) {
    return {
      routes: [],
      selectedRouteId: null,
      summary: null,
      emptyText: "No hay rutas configuradas para mostrar el resumen.",
    };
  }

  const selectedRouteId = parsePositiveInt(selectedRouteIdRaw) ?? routes[0].route_id;
  const selectedRoute =
    routes.find((route) => route.route_id === selectedRouteId) ?? routes[0];

  const { data: establishmentsData } = await supabase
    .from("establishment")
    .select("establishment_id, name, direction, is_active")
    .eq("route_id", selectedRoute.route_id)
    .order("establishment_id", { ascending: true });

  const establishments = (establishmentsData ?? []) as RouteSummaryEstablishment[];
  const summary = await buildRouteSummaryForSelection({
    supabase,
    route: selectedRoute,
    establishments,
  });

  return {
    routes: routes.map((route) => ({ routeId: route.route_id, name: route.nombre })),
    selectedRouteId: selectedRoute.route_id,
    summary,
    emptyText: "No hay rutas configuradas para mostrar el resumen.",
  };
}

async function getVisitanteRouteSummaryCardData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authUserId: string,
  selectedRouteIdRaw: string | undefined
): Promise<RouteSummaryCardData> {
  const ownProfile = await supabase
    .from("user_profile")
    .select("company_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const companyId = ownProfile.data?.company_id ?? null;
  if (!companyId) {
    return {
      routes: [],
      selectedRouteId: null,
      summary: null,
      emptyText: "No tienes una empresa asignada para ver el resumen de rutas.",
    };
  }

  const { data: productRows } = await supabase
    .from("product")
    .select("product_id")
    .eq("company_id", companyId);

  const productIds = (productRows ?? []).map((row) => row.product_id);
  if (productIds.length === 0) {
    return {
      routes: [],
      selectedRouteId: null,
      summary: null,
      emptyText: "Tu empresa no tiene productos activos vinculados a rutas.",
    };
  }

  const { data: relationRows } = await supabase
    .from("products_establishment")
    .select("establishment_id")
    .in("product_id", productIds);

  const visitorEstablishmentIds = Array.from(
    new Set((relationRows ?? []).map((row) => row.establishment_id))
  );

  if (visitorEstablishmentIds.length === 0) {
    return {
      routes: [],
      selectedRouteId: null,
      summary: null,
      emptyText: "No hay establecimientos relacionados con los productos de tu empresa.",
    };
  }

  const { data: establishmentsData } = await supabase
    .from("establishment")
    .select("establishment_id, name, direction, is_active, route_id")
    .in("establishment_id", visitorEstablishmentIds)
    .not("route_id", "is", null);

  const establishmentRows =
    (establishmentsData ?? []) as Array<RouteSummaryEstablishment & { route_id: number | null }>;

  const routeIds = Array.from(
    new Set(
      establishmentRows
        .map((row) => row.route_id)
        .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)
    )
  );

  if (routeIds.length === 0) {
    return {
      routes: [],
      selectedRouteId: null,
      summary: null,
      emptyText: "No hay rutas asociadas a los establecimientos de tu empresa.",
    };
  }

  const { data: routesData } = await supabase
    .from("route")
    .select("route_id, nombre, day, visit_period, is_active")
    .in("route_id", routeIds)
    .order("nombre", { ascending: true });

  const routes = (routesData ?? []) as RouteSummaryRoute[];
  if (routes.length === 0) {
    return {
      routes: [],
      selectedRouteId: null,
      summary: null,
      emptyText: "No hay rutas disponibles para tu empresa.",
    };
  }

  const selectedRouteId = parsePositiveInt(selectedRouteIdRaw) ?? routes[0].route_id;
  const selectedRoute =
    routes.find((route) => route.route_id === selectedRouteId) ?? routes[0];

  const establishments = establishmentRows
    .filter((row) => row.route_id === selectedRoute.route_id)
    .map((row) => ({
      establishment_id: row.establishment_id,
      name: row.name,
      direction: row.direction,
      is_active: row.is_active,
    }));

  const summary = await buildRouteSummaryForSelection({
    supabase,
    route: selectedRoute,
    establishments,
    productIds,
  });

  return {
    routes: routes.map((route) => ({ routeId: route.route_id, name: route.nombre })),
    selectedRouteId: selectedRoute.route_id,
    summary,
    emptyText:
      "No hay rutas con establecimientos vinculados a tu empresa para mostrar en este momento.",
  };
}

function getKpiModuleSpan(total: number, index: number) {
  if (total === 5) {
    return index < 3 ? "xl:col-span-4" : "xl:col-span-6";
  }

  if (total === 4) return "xl:col-span-6";
  if (total === 3) return "xl:col-span-4";
  if (total === 2) return "xl:col-span-6";

  return "xl:col-span-4";
}

function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
      {items.map((item, index) => (
        <article
          key={item.label}
          className={`rounded-[12px] border border-[var(--border)] bg-white p-4 ${getKpiModuleSpan(
            items.length,
            index
          )}`}
        >
          <p className="text-[12px] text-[#5A7984]">{item.label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none text-foreground">{item.value}</p>
          <p className="mt-2 text-[12px] text-[var(--muted)]">{item.hint}</p>
        </article>
      ))}
    </section>
  );
}

function formatRangeLabel(option: DashboardRange) {
  if (option === 365) return "1a";
  return `${option}d`;
}

function buildRoleHomeHref(role: AppRole, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, value);
  });

  const queryString = params.toString();
  return queryString ? `/home/${role}?${queryString}` : `/home/${role}`;
}

function RangeSwitch({
  role,
  current,
  options,
  queryKey = "range",
  preserve = {},
  label = "Lapso",
}: {
  role: AppRole;
  current: DashboardRange;
  options: readonly DashboardRange[];
  queryKey?: "range" | "adjustmentsRange" | "activityRange";
  preserve?: Record<string, string | undefined>;
  label?: string;
}) {
  if (options.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      {options.map((option) => {
        const active = option === current;
        const href = buildRoleHomeHref(role, {
          ...preserve,
          [queryKey]: String(option),
        });

        return (
          <Link
            key={option}
            href={href}
            className={[
              "rounded-full border px-3 py-1 text-[12px] font-semibold",
              active
                ? "border-[#5A7A84] bg-[#DDE2DD] text-[#0D3233]"
                : "border-[var(--border)] bg-white text-[var(--muted)]",
            ].join(" ")}
          >
            {formatRangeLabel(option)}
          </Link>
        );
      })}
    </div>
  );
}

function RankedList({ title, items, emptyText }: { title: string; items: RankedItem[]; emptyText: string }) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <article
              key={item.label}
              className="flex items-center justify-between rounded-[8px] border border-[var(--border)] px-3 py-2"
            >
              <div>
                <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                {item.extra ? <p className="text-[12px] text-[var(--muted)]">{item.extra}</p> : null}
              </div>
              <p className="text-[14px] font-semibold text-[#5A7A84]">{item.value}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TopAdjustmentsChart({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: RankedItem[];
  emptyText: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="mt-4 flex h-56 items-end gap-3 overflow-x-auto pb-2">
          {items.map((item) => {
            const ratio = maxValue === 0 ? 0 : Math.round((item.value / maxValue) * 100);
            const height = Math.max(ratio, 6);

            return (
              <article key={item.label} className="flex min-w-[88px] flex-col items-center">
                <p className="mb-2 text-[12px] font-semibold text-[#405C62]">{item.value}</p>
                <div className="relative h-40 w-full rounded-[8px] bg-[#EEF2EE]">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[8px] bg-[#5A7A84]"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-[11px] text-[var(--muted)]">{item.label}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VisitedTrendLineChart({
  title,
  points,
  emptyText,
}: {
  title: string;
  points: TrendPoint[];
  emptyText: string;
}) {
  if (points.length === 0) {
    return (
      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="mt-3 text-[13px] text-[var(--muted)]">{emptyText}</p>
      </section>
    );
  }

  const chartWidth = Math.max(points.length * 70, 520);
  const chartHeight = 220;
  const padding = { top: 18, right: 20, bottom: 36, left: 28 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(...points.map((point) => point.value), 1);

  const plottedPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (points.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (point.value / maxValue) * plotHeight;

    return { ...point, x, y };
  });

  const pathD = plottedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>

      <div className="mt-4 overflow-x-auto">
        <svg
          className="h-[220px] min-w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={title}
        >
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="#B3B5B3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="#B3B5B3"
            strokeWidth="1"
          />

          <path d={pathD} fill="none" stroke="#5A7A84" strokeWidth="2.5" />

          {plottedPoints.map((point) => (
            <g key={`${point.label}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r="4" fill="#0D3233" />
              <text
                x={point.x}
                y={point.y - 10}
                textAnchor="middle"
                fontSize="11"
                fill="#405C62"
                fontFamily="Manrope"
              >
                {point.value}
              </text>
              <text
                x={point.x}
                y={chartHeight - 12}
                textAnchor="middle"
                fontSize="11"
                fill="#8A9BA7"
                fontFamily="Manrope"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function TrendBars({ title, points, emptyText }: { title: string; points: TrendPoint[]; emptyText: string }) {
  const maxValue = Math.max(...points.map((point) => point.value), 0);

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>

      {points.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {points.map((point) => {
            const ratio = maxValue === 0 ? 0 : Math.round((point.value / maxValue) * 100);

            return (
              <article key={point.label} className="grid grid-cols-[46px_1fr_36px] items-center gap-2">
                <p className="text-[12px] text-[var(--muted)]">{point.label}</p>
                <div className="h-2.5 rounded-full bg-[#E9EDE9]">
                  <div
                    className="h-2.5 rounded-full bg-[#5A7A84]"
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                <p className="text-right text-[12px] font-semibold text-[#405C62]">{point.value}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentRecordsTable({
  title,
  records,
  emptyText,
}: {
  title: string;
  records: DashboardRecordRow[];
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      </div>

      {records.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        <>
          <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1fr_1.2fr_1.2fr_0.7fr_0.7fr_1fr] md:gap-3">
            <p>Fecha</p>
            <p>Establecimiento</p>
            <p>Producto</p>
            <p>Ajuste</p>
            <p>Evidencias</p>
            <p>Usuario</p>
          </div>

          {records.map((record) => {
            const delta = getInventoryDelta(record);
            const deltaLabel =
              delta == null ? "-" : `${delta > 0 ? "+" : ""}${delta}`;

            return (
              <article
                key={record.record_id}
                className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1fr_1.2fr_1.2fr_0.7fr_0.7fr_1fr] md:items-center md:gap-3"
              >
                <div>
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Fecha</p>
                  <p className="text-[13px] text-[#405C62]">{formatDateTime(record.time_date)}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Establecimiento</p>
                  <p className="text-[13px] text-[#405C62]">{extractEstablishmentName(record)}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Producto</p>
                  <p className="text-[13px] text-[#405C62]">{extractProductLabel(record)}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Ajuste</p>
                  <p className="text-[13px] text-[#405C62]">{deltaLabel}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Evidencias</p>
                  <p className="text-[13px] text-[#405C62]">{record.evidence_num ?? 0}</p>
                </div>

                <div className="mt-2 md:mt-0">
                  <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Usuario</p>
                  <p className="text-[13px] text-[#405C62]">{extractReporterName(record)}</p>
                </div>
              </article>
            );
          })}
        </>
      )}
    </section>
  );
}

function HeaderActions({ actions }: { actions: Array<{ label: string; href: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
        >
          {action.label}
        </Link>
      ))}
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
        >
          Cerrar sesion
        </button>
      </form>
    </div>
  );
}

export default async function RoleHomePage({ params, searchParams }: PageProps) {
  const { role: routeRole } = await params;
  if (!isAppRole(routeRole)) {
    redirect("/home");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profileRole: Awaited<ReturnType<typeof getUserRoleFromProfile>>;
  try {
    profileRole = await getUserRoleFromProfile(user.id);
  } catch {
    redirect("/login");
  }

  if (!profileRole) {
    redirect("/login");
  }

  if (routeRole !== profileRole) {
    redirect(roleHomePath(profileRole));
  }

  const cookieStore = await cookies();
  const cookieRole = cookieStore.get(APP_ROLE_COOKIE)?.value;
  if (cookieRole && cookieRole !== profileRole) {
    redirect(roleHomePath(profileRole));
  }

  const {
    range: rangeParam,
    adjustmentsRange: adjustmentsRangeParam,
    activityRange: activityRangeParam,
    routeId,
  } = await searchParams;
  const rangeOptions = getRangeOptionsForRole(profileRole);
  const defaultRange = rangeOptions[0] ?? 30;
  const range = parseRange(rangeParam, rangeOptions, defaultRange);

  const copy = ROLE_COPY[profileRole];

  if (profileRole === "admin" || profileRole === "editor") {
    const adminChartRanges = getRangeOptionsForRole(profileRole);
    const adjustmentsRange = parseRange(adjustmentsRangeParam ?? rangeParam, adminChartRanges, 30);
    const activityRange = parseRange(activityRangeParam ?? rangeParam, adminChartRanges, 30);
    const dashboard = await getAdminEditorDashboardData(supabase, adjustmentsRange, activityRange);
    const routeSummaryCard =
      profileRole === "admin" ? await getAdminRouteSummaryCardData(supabase, routeId) : null;

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Principal/Dashboard</p>
            <h1 className="text-[20px] font-semibold text-foreground">{copy.heading}</h1>
            <p className="text-[13px] text-[var(--muted)]">{copy.message}</p>
          </div>

          <HeaderActions
            actions={[
              { label: "Ir a registros", href: "/registros" },
              { label: "Ir a reportes", href: "/reportes" },
              { label: "Ir a tareas", href: "/tareas" },
            ]}
          />
        </header>

        <KpiGrid items={dashboard.kpis} />

        <section className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-2 xl:col-span-6">
            <RangeSwitch
              role={profileRole}
              current={adjustmentsRange}
              options={adminChartRanges}
              queryKey="adjustmentsRange"
              preserve={{ activityRange: String(activityRange), routeId }}
              label="Lapso ajustes"
            />
            <TopAdjustmentsChart
              title={`Establecimientos con mas ajustes (${formatRangeLabel(adjustmentsRange)})`}
              items={dashboard.topAdjustmentsByEstablishment}
              emptyText="No hay ajustes registrados en el periodo seleccionado."
            />
          </div>

          <div className="space-y-2 xl:col-span-6">
            <RangeSwitch
              role={profileRole}
              current={activityRange}
              options={adminChartRanges}
              queryKey="activityRange"
              preserve={{ adjustmentsRange: String(adjustmentsRange), routeId }}
              label="Lapso actividad"
            />
            <VisitedTrendLineChart
              title={`Tendencia de actividad (${trendGranularityLabel(
                getVisitedTrendGranularity(activityRange)
              )})`}
              points={dashboard.trend}
              emptyText="No hay establecimientos visitados en el periodo seleccionado."
            />
          </div>

          <div className="xl:col-span-12">
            <RecentRecordsTable
              title="Ultimos 10 registros"
              records={dashboard.recentRecords}
              emptyText="No hay registros recientes para mostrar."
            />
          </div>

          {routeSummaryCard ? (
            <div className="xl:col-span-12">
              <RouteRealtimeSummaryCard
                title="Resumen en tiempo real por ruta"
                description="Seguimiento del lapso activo por ruta, con establecimientos completados y pendientes."
                routes={routeSummaryCard.routes}
                selectedRouteId={routeSummaryCard.selectedRouteId ?? 0}
                summary={routeSummaryCard.summary}
                completed={routeSummaryCard.summary?.completed ?? []}
                pending={routeSummaryCard.summary?.pending ?? []}
                emptyText={routeSummaryCard.emptyText}
              />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (profileRole === "rutero") {
    const dashboard = await getRuteroDashboardData(supabase, user.id);

    if (!dashboard) {
      return (
        <p className="mx-auto w-full max-w-6xl text-[13px] font-medium text-[#9B1C1C]">
          No se encontro un perfil activo para este usuario.
        </p>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Principal/Dashboard</p>
            <h1 className="text-[20px] font-semibold text-foreground">{copy.heading}</h1>
            <p className="text-[13px] text-[var(--muted)]">{copy.message}</p>
          </div>

          <HeaderActions
            actions={[
              { label: "Ver tareas", href: "/tareas" },
              { label: "Ver rutas", href: "/rutas" },
              { label: "Crear registro", href: "/registros" },
            ]}
          />
        </header>

        <KpiGrid items={dashboard.kpis} />

        <section className="grid gap-4 xl:grid-cols-12">
          <section className="rounded-[12px] border border-[var(--border)] bg-white p-4 xl:col-span-7">
            <h2 className="text-[15px] font-semibold text-foreground">Proximas tareas</h2>
            {dashboard.upcomingTasks.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--muted)]">No tienes tareas pendientes.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {dashboard.upcomingTasks.map((task) => (
                  <article
                    key={task.taskId}
                    className="rounded-[8px] border border-[var(--border)] px-3 py-2"
                  >
                    <p className="text-[13px] font-semibold text-foreground">{task.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      Prioridad: {task.priority} | Estado: {task.state} | Vence: {formatDate(task.dueTo)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[12px] border border-[var(--border)] bg-white p-4 xl:col-span-5">
            <h2 className="text-[15px] font-semibold text-foreground">Rutas asignadas</h2>
            {dashboard.routes.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--muted)]">No tienes rutas asignadas.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {dashboard.routes.map((route) => (
                  <article
                    key={route.route_id}
                    className="flex items-center justify-between rounded-[8px] border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{route.nombre}</p>
                      <p className="text-[12px] text-[var(--muted)]">Dia: {route.day ?? "Sin dia"}</p>
                    </div>
                    <p className="text-[12px] font-semibold text-[#5A7A84]">
                      {route.is_active ? "Activa" : "Inactiva"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[12px] border border-[var(--border)] bg-white p-4 xl:col-span-4">
            <h2 className="text-[15px] font-semibold text-foreground">Alertas operativas</h2>
            {dashboard.alerts.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--muted)]">Sin alertas por ahora.</p>
            ) : (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-[#5A7984]">
                {dashboard.alerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="xl:col-span-8">
            <RecentRecordsTable
              title="Ultimos registros enviados por mi"
              records={dashboard.recentRecords}
              emptyText="No tienes registros recientes para mostrar."
            />
          </div>
        </section>
      </div>
    );
  }

  const dashboard = await getVisitanteDashboardData(supabase, user.id, range);
  const routeSummaryCard = await getVisitanteRouteSummaryCardData(supabase, user.id, routeId);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
        <div>
          <p className="text-[12px] text-[#5A7984]">Principal/Dashboard</p>
          <h1 className="text-[20px] font-semibold text-foreground">{copy.heading}</h1>
          <p className="text-[13px] text-[var(--muted)]">{copy.message}</p>
        </div>

        <HeaderActions
          actions={[
            { label: "Ver reportes", href: "/reportes" },
            { label: "Ver registros", href: "/registros" },
            { label: "Ver productos", href: "/productos" },
          ]}
        />
      </header>

      <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--muted)]">
        {dashboard.companyId
          ? `Monitoreando empresa: ${dashboard.companyName ?? "Empresa asignada"}.`
          : "No tienes una empresa asignada. Contacta al administrador para habilitar esta vista."}
      </div>

      <RangeSwitch role={profileRole} current={range} options={rangeOptions} preserve={{ routeId }} />

      <KpiGrid items={dashboard.kpis} />

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <RankedList
            title="Top establecimientos con ajustes"
            items={dashboard.topAdjustmentsByEstablishment}
            emptyText="No hay ajustes para los filtros actuales."
          />
        </div>

        <div className="xl:col-span-6">
          <TrendBars
            title="Tendencia de ajustes"
            points={dashboard.adjustmentsTrend}
            emptyText="No hay ajustes para el periodo seleccionado."
          />
        </div>

        <div className="xl:col-span-5">
          <RankedList
            title="Productos con mayor variacion"
            items={dashboard.topProductsByVariation}
            emptyText="No se detectaron variaciones en el periodo seleccionado."
          />
        </div>

        <div className="xl:col-span-7">
          <RecentRecordsTable
            title="Ultimos 10 registros de mi empresa"
            records={dashboard.recentRecords}
            emptyText="No hay registros recientes para mostrar."
          />
        </div>

        <div className="xl:col-span-12">
          <RouteRealtimeSummaryCard
            title="Resumen en tiempo real por ruta"
            description="Solo se muestran establecimientos y registros vinculados a los productos de tu empresa."
            routes={routeSummaryCard.routes}
            selectedRouteId={routeSummaryCard.selectedRouteId ?? 0}
            summary={routeSummaryCard.summary}
            completed={routeSummaryCard.summary?.completed ?? []}
            pending={routeSummaryCard.summary?.pending ?? []}
            emptyText={routeSummaryCard.emptyText}
          />
        </div>
      </section>
    </div>
  );
}




























