import Link from "next/link";
import { TaskDeleteButton } from "@/app/tareas/_components/task-delete-button";
import { TaskFilters } from "@/app/tareas/_components/task-filters";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    priority?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 10;

function parsePage(page: string | undefined) {
  const parsed = Number(page ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function buildPageHref(
  page: number,
  query: string | undefined,
  priority: "all" | "baja" | "media" | "alta" | "crítica"
) {
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  if (priority !== "all") params.set("priority", priority);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/tareas?${queryString}` : "/tareas";
}

export default async function TasksListPage({ searchParams }: PageProps) {
  const { supabase, role, user } = await requireRole(["admin", "editor", "rutero"]);
  const { q, priority, page } = await searchParams;
  const currentPriority =
    priority === "baja" ||
    priority === "media" ||
    priority === "alta" ||
    priority === "crítica"
      ? priority
      : "all";
  const currentPage = parsePage(page);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let taskIds: number[] | null = null;
  const assignedStatesByTask = new Map<number, string[]>();
  const assignedByStateByTask = new Map<number, Record<string, string[]>>();

  if (role === "rutero") {
    const profile = await getCurrentUserProfile(user.id);
    if (!profile) {
      return (
        <p className="mx-auto w-full max-w-6xl text-[13px] font-medium text-[#9B1C1C]">
          No se encontro perfil para este usuario.
        </p>
      );
    }

    const { data: assignedRows } = await supabase
      .from("user_tasks")
      .select("task_id, task_state")
      .eq("user_id", profile.userId);
    taskIds = (assignedRows ?? []).map((row) => row.task_id);
    (assignedRows ?? []).forEach((row) => {
      assignedStatesByTask.set(row.task_id, [row.task_state]);
      assignedByStateByTask.set(row.task_id, {
        [row.task_state]: ["Tu"],
      });
    });
  }

  if (role === "admin" || role === "editor") {
    const { data: assignmentRows } = await supabase
      .from("user_tasks")
      .select("task_id, task_state, user_profile(name)");

    (assignmentRows ?? []).forEach((row) => {
      const currentStates = assignedStatesByTask.get(row.task_id) ?? [];
      if (!currentStates.includes(row.task_state)) {
        currentStates.push(row.task_state);
      }
      assignedStatesByTask.set(row.task_id, currentStates);

      const profileData = Array.isArray(row.user_profile)
        ? row.user_profile[0]
        : row.user_profile;
      const userName =
        profileData && typeof profileData === "object" && "name" in profileData
          ? String(profileData.name)
          : "";

      if (userName) {
        const byState = assignedByStateByTask.get(row.task_id) ?? {};
        if (!byState[row.task_state]) {
          byState[row.task_state] = [];
        }
        if (!byState[row.task_state].includes(userName)) {
          byState[row.task_state].push(userName);
        }
        assignedByStateByTask.set(row.task_id, byState);
      }
    });
  }

  let dataQuery = supabase
    .from("task")
    .select("task_id, title, description, priority, due_to")
    .order("task_id", { ascending: false });
  let countQuery = supabase
    .from("task")
    .select("task_id", { count: "exact", head: true });

  if (taskIds) {
    if (taskIds.length === 0) {
      dataQuery = dataQuery.in("task_id", [-1]);
      countQuery = countQuery.in("task_id", [-1]);
    } else {
      dataQuery = dataQuery.in("task_id", taskIds);
      countQuery = countQuery.in("task_id", taskIds);
    }
  }

  if (q?.trim()) {
    const search = `%${q.trim()}%`;
    dataQuery = dataQuery.ilike("title", search);
    countQuery = countQuery.ilike("title", search);
  }

  if (currentPriority !== "all") {
    dataQuery = dataQuery.eq("priority", currentPriority);
    countQuery = countQuery.eq("priority", currentPriority);
  }

  const [{ data: tasks, error }, { count, error: countError }] = await Promise.all([
    dataQuery.range(from, to),
    countQuery,
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#DDE2DD] p-3">
            <div>
              <p className="text-[12px] text-[#5A7984]">Operacion</p>
              <h1 className="text-[20px] font-semibold text-foreground">Tareas</h1>
            </div>
            {role === "admin" ? (
              <Link
                href="/tareas/nueva"
                className="rounded-[8px] bg-foreground px-4 py-2 text-[13px] font-semibold text-white"
              >
                Agregar tarea
              </Link>
            ) : null}
          </header>

          <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
            <TaskFilters initialQuery={q ?? ""} initialPriority={currentPriority} />
          </div>

          <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
            <div className="hidden bg-[#5A7A84] px-4 py-3 text-[12px] font-semibold text-white md:grid md:grid-cols-[1.2fr_0.9fr_0.8fr_1fr_1fr] md:gap-3">
              <p>Nombre</p>
              <p>Fecha limite</p>
              <p>Estado</p>
              <p>Asignado a</p>
              <p>Acciones</p>
            </div>

            {error || countError ? (
              <p className="px-4 py-4 text-[13px] font-medium text-[#9B1C1C]">
                No se pudieron cargar las tareas.
              </p>
            ) : null}

            {!error && !countError && (!tasks || tasks.length === 0) ? (
              <p className="px-4 py-4 text-[13px] text-[var(--muted)]">
                No hay tareas para mostrar.
              </p>
            ) : null}

            {!error && !countError && tasks?.length
              ? tasks.map((task) => (
                  <article
                    key={task.task_id}
                    className="border-t border-[var(--border)] px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1.2fr_0.9fr_0.8fr_1fr_1fr] md:items-center md:gap-3"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Nombre
                      </p>
                      <p className="text-[13px] text-[var(--muted)]">{task.title}</p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Fecha limite
                      </p>
                      <p className="text-[13px] text-[var(--muted)]">
                        {formatDate(task.due_to)}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Estado
                      </p>
                      <p className="text-[13px] text-[var(--muted)]">
                        {(() => {
                          const states = assignedStatesByTask.get(task.task_id) ?? [];
                          if (states.length === 0) return "-";
                          if (states.every(s => s === "Pendiente")) return "Pendiente";
                          if (states.every(s => s === "Completada")) return "Completada";
                          if (states.every(s => s === "Atrasada")) return "Atrasada";
                          
                          // If there's a mix (someone started/completed but not everyone)
                          return "En proceso";
                        })()}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <p className="text-[12px] font-semibold text-[var(--muted)] md:hidden">
                        Asignado a
                      </p>
                      <div className="flex flex-col gap-1">
                        {(() => {
                          if (role === "rutero") return <p className="text-[13px] text-[var(--muted)]">Tu</p>;
                          const byState = assignedByStateByTask.get(task.task_id);
                          if (!byState || Object.keys(byState).length === 0) return <p className="text-[13px] text-[var(--muted)]">-</p>;
                          return Object.entries(byState).map(([state, names]) => (
                            <p key={state} className="text-[13px] text-[var(--muted)]">
                              <span className="font-medium text-foreground">{state}:</span> {names.join(", ")}
                            </p>
                          ));
                        })()}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 md:mt-0">
                      {(role === "admin" || role === "editor") && (
                        <Link
                          href={`/tareas/${task.task_id}/editar`}
                          className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-[12px] font-semibold text-foreground"
                        >
                          Editar
                        </Link>
                      )}
                      {role === "admin" ? (
                        <TaskDeleteButton taskId={task.task_id} taskTitle={task.title} />
                      ) : null}
                    </div>
                  </article>
                ))
              : null}
          </section>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-[var(--muted)]">
              Mostrando {totalCount === 0 ? 0 : from + 1}-{Math.min(totalCount, to + 1)} de{" "}
              {totalCount}
            </p>

            <div className="flex items-center gap-2">
              {canGoPrev ? (
                <Link
                  href={buildPageHref(currentPage - 1, q, currentPriority)}
                  className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
                >
                  Anterior
                </Link>
              ) : (
                <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
                  Anterior
                </span>
              )}

              <span className="text-[12px] font-semibold text-[var(--muted)]">
                Pagina {Math.min(currentPage, totalPages)} de {totalPages}
              </span>

              {canGoNext ? (
                <Link
                  href={buildPageHref(currentPage + 1, q, currentPriority)}
                  className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground"
                >
                  Siguiente
                </Link>
              ) : (
                <span className="rounded-[8px] border border-[var(--border)] bg-[#F6F7F6] px-3 py-1.5 text-[12px] font-semibold text-[#9AA7AB]">
                  Siguiente
                </span>
              )}
            </div>
          </div>
    </div>
  );
}
