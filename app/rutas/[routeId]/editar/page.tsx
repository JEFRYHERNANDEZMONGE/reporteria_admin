import { notFound } from "next/navigation";
import { RouteForm } from "@/app/rutas/_components/route-form";
import { updateRouteAction } from "@/app/rutas/actions";
import { requireRole } from "@/lib/auth/require-role";

type PageProps = {
  params: Promise<{ routeId: string }>;
};

export default async function EditRoutePage({ params }: PageProps) {
  const { supabase } = await requireRole(["admin", "editor"]);
  const { routeId } = await params;
  const parsedRouteId = Number(routeId);

  if (!parsedRouteId || Number.isNaN(parsedRouteId)) {
    notFound();
  }

  const [
    { data: route, error },
    { data: ruteros },
    { data: dayOptionsRaw },
    { data: availableEstablishments },
    { data: assignedEstablishments },
  ] = await Promise.all([
    supabase
      .from("route")
      .select("route_id, nombre, visit_period, day, assigned_user, is_active")
      .eq("route_id", parsedRouteId)
      .maybeSingle(),
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
    supabase
      .from("establishment")
      .select("establishment_id, name, direction, province, canton")
      .eq("route_id", parsedRouteId)
      .order("name", { ascending: true }),
  ]);

  if (error || !route) {
    notFound();
  }

  const dayOptions = Array.isArray(dayOptionsRaw)
    ? dayOptionsRaw.filter((value): value is string => typeof value === "string")
    : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="rounded-[12px] bg-[#DDE2DD] p-3">
        <p className="text-[12px] text-[#5A7984]">Operacion/Rutas</p>
        <h1 className="text-[34px] font-semibold leading-none text-foreground">Editar ruta</h1>
      </header>

      <RouteForm
        mode="edit"
        route={route}
        action={updateRouteAction}
        dayOptions={dayOptions}
        ruteroOptions={ruteros ?? []}
        availableEstablishments={availableEstablishments ?? []}
        initialAssignedEstablishments={assignedEstablishments ?? []}
      />
    </div>
  );
}
