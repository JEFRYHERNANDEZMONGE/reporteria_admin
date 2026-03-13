import { RouteForm } from "@/app/rutas/_components/route-form";
import { createRouteAction } from "@/app/rutas/actions";
import { requireRole } from "@/lib/auth/require-role";

export default async function NewRoutePage() {
  const { supabase } = await requireRole(["admin", "editor"]);

  const [{ data: ruteros }, { data: dayOptionsRaw }, { data: availableEstablishments }] =
    await Promise.all([
    supabase
      .from("user_profile")
      .select("user_id, name")
      .eq("role", "rutero")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.rpc("route_day_options"),
    supabase
      .from("establishment")
      .select("establishment_id, name, direction, province, canton")
      .is("route_id", null)
      .order("name", { ascending: true }),
  ]);

  const dayOptions = Array.isArray(dayOptionsRaw)
    ? dayOptionsRaw.filter((value): value is string => typeof value === "string")
    : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Operacion/Rutas</p>
        <h1 className="text-[34px] font-semibold leading-none text-foreground">Crear ruta</h1>
      </header>

      <RouteForm
        mode="create"
        action={createRouteAction}
        dayOptions={dayOptions}
        ruteroOptions={ruteros ?? []}
        availableEstablishments={availableEstablishments ?? []}
        initialAssignedEstablishments={[]}
      />
    </div>
  );
}
