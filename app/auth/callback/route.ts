import { type NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { logAuditAction } from "@/lib/audit/log";
import { isAppRole, APP_ROLE_COOKIE, APP_SESSION_LOG_COOKIE, roleHomePath } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const oauthError = searchParams.get("error");

  const supabase = await createSupabaseServerClient();

  // Flujo de recuperación de contraseña
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=token-expired`);
    }
    return NextResponse.redirect(`${origin}/auth/reset-contrasena`);
  }

  if (oauthError || !code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

  if (sessionError || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // Buscar perfil por auth_user_id (usuario ya vinculado previamente)
  const { data: profileById } = await supabase
    .from("user_profile")
    .select("user_id, role, is_active")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  let profile = profileById;

  // Fallback: buscar por email (primer login con Google de un usuario pre-creado por admin)
  if (!profile && data.user.email) {
    const { data: profileByEmail } = await supabase
      .from("user_profile")
      .select("user_id, role, is_active")
      .eq("email", data.user.email)
      .maybeSingle();

    if (profileByEmail) {
      // Vincular el auth_user_id de Google al perfil existente
      await supabase
        .from("user_profile")
        .update({ auth_user_id: data.user.id })
        .eq("user_id", profileByEmail.user_id);

      profile = profileByEmail;
    }
  }

  // Sin perfil = no tiene acceso (no fue creado por un admin)
  if (!profile || !isAppRole(profile.role)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no-role`);
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=inactive`);
  }

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");

  const { data: sessionLog } = await supabase
    .from("user_session_log")
    .insert({
      user_id: profile.user_id,
      auth_user_id: data.user.id,
      user_agent: userAgent,
    })
    .select("session_log_id")
    .maybeSingle();

  await logAuditAction(supabase, {
    action: "LOGIN",
    description: `Inicio de sesion con Google desde ${userAgent ?? "desconocido"}`,
  });

  const cookieStore = await cookies();
  cookieStore.set(APP_ROLE_COOKIE, profile.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
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

  return NextResponse.redirect(`${origin}${roleHomePath(profile.role)}`);
}
