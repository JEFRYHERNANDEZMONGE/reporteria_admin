"use server";

import { cookies, headers } from "next/headers";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { sendMailgunMessage, type MailgunAttachment } from "@/lib/mailgun/client";
import {
  buildCompanyReportAttachmentName,
  buildCompanyReportExportPath,
  buildCompanyReportExportSearchParams,
  parseCompanyReportRequestsInput,
  parseSelectedCompanyReportEmailsInput,
  reportTitleForEmail,
  type CompanyEmailReportRequest,
} from "@/lib/reports/company-report-email";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SendCompanyReportsState = {
  error: string | null;
  success: string | null;
};

const INITIAL_STATE: SendCompanyReportsState = {
  error: null,
  success: null,
};

function parseRequestedCompanyId(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function serializeCookieHeader(entries: Awaited<ReturnType<typeof cookies>>): string {
  return entries
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
}

function resolveRequestOrigin(requestHeaders: Awaited<ReturnType<typeof headers>>): string {
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const host = forwardedHost ?? requestHeaders.get("host");

  if (!host) {
    throw new Error("No se pudo resolver el origen de la solicitud.");
  }

  return `${forwardedProto ?? "http"}://${host}`;
}

async function resolveEffectiveCompanyId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authUserId: string,
  role: "admin" | "editor" | "visitante",
  requestedCompanyId: number | null
): Promise<number | null> {
  if (role === "admin" || role === "editor") {
    return requestedCompanyId;
  }

  const { data } = await supabase
    .from("user_profile")
    .select("company_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return data?.company_id ?? null;
}

async function fetchAttachmentBuffer(params: {
  origin: string;
  cookieHeader: string;
  companyId: number;
  request: CompanyEmailReportRequest;
  index: number;
}): Promise<MailgunAttachment> {
  const { origin, cookieHeader, companyId, request, index } = params;
  const url = new URL(buildCompanyReportExportPath(request.type), origin);
  const searchParams = buildCompanyReportExportSearchParams(companyId, request);
  url.search = searchParams.toString();

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "No se pudo generar uno de los adjuntos. (REP-ADJ-01)");
  }

  const contentType =
    response.headers.get("content-type") ??
    (request.type === "completo"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf");

  return {
    filename: buildCompanyReportAttachmentName(request, index),
    contentType,
    content: await response.arrayBuffer(),
  };
}

function buildEmailText(companyName: string, requests: CompanyEmailReportRequest[]): string {
  const lines = [
    `Se adjuntan ${requests.length} reporte(s) para ${companyName}.`,
    "",
    "Detalle del envio:",
  ];

  requests.forEach((request, index) => {
    const filters = [
      request.from ? `desde ${request.from}` : null,
      request.to ? `hasta ${request.to}` : null,
      request.routeId ? `ruta ${request.routeId}` : null,
      request.productId ? `producto ${request.productId}` : null,
      request.establishmentId ? `establecimiento ${request.establishmentId}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    lines.push(
      `${index + 1}. ${reportTitleForEmail(request.type)}${filters ? ` (${filters})` : ""}`
    );
  });

  lines.push("", "Mensaje generado desde reporteria_admin.");

  return lines.join("\n");
}

export async function sendCompanyReportsAction(
  _prevState: SendCompanyReportsState = INITIAL_STATE,
  formData: FormData
): Promise<SendCompanyReportsState> {
  void _prevState;
  const parsedRequests = parseCompanyReportRequestsInput(formData.get("requestsJson"));
  if (parsedRequests.error) {
    return { error: parsedRequests.error, success: null };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Tu sesion ha expirado. Inicia sesion nuevamente.",
      success: null,
    };
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile || profile.isActive === false) {
    return { error: "No tienes permisos para enviar reportes.", success: null };
  }

  if (profile.role !== "admin" && profile.role !== "editor" && profile.role !== "visitante") {
    return { error: "No tienes permisos para enviar reportes.", success: null };
  }

  const requestedCompanyId = parseRequestedCompanyId(formData.get("companyId"));
  const effectiveCompanyId = await resolveEffectiveCompanyId(
    supabase,
    user.id,
    profile.role,
    requestedCompanyId
  );

  if (!effectiveCompanyId) {
    return {
      error:
        profile.role === "visitante"
          ? "No tienes una empresa asignada para enviar reportes."
          : "Debes seleccionar una empresa.",
      success: null,
    };
  }

  const { data: company, error: companyError } = await supabase
    .from("company")
    .select("company_id, name, report_emails")
    .eq("company_id", effectiveCompanyId)
    .maybeSingle();

  if (companyError || !company) {
    return { error: "No se encontro la empresa seleccionada.", success: null };
  }

  const reportEmails = Array.isArray(company.report_emails)
    ? company.report_emails.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (reportEmails.length === 0) {
    return {
      error: "La empresa seleccionada no tiene correos para reportes configurados.",
      success: null,
    };
  }

  const parsedSelectedEmails = parseSelectedCompanyReportEmailsInput(
    formData.get("selectedEmailsJson"),
    reportEmails
  );

  if (parsedSelectedEmails.error) {
    return {
      error: `Correos destino: ${parsedSelectedEmails.error}`,
      success: null,
    };
  }

  try {
    const requestHeaders = await headers();
    const requestCookies = await cookies();
    const origin = resolveRequestOrigin(requestHeaders);
    const cookieHeader = serializeCookieHeader(requestCookies);

    const attachments = await Promise.all(
      parsedRequests.requests.map((request, index) =>
        fetchAttachmentBuffer({
          origin,
          cookieHeader,
          companyId: effectiveCompanyId,
          request,
          index,
        })
      )
    );

    const reportNames = parsedRequests.requests.map((request) => reportTitleForEmail(request.type));
    const uniqueReportNames = Array.from(new Set(reportNames)).join(", ");

    await sendMailgunMessage({
      to: parsedSelectedEmails.emails,
      subject: `Reportes para ${company.name}: ${uniqueReportNames}`,
      text: buildEmailText(company.name, parsedRequests.requests),
      attachments,
    });

    return {
      error: null,
      success: `Se enviaron ${attachments.length} reporte(s) a ${parsedSelectedEmails.emails.join(", ")}.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudieron enviar los reportes. (REP-ENV-01)",
      success: null,
    };
  }
}
