"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";

type CompanyOption = {
  company_id: number;
  name: string;
};

type UserOption = {
  user_id: number;
  name: string;
};

type ReportFiltersProps = {
  initialQuery: string;
  initialCompany: string;
  initialUser: string;
  initialDateFrom: string;
  initialDateTo: string;
  companies: CompanyOption[];
  users: UserOption[];
  showCompanyFilter: boolean;
  showUserFilter: boolean;
};

export function ReportFilters({
  initialQuery,
  initialCompany,
  initialUser,
  initialDateFrom,
  initialDateTo,
  companies,
  users,
  showCompanyFilter,
  showUserFilter,
}: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [companyId, setCompanyId] = useState(initialCompany);
  const [userId, setUserId] = useState(initialUser);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCompanyId(initialCompany);
  }, [initialCompany]);

  useEffect(() => {
    setUserId(initialUser);
  }, [initialUser]);

  useEffect(() => {
    setDateFrom(initialDateFrom);
  }, [initialDateFrom]);

  useEffect(() => {
    setDateTo(initialDateTo);
  }, [initialDateTo]);

  const paramsBase = useMemo(() => new URLSearchParams(), []);

  const navigateWithFilters = (
    nextQuery: string,
    nextCompanyId: string,
    nextUserId: string,
    nextDateFrom: string,
    nextDateTo: string
  ) => {
    const params = new URLSearchParams(paramsBase);
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    if (showCompanyFilter && nextCompanyId) {
      params.set("company", nextCompanyId);
    }

    if (showUserFilter && nextUserId) {
      params.set("user", nextUserId);
    }

    if (nextDateFrom) {
      params.set("from", nextDateFrom);
    }

    if (nextDateTo) {
      params.set("to", nextDateTo);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      navigateWithFilters(query, companyId, userId, dateFrom, dateTo);
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, companyId, userId, dateFrom, dateTo]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[12px] bg-transparent">
      <label className="w-full max-w-[320px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
          Buscar reporte
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Producto, establecimiento o comentario"
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      {showCompanyFilter ? (
        <label className="w-full max-w-[220px]">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Empresa</span>
          <AdaptiveSelect
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

      {showUserFilter ? (
        <label className="w-full max-w-[220px]">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Usuario</span>
          <AdaptiveSelect
            value={userId}
            onValueChange={setUserId}
            emptyOptionLabel="Todos"
            placeholder="Buscar usuario"
            options={users.map((user) => ({
              value: String(user.user_id),
              label: user.name,
            }))}
            className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>
      ) : null}

      <label className="w-full max-w-[170px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Desde</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      <label className="w-full max-w-[170px]">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Hasta</span>
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>
    </div>
  );
}
