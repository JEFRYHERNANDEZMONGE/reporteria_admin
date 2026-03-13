import { notFound } from "next/navigation";
import { CompanyForm } from "@/app/empresas/_components/company-form";
import { updateCompanyAction } from "@/app/empresas/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function EditCompanyPage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin", "editor"]);
  const { companyId } = await params;
  const parsedCompanyId = Number(companyId);

  if (!parsedCompanyId || Number.isNaN(parsedCompanyId)) {
    notFound();
  }

  const { data: company, error } = await supabase
    .from("company")
    .select("company_id, name, direction, is_active, report_emails")
    .eq("company_id", parsedCompanyId)
    .maybeSingle();

  if (error || !company) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Empresas</p>
        <h1 className="text-[20px] font-semibold text-foreground">Editar empresa</h1>
      </header>

      <CompanyForm mode="edit" company={company} action={updateCompanyAction} />
    </div>
  );
}
