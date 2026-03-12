import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/require-role";
import {
  buildRouteRealtimeSummary,
  type RouteSummaryEstablishment,
  type RouteSummaryRecord,
  type RouteSummaryRoute,
} from "@/lib/routes/realtime-summary";
import { RouteSummarySelector } from "@/app/rutas/_components/route-summary-selector";

type PageProps = {
  searchParams: Promise<{
    routeId?: string;
  }>;
};

type RouteRow = RouteSummaryRoute & {
  assigned_user: number | null;
  assignee?: { name?: string } | Array<{ name?: string }> | null;
};

function parsePositiveInt(value: string | undefined) {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatDateTime(value: string | null) {
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

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatInclusiveEndDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  date.setDate(date.getDate() - 1);

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusClasses(statusKey: string) {
  if (statusKey === "completada") {
    return "border-[#B8D8C0] bg-[#ECF8EF] text-[#22603A]";
  }

  if (statusKey === "en_progreso") {
    return "border-[#F0D8A8] bg-[#FFF7E7] text-[#8A5A00]";
  }

  if (statusKey === "pendiente" || statusKey === "no_empezada") {
    return "border-[#D7DDE0] bg-[#F6F8F9] text-[#48616A]";
  }

  if (statusKey === "inactiva") {
    return "border-[#E1C5C5] bg-[#FCEEEE] text-[#8B3B3B]";
  }

  return "border-[#D7DDE0] bg-[#F6F8F9] text-[#48616A]";
}

function takeAssigneeName(
  assignee: { name?: string } | Array<{ name?: string }> | null | undefined
) {
  if (!assignee) return "-";
  if (Array.isArray(assignee)) return assignee[0]?.name ?? "-";
  return assignee.name ?? "-";
}

function SummaryList({
  title,
  description,
  items,
  emptyText,
}: {
  title: string;
  description: string;
  items: Array<{
    establishmentId: number;
    name: string;
    direction: string | null;
    isActive: boolean;
    lastRecordAt: string | null;
  }>;
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        items.map((item) => (
          <article
            key={item.establishmentId}
            className="border-t border-[var(--border)] px-4 py-3 first:border-t-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-[12px] text-[var(--muted)]">{item.direction || "-"}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-semibold text-[#5A7984]">
                  {item.isActive ? "Activo" : "Inactivo"}
                </p>
                {item.lastRecordAt ? (
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    Ultimo registro: {formatDateTime(item.lastRecordAt)}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

export default async function RouteSummaryPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "rutero"]);
  const { routeId } = await searchParams;

  const profile = role === "rutero" ? await getCurrentUserProfile(user.id) : null;
  const currentUserId = profile?.userId ?? null;

  if (role === "rutero" && !currentUserId) {
    return (
      <p className="mx-auto w-full max-w-6xl text-[13px] font-medium text-[#9B1C1C]">
        No se encontro un perfil activo para este usuario.
      </p>
    );
  }

  let routesQuery = supabase
    .from("route")
    .select("route_id, nombre, visit_period, day, is_active, assigned_user, assignee:user_profile(name)")
    .order("is_active", { ascending: false })
    .order("nombre", { ascending: true });

  if (role === "rutero" && currentUserId) {
    routesQuery = routesQuery.eq("assigned_user", currentUserId);
  }

  const { data: routes, error } = await routesQuery;

  if (error) {
    return (
      <p className="mx-auto w-full max-w-6xl text-[13px] font-medium text-[#9B1C1C]">
        No se pudo cargar el resumen de rutas.
      </p>
    );
  }

  const availableRoutes = (routes ?? []) as RouteRow[];
  if (availableRoutes.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="rounded-[12px] bg-[#DDE2DD] p-3">
          <p className="text-[12px] text-[#5A7984]">Operacion/Rutas</p>
          <h1 className="text-[20px] font-semibold text-foreground">Resumen por ruta</h1>
        </header>

        <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[13px] text-[var(--muted)]">
            No hay rutas disponibles para mostrar en este momento.
          </p>
        </section>
      </div>
    );
  }

  const selectedRouteId =
    availableRoutes.find((route) => route.route_id === parsePositiveInt(routeId))?.route_id ??
    availableRoutes[0].route_id;
  const selectedRoute = availableRoutes.find((route) => route.route_id === selectedRouteId) ?? availableRoutes[0];

  const { data: establishmentsData, error: establishmentsError } = await supabase
    .from("establishment")
    .select("establishment_id, name, direction, is_active")
    .eq("route_id", selectedRoute.route_id)
    .order("establishment_id", { ascending: true });

  if (establishmentsError) {
    return (
      <p className="mx-auto w-full max-w-6xl text-[13px] font-medium text-[#9B1C1C]">
        No se pudieron cargar los establecimientos de la ruta seleccionada.
      </p>
    );
  }

  const establishments = (establishmentsData ?? []) as RouteSummaryEstablishment[];
  const baseSummary = buildRouteRealtimeSummary({
    route: selectedRoute,
    establishments,
    records: [],
  });

  let records: RouteSummaryRecord[] = [];
  if (baseSummary.period.active && baseSummary.period.startAt && baseSummary.period.endAt && establishments.length > 0) {
    const establishmentIds = establishments.map((item) => item.establishment_id);
    const { data: recordsData } = await supabase
      .from("check_record")
      .select("establishment_id, time_date")
      .in("establishment_id", establishmentIds)
      .gte("time_date", baseSummary.period.startAt)
      .lt("time_date", baseSummary.period.endAt)
      .order("time_date", { ascending: false });

    records = (recordsData ?? []) as RouteSummaryRecord[];
  }

  const summary = buildRouteRealtimeSummary({
    route: selectedRoute,
    establishments,
    records,
  });

  const assigneeName = takeAssigneeName(selectedRoute.assignee);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Operacion/Rutas</p>
            <h1 className="text-[20px] font-semibold text-foreground">Resumen por ruta</h1>
            <p className="text-[13px] text-[var(--muted)]">
              Selecciona una ruta para revisar su avance en el lapso activo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/rutas"
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Ver rutas
            </Link>
            <Link
              href={`/rutas/${selectedRoute.route_id}`}
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Detalle de ruta
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <RouteSummarySelector
            routes={availableRoutes.map((route) => ({
              routeId: route.route_id,
              name: route.nombre,
            }))}
            selectedRouteId={selectedRoute.route_id}
          />

          <div className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] px-4 py-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Ruta seleccionada</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{selectedRoute.nombre}</p>
          </div>
        </div>
      </section>

      <section
        className={`rounded-[12px] border px-4 py-3 ${statusClasses(summary.status.key)}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]">Estado actual</p>
            <h2 className="mt-1 text-[18px] font-semibold">{summary.status.label}</h2>
            <p className="mt-1 text-[13px]">{summary.status.description}</p>
          </div>

          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]">Lapso</p>
            <p className="mt-1 text-[14px] font-semibold">
              {summary.period.dayLabel ?? "Sin dia"} /{" "}
              {summary.period.visitPeriodDays ? `${summary.period.visitPeriodDays} dia(s)` : "Sin lapso"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Responsable</p>
          <p className="mt-1 text-[16px] font-semibold text-foreground">{assigneeName}</p>
        </article>

        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Ventana actual</p>
          <p className="mt-1 text-[16px] font-semibold text-foreground">
            {summary.period.active
              ? `${formatDate(summary.period.startAt)} - ${formatInclusiveEndDate(summary.period.endAt)}`
              : "Sin lapso activo"}
          </p>
          {!summary.period.active && summary.period.nextStartAt ? (
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              Proximo inicio: {formatDate(summary.period.nextStartAt)}
            </p>
          ) : null}
        </article>

        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Establecimientos completados</p>
          <p className="mt-1 text-[30px] font-semibold leading-none text-foreground">
            {summary.completedCount}
          </p>
        </article>

        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Establecimientos pendientes</p>
          <p className="mt-1 text-[30px] font-semibold leading-none text-foreground">
            {summary.pendingCount}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Dia de ruta</p>
          <p className="mt-1 text-[14px] font-semibold text-foreground">{selectedRoute.day || "-"}</p>
        </article>

        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Lapso configurado</p>
          <p className="mt-1 text-[14px] font-semibold text-foreground">
            {selectedRoute.visit_period || "-"}
          </p>
        </article>

        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Estado de ruta</p>
          <p className="mt-1 text-[14px] font-semibold text-foreground">
            {selectedRoute.is_active ? "Activa" : "Inactiva"}
          </p>
        </article>

        <article className="rounded-[12px] border border-[var(--border)] bg-white p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Total asignados</p>
          <p className="mt-1 text-[14px] font-semibold text-foreground">
            {summary.totalEstablishments}
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SummaryList
          title="Completados"
          description="Establecimientos con al menos un registro dentro del lapso activo."
          items={summary.completed}
          emptyText="No hay establecimientos completados para esta ruta en el lapso actual."
        />

        <SummaryList
          title="Pendientes"
          description={
            summary.period.active
              ? "Establecimientos que aun no tienen registros dentro del lapso activo."
              : "Establecimientos que quedan pendientes hasta que el lapso vuelva a estar activo."
          }
          items={summary.pending}
          emptyText="No hay establecimientos pendientes para esta ruta."
        />
      </section>
    </div>
  );
}
