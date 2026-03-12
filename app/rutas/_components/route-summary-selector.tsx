"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type RouteOption = {
  routeId: number;
  name: string;
};

type RouteSummarySelectorProps = {
  routes: RouteOption[];
  selectedRouteId: number;
};

export function RouteSummarySelector({
  routes,
  selectedRouteId,
}: RouteSummarySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (nextRouteId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("routeId", nextRouteId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <label className="block w-full max-w-[360px]">
      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">
        Seleccionar ruta
      </span>
      <select
        value={String(selectedRouteId)}
        onChange={(event) => handleChange(event.target.value)}
        className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-foreground"
      >
        {routes.map((route) => (
          <option key={route.routeId} value={route.routeId}>
            {route.name}
          </option>
        ))}
      </select>
    </label>
  );
}
