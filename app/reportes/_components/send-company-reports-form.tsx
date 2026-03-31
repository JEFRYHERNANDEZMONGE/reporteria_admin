"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";
import {
  sendCompanyReportsAction,
  type SendCompanyReportsState,
} from "@/app/reportes/actions";
import type { AppRole } from "@/lib/auth/roles";

type Option = {
  id: number;
  label: string;
};

type CompanyOption = Option & {
  reportEmails: string[];
};

type DraftRequest = {
  id: string;
  type: "completo" | "ajustes";
  from: string;
  to: string;
  routeId: string;
  productId: string;
  establishmentId: string;
};

type SendCompanyReportsFormProps = {
  role: AppRole;
  companies: CompanyOption[];
  routes: Option[];
  establishments: Option[];
  products: Option[];
  defaultCompanyId: number | null;
};

const INITIAL_STATE: SendCompanyReportsState = {
  error: null,
  success: null,
};

const REPORT_TYPE_OPTIONS = [
  { value: "completo", label: "Reporte Completo" },
  { value: "ajustes", label: "Ajuste de Inventario" },
] as const;

function createDraftRequest(index: number): DraftRequest {
  return {
    id: `request-${Date.now()}-${index}`,
    type: "completo",
    from: "",
    to: "",
    routeId: "",
    productId: "",
    establishmentId: "",
  };
}

