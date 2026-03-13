"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";
import type { RouteFormState } from "@/app/rutas/actions";
import { SearchableCombobox } from "@/app/_components/searchable-combobox";

type RouteRecord = {
  route_id: number;
  nombre: string;
  visit_period: string | null;
  day: string | null;
  assigned_user: number | null;
  is_active: boolean;
};

type RuteroOption = {
  user_id: number;
  name: string;
};

type EstablishmentOption = {
  establishment_id: number;
  name: string;
  direction: string | null;
  province: string | null;
  canton: string | null;
};

type RouteFormProps = {
  mode: "create" | "edit";
  route?: RouteRecord;
  dayOptions: string[];
  ruteroOptions: RuteroOption[];
  availableEstablishments: EstablishmentOption[];
  initialAssignedEstablishments?: EstablishmentOption[];
  action: (
    prevState: RouteFormState,
    formData: FormData,
  ) => Promise<RouteFormState>;
};

const INITIAL_STATE: RouteFormState = { error: null };

function buildLocationOptions(values: Array<string | null>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  )
    .sort((left, right) => left.localeCompare(right, "es"))
    .map((value) => ({
      value,
      label: value,
    }));
}

export function RouteForm({
  mode,
  route,
  dayOptions,
  ruteroOptions,
  availableEstablishments,
  initialAssignedEstablishments = [],
  action,
}: RouteFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedEstablishments, setSelectedEstablishments] = useState<
    EstablishmentOption[]
  >(initialAssignedEstablishments);
  const [provinceFilter, setProvinceFilter] = useState("");
  const [cantonFilter, setCantonFilter] = useState("");

  const establishmentPool = useMemo(() => {
    const byId = new Map<number, EstablishmentOption>();

    availableEstablishments.forEach((item) => {
      byId.set(item.establishment_id, item);
    });

    initialAssignedEstablishments.forEach((item) => {
      if (!byId.has(item.establishment_id)) {
        byId.set(item.establishment_id, item);
      }
    });

    return Array.from(byId.values());
  }, [availableEstablishments, initialAssignedEstablishments]);

  const availableWithoutSelection = useMemo(() => {
    const selectedIds = new Set(
      selectedEstablishments.map((item) => item.establishment_id),
    );

    return establishmentPool.filter((item) => !selectedIds.has(item.establishment_id));
  }, [establishmentPool, selectedEstablishments]);

  const provinceOptions = useMemo(
    () => buildLocationOptions(availableWithoutSelection.map((item) => item.province)),
    [availableWithoutSelection],
  );

  const cantonOptions = useMemo(() => {
    const scopedEstablishments = provinceFilter
      ? availableWithoutSelection.filter((item) => item.province === provinceFilter)
      : availableWithoutSelection;

    return buildLocationOptions(scopedEstablishments.map((item) => item.canton));
  }, [availableWithoutSelection, provinceFilter]);

  const effectiveCantonFilter = cantonOptions.some(
    (option) => option.value === cantonFilter,
  )
    ? cantonFilter
    : "";

  const availableToAdd = useMemo(() => {
    return availableWithoutSelection.filter((item) => {
      if (provinceFilter && item.province !== provinceFilter) {
        return false;
      }

      if (effectiveCantonFilter && item.canton !== effectiveCantonFilter) {
        return false;
      }

      return true;
    });
  }, [availableWithoutSelection, effectiveCantonFilter, provinceFilter]);

  const addEstablishment = (establishment: EstablishmentOption) => {
    setSelectedEstablishments((prev) => {
      if (
        prev.some(
          (item) => item.establishment_id === establishment.establishment_id,
        )
      ) {
        return prev;
      }

      return [...prev, establishment];
    });

  };

  const removeEstablishment = (establishmentId: number) => {
    setSelectedEstablishments((prev) =>
      prev.filter((item) => item.establishment_id !== establishmentId),
    );
  };

  return (
    <form action={formAction} className="space-y-3">
      {mode === "edit" ? (
        <input type="hidden" name="routeId" value={route?.route_id} />
      ) : null}

      {selectedEstablishments.map((establishment) => (
        <input
          key={establishment.establishment_id}
          type="hidden"
          name="establishmentIds"
          value={establishment.establishment_id}
        />
      ))}

      <input
        type="hidden"
        name="status"
        value={route?.is_active === false ? "inactive" : "active"}
      />

      <section className="rounded-[12px] border border-[var(--border)] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.55fr_0.9fr_1fr]">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre de ruta
            </span>
            <input
              name="nombre"
              defaultValue={route?.nombre ?? ""}
              placeholder="Ruta Norte"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Lapso de visita
            </span>
            <input
              name="visitPeriod"
              defaultValue={route?.visit_period ?? ""}
              placeholder="7"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Dia de ruta
            </span>
            <AdaptiveSelect
              name="day"
              defaultValue={route?.day ?? ""}
              emptyOptionLabel="Sin dia asignado"
              placeholder="Buscar dia"
              options={dayOptions.map((day) => ({
                value: day,
                label: day,
              }))}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[14px] font-semibold text-foreground">
            Asignar usuario
          </p>

          <label className="block max-w-[360px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Usuario asignado
            </span>
            <AdaptiveSelect
              name="assignedUserId"
              defaultValue={
                route?.assigned_user ? String(route.assigned_user) : ""
              }
              emptyOptionLabel="Sin asignar"
              placeholder="Buscar usuario"
              options={ruteroOptions.map((rutero) => ({
                value: String(rutero.user_id),
                label: rutero.name,
              }))}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
        <div className="bg-[#5A7A84] p-3">
          <p className="text-[16px] font-semibold text-white">Establecimientos</p>

          <div className="mt-2 grid gap-2 lg:grid-cols-[0.9fr_0.9fr_1.6fr]">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
                Provincia
              </span>

              <AdaptiveSelect
                name="provinceFilter"
                value={provinceFilter}
                onValueChange={(value) => {
                  setProvinceFilter(value);
                  setCantonFilter("");
                }}
                emptyOptionLabel="Todas las provincias"
                placeholder="Filtrar provincia"
                options={provinceOptions}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
                Canton
              </span>

              <AdaptiveSelect
                name="cantonFilter"
                value={effectiveCantonFilter}
                onValueChange={setCantonFilter}
                emptyOptionLabel="Todos los cantones"
                placeholder="Filtrar canton"
                options={cantonOptions}
                disabled={cantonOptions.length === 0}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
                Agregar establecimiento
              </span>

              <div className="rounded-[8px] border border-[var(--border)] bg-white p-2">
                <SearchableCombobox
                  items={availableToAdd}
                  getItemId={(establishment) => establishment.establishment_id}
                  getItemLabel={(establishment) => establishment.name}
                  getItemKeywords={(establishment) =>
                    [
                      establishment.direction,
                      establishment.province,
                      establishment.canton,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                  placeholder="Buscar por nombre, direccion o ubicacion"
                  emptyMessage="Sin resultados disponibles"
                  onSelect={addEstablishment}
                />
              </div>
            </label>
          </div>
        </div>

        <div className="p-3">
          {selectedEstablishments.length === 0 ? (
            <p className="text-[12px] text-[var(--muted)]">
              No hay establecimientos agregados a la ruta.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {selectedEstablishments.map((establishment, index) => (
                <div
                  key={establishment.establishment_id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-4 text-[13px] text-[#5A7984]">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-[#5A7984]">
                        {establishment.name}
                      </p>
                      <p className="truncate text-[12px] text-[var(--muted)]">
                        {establishment.direction || "-"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeEstablishment(establishment.establishment_id)
                    }
                    className="flex h-6 w-6 items-center justify-center text-[16px] leading-none text-[var(--muted)]"
                    aria-label={`Quitar ${establishment.name}`}
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
          href="/rutas"
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
        <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
