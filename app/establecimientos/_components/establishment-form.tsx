"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { EstablishmentFormState } from "@/app/establecimientos/actions";
import { SearchableCombobox } from "@/app/_components/searchable-combobox";

type EstablishmentRecord = {
  establishment_id: number;
  name: string;
  route_id: number | null;
  direction: string | null;
  province: string | null;
  canton: string | null;
  district: string | null;
  lat: number | string | null;
  lng: number | string | null;
  is_active: boolean;
};

type RouteOption = {
  route_id: number;
  nombre: string;
  is_active: boolean;
};

type ProductOption = {
  product_id: number;
  sku: string;
  name: string;
  company_name: string | null;
  is_active: boolean;
};

type EstablishmentFormProps = {
  mode: "create" | "edit";
  establishment?: EstablishmentRecord;
  routeOptions: RouteOption[];
  productOptions: ProductOption[];
  initialSelectedProducts?: ProductOption[];
  action: (
    prevState: EstablishmentFormState,
    formData: FormData
  ) => Promise<EstablishmentFormState>;
};

const INITIAL_STATE: EstablishmentFormState = { error: null };

function toInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return String(parsed);
}

export function EstablishmentForm({
  mode,
  establishment,
  routeOptions,
  productOptions,
  initialSelectedProducts = [],
  action,
}: EstablishmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedProducts, setSelectedProducts] =
    useState<ProductOption[]>(initialSelectedProducts);

  const productPool = useMemo(() => {
    const byId = new Map<number, ProductOption>();

    productOptions.forEach((item) => {
      byId.set(item.product_id, item);
    });

    initialSelectedProducts.forEach((item) => {
      if (!byId.has(item.product_id)) {
        byId.set(item.product_id, item);
      }
    });

    return Array.from(byId.values());
  }, [initialSelectedProducts, productOptions]);

  const availableProducts = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map((item) => item.product_id));
    return productPool.filter((item) => !selectedIds.has(item.product_id));
  }, [productPool, selectedProducts]);

  const addProduct = (product: ProductOption) => {
    setSelectedProducts((prev) => {
      if (prev.some((item) => item.product_id === product.product_id)) {
        return prev;
      }

      return [...prev, product];
    });

  };

  const removeProduct = (productId: number) => {
    setSelectedProducts((prev) => prev.filter((item) => item.product_id !== productId));
  };

  return (
    <form action={formAction} className="space-y-3">
      {mode === "edit" ? (
        <input
          type="hidden"
          name="establishmentId"
          value={establishment?.establishment_id}
        />
      ) : null}

      {selectedProducts.map((product) => (
        <input
          key={product.product_id}
          type="hidden"
          name="productIds"
          value={product.product_id}
        />
      ))}

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre
            </span>
            <input
              name="name"
              defaultValue={establishment?.name ?? ""}
              placeholder="Nombre del establecimiento"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Ruta
            </span>
            <select
              name="routeId"
              defaultValue={establishment?.route_id ? String(establishment.route_id) : ""}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="">Sin ruta asignada</option>
              {routeOptions.map((route) => (
                <option key={route.route_id} value={route.route_id}>
                  {route.nombre}
                  {route.is_active ? "" : " (Inactiva)"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Direccion
            </span>
            <input
              name="direction"
              defaultValue={establishment?.direction ?? ""}
              placeholder="Direccion detallada"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Provincia
              </span>
              <input
                name="province"
                defaultValue={establishment?.province ?? ""}
                placeholder="Provincia"
                required
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Canton
              </span>
              <input
                name="canton"
                defaultValue={establishment?.canton ?? ""}
                placeholder="Canton"
                required
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Distrito
              </span>
              <input
                name="district"
                defaultValue={establishment?.district ?? ""}
                placeholder="Distrito"
                required
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Latitud
              </span>
              <input
                name="lat"
                inputMode="decimal"
                defaultValue={toInputValue(establishment?.lat)}
                placeholder="19.4326"
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Longitud
              </span>
              <input
                name="lng"
                inputMode="decimal"
                defaultValue={toInputValue(establishment?.lng)}
                placeholder="-99.1332"
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Estado
              </span>
              <select
                name="status"
                defaultValue={establishment?.is_active === false ? "inactive" : "active"}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="bg-[#5A7A84] p-3">
          <p className="text-[16px] font-semibold text-white">Productos</p>

          <label className="mt-2 block max-w-[360px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
              Agregar producto
            </span>

            <div className="rounded-[8px] border border-[var(--border)] bg-white p-2">
              <SearchableCombobox
                items={availableProducts}
                getItemId={(product) => product.product_id}
                getItemLabel={(product) => `${product.sku} - ${product.name}`}
                getItemKeywords={(product) => product.company_name ?? ""}
                placeholder="SKU o nombre"
                emptyMessage="Sin resultados disponibles"
                onSelect={addProduct}
              />
            </div>
          </label>
        </div>

        <div className="p-3">
          {selectedProducts.length === 0 ? (
            <p className="text-[12px] text-[var(--muted)]">
              No hay productos asociados al establecimiento.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {selectedProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[#5A7984]">
                      {product.sku} - {product.name}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {product.company_name ?? "Sin empresa"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeProduct(product.product_id)}
                    className="flex h-6 w-6 items-center justify-center text-[16px] leading-none text-[var(--muted)]"
                    aria-label={`Quitar ${product.name}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/establecimientos"
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

      {state.error ? (
        <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p>
      ) : null}
    </form>
  );
}
