"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";

type CompanyOption = {
  company_id: number;
  name: string;
};

type ProductFiltersProps = {
  initialQuery: string;
  initialStatus: "all" | "active" | "inactive";
  initialCompany: string;
  companies: CompanyOption[];
  showCompanyFilter: boolean;
};

export function ProductFilters({
  initialQuery,
  initialStatus,
  initialCompany,
  companies,
  showCompanyFilter,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [companyId, setCompanyId] = useState(initialCompany);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setCompanyId(initialCompany);
  }, [initialCompany]);

  const paramsBase = useMemo(() => new URLSearchParams(), []);

  const navigateWithFilters = (nextQuery: string, nextStatus: string, nextCompanyId: string) => {
    const params = new URLSearchParams(paramsBase);
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    if (nextStatus === "active" || nextStatus === "inactive") {
      params.set("status", nextStatus);
    }

    if (showCompanyFilter && nextCompanyId) {
      params.set("company", nextCompanyId);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      navigateWithFilters(query, status, companyId);
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, companyId]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[12px] bg-transparent">
      <label className="w-full max-w-[360px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Buscar producto
        </span>
        <input
          type="text"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o SKU"
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      <label className="w-full max-w-[220px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Estado</span>
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

      {showCompanyFilter ? (
        <label className="w-full max-w-[260px]">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Empresa
          </span>
          <AdaptiveSelect
            name="company"
            value={companyId}
            onValueChange={setCompanyId}
            emptyOptionLabel="Todas"
            placeholder="Buscar empresa"
            options={companies.map((company) => ({
              value: String(company.company_id),
              label: company.name,
            }))}
            className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>
      ) : null}
    </div>
  );
}
