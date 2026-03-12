"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type EstablishmentFiltersProps = {
  initialQuery: string;
  initialStatus: "all" | "active" | "inactive";
};

export function EstablishmentFilters({
  initialQuery,
  initialStatus,
}: EstablishmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const paramsBase = useMemo(() => new URLSearchParams(), []);

  const navigateWithFilters = (nextQuery: string, nextStatus: string) => {
    const params = new URLSearchParams(paramsBase);
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    if (nextStatus === "active" || nextStatus === "inactive") {
      params.set("status", nextStatus);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      navigateWithFilters(query, status);
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[12px] bg-transparent">
      <label className="w-full max-w-[360px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Buscar establecimiento
        </span>
        <input
          type="text"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, direccion, ubicacion o ruta"
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      <label className="w-full max-w-[220px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Estado
        </span>
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | "active" | "inactive")}
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        >
          <option value="all">Todos</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </label>
    </div>
  );
}
