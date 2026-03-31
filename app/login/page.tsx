"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loginAction, type LoginActionState } from "@/app/login/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const INITIAL_STATE: LoginActionState = { error: null };

const OAUTH_ERRORS: Record<string, string> = {
  oauth: "Error al autenticar con Google. Intenta nuevamente.",
  "no-role": "No tienes acceso al sistema. Contacta al administrador.",
  inactive: "Tu usuario esta inactivo. Contacta al administrador.",
  "token-expired": "El enlace ha expirado o ya fue usado. Solicita uno nuevo.",
};

function LoginContent() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_STATE
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const displayError =
    state.error ??
    (urlError ? (OAUTH_ERRORS[urlError] ?? "Error al iniciar sesion con Google.") : null);
  useEffect(() => { if (displayError) toast.error(displayError); }, [displayError]);

  async function handleGoogleSignIn() {
    setIsGooglePending(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-[420px] rounded-[12px] border border-[var(--border)] bg-surface p-6">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo-hm.webp"
            alt="Instavista Logo"
            width={120}
            height={120}
            className="h-[120px] w-auto rounded-[12px]"
          />
          <h1 className="text-center text-[20px] font-semibold text-foreground">
            Instavista Admin
          </h1>
        </div>

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
              defaultValue={state.email ?? ""}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
              required
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              Contraseña
            </span>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 pr-10 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-foreground"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || isGooglePending}
            className="mt-1 h-11 w-full rounded-[8px] bg-foreground text-[14px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Ingresando..." : "Ingresar"}
          </button>

          <Link
            href="/login/olvide-contrasena"
            className="text-center text-[12px] text-[var(--muted)] hover:text-foreground"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>

        <div className="my-4 flex items-center gap-3">
          <hr className="flex-1 border-[var(--border)]" />
          <span className="text-[11px] text-[var(--muted)]">o</span>
          <hr className="flex-1 border-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isPending || isGooglePending}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-[8px] border border-[var(--border)] bg-surface text-[14px] font-medium text-foreground transition-opacity hover:bg-background disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85L38.4 6.12A23.84 23.84 0 0 0 24 0C14.62 0 6.51 5.38 2.56 13.25l7.38 5.73C11.68 13.1 17.36 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.57 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.2 5.47-4.68 7.15l7.18 5.57C43.46 37.84 46.57 31.62 46.57 24.5z"/>
            <path fill="#FBBC05" d="M9.94 28.98A14.56 14.56 0 0 1 9.5 24c0-1.73.3-3.4.44-4.98l-7.38-5.73A23.93 23.93 0 0 0 0 24c0 3.87.92 7.53 2.56 10.75l7.38-5.77z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.14 15.9-5.82l-7.18-5.57c-2.15 1.45-4.91 2.3-8.72 2.3-6.64 0-12.32-3.6-14.06-8.98l-7.38 5.77C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {isGooglePending ? "Redirigiendo..." : "Continuar con Google"}
        </button>

        {displayError ? (
          <p className="mt-4 text-center text-[13px] font-medium text-[#9B1C1C]">
            {displayError}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

