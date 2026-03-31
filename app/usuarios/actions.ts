"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAuditAction } from "@/lib/audit/log";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isAppRole } from "@/lib/auth/roles";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserFormState = {
  error: string | null;
};

export type DeleteUserState = {
  error: string | null;
  success: boolean;
};

export type ToggleUserStatusState = {
  error: string | null;
  success: boolean;
};

export type MyProfileFormState = {
  error: string | null;
  success: string | null;
};

type UserManagerContext =
  | {
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      profile: {
        userId: number;
        role: "admin" | "editor" | "visitante" | "rutero";
        isActive: boolean;
      };
      authUser: { id: string; email: string | null };
    }
  | { error: string };

async function getUserManager(): Promise<UserManagerContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesion ha expirado. Inicia sesion nuevamente." };
  }

  const profile = await getCurrentUserProfile(user.id);
  if (!profile) {
    return { error: "No se encontro tu perfil de usuario." };
  }

  if (!profile.isActive) {
    return { error: "Tu usuario esta inactivo. Contacta al administrador." };
  }

  return {
    supabase,
    profile,
    authUser: {
      id: user.id,
      email: user.email ?? null,
    },
  };
}

function parseRole(value: FormDataEntryValue | null) {
  const roleValue = String(value ?? "").trim();
  return isAppRole(roleValue) ? roleValue : null;
}

function parseEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  return email;
}

function parseStatus(value: FormDataEntryValue | null) {
  return String(value ?? "active") !== "inactive";
}

function parseOptionalCompanyId(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function companyExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: number
) {
  const { data, error } = await supabase
    .from("company")
    .select("company_id")
    .eq("company_id", companyId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function createAuthUserWithAdminAPI(
  email: string,
  password: string
): Promise<{ authUserId: string | null; error: string | null }> {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {},
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      authUserId: null,
      error: "No se pudo crear el usuario de autenticacion. (USR-CRE-01)",
    };
  }

  const authUserId =
    payload &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string"
      ? payload.id
      : null;

  if (!authUserId) {
    return {
      authUserId: null,
      error: "No se recibio el id del usuario de autenticacion. (USR-CRE-02)",
    };
  }

  return { authUserId, error: null };
}

