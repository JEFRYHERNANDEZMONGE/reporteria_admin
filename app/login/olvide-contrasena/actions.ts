"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  error: string | null;
  success: boolean;
};

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Debes ingresar tu correo.", success: false };
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?type=recovery`,
  });

  if (error) {
    return {
      error: "No se pudo enviar el correo. Intenta nuevamente.",
      success: false,
    };
  }

  // Siempre retornar éxito para no revelar si el correo existe
  return { error: null, success: true };
}
