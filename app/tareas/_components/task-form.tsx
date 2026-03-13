"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { TaskFormState } from "@/app/tareas/actions";
import { SearchableCombobox } from "@/app/_components/searchable-combobox";

type Task = {
  task_id: number;
  title: string;
  description: string | null;
  priority: "baja" | "media" | "alta" | "crítica";
  due_to: string | null;
};

type AssignableUser = {
  user_id: number;
  name: string;
};

type TaskFormProps = {
  mode: "create" | "edit";
  task?: Task;
  users: AssignableUser[];
  selectedUserIds: number[];
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
};

const INITIAL_STATE: TaskFormState = { error: null };

function toInputDays(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? String(diffDays) : "0";
}

export function TaskForm({
  mode,
  task,
  users,
  selectedUserIds,
  action,
}: TaskFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [selectedIds, setSelectedIds] = useState<number[]>(selectedUserIds);

  const availableUsers = useMemo(() => {
    const selected = new Set(selectedIds);
    return users.filter((user) => !selected.has(user.user_id));
  }, [selectedIds, users]);

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user.user_id)),
    [selectedIds, users]
  );


  return (
    <form action={formAction} className="rounded-[12px] border border-[var(--border)] bg-white p-4">
      {mode === "edit" ? <input type="hidden" name="taskId" value={task?.task_id} /> : null}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Titulo
          </span>
          <input
            name="title"
            defaultValue={task?.title ?? ""}
            placeholder="Titulo de la tarea"
            required
            className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
            Descripcion
          </span>
          <textarea
            name="description"
            defaultValue={task?.description ?? ""}
            placeholder="Detalles de la tarea"
            rows={3}
            className="w-full resize-y rounded-[8px] border border-[var(--border)] px-3 py-2 text-[13px] outline-none focus:border-foreground"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Prioridad
            </span>
            <select
              name="priority"
              defaultValue={task?.priority ?? "media"}
              className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="crítica">Critica</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
              Días para hacerla
            </span>
            <input
              name="due_to_days"
              type="number"
              min="0"
              defaultValue={toInputDays(task?.due_to)}
              placeholder="0"
              className="h-10 w-full rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-foreground"
            />
          </label>
        </div>

        <div className="rounded-[12px] border border-[var(--border)] bg-white">
          <div className="rounded-t-[12px] bg-[#5A7A84] p-3">
            <p className="text-[16px] font-semibold text-white">Asignar usuarios</p>

            <div className="mt-1 max-w-[360px]">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#BEBFBF]">
                Usuarios
              </span>
              <SearchableCombobox
                items={availableUsers}
                getItemId={(user) => user.user_id}
                getItemLabel={(user) => user.name}
                placeholder="Buscar usuarios..."
                emptyMessage="Sin resultados."
                onSelect={(user) =>
                  setSelectedIds((prev) =>
                    prev.includes(user.user_id) ? prev : [...prev, user.user_id]
                  )
                }
              />
            </div>
          </div>

          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="assigned_user_ids" value={id} />
          ))}

          <div className="px-3">
            {selectedUsers.length === 0 ? (
              <p className="py-3 text-[13px] text-[var(--muted)]">
                No hay usuarios asignados.
              </p>
            ) : (
              selectedUsers.map((user, index) => {
                const isLast = index === selectedUsers.length - 1;
                return (
                  <div
                    key={user.user_id}
                    className={`flex h-10 items-center justify-between ${
                      isLast ? "" : "border-b border-[var(--border)]"
                    }`}
                  >
                    <p className="text-[13px] text-[var(--muted)]">{user.name}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds((prev) => prev.filter((id) => id !== user.user_id))
                      }
                      className="text-[12px] font-semibold text-[#9B1C1C]"
                    >
                      Quitar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/tareas"
          className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
        >
          Cancelar
        </Link>
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