export async function createUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const email = parseEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = parseRole(formData.get("role"));
  const companyIdInput = parseOptionalCompanyId(formData.get("companyId"));
  const isActive = parseStatus(formData.get("status"));

  if (!email) {
    return { error: "El correo es obligatorio." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  if (!role) {
    return { error: "El rol es invalido." };
  }

  if (role === "visitante" && !companyIdInput) {
    return { error: "Debes seleccionar una empresa para usuarios visitantes." };
  }

  if (password.length < 8) {
    return { error: "La contrasena debe tener al menos 8 caracteres." };
  }

  const actor = await getUserManager();
  if ("error" in actor) return { error: actor.error };
  if (actor.profile.role !== "admin") {
    return { error: "No tienes permisos para crear usuarios." };
  }

  const { authUserId, error: authError } = await createAuthUserWithAdminAPI(
    email,
    password
  );

  if (authError || !authUserId) {
    return { error: authError ?? "No se pudo crear el usuario." };
  }

  const { supabase } = actor;
  const companyId = role === "visitante" ? companyIdInput : null;
  if (companyId) {
    const exists = await companyExists(supabase, companyId);
    if (!exists) {
      return { error: "La empresa seleccionada no existe o no esta disponible." };
    }
  }

  const { error } = await supabase.from("user_profile").insert({
    name,
    role,
    email,
    is_active: isActive,
    auth_user_id: authUserId,
    company_id: companyId,
  });

  if (error) {
    return {
      error:
        "No se pudo crear el perfil del usuario. Verifica correo y que el usuario no exista. (USR-CRE-03)",
    };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateUserAction(
  _prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const userId = Number(formData.get("userId"));
  const email = parseEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim();
  if (!userId || Number.isNaN(userId)) {
    return { error: "Usuario invalido." };
  }

  if (!email) {
    return { error: "El correo es obligatorio." };
  }

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const actor = await getUserManager();
  if ("error" in actor) return { error: actor.error };
  if (actor.profile.role !== "admin" && actor.profile.role !== "editor") {
    return { error: "No tienes permisos para editar usuarios." };
  }
  const { supabase, authUser } = actor;

  const { data: targetUser, error: targetUserError } = await supabase
    .from("user_profile")
    .select("auth_user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetUserError || !targetUser) {
    return { error: "No se encontro el usuario a editar." };
  }

  if (targetUser.auth_user_id && targetUser.auth_user_id === authUser.id) {
    return { error: "Este es tu usuario. Gestiona tus datos desde Mi perfil." };
  }

  const requestedRole = parseRole(formData.get("role"));
  const isActive = parseStatus(formData.get("status"));
  const companyIdInput = parseOptionalCompanyId(formData.get("companyId"));
  const finalRole = actor.profile.role === "admin" ? requestedRole : targetUser.role;

  if (!finalRole) {
    return { error: "El rol es invalido." };
  }

  if (finalRole === "visitante" && !companyIdInput) {
    return { error: "Debes seleccionar una empresa para usuarios visitantes." };
  }

  const finalCompanyId = finalRole === "visitante" ? companyIdInput : null;
  if (finalCompanyId) {
    const exists = await companyExists(supabase, finalCompanyId);
    if (!exists) {
      return { error: "La empresa seleccionada no existe o no esta disponible." };
    }
  }

  const updatePayload: {
    name: string;
    email: string;
    role?: "admin" | "editor" | "visitante" | "rutero";
    is_active?: boolean;
    company_id?: number | null;
  } = {
    name,
    email,
    company_id: finalCompanyId,
  };

  if (actor.profile.role === "admin") {
    updatePayload.role = finalRole;
    updatePayload.is_active = isActive;
  }

  const { error } = await supabase
    .from("user_profile")
    .update(updatePayload)
    .eq("user_id", userId);

  if (error) {
    return { error: "No se pudo actualizar el usuario. Verifica los datos ingresados. (USR-UPD-01)" };
  }

  revalidatePath("/usuarios");
  revalidatePath("/mi-perfil");
  redirect("/usuarios");
}

export async function toggleUserStatusAction(
  _prevState: ToggleUserStatusState,
  formData: FormData
): Promise<ToggleUserStatusState> {
  const userId = Number(formData.get("userId"));
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const isActive = nextStatus === "active";

  if (!userId || Number.isNaN(userId)) {
    return { error: "Usuario invalido.", success: false };
  }

  if (nextStatus !== "active" && nextStatus !== "inactive") {
    return { error: "Estado invalido.", success: false };
  }

  const actor = await getUserManager();
  if ("error" in actor) return { error: actor.error, success: false };
  if (actor.profile.role !== "admin") {
    return { error: "No tienes permisos para cambiar el estado.", success: false };
  }
  const { supabase, authUser } = actor;

  const { data: targetUser, error: targetUserError } = await supabase
    .from("user_profile")
    .select("auth_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetUserError || !targetUser) {
    return { error: "No se encontro el usuario.", success: false };
  }

  if (targetUser.auth_user_id && targetUser.auth_user_id === authUser.id) {
    return {
      error: "No puedes pausar o activar tu propio usuario desde esta vista.",
      success: false,
    };
  }

  const { error } = await supabase
    .from("user_profile")
    .update({
      is_active: isActive,
    })
    .eq("user_id", userId);

  if (error) {
    return { error: "No se pudo cambiar el estado del usuario. (USR-STA-01)", success: false };
  }

  revalidatePath("/usuarios");
  revalidatePath("/mi-perfil");
  redirect("/usuarios");
}

export async function deleteUserAction(
  _prevState: DeleteUserState,
  formData: FormData
): Promise<DeleteUserState> {
  const userId = Number(formData.get("userId"));

  if (!userId || Number.isNaN(userId)) {
    return { error: "Usuario invalido.", success: false };
  }

  const actor = await getUserManager();
  if ("error" in actor) return { error: actor.error, success: false };
  if (actor.profile.role !== "admin") {
    return { error: "Solo admin puede eliminar usuarios.", success: false };
  }
  const { supabase, authUser } = actor;

  const { data: targetUser, error: targetUserError } = await supabase
    .from("user_profile")
    .select("auth_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetUserError || !targetUser) {
    return { error: "No se encontro el usuario.", success: false };
  }

  if (targetUser.auth_user_id && targetUser.auth_user_id === authUser.id) {
    return {
      error: "No puedes eliminar tu propio usuario desde esta vista.",
      success: false,
    };
  }

  const { error } = await supabase.from("user_profile").delete().eq("user_id", userId);

  if (error) {
    return {
      error: "No se pudo eliminar el usuario. Verifica dependencias relacionadas. (USR-DEL-01)",
      success: false,
    };
  }

  if (targetUser.auth_user_id) {
    const { url } = getSupabaseEnv();
    const adminClient = createClient(url, getSupabaseServiceRoleKey());
    await adminClient.auth.admin.deleteUser(targetUser.auth_user_id);
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateMyProfileAction(
  _prevState: MyProfileFormState,
  formData: FormData
): Promise<MyProfileFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "").trim();
  const confirmNewPassword = String(formData.get("confirmNewPassword") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio.", success: null };
  }

  const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmNewPassword);
  if (wantsPasswordChange) {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return {
        error: "Para cambiar la contrasena debes completar todos los campos.",
        success: null,
      };
    }

    if (newPassword !== confirmNewPassword) {
      return {
        error: "La nueva contrasena y su confirmacion no coinciden.",
        success: null,
      };
    }

    if (newPassword.length < 8) {
      return {
        error: "La nueva contrasena debe tener al menos 8 caracteres.",
        success: null,
      };
    }
  }

  const actor = await getUserManager();
  if ("error" in actor) return { error: actor.error, success: null };
  const { supabase, authUser } = actor;

  if (wantsPasswordChange) {
    if (!authUser.email) {
      return {
        error: "Tu usuario no tiene correo disponible para validar contrasena.",
        success: null,
      };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });

    if (signInError) {
      return {
        error: "La contrasena actual es incorrecta.",
        success: null,
      };
    }
  }

  const { error: updateProfileError } = await supabase
    .from("user_profile")
    .update({ name })
    .eq("auth_user_id", authUser.id);

  if (updateProfileError) {
    return { error: "No se pudo actualizar tu nombre. (USR-PRF-01)", success: null };
  }

  if (wantsPasswordChange) {
    const { error: updatePasswordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updatePasswordError) {
      return {
        error: "No se pudo actualizar la contrasena. Intenta nuevamente. (USR-PRF-02)",
        success: null,
      };
    }

    await logAuditAction(supabase, {
      action: "PASSWORD_CHANGE",
      description: "Cambio de contrasena",
    });
  }

  revalidatePath("/mi-perfil");
  return { error: null, success: "Perfil actualizado correctamente." };
}
