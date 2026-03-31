"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
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
  useEffect(() => { if (state.error) toast.error(state.error); }, [state]);
  const [reportEmails, setReportEmails] = useState<string[]>(company?.report_emails ?? []);
  const [emailDraft, setEmailDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const resetEmailDraft = () => {
    setEmailDraft("");
    setEmailError(null);
  };

  const addReportEmail = () => {
    const nextEmail = emailDraft.trim().toLowerCase();

    if (!nextEmail) {
      setEmailError("Ingresa un correo para agregarlo.");
      return;
    }

    if (reportEmails.includes(nextEmail)) {
      setEmailError("Ese correo ya fue agregado.");
      return;
    }

    setReportEmails((current) => [...current, nextEmail]);
    resetEmailDraft();
  };

  const startEditingEmail = (index: number) => {
    setEditingIndex(index);
    setEditingDraft(reportEmails[index] ?? "");
    setEmailError(null);
  };

  const saveEditedEmail = () => {
    if (editingIndex === null) return;

    const nextEmail = editingDraft.trim().toLowerCase();

    if (!nextEmail) {
      setEmailError("Ingresa un correo valido antes de guardarlo.");
      return;
    }

    const isDuplicate = reportEmails.some(
      (email, index) => index !== editingIndex && email === nextEmail
    );

    if (isDuplicate) {
      setEmailError("Ese correo ya fue agregado.");
      return;
    }

    setReportEmails((current) =>
      current.map((email, index) => (index === editingIndex ? nextEmail : email))
    );
    setEditingIndex(null);
    setEditingDraft("");
    setEmailError(null);
  };

  const cancelEditedEmail = () => {
    setEditingIndex(null);
    setEditingDraft("");
    setEmailError(null);
  };

  const removeReportEmail = (indexToRemove: number) => {
    setReportEmails((current) => current.filter((_, index) => index !== indexToRemove));

    if (editingIndex === indexToRemove) {
      cancelEditedEmail();
      return;
    }

    if (editingIndex !== null && editingIndex > indexToRemove) {
      setEditingIndex(editingIndex - 1);
    }

    setEmailError(null);
  };

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
          <input
            type="hidden"
            name="reportEmails"
            value={reportEmails.join("\n")}
          />
          <div className="rounded-[10px] border border-[var(--border)] p-3">
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                type="email"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                placeholder="correo@empresa.com"
                className="h-10 flex-1 rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
              />
              <button
                type="button"
                onClick={addReportEmail}
                className="h-10 rounded-[8px] border border-[var(--border)] px-4 text-[13px] font-semibold text-foreground"
              >
                Agregar correo
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[12px] font-semibold text-[var(--muted)]">Correos agregados</p>
              {reportEmails.length === 0 ? (
                <p className="text-[13px] text-[var(--muted)]">
                  Todavia no hay correos configurados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {reportEmails.map((email, index) => {
                    const isEditing = editingIndex === index;

                    return (
                      <li
                        key={`${email}-${index}`}
                        className="rounded-[8px] border border-[var(--border)] px-3 py-2"
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <input
                              type="email"
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                              className="h-10 flex-1 rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground outline-none focus:border-foreground"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={saveEditedEmail}
                                className="rounded-[8px] bg-foreground px-3 py-2 text-[13px] font-semibold text-white"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditedEmail}
                                className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-foreground"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <p className="text-[13px] text-foreground">{email}</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingEmail(index)}
                                className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-foreground"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeReportEmail(index)}
                                className="rounded-[8px] border border-[#E5B5B5] px-3 py-2 text-[13px] font-semibold text-[#9B1C1C]"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {emailError ? (
              <p className="mt-3 text-[13px] font-medium text-[#9B1C1C]">{emailError}</p>
            ) : null}
          </div>
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
