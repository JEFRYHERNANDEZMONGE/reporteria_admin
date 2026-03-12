"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAuditAction } from "@/lib/audit/log";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  APP_ROLE_COOKIE,
  APP_SESSION_LOG_COOKIE,
  roleHomePath,
} from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error: string | null;
  email?: string;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Debes ingresar correo y contrasena.", email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Credenciales invalidas.", email };
  }

  let profile: Awaited<ReturnType<typeof getCurrentUserProfile>>;
  try {
    profile = await getCurrentUserProfile(data.user.id);
  } catch {
    await supabase.auth.signOut();
    return {
      error: "No fue posible validar tu rol en este momento. Intenta nuevamente.",
      email,
    };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: "No se encontro un rol para este usuario. Contacta al administrador.",
      email,
    };
  }

  if (!profile.isActive) {
    await supabase.auth.signOut();
    return {
      error: "Tu usuario esta inactivo. Contacta al administrador.",
      email,
    };
  }

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");

  await supabase
    .from("user_profile")
    .update({ email: data.user.email ?? email })
    .eq("user_id", profile.userId);

  const { data: sessionLog } = await supabase
    .from("user_session_log")
    .insert({
      user_id: profile.userId,
      auth_user_id: data.user.id,
      user_agent: userAgent,
    })
    .select("session_log_id")
    .maybeSingle();

  const cookieStore = await cookies();
  cookieStore.set(APP_ROLE_COOKIE, profile.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  await logAuditAction(supabase, {
    action: "LOGIN",
    description: `Inicio de sesion desde ${userAgent ?? "desconocido"}`,
  });

  if (sessionLog?.session_log_id) {
    cookieStore.set(APP_SESSION_LOG_COOKIE, String(sessionLog.session_log_id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  redirect(roleHomePath(profile.role));
}
