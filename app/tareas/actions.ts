"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TaskFormState = {
  error: string | null;
};

export type DeleteTaskState = {
  error: string | null;
  success: boolean;
};

type TaskActorContext =
  | {
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      profile: { userId: number; role: "admin" | "editor" | "visitante" | "rutero" };
    }
  | { error: string };

async function getTaskActor(): Promise<TaskActorContext> {
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

  return { supabase, profile };
}

function parseAssignedUserIds(formData: FormData) {
  return formData
    .getAll("assigned_user_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

async function syncTaskAssignments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  taskId: number,
  nextUserIds: number[]
) {
  const { data: currentRows, error: currentError } = await supabase
    .from("user_tasks")
    .select("user_id")
    .eq("task_id", taskId);

  if (currentError) {
    return { error: currentError };
  }

  const currentIds = new Set((currentRows ?? []).map((row) => row.user_id));
  const nextIds = new Set(nextUserIds);
  const toInsert = [...nextIds].filter((id) => !currentIds.has(id));
  const toDelete = [...currentIds].filter((id) => !nextIds.has(id));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("user_tasks").insert(
      toInsert.map((userId) => ({
        user_id: userId,
        task_id: taskId,
        task_state: "Pendiente",
      }))
    );
    if (error) return { error };
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("user_tasks")
      .delete()
      .eq("task_id", taskId)
      .in("user_id", toDelete);
    if (error) return { error };
  }

  return { error: null };
}

export async function createTaskAction(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "media");
  const dueToDaysInput = String(formData.get("due_to_days") ?? "").trim();
  const assignedUserIds = parseAssignedUserIds(formData);

  if (!title) {
    return { error: "El titulo es obligatorio." };
  }

  if (!["baja", "media", "alta", "crítica"].includes(priority)) {
    return { error: "Prioridad invalida." };
  }

  const actor = await getTaskActor();
  if ("error" in actor) return { error: actor.error };
  if (actor.profile.role !== "admin") {
    return { error: "Solo admin puede crear tareas." };
  }

  const { supabase } = actor;
  let dueTo: string | null = null;
  if (dueToDaysInput && !Number.isNaN(Number(dueToDaysInput))) {
    const days = Number(dueToDaysInput);
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    dueTo = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  const { data: insertedTask, error } = await supabase
    .from("task")
    .insert({
      title,
      description: description || null,
      priority,
      due_to: dueTo,
    })
    .select("task_id")
    .single();

  if (error) {
    return { error: "No se pudo crear la tarea. (TAR-CRE-01)" };
  }

  if (insertedTask && assignedUserIds.length > 0) {
    const { error: assignmentError } = await supabase.from("user_tasks").insert(
      assignedUserIds.map((userId) => ({
        user_id: userId,
        task_id: insertedTask.task_id,
        task_state: "Pendiente",
      }))
    );

    if (assignmentError) {
      return { error: "Se creo la tarea, pero no se pudieron guardar asignaciones. (TAR-CRE-02)" };
    }
  }

  revalidatePath("/tareas");
  redirect("/tareas");
}

export async function updateTaskAction(
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const taskId = Number(formData.get("taskId"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "media");
  const dueToDaysInput = String(formData.get("due_to_days") ?? "").trim();
  const assignedUserIds = parseAssignedUserIds(formData);

  if (!taskId || Number.isNaN(taskId)) {
    return { error: "Tarea invalida." };
  }

  if (!title) {
    return { error: "El titulo es obligatorio." };
  }

  if (!["baja", "media", "alta", "crítica"].includes(priority)) {
    return { error: "Prioridad invalida." };
  }

  const actor = await getTaskActor();
  if ("error" in actor) return { error: actor.error };
  if (actor.profile.role !== "admin" && actor.profile.role !== "editor") {
    return { error: "No tienes permisos para editar tareas." };
  }

  const { supabase } = actor;
  let dueTo: string | null = null;
  if (dueToDaysInput && !Number.isNaN(Number(dueToDaysInput))) {
    const days = Number(dueToDaysInput);
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    dueTo = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  const { error } = await supabase
    .from("task")
    .update({
      title,
      description: description || null,
      priority,
      due_to: dueTo,
    })
    .eq("task_id", taskId);

  if (error) {
    return { error: "No se pudo actualizar la tarea. (TAR-UPD-01)" };
  }

  const { error: assignmentError } = await syncTaskAssignments(
    supabase,
    taskId,
    assignedUserIds
  );

  if (assignmentError) {
    return { error: "Se actualizo la tarea, pero no sus asignaciones. (TAR-UPD-02)" };
  }

  revalidatePath("/tareas");
  redirect("/tareas");
}

export async function deleteTaskAction(
  _prevState: DeleteTaskState,
  formData: FormData
): Promise<DeleteTaskState> {
  const taskId = Number(formData.get("taskId"));

  if (!taskId || Number.isNaN(taskId)) {
    return { error: "Tarea invalida.", success: false };
  }

  const actor = await getTaskActor();
  if ("error" in actor) return { error: actor.error, success: false };
  if (actor.profile.role !== "admin") {
    return { error: "Solo admin puede eliminar tareas.", success: false };
  }

  const { supabase } = actor;
  const { data: task, error: taskError } = await supabase
    .from("task")
    .select("title")
    .eq("task_id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    return { error: "No se encontro la tarea.", success: false };
  }

  const { error } = await supabase.from("task").delete().eq("task_id", taskId);
  if (error) {
    return {
      error: "No se pudo eliminar la tarea. Verifica dependencias relacionadas. (TAR-DEL-01)",
      success: false,
    };
  }

  revalidatePath("/tareas");
  redirect("/tareas");
}
