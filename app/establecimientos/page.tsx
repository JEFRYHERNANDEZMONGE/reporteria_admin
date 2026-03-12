import Link from "next/link";
import { EstablishmentDeleteButton } from "@/app/establecimientos/_components/establishment-delete-button";
import { EstablishmentFilters } from "@/app/establecimientos/_components/establishment-filters";
import { EstablishmentImportPanel } from "@/app/establecimientos/_components/establishment-import-panel";
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

function buildPageHref(
  page: number,
  query: string | undefined,
  status: "all" | "active" | "inactive"
) {
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
  return queryString ? `/establecimientos?${queryString}` : "/establecimientos";
}

export default async function EstablishmentsListPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "visitante"]);
  const { q, status, page } = await searchParams;
  const currentStatus = status === "active" || status === "inactive" ? status : "all";
  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const canManage = role === "admin" || role === "editor";

  const ownProfile =
    role === "visitante"
      ? await supabase
          .from("user_profile")
          .select("company_id, company:company_id(name)")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : { data: null };

  const visitanteCompanyId =
    role === "visitante" && ownProfile.data ? (ownProfile.data.company_id as number | null) : null;
  const visitanteCompanyData =
    role === "visitante"
      ? ((ownProfile.data?.company as { name?: string } | Array<{ name?: string }> | null) ?? null)
      : null;
  const visitanteCompanyName = Array.isArray(visitanteCompanyData)
    ? visitanteCompanyData[0]?.name ?? null
    : visitanteCompanyData?.name ?? null;

  let visitorEstablishmentIds: number[] | null = null;

  if (role === "visitante") {
    if (!visitanteCompanyId) {
      visitorEstablishmentIds = [];
    } else {
      const { data: productRows } = await supabase
        .from("product")
        .select("product_id")
        .eq("company_id", visitanteCompanyId);

      const productIds = (productRows ?? []).map((row) => row.product_id);

      if (productIds.length === 0) {
        visitorEstablishmentIds = [];
      } else {
        const { data: relationRows } = await supabase
          .from("products_establishment")
          .select("establishment_id")
          .in("product_id", productIds);

        visitorEstablishmentIds = Array.from(
          new Set((relationRows ?? []).map((row) => row.establishment_id))
        );
      }
    }
  }

  let dataQuery = canManage
    ? supabase
        .from("establishment")
        .select(
          "establishment_id, name, direction, province, canton, district, route_id, is_active, route:route_id(nombre)"
        )
        .order("establishment_id", { ascending: false })
    : supabase
        .from("establishment")
        .select("establishment_id, name, direction, province, canton, district, route_id, is_active")
        .order("establishment_id", { ascending: false });

  let countQuery = supabase
    .from("establishment")
    .select("establishment_id", { count: "exact", head: true });

  if (q?.trim()) {
    const search = `%${q.trim()}%`;
    if (canManage) {
      const { data: matchedRouteRows } = await supabase
        .from("route")
        .select("route_id")
        .ilike("nombre", search);

      const matchedRouteIds = (matchedRouteRows ?? [])
        .map((row) => row.route_id)
        .filter((value): value is number => Number.isInteger(value) && value > 0);

      const routeFilter =
        matchedRouteIds.length > 0 ? `,route_id.in.(${matchedRouteIds.join(",")})` : "";

      dataQuery = dataQuery.or(
        `name.ilike.${search},direction.ilike.${search},province.ilike.${search},canton.ilike.${search},district.ilike.${search}${routeFilter}`
      );
      countQuery = countQuery.or(
        `name.ilike.${search},direction.ilike.${search},province.ilike.${search},canton.ilike.${search},district.ilike.${search}${routeFilter}`
      );
    } else {
      dataQuery = dataQuery.or(
        `name.ilike.${search},direction.ilike.${search},province.ilike.${search},canton.ilike.${search},district.ilike.${search}`
      );
      countQuery = countQuery.or(
        `name.ilike.${search},direction.ilike.${search},province.ilike.${search},canton.ilike.${search},district.ilike.${search}`
      );
    }
  }

  if (currentStatus === "active") {
    dataQuery = dataQuery.eq("is_active", true);
    countQuery = countQuery.eq("is_active", true);
  }

  if (currentStatus === "inactive") {
    dataQuery = dataQuery.eq("is_active", false);
    countQuery = countQuery.eq("is_active", false);
  }

  if (role === "visitante") {
    if (visitorEstablishmentIds && visitorEstablishmentIds.length > 0) {
      dataQuery = dataQuery.in("establishment_id", visitorEstablishmentIds);
      countQuery = countQuery.in("establishment_id", visitorEstablishmentIds);
    } else {
      dataQuery = dataQuery.eq("establishment_id", -1);
      countQuery = countQuery.eq("establishment_id", -1);
    }
  }

  const [{ data: establishments, error }, { count, error: countError }] = await Promise.all([
    dataQuery.range(from, to),
    countQuery,
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
        <div>
          <p className="text-[12px] text-[#5A7984]">Operacion / Establecimientos</p>
          <h1 className="text-[20px] font-semibold text-foreground">Establecimientos</h1>
        </div>
        {canManage ? (
          <Link
            href="/establecimientos/nueva"
            className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
          >
            Agregar establecimiento
          </Link>
        ) : null}
      </header>

      {role === "visitante" ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--muted)]">
          {visitanteCompanyId
            ? `Mostrando establecimientos con productos de tu empresa: ${visitanteCompanyName ?? "Empresa asignada"}.`
            : "No tienes una empresa asignada. Contacta al administrador."}
        </div>
      ) : null}

      {canManage ? <EstablishmentImportPanel /> : null}

      <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
        <EstablishmentFilters initialQuery={q ?? ""} initialStatus={currentStatus} />
      </div>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1.1fr_1fr_1.6fr_0.7fr_0.9fr] md:gap-3">
          <p>Nombre</p>
          <p>Ruta</p>
          <p>Direccion</p>
          <p>Estado</p>
          <p>Acciones</p>
        </div>

        {error || countError ? (
          <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
            No se pudieron cargar los establecimientos.
          </p>
        ) : null}

        {!error && !countError && (!establishments || establishments.length === 0) ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">
            No hay establecimientos para mostrar.
          </p>
        ) : null}

        {!error && !countError && establishments?.length
          ? establishments.map((item) => {
              const routeData = canManage
                ?
                    ((item as {
                      route?: { nombre?: string } | Array<{ nombre?: string }> | null;
                    }).route ?? null)
                : null;

              const routeName = canManage
                ? Array.isArray(routeData)
                  ? routeData[0]?.nombre ?? "-"
                  : routeData?.nombre ?? "-"
                : "-";

              return (
                <article
                  key={item.establishment_id}
                  className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1.1fr_1fr_1.6fr_0.7fr_0.9fr] md:items-center md:gap-3"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Nombre</p>
                    <p className="text-[13px] text-[#5A7984]">{item.name}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Ruta</p>
                    <p className="text-[13px] text-[#5A7984]">{routeName}</p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Direccion</p>
                    <p className="text-[13px] text-[#5A7984]">{item.direction || "-"}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {[item.province, item.canton, item.district].filter(Boolean).join(" / ") || "-"}
                    </p>
                  </div>

                  <div className="mt-2 md:mt-0">
                    <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Estado</p>
                    <p className="text-[13px] text-[#5A7984]">
                      {item.is_active ? "Activo" : "Inactivo"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1 text-[12px] md:mt-0">
                    {canManage ? (
                      <>
                        <Link
                          href={`/establecimientos/${item.establishment_id}/editar`}
                          className="font-semibold text-[#5A7984]"
                        >
                          Editar
                        </Link>
                        <span className="text-[#5A7984]">-</span>
                      </>
                    ) : null}

                    <Link
                      href={`/establecimientos/${item.establishment_id}`}
                      className="font-semibold text-[#5A7984]"
                    >
                      Ver mapa
                    </Link>

                    {role === "admin" ? (
                      <>
                        <span className="text-[#5A7984]">-</span>
                        <EstablishmentDeleteButton
                          establishmentId={item.establishment_id}
                          plain
                        />
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
          Mostrando {totalCount === 0 ? 0 : from + 1}-{Math.min(totalCount, to + 1)} de {" "}
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

