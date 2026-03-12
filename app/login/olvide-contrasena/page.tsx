"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/app/login/olvide-contrasena/actions";

const INITIAL_STATE: ForgotPasswordState = { error: null, success: false };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    INITIAL_STATE
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-[420px] rounded-[12px] border border-[var(--border)] bg-surface p-6">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="Instavista Logo"
            width={120}
            height={120}
            className="h-[120px] w-auto rounded-[12px]"
          />
          <h1 className="text-center text-[20px] font-semibold text-foreground">
            Recuperar contraseña
          </h1>
          <p className="text-center text-[13px] text-[var(--muted)]">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu
            contraseña.
          </p>
        </div>

        {state.success ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--border)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-foreground">
              Revisa tu correo
            </p>
            <p className="text-[13px] text-[var(--muted)]">
              Si tu correo está registrado, recibirás un enlace para
              restablecer tu contraseña en los próximos minutos.
            </p>
            <Link
              href="/login"
              className="mt-2 text-[13px] font-medium text-foreground underline underline-offset-4"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Correo
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@instavista.com"
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isPending}
              className="mt-1 h-11 w-full rounded-[8px] bg-foreground text-[14px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Enviando..." : "Enviar enlace"}
            </button>

            <Link
              href="/login"
              className="text-center text-[13px] text-[var(--muted)] hover:text-foreground"
            >
              ← Volver al inicio de sesión
            </Link>
          </form>
        )}

        {state.error ? (
          <p className="mt-4 text-center text-[13px] font-medium text-[#9B1C1C]">
            {state.error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
