"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";
import type { ProductFormState } from "@/app/productos/actions";

type Product = {
  product_id: number;
  sku: string;
  name: string;
  company_id: number;
  is_active: boolean;
};

type CompanyOption = {
  company_id: number;
  name: string;
  is_active: boolean;
};

type ProductFormProps = {
  mode: "create" | "edit";
  product?: Product;
  companies: CompanyOption[];
  action: (
    prevState: ProductFormState,
    formData: FormData
  ) => Promise<ProductFormState>;
};

const INITIAL_STATE: ProductFormState = { error: null };

export function ProductForm({ mode, product, companies, action }: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  useEffect(() => { if (state.error) toast.error(state.error); }, [state]);

  return (
    <form action={formAction} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      {mode === "edit" ? <input type="hidden" name="productId" value={product?.product_id} /> : null}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">SKU</span>
            <input
              name="sku"
              defaultValue={product?.sku ?? ""}
              placeholder="SKU-001"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre
            </span>
            <input
              name="name"
              defaultValue={product?.name ?? ""}
              placeholder="Nombre del producto"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Empresa
            </span>
            <AdaptiveSelect
              name="companyId"
              defaultValue={product?.company_id ? String(product.company_id) : ""}
              required
              emptyOptionLabel="Seleccionar empresa"
              placeholder="Buscar empresa"
              options={companies.map((company) => ({
                value: String(company.company_id),
                label: `${company.name}${company.is_active ? "" : " (Inactiva)"}`,
              }))}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block max-w-[260px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Estado
            </span>
            <select
              name="status"
              defaultValue={product?.is_active === false ? "inactive" : "active"}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/productos"
          className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {state.error ? <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p> : null}
    </form>
  );
}
