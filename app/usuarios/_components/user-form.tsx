"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AdaptiveSelect } from "@/app/_components/adaptive-select";
import type { UserFormState } from "@/app/usuarios/actions";
import { APP_ROLES } from "@/lib/auth/roles";

type UserProfile = {
  user_id: number;
  name: string;
  role: "admin" | "editor" | "visitante" | "rutero";
  email: string | null;
  is_active: boolean;
  company_id?: number | null;
};

type CompanyOption = {
  company_id: number;
  name: string;
  is_active: boolean;
};

type UserFormProps = {
  mode: "create" | "edit";
  userProfile?: UserProfile;
  companies?: CompanyOption[];
  showCancel?: boolean;
  canManageRoleStatus?: boolean;
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
};

const INITIAL_STATE: UserFormState = { error: null };

export function UserForm({
  mode,
  userProfile,
  companies = [],
  showCancel = true,
  canManageRoleStatus = true,
  action,
}: UserFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedRole, setSelectedRole] = useState<UserProfile["role"]>(
    userProfile?.role ?? "visitante"
  );
  const [showPassword, setShowPassword] = useState(false);
  const shouldShowCompanyField = selectedRole === "visitante";

  return (
    <form
      action={formAction}
      className="rounded-[12px] border border-[var(--border)] bg-white p-4"
    >
      {mode === "edit" ? (
        <input type="hidden" name="userId" value={userProfile?.user_id} />
      ) : null}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Correo
            </span>
            <input
              name="email"
              type="email"
              defaultValue={userProfile?.email ?? ""}
              placeholder="usuario@correo.com"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          {mode === "create" ? (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Contrasena
              </span>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  required
                  minLength={8}
                  className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 pr-10 text-[13px] outline-none focus:border-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </label>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_250px]">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Nombre
            </span>
            <input
              name="name"
              defaultValue={userProfile?.name ?? ""}
              placeholder="Nombre completo"
              required
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Rol
            </span>
            {canManageRoleStatus ? (
              <select
                name="role"
                defaultValue={userProfile?.role ?? "visitante"}
                onChange={(event) =>
                  setSelectedRole(event.target.value as UserProfile["role"])
                }
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              >
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="role" value={userProfile?.role ?? "visitante"} />
                <div className="flex h-10 items-center rounded-[8px] border border-[var(--border)] bg-[#F8FAF8] px-3 text-[13px] text-[var(--muted)]">
                  {userProfile?.role ?? "visitante"}
                </div>
              </>
            )}
          </label>
        </div>

        {!shouldShowCompanyField ? (
          <input type="hidden" name="companyId" value="" />
        ) : null}

        <div className={`grid gap-3 ${shouldShowCompanyField ? "sm:grid-cols-[1fr_200px]" : "sm:grid-cols-[200px]"}`}>
          {shouldShowCompanyField ? (
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
                Empresa
              </span>
              <AdaptiveSelect
                name="companyId"
                defaultValue={userProfile?.company_id ? String(userProfile.company_id) : ""}
                required
                emptyOptionLabel="Seleccionar empresa"
                placeholder="Buscar empresa"
                options={companies.map((company) => ({
                  value: String(company.company_id),
                  label: `${company.name}${company.is_active ? "" : " (Inactiva)"}`,
                }))}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Estado
            </span>
            {canManageRoleStatus ? (
              <select
                name="status"
                defaultValue={userProfile?.is_active === false ? "inactive" : "active"}
                className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
              >
                <option value="active">Activo</option>
                <option value="inactive">Pausado</option>
              </select>
            ) : (
              <>
                <input
                  type="hidden"
                  name="status"
                  value={userProfile?.is_active === false ? "inactive" : "active"}
                />
                <div className="flex h-10 items-center rounded-[8px] border border-[var(--border)] bg-[#F8FAF8] px-3 text-[13px] text-[var(--muted)]">
                  {userProfile?.is_active === false ? "Pausado" : "Activo"}
                </div>
              </>
            )}
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {showCancel ? (
          <Link
            href="/usuarios"
            className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            Cancelar
          </Link>
        ) : null}
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
