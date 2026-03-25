"use client";

import { useActionState, useState } from "react";
import { updateMyProfileAction, type MyProfileFormState } from "@/app/usuarios/actions";

type MyProfileFormProps = {
  name: string;
  role: "admin" | "editor" | "visitante" | "rutero";
  companyName: string | null;
};

const INITIAL_STATE: MyProfileFormState = {
  error: null,
  success: null,
};

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  );
}

export function MyProfileForm({ name, role, companyName }: MyProfileFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateMyProfileAction,
    INITIAL_STATE
  );
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form action={formAction} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      <p className="text-[24px] font-semibold leading-none text-foreground">Mi perfil</p>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Nombre</span>
        <input
          name="name"
          defaultValue={name}
          placeholder="Nombre completo"
          required
          className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
        />
      </label>

      {role === "visitante" ? (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Empresa</span>
          <div className="flex h-10 w-full items-center rounded-[8px] border border-[var(--border)] bg-[#F8FAF8] px-3 text-[13px] text-[var(--muted)]">
            {companyName ?? "Sin empresa asignada"}
          </div>
        </label>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Contrasena actual
          </span>
          <div className="relative">
            <input
              name="currentPassword"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              placeholder="********"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 pr-10 text-[13px] outline-none focus:border-foreground"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowCurrent((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-foreground">
              <EyeIcon visible={showCurrent} />
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Nueva contrasena
          </span>
          <div className="relative">
            <input
              name="newPassword"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="********"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 pr-10 text-[13px] outline-none focus:border-foreground"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowNew((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-foreground">
              <EyeIcon visible={showNew} />
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Confirmar contrasena
          </span>
          <div className="relative">
            <input
              name="confirmNewPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="********"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 pr-10 text-[13px] outline-none focus:border-foreground"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowConfirm((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-foreground">
              <EyeIcon visible={showConfirm} />
            </button>
          </div>
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="reset"
          className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
        >
          Cancelar
        </button>
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
      {state.success ? (
        <p className="mt-3 text-[13px] font-medium text-[#1F6B45]">{state.success}</p>
      ) : null}
    </form>
  );
}
