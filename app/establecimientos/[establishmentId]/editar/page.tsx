import { notFound } from "next/navigation";
import { EstablishmentForm } from "@/app/establecimientos/_components/establishment-form";
import { updateEstablishmentAction } from "@/app/establecimientos/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ establishmentId: string }>;
};

export default async function EditEstablishmentPage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin", "editor"]);
  const { establishmentId } = await params;
  const parsedEstablishmentId = Number(establishmentId);

  if (!parsedEstablishmentId || Number.isNaN(parsedEstablishmentId)) {
    notFound();
  }

  const [
    { data: establishment, error },
    { data: routes },
    { data: products },
    { data: selectedProductRows },
  ] = await Promise.all([
    supabase
      .from("establishment")
      .select(
        "establishment_id, name, route_id, direction, province, canton, district, lat, lng:long, is_active"
      )
      .eq("establishment_id", parsedEstablishmentId)
      .maybeSingle(),
    supabase
      .from("route")
      .select("route_id, nombre, is_active")
      .order("nombre", { ascending: true }),
    supabase
      .from("product")
      .select("product_id, sku, name, is_active, company:company_id(name)")
      .order("name", { ascending: true }),
    supabase
      .from("products_establishment")
      .select("product:product_id(product_id, sku, name, is_active, company:company_id(name))")
      .eq("establishment_id", parsedEstablishmentId),
  ]);

  if (error || !establishment) {
    notFound();
  }

  const normalizedProducts = (products ?? []).map((product) => {
    const companyData = product.company as
      | { name?: string }
      | Array<{ name?: string }>
      | null;

    const companyName = Array.isArray(companyData)
      ? companyData[0]?.name ?? null
      : companyData?.name ?? null;

    return {
      product_id: product.product_id,
      sku: product.sku,
      name: product.name,
      is_active: product.is_active,
      company_name: companyName,
    };
  });

  const initialSelectedProducts = (selectedProductRows ?? [])
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Operacion / Establecimientos</p>
        <h1 className="text-[20px] font-semibold text-foreground">Editar establecimiento</h1>
      </header>

      <EstablishmentForm
        mode="edit"
        establishment={establishment}
        action={updateEstablishmentAction}
        routeOptions={routes ?? []}
        productOptions={normalizedProducts}
        initialSelectedProducts={initialSelectedProducts}
      />
    </div>
  );
}