export function SendCompanyReportsForm({
  role,
  companies,
  routes,
  establishments,
  products,
  defaultCompanyId,
}: SendCompanyReportsFormProps) {
  const [state, formAction, isPending] = useActionState(sendCompanyReportsAction, INITIAL_STATE);
  useEffect(() => { if (state.error) toast.error(state.error); }, [state]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [companyId, setCompanyId] = useState(defaultCompanyId ? String(defaultCompanyId) : "");
  const [requests, setRequests] = useState<DraftRequest[]>([createDraftRequest(0)]);
  const [selectedReportEmails, setSelectedReportEmails] = useState<string[]>([]);
  const canChooseCompany = role !== "visitante";

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === companyId) ?? null,
    [companies, companyId]
  );
  const availableReportEmails = selectedCompany?.reportEmails ?? [];

  const requestsJson = useMemo(
    () =>
      JSON.stringify(
        requests.map(({ type, from, to, routeId, productId, establishmentId }) => ({
          type,
          from,
          to,
          routeId,
          productId,
          establishmentId,
        }))
      ),
    [requests]
  );
  const selectedEmailsJson = useMemo(
    () => JSON.stringify(selectedReportEmails),
    [selectedReportEmails]
  );

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        value: String(company.id),
        label: company.label,
      })),
    [companies]
  );

  const routeOptions = useMemo(
    () =>
      routes.map((route) => ({
        value: String(route.id),
        label: route.label,
      })),
    [routes]
  );

  const establishmentOptions = useMemo(
    () =>
      establishments.map((establishment) => ({
        value: String(establishment.id),
        label: establishment.label,
      })),
    [establishments]
  );

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product.id),
        label: product.label,
      })),
    [products]
  );

  const updateRequest = (requestId: string, nextValue: Partial<DraftRequest>) => {
    setRequests((current) =>
      current.map((request) => {
        if (request.id !== requestId) return request;

        const nextRequest = { ...request, ...nextValue };
        if (nextRequest.type === "completo") {
          nextRequest.routeId = "";
        }

        return nextRequest;
      })
    );
  };

  const removeRequest = (requestId: string) => {
    setRequests((current) =>
      current.length === 1 ? current : current.filter((request) => request.id !== requestId)
    );
  };

  const toggleReportEmail = (email: string) => {
    setSelectedReportEmails((current) =>
      current.includes(email) ? current.filter((value) => value !== email) : [...current, email]
    );
  };

  const handleCompanyChange = (value: string) => {
    setCompanyId(value);
    setSelectedReportEmails([]);
  };

  return (
    <details open={isExpanded} className="rounded-[12px] border border-[var(--border)] bg-white">
      <summary
        aria-expanded={isExpanded}
        onClick={(event) => {
          event.preventDefault();
          setIsExpanded((current) => !current);
        }}
        className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden"
      >
        <div>
          <h2 className="text-[16px] font-semibold text-foreground">Enviar reportes por correo</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-[var(--muted)]">
            Prepara un envio puntual para una empresa. Reporte Completo se adjunta en Excel y
            Ajuste de Inventario se adjunta en PDF.
          </p>
        </div>

        <span className="rounded-[999px] border border-[var(--border)] px-3 py-1 text-[12px] font-semibold text-[var(--muted)]">
          {isExpanded ? "Ocultar" : "Mostrar"}
        </span>
      </summary>

      <form action={formAction} className="border-t border-[var(--border)] p-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[13px] text-[var(--muted)]">
            Escoge destinatarios puntuales y combina varios reportes en un solo correo.
          </div>

          <button
            type="button"
            onClick={() => setRequests((current) => [...current, createDraftRequest(current.length)])}
            className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-foreground"
          >
            Agregar reporte
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,280px),1fr]">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Empresa
            </span>
            <AdaptiveSelect
              name={canChooseCompany ? "companySelector" : undefined}
              value={companyId}
              onValueChange={handleCompanyChange}
              disabled={!canChooseCompany}
              emptyOptionLabel={canChooseCompany ? "Seleccionar empresa" : undefined}
              placeholder="Buscar empresa"
              options={companyOptions}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <div className="rounded-[10px] border border-[var(--border)] bg-[#F7F9F7] px-3 py-2">
            <p className="text-[12px] font-semibold text-[var(--muted)]">Correos destino</p>
            {availableReportEmails.length ? (
              <div className="mt-2 space-y-2">
                <p className="text-[13px] text-foreground">Selecciona uno o varios destinatarios.</p>
                {availableReportEmails.map((email) => {
                  const isChecked = selectedReportEmails.includes(email);

                  return (
                    <label key={email} className="flex items-center gap-2 text-[13px] text-foreground">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleReportEmail(email)}
                        className="h-4 w-4 rounded border border-[var(--border)]"
                      />
                      <span>{email}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-[#9B1C1C]">
                {selectedCompany
                  ? "La empresa seleccionada no tiene correos para reportes configurados."
                  : "Selecciona una empresa para ver los destinatarios."}
              </p>
            )}
          </div>
        </div>

        <input type="hidden" name="companyId" value={companyId} readOnly />
        <input type="hidden" name="requestsJson" value={requestsJson} readOnly />
        <input type="hidden" name="selectedEmailsJson" value={selectedEmailsJson} readOnly />

        <div className="mt-4 space-y-3">
          {requests.map((request, index) => {
            const isAjustes = request.type === "ajustes";

            return (
              <div
                key={request.id}
                className="rounded-[12px] border border-[var(--border)] bg-[#FCFDFC] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-foreground">Reporte {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeRequest(request.id)}
                    disabled={requests.length === 1}
                    className="text-[12px] font-semibold text-[#9B1C1C] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                      Tipo
                    </span>
                    <select
                      value={request.type}
                      onChange={(event) =>
                        updateRequest(request.id, {
                          type: event.target.value as DraftRequest["type"],
                        })
                      }
                      className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    >
                      {REPORT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                      Desde
                    </span>
                    <input
                      type="date"
                      value={request.from}
                      onChange={(event) => updateRequest(request.id, { from: event.target.value })}
                      className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                      Hasta
                    </span>
                    <input
                      type="date"
                      value={request.to}
                      onChange={(event) => updateRequest(request.id, { to: event.target.value })}
                      className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    />
                  </label>

                  {isAjustes ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                        Ruta
                      </span>
                      <AdaptiveSelect
                        value={request.routeId}
                        onValueChange={(value) => updateRequest(request.id, { routeId: value })}
                        emptyOptionLabel="Todas"
                        placeholder="Buscar ruta"
                        options={routeOptions}
                        className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                      Producto
                    </span>
                    <AdaptiveSelect
                      value={request.productId}
                      onValueChange={(value) => updateRequest(request.id, { productId: value })}
                      emptyOptionLabel="Todos"
                      placeholder="Buscar producto"
                      options={productOptions}
                      className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                      Establecimiento
                    </span>
                    <AdaptiveSelect
                      value={request.establishmentId}
                      onValueChange={(value) =>
                        updateRequest(request.id, { establishmentId: value })
                      }
                      emptyOptionLabel="Todos"
                      placeholder="Buscar establecimiento"
                      options={establishmentOptions}
                      className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={isPending || !selectedCompany || selectedReportEmails.length === 0}
            className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Enviando..." : "Enviar reportes"}
          </button>
        </div>

        {state.error ? (
          <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mt-3 text-[13px] font-medium text-[#166534]">{state.success}</p>
        ) : null}
      </form>
    </details>
  );
}
