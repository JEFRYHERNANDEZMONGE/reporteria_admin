"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CompanyFormState } from "@/app/empresas/actions";

type Company = {
  company_id: number;
  name: string;
  direction: string | null;
  report_emails: string[] | null;
  is_active: boolean;
};

type CompanyFormProps = {
  mode: "create" | "edit";
  company?: Company;
  action: (
    prevState: CompanyFormState,
    formData: FormData
  ) => Promise<CompanyFormState>;
};

const INITIAL_STATE: CompanyFormState = { error: null };

export function CompanyForm({ mode, company, action }: CompanyFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="rounded-[12px] border border-[var(--border)] bg-white p-4"
    >
      {mode === "edit" ? (
        <input type="hidden" name="companyId" value={company?.company_id} />
      ) : null}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Nombre
          </span>
          <input
            name="name"
            defaultValue={company?.name ?? ""}
            placeholder="Nombre de la empresa"
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Direccion
          </span>
          <textarea
            name="direction"
            defaultValue={company?.direction ?? ""}
            placeholder="Direccion completa"
            rows={3}
            className="w-full resize-y rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Correos para reportes
          </span>
          <textarea
            name="reportEmails"
            defaultValue={company?.report_emails?.join("\n") ?? ""}
            placeholder="Un correo por linea"
            rows={4}
            className="w-full resize-y rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
          />
        </label>

        <label className="block max-w-[260px]">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Estado
          </span>
          <select
            name="status"
            defaultValue={company?.is_active === false ? "inactive" : "active"}
            className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-foreground outline-none focus:border-foreground"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/empresas"
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
        <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{state.error}</p>
      ) : null}
    </form>
  );
}
