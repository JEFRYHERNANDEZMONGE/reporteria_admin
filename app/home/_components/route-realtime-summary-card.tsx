import { RouteSummarySelector } from "@/app/rutas/_components/route-summary-selector";
import type { RouteRealtimeSummary } from "@/lib/routes/realtime-summary";

type RouteOption = {
  routeId: number;
  name: string;
};

type SummaryItem = {
  establishmentId: number;
  name: string;
  direction: string | null;
  lastRecordAt: string | null;
};

type RouteRealtimeSummaryCardProps = {
  title: string;
  description: string;
  routes: RouteOption[];
  selectedRouteId: number;
  summary: RouteRealtimeSummary | null;
  completed: SummaryItem[];
  pending: SummaryItem[];
  emptyText: string;
};

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

function SummaryList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: SummaryItem[];
  emptyText: string;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[#FBFCFB]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[var(--muted)]">{emptyText}</p>
      ) : (
        items.map((item) => (
          <article
            key={item.establishmentId}
            className="border-t border-[var(--border)] px-4 py-3 first:border-t-0"
          >
            <p className="text-[13px] font-semibold text-foreground">{item.name}</p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">{item.direction || "-"}</p>
            {item.lastRecordAt ? (
              <p className="mt-1 text-[12px] text-[#5A7984]">
                Registro: {formatDateTime(item.lastRecordAt)}
              </p>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}

export function RouteRealtimeSummaryCard({
  title,
  description,
  routes,
  selectedRouteId,
  summary,
  completed,
  pending,
  emptyText,
}: RouteRealtimeSummaryCardProps) {
  if (routes.length === 0 || !summary) {
    return (
      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[13px] text-[var(--muted)]">{description}</p>
        <p className="mt-4 text-[13px] text-[var(--muted)]">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{description}</p>
        </div>

        <RouteSummarySelector routes={routes} selectedRouteId={selectedRouteId} />
      </div>

      <div className={`mt-4 rounded-[10px] border px-4 py-3 ${statusClasses(summary.status.key)}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em]">Estado</p>
            <p className="mt-1 text-[18px] font-semibold">{summary.status.label}</p>
            <p className="mt-1 text-[13px]">{summary.status.description}</p>
          </div>

          <div className="text-right text-[12px]">
            {summary.period.active ? (
              <p>
                Ventana activa: {formatDate(summary.period.startAt)} -{" "}
                {formatInclusiveEndDate(summary.period.endAt)}
              </p>
            ) : summary.period.nextStartAt ? (
              <p>Proximo inicio: {formatDate(summary.period.nextStartAt)}</p>
            ) : (
              <p>{summary.period.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Completados</p>
          <p className="mt-1 text-[30px] font-semibold leading-none text-foreground">
            {summary.completedCount}
          </p>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            {summary.totalEstablishments === 0
              ? "Sin establecimientos asignados"
              : `${summary.pendingCount} pendiente(s) de ${summary.totalEstablishments}`}
          </p>
        </article>

        <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-4">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Pendientes</p>
          <p className="mt-1 text-[30px] font-semibold leading-none text-foreground">
            {summary.pendingCount}
          </p>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            {summary.completedCount} establecimiento(s) ya registraron actividad
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SummaryList
          title="Establecimientos completados"
          items={completed}
          emptyText="No hay establecimientos completados en la ventana actual."
        />
        <SummaryList
          title="Establecimientos pendientes"
          items={pending}
          emptyText="No hay establecimientos pendientes en la ventana actual."
        />
      </div>
    </section>
  );
}
