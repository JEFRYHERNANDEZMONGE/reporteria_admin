import Link from "next/link";
import { RouteDeleteButton } from "@/app/rutas/_components/route-delete-button";
import { RouteFilters } from "@/app/rutas/_components/route-filters";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 10;

function parsePage(page: string | undefined) {
  const parsed = Number(page ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function buildPageHref(page: number, query: string | undefined, status: "all" | "active" | "inactive") {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (status !== "all") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/rutas?${queryString}` : "/rutas";
}

export default async function RoutesListPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "rutero"]);
  const { q, status, page } = await searchParams;
  const canManage = role === "admin" || role === "editor";
  const currentStatus = status === "active" || status === "inactive" ? status : "all";
  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const profile = await getCurrentUserProfile(user.id);
  const currentUserId = profile?.userId ?? null;

  let dataQuery = supabase
    .from("route")
    .select("route_id, nombre, visit_period, day, is_active, assigned_user, assignee:user_profile(name)")
    .order("route_id", { ascending: false });

  let countQuery = supabase.from("route").select("route_id", { count: "exact", head: true });

  if (role === "rutero" && currentUserId) {
    dataQuery = dataQuery.eq("assigned_user", currentUserId);
    countQuery = countQuery.eq("assigned_user", currentUserId);
  }

  if (q?.trim()) {
    const search = `%${q.trim()}%`;
    dataQuery = dataQuery.ilike("nombre", search);
    countQuery = countQuery.ilike("nombre", search);
  }

  if (currentStatus === "active") {
    dataQuery = dataQuery.eq("is_active", true);
    countQuery = countQuery.eq("is_active", true);
  }

  if (currentStatus === "inactive") {
    dataQuery = dataQuery.eq("is_active", false);
    countQuery = countQuery.eq("is_active", false);
  }

  const [{ data: routes, error }, { count, error: countError }] = await Promise.all([
    dataQuery.range(from, to),
    countQuery,
  ]);

  const routeIds = (routes ?? []).map((route) => route.route_id);
  const { data: establishments } =
    routeIds.length > 0
      ? await supabase.from("establishment").select("route_id").in("route_id", routeIds)
      : { data: [] };

  const establishmentCountByRouteId = new Map<number, number>();
  (establishments ?? []).forEach((row) => {
    const current = establishmentCountByRouteId.get(row.route_id) ?? 0;
    establishmentCountByRouteId.set(row.route_id, current + 1);
  });

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Operacion/Rutas</p>
            <h1 className="text-[34px] font-semibold leading-none text-foreground">Rutas</h1>
          </div>
          {canManage ? (
            <Link
              href="/rutas/nueva"
              className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
            >
              Agregar ruta
            </Link>
          ) : null}
        </div>
      </header>

      <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
        <RouteFilters initialQuery={q ?? ""} initialStatus={currentStatus} />
      </div>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.9fr] md:gap-3">
          <p>Ruta</p>
          <p>Responsable</p>
          <p>Dia</p>
          <p>Establecimientos</p>
          <p>Estado</p>
          <p>Acciones</p>
        </div>

        {error || countError ? (
          <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
            No se pudieron cargar las rutas.
          </p>
        ) : null}

        {!error && !countError && (!routes || routes.length === 0) ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">No hay rutas para mostrar.</p>
        ) : null}

        {!error && !countError && routes?.length
          ? routes.map((route) => {
              const assigneeData = route.assignee as { name?: string } | Array<{ name?: string }> | null;
              const assigneeName = Array.isArray(assigneeData)
                ? assigneeData[0]?.name ?? "-"
                : assigneeData?.name ?? "-";

              return (
                <article
                  key={route.route_id}
                  className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.9fr] md:items-center md:gap-3"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Ruta</p>
                    <p className="text-[13px] text-[#5A7984]">{route.nombre}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                      Responsable
                    </p>
                    <p className="text-[13px] text-[#5A7984]">{assigneeName}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Dia</p>
                    <p className="text-[13px] text-[#5A7984]">{route.day || "-"}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                      Establecimientos
                    </p>
                    <p className="text-[13px] text-[#5A7984]">
                      {establishmentCountByRouteId.get(route.route_id) ?? 0}
                    </p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Estado</p>
                    <p className="text-[13px] text-[#5A7984]">
                      {route.is_active ? "Activa" : "Inactiva"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1 text-[12px] md:mt-0">
                    <Link href={`/rutas/${route.route_id}`} className="font-semibold text-[#5A7984]">
                      Ver
                    </Link>
                    {canManage ? (
                      <>
                        <span className="text-[#5A7984]">-</span>
                        <Link
                          href={`/rutas/${route.route_id}/editar`}
                          className="font-semibold text-[#5A7984]"
                        >
                          Editar
                        </Link>
                        {role === "admin" ? (
                          <>
                            <span className="text-[#5A7984]">-</span>
                            <RouteDeleteButton routeId={route.route_id} plain />
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })
          : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--muted)]">
          Mostrando {totalCount === 0 ? 0 : from + 1}-{Math.min(totalCount, to + 1)} de{" "}
          {totalCount}
        </p>

        <div className="flex items-center gap-2">
          {canGoPrev ? (
            <Link
              href={buildPageHref(currentPage - 1, q, currentStatus)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
            >
              Anterior
            </Link>
          ) : (
            <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
              Anterior
            </span>
          )}

          <span className="text-[12px] font-semibold text-[var(--muted)]">
            Pagina {Math.min(currentPage, totalPages)} de {totalPages}
          </span>

          {canGoNext ? (
            <Link
              href={buildPageHref(currentPage + 1, q, currentStatus)}
              className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
            >
              Siguiente
            </Link>
          ) : (
            <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
              Siguiente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
