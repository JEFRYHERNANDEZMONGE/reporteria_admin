"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleFromProfile } from "@/lib/auth/profile";
import { parseCompanyReportEmailsInput } from "@/lib/company/report-emails";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CompanyFormState = {
  error: string | null;
};

export type DeleteCompanyState = {
  error: string | null;
  success: boolean;
};

type AuthorizedCompanyContext =
  | { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { error: string };

function parseIsActive(value: FormDataEntryValue | null) {
  return String(value ?? "active") === "active";
}

async function getAuthorizedCompanyClient(): Promise<AuthorizedCompanyContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (!role || (role !== "admin" && role !== "editor")) {
    return { error: "No tienes permisos para administrar empresas." };
  }

  return { supabase };
}

export async function createCompanyAction(
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const parsedReportEmails = parseCompanyReportEmailsInput(formData.get("reportEmails"));
  const reportEmails = parsedReportEmails.emails;
  const isActive = parseIsActive(formData.get("status"));

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (parsedReportEmails.error) {
    return { error: parsedReportEmails.error };
  }

  const context = await getAuthorizedCompanyClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;
  const { error } = await supabase.from("company").insert({
    name,
    direction: direction || null,
    report_emails: reportEmails,
    is_active: isActive,
  });

  if (error) {
    return { error: "No se pudo crear la empresa. Intenta nuevamente." };
  }

  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function deleteCompanyAction(
  _prevState: DeleteCompanyState,
  formData: FormData
): Promise<DeleteCompanyState> {
  const companyId = Number(formData.get("companyId"));
  const expectedName = String(formData.get("expectedName") ?? "").trim();
  const confirmationName = String(formData.get("confirmationName") ?? "").trim();

  if (!companyId || Number.isNaN(companyId)) {
    return { error: "Empresa invalida.", success: false };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Tu sesion ha expirado. Inicia sesion nuevamente.",
      success: false,
    };
  }

  const role = await getUserRoleFromProfile(user.id);
  if (role !== "admin") {
    return { error: "Solo admin puede eliminar empresas.", success: false };
  }

  const { data: company, error: companyError } = await supabase
    .from("company")
    .select("name")
    .eq("company_id", companyId)
    .maybeSingle();

  if (companyError || !company) {
    return { error: "No se encontro la empresa.", success: false };
  }

  if (company.name !== expectedName || confirmationName !== expectedName) {
    return {
      error: "El nombre ingresado no coincide con la empresa a eliminar.",
      success: false,
    };
  }

  const { error } = await supabase.from("company").delete().eq("company_id", companyId);

  if (error) {
    return {
      error:
        "No se pudo eliminar la empresa. Verifica si tiene registros relacionados.",
      success: false,
    };
  }

  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function updateCompanyAction(
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const companyId = Number(formData.get("companyId"));
  const name = String(formData.get("name") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const parsedReportEmails = parseCompanyReportEmailsInput(formData.get("reportEmails"));
  const reportEmails = parsedReportEmails.emails;
  const isActive = parseIsActive(formData.get("status"));

  if (!companyId || Number.isNaN(companyId)) {
    return { error: "Empresa invalida." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (parsedReportEmails.error) {
    return { error: parsedReportEmails.error };
  }

  const context = await getAuthorizedCompanyClient();
  if ("error" in context) {
    return { error: context.error };
  }

  const { supabase } = context;
  const { error } = await supabase
    .from("company")
    .update({
      name,
      direction: direction || null,
      report_emails: reportEmails,
      is_active: isActive,
    })
    .eq("company_id", companyId);

  if (error) {
    return { error: "No se pudo actualizar la empresa. Intenta nuevamente." };
  }

  revalidatePath("/empresas");
  redirect("/empresas");
}
