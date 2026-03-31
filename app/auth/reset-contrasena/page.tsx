"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  buildCleanAuthUrl,
  getRecoveryErrorMessage,
  hasRecoveryAuthParams,
} from "@/lib/auth/recovery-flow";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EXPIRED_LINK_ERROR =
  "El enlace ha expirado o ya fue usado. Solicita uno nuevo.";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let isMounted = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const currentUrl = new URL(window.location.href);
    const cleanUrl = buildCleanAuthUrl(currentUrl);
    const urlError = getRecoveryErrorMessage({
      search: currentUrl.search,
      hash: currentUrl.hash,
    });
    const expectsRecoverySession = hasRecoveryAuthParams({
      search: currentUrl.search,
      hash: currentUrl.hash,
    });

    function replaceUrl() {
      window.history.replaceState({}, document.title, cleanUrl);
    }

    function markReady() {
      if (!isMounted) return;
      replaceUrl();
      setError(null);
      setHasSession(true);
    }

    function markInvalid(message: string) {
      if (!isMounted) return;
      replaceUrl();
      setError(message);
      setHasSession(false);
    }

    if (urlError) {
      markInvalid(urlError);
      return () => {
        isMounted = false;
      };
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
          }
          markReady();
        }
      }
    );

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMounted) return;

        if (sessionError) {
          markInvalid(EXPIRED_LINK_ERROR);
          return;
        }

        if (data.session) {
          markReady();
          return;
        }

        if (!expectsRecoverySession) {
          markInvalid(EXPIRED_LINK_ERROR);
          return;
        }

        fallbackTimer = setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData.session) {
            markReady();
            return;
          }

          markInvalid(EXPIRED_LINK_ERROR);
        }, 1500);
      })
      .catch(() => {
        markInvalid(EXPIRED_LINK_ERROR);
      });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsPending(false);

    if (updateError) {
      setError(
        "No se pudo actualizar la contraseña. El enlace puede haber expirado."
      );
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (hasSession === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background" />
    );
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
            Nueva contraseña
          </h1>
          <p className="text-center text-[13px] text-[var(--muted)]">
            Elige una contraseña segura para tu cuenta.
          </p>
        </div>

        {success ? (
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
              Contraseña actualizada
            </p>
            <p className="text-[13px] text-[var(--muted)]">
              Redirigiendo al inicio de sesión...
            </p>
          </div>
        ) : hasSession === false ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-[14px] font-semibold text-[#9B1C1C]">
              No se pudo validar el enlace
            </p>
            <p className="text-[13px] text-[var(--muted)]">
              {error ?? EXPIRED_LINK_ERROR}
            </p>
            <Link
              href="/login/olvide-contrasena"
              className="mt-2 text-[13px] font-medium text-foreground underline underline-offset-4"
            >
              Solicitar un nuevo enlace
            </Link>
            <Link
              href="/login"
              className="text-[13px] text-[var(--muted)] hover:text-foreground"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {/* Nueva contraseña */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Nueva contraseña
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Confirmar contraseña */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Confirmar contraseña
              </span>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 pr-10 text-[13px] text-foreground placeholder:text-[var(--placeholder)] outline-none focus:border-foreground"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-foreground"
                  aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirm ? (
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
              disabled={isPending}
              className="mt-1 h-11 w-full rounded-[8px] bg-foreground text-[14px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}

        {error && hasSession !== false ? (
          <p className="mt-4 text-center text-[13px] font-medium text-[#9B1C1C]">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
