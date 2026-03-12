import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteMap } from "@/app/rutas/_components/route-map";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ establishmentId: string }>;
};

export default async function EstablishmentDetailPage({ params }: PageProps) {
  const { supabase, role } = await requireRole(["admin", "editor", "visitante"]);
  const { establishmentId } = await params;
  const parsedEstablishmentId = Number(establishmentId);
  const canManage = role === "admin" || role === "editor";

  if (!parsedEstablishmentId || Number.isNaN(parsedEstablishmentId)) {
    notFound();
  }

  const establishmentQuery = canManage
    ? supabase
        .from("establishment")
        .select(
          "establishment_id, name, direction, province, canton, district, lat, lng:long, route_id, is_active, route:route_id(nombre)"
        )
        .eq("establishment_id", parsedEstablishmentId)
    : supabase
        .from("establishment")
        .select("establishment_id, name, direction, province, canton, district, lat, lng:long, route_id, is_active")
        .eq("establishment_id", parsedEstablishmentId);

  const { data: establishment, error } = await establishmentQuery.maybeSingle();

  if (error || !establishment) {
    notFound();
  }

  const routeData = canManage
    ?
        ((establishment as {
          route?: { nombre?: string } | Array<{ nombre?: string }> | null;
        }).route ?? null)
    : null;

  const routeName = canManage
    ? Array.isArray(routeData)
      ? routeData[0]?.nombre ?? "-"
      : routeData?.nombre ?? "-"
    : "-";

  const { data: productRows } = await supabase
    .from("products_establishment")
    .select("product:product_id(product_id, sku, name, is_active, company:company_id(name))")
    .eq("establishment_id", parsedEstablishmentId);

  const products = (productRows ?? [])
    .map((row) => {
      const productData = row.product as
        | {
            product_id?: number;
            sku?: string;
            name?: string;
            is_active?: boolean;
            company?: { name?: string } | Array<{ name?: string }> | null;
          }
        | Array<{
            product_id?: number;
            sku?: string;
            name?: string;
            is_active?: boolean;
            company?: { name?: string } | Array<{ name?: string }> | null;
          }>
        | null;

      const product = Array.isArray(productData) ? productData[0] : productData;
      if (!product?.product_id || !product.sku || !product.name) return null;

      const companyData = product.company ?? null;
      const companyName = Array.isArray(companyData)
        ? companyData[0]?.name ?? null
        : companyData?.name ?? null;

      return {
        product_id: product.product_id,
        sku: product.sku,
        name: product.name,
        is_active: product.is_active !== false,
        company_name: companyName,
      };
    })
    .filter((value): value is {
      product_id: number;
      sku: string;
      name: string;
      is_active: boolean;
      company_name: string | null;
    } => value !== null);

  const parsedLat =
    typeof establishment.lat === "number"
      ? establishment.lat
      : typeof establishment.lat === "string"
        ? Number(establishment.lat)
        : null;

  const parsedLng =
    typeof establishment.lng === "number"
      ? establishment.lng
      : typeof establishment.lng === "string"
        ? Number(establishment.lng)
        : null;

  const mapPoints = [
    {
      establishmentId: establishment.establishment_id,
      name: establishment.name,
      lat: typeof parsedLat === "number" && Number.isFinite(parsedLat) ? parsedLat : null,
      lng: typeof parsedLng === "number" && Number.isFinite(parsedLng) ? parsedLng : null,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#5A7984]">Operacion / Establecimientos</p>
            <h1 className="text-[20px] font-semibold text-foreground">{establishment.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/establecimientos"
              className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Volver
            </Link>
            {canManage ? (
              <Link
                href={`/establecimientos/${establishment.establishment_id}/editar`}
                className="rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-semibold text-foreground"
              >
                Editar
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <p className="text-[16px] font-semibold text-foreground">Mapa</p>
        <div className="mt-3">
          <RouteMap points={mapPoints} />
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Ruta</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">{routeName}</p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Direccion</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {establishment.direction || "-"}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Provincia / Canton / Distrito</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {[establishment.province, establishment.canton, establishment.district]
                .filter(Boolean)
                .join(" / ") || "-"}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Latitud / Longitud</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {mapPoints[0].lat !== null && mapPoints[0].lng !== null
                ? `${mapPoints[0].lat}, ${mapPoints[0].lng}`
                : "-"}
            </p>
          </article>
          <article className="rounded-[10px] border border-[var(--border)] bg-[#F8FAF8] p-3">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Estado</p>
            <p className="mt-1 text-[14px] font-semibold text-foreground">
              {establishment.is_active ? "Activo" : "Inactivo"}
            </p>
          </article>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[0.9fr_1.4fr_1fr_0.7fr] md:gap-3">
          <p>SKU</p>
          <p>Producto</p>
          <p>Empresa</p>
          <p>Estado</p>
        </div>

        {products.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[var(--muted)]">
            Este establecimiento no tiene productos asociados.
          </p>
        ) : (
          products.map((product) => (
            <article
              key={product.product_id}
              className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[0.9fr_1.4fr_1fr_0.7fr] md:items-center md:gap-3"
            >
              <div>
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">SKU</p>
                <p className="text-[13px] text-[#5A7984]">{product.sku}</p>
              </div>
              <div className="mt-2 md:mt-0">
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Producto</p>
                <p className="text-[13px] text-[#5A7984]">{product.name}</p>
              </div>
              <div className="mt-2 md:mt-0">
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Empresa</p>
                <p className="text-[13px] text-[#5A7984]">{product.company_name ?? "-"}</p>
              </div>
              <div className="mt-2 md:mt-0">
                <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">Estado</p>
                <p className="text-[13px] text-[#5A7984]">
                  {product.is_active ? "Activo" : "Inactivo"}
                </p>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
