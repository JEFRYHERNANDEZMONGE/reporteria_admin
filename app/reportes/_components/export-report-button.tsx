"use client";

import { useMemo, useState } from "react";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";
import type { AppRole } from "@/lib/auth/roles";
import type { ReportType } from "@/lib/reports/types";

type Option = {
  id: number;
  label: string;
};

type ProductOption = Option & {
  companyId: number | null;
};

type ExportReportButtonProps = {
  role: AppRole;
  reportType: ReportType;
  reportTitle: string;
  defaultCompanyId: number | null;
  companies: Option[];
  users: Option[];
  routes: Option[];
  establishments: Option[];
  products: ProductOption[];
};

function shouldShowUser(reportType: ReportType) {
  return reportType === "eficiencia" || reportType === "auditoria" || reportType === "productividad";
}

function shouldShowRoute(reportType: ReportType) {
  return reportType === "ajustes" || reportType === "productividad_empresa";
}

function shouldShowCompany(reportType: ReportType) {
  return (
    reportType === "completo" ||
    reportType === "ajustes" ||
    reportType === "presentacion" ||
    reportType === "productividad_empresa"
  );
}

function shouldShowProduct(reportType: ReportType) {
  return reportType === "completo" || reportType === "ajustes";
}

function shouldShowEstablishment(reportType: ReportType) {
  return (
    reportType === "completo" ||
    reportType === "ajustes" ||
    reportType === "presentacion" ||
    reportType === "productividad_empresa"
  );
}

export function ExportReportButton({
  role,
  reportType,
  reportTitle,
  defaultCompanyId,
  companies,
  users,
  routes,
  establishments,
  products,
}: ExportReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"pdf" | "excel">("pdf");
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    defaultCompanyId ? String(defaultCompanyId) : ""
  );

  const showCompany = useMemo(
    () => role !== "visitante" && shouldShowCompany(reportType),
    [reportType, role]
  );
  const showUser = useMemo(
    () => role !== "visitante" && shouldShowUser(reportType),
    [reportType, role]
  );
  const showRoute = useMemo(
    () => role !== "visitante" && shouldShowRoute(reportType),
    [reportType, role]
  );
  const showProduct = useMemo(() => shouldShowProduct(reportType), [reportType]);
  const showEstablishment = useMemo(() => shouldShowEstablishment(reportType), [reportType]);

  const filteredProductOptions = useMemo(() => {
    const filtered = selectedCompanyId
      ? products.filter((p) => p.companyId === Number(selectedCompanyId))
      : products;
    return filtered.map((p) => ({ value: String(p.id), label: p.label }));
  }, [products, selectedCompanyId]);

  return (
    <>
      <div className="flex items-center gap-2">
        {reportType !== "completo" ? (
          <button
            type="button"
            onClick={() => {
              setMode("pdf");
              setSelectedCompanyId(defaultCompanyId ? String(defaultCompanyId) : "");
              setIsOpen(true);
            }}
            className="rounded-[8px] bg-foreground px-3 py-2 text-[13px] font-semibold text-white"
          >
            Exportar
          </button>
        ) : null}
        {reportType === "completo" ? (
          <button
            type="button"
            onClick={() => {
              setMode("excel");
              setSelectedCompanyId(defaultCompanyId ? String(defaultCompanyId) : "");
              setIsOpen(true);
            }}
            className="rounded-[8px] bg-foreground px-3 py-2 text-[13px] font-semibold text-white"
          >
            Exportar
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-[12px] border border-[var(--border)] bg-white p-4">
            <h3 className="text-[16px] font-semibold text-foreground">
              Exportar - {reportTitle}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Configura los parametros para generar el archivo.
            </p>

            <form
              action={mode === "excel" ? "/reportes/export-excel" : "/reportes/export"}
              method="get"
              target="_blank"
              className="mt-3 grid gap-3 md:grid-cols-2"
              onSubmit={() => {
                setTimeout(() => setIsOpen(false), 150);
              }}
            >
              <input type="hidden" name="type" value={reportType} />
              {role === "visitante" && defaultCompanyId ? (
                <input type="hidden" name="companyId" value={String(defaultCompanyId)} />
              ) : null}

              {showCompany ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Empresa
                  </span>
                  <AdaptiveSelect
                    name="companyId"
                    value={selectedCompanyId}
                    onValueChange={(value) => setSelectedCompanyId(value)}
                    emptyOptionLabel="Todas"
                    placeholder="Buscar empresa"
                    options={companies.map((option) => ({
                      value: String(option.id),
                      label: option.label,
                    }))}
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                  />
                </label>
              ) : null}

              {showUser ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Usuario
                  </span>
                  <AdaptiveSelect
                    name="userId"
                    emptyOptionLabel="Todos"
                    placeholder="Buscar usuario"
                    options={users.map((option) => ({
                      value: String(option.id),
                      label: option.label,
                    }))}
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                  />
                </label>
              ) : null}

              {showRoute ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Ruta
                  </span>
                  <AdaptiveSelect
                    name="routeId"
                    emptyOptionLabel="Todas"
                    placeholder="Buscar ruta"
                    options={routes.map((option) => ({
                      value: String(option.id),
                      label: option.label,
                    }))}
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                  />
                </label>
              ) : null}

              {showEstablishment ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Establecimiento
                  </span>
                  <AdaptiveSelect
                    name="establishmentId"
                    emptyOptionLabel="Todos"
                    placeholder="Buscar establecimiento"
                    options={establishments.map((option) => ({
                      value: String(option.id),
                      label: option.label,
                    }))}
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                  />
                </label>
              ) : null}

              {showProduct ? (
                <label>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                    Producto
                  </span>
                  <AdaptiveSelect
                    name="productId"
                    emptyOptionLabel="Todos"
                    placeholder="Buscar producto"
                    options={filteredProductOptions}
                    className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                  />
                </label>
              ) : null}

              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Desde</span>
                <input
                  type="date"
                  name="from"
                  className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Hasta</span>
                <input
                  type="date"
                  name="to"
                  className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                />
              </label>

              <div className="col-span-full mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
                >
                  Exportar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
