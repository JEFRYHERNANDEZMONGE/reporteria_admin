import { parsePositiveInt, pdfName, xlsxName } from "@/lib/reports/export-core";

export const COMPANY_EMAIL_REPORT_TYPES = ["completo", "ajustes"] as const;

export type CompanyEmailReportType = (typeof COMPANY_EMAIL_REPORT_TYPES)[number];

export type CompanyEmailReportRequest = {
  type: CompanyEmailReportType;
  from: string | null;
  to: string | null;
  routeId: number | null;
  productId: number | null;
  establishmentId: number | null;
};

type ParsedSelectedCompanyReportEmails = {
  emails: string[];
  error: string | null;
};

type ParsedCompanyReportRequests = {
  requests: CompanyEmailReportRequest[];
  error: string | null;
};

type RawCompanyReportRequest = {
  type?: unknown;
  from?: unknown;
  to?: unknown;
  routeId?: unknown;
  productId?: unknown;
  establishmentId?: unknown;
};

function isCompanyEmailReportType(value: unknown): value is CompanyEmailReportType {
  return COMPANY_EMAIL_REPORT_TYPES.some((type) => type === value);
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") return null;
  return parsePositiveInt(value.trim());
}

function attachmentBaseName(request: CompanyEmailReportRequest, index: number): string {
  const from = request.from ?? "sin-desde";
  const to = request.to ?? "sin-hasta";
  return `${request.type}_${index + 1}_${from}_${to}`.replace(/[^\w-]/g, "_");
}

export function reportTitleForEmail(type: CompanyEmailReportType): string {
  if (type === "completo") return "Reporte Completo";
  return "Ajuste de Inventario";
}

export function parseCompanyReportRequestsInput(
  value: FormDataEntryValue | string | null
): ParsedCompanyReportRequests {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { requests: [], error: "Debes agregar al menos un reporte para enviar." };
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(raw);
  } catch {
    return { requests: [], error: "La configuracion de reportes no es valida." };
  }

  if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
    return { requests: [], error: "Debes agregar al menos un reporte para enviar." };
  }

  const requests: CompanyEmailReportRequest[] = [];

  for (const item of parsedValue) {
    if (!item || typeof item !== "object") {
      return { requests: [], error: "La configuracion de reportes no es valida." };
    }

    const rawRequest = item as RawCompanyReportRequest;
    if (!isCompanyEmailReportType(rawRequest.type)) {
      return {
        requests: [],
        error: `El tipo de reporte ${String(rawRequest.type ?? "")} no esta permitido para envio por correo.`,
      };
    }

    const request: CompanyEmailReportRequest = {
      type: rawRequest.type,
      from: normalizeDate(rawRequest.from),
      to: normalizeDate(rawRequest.to),
      routeId: normalizeId(rawRequest.routeId),
      productId: normalizeId(rawRequest.productId),
      establishmentId: normalizeId(rawRequest.establishmentId),
    };

    if (request.type === "completo" && request.routeId) {
      return {
        requests: [],
        error: "El filtro routeId solo esta disponible para solicitudes de tipo ajustes.",
      };
    }

    requests.push(request);
  }

  return { requests, error: null };
}

export function parseSelectedCompanyReportEmailsInput(
  value: FormDataEntryValue | string | null,
  availableEmails: string[]
): ParsedSelectedCompanyReportEmails {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { emails: [], error: "Debes seleccionar al menos un correo destino." };
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(raw);
  } catch {
    return { emails: [], error: "Correos destino invalidos." };
  }

  if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
    return { emails: [], error: "Debes seleccionar al menos un correo destino." };
  }

  const availableEmailSet = new Set(
    availableEmails
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase())
  );

  const emails = Array.from(
    new Set(
      parsedValue
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (emails.length === 0) {
    return { emails: [], error: "Debes seleccionar al menos un correo destino." };
  }

  const invalidEmails = emails.filter((email) => !availableEmailSet.has(email));
  if (invalidEmails.length > 0) {
    return {
      emails: [],
      error: `Correos destino invalidos: ${invalidEmails.join(", ")}.`,
    };
  }

  return { emails, error: null };
}

export function buildCompanyReportExportPath(type: CompanyEmailReportType): string {
  return type === "completo" ? "/reportes/export-excel" : "/reportes/export";
}

export function buildCompanyReportExportSearchParams(
  companyId: number,
  request: CompanyEmailReportRequest
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("type", request.type);
  params.set("companyId", String(companyId));

  if (request.from) params.set("from", request.from);
  if (request.to) params.set("to", request.to);
  if (request.routeId) params.set("routeId", String(request.routeId));
  if (request.productId) params.set("productId", String(request.productId));
  if (request.establishmentId) {
    params.set("establishmentId", String(request.establishmentId));
  }

  return params;
}

export function buildCompanyReportAttachmentName(
  request: CompanyEmailReportRequest,
  index: number
): string {
  const baseName = attachmentBaseName(request, index);
  if (request.type === "completo") {
    return xlsxName("completo").replace("reporte_completo", baseName);
  }

  return pdfName("ajustes").replace("reporte_ajustes", baseName);
}
