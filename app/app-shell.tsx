"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { SidebarNav } from "@/app/home/_components/sidebar-nav";
import type { AppRole } from "@/lib/auth/roles";

type AppShellProps = {
  children: React.ReactNode;
  role: AppRole | null;
};

export function AppShell({ children, role }: AppShellProps) {
  const pathname = usePathname();
  const lastKnownRole = useRef<AppRole | null>(role);

  // Retenemos el ultimo rol conocido. Durante actulizaciones y server actions, 
  // Next.js a veces puede perder acceso temporal a las cookies en el layout.
  if (role) {
    lastKnownRole.current = role;
  }
  const activeRole = role ?? lastKnownRole.current;

  // Usamos un blocklist en lugar de allowlist para evitar que desaparezca
  // en submódulos o transiciones inesperadas.
  const isAuthRoute =
    !pathname ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-background lg:flex lg:h-screen lg:items-start lg:overflow-hidden">
      {activeRole ? <SidebarNav role={activeRole} /> : null}
      <section className="w-full p-4 pt-5 sm:p-6 lg:h-screen lg:overflow-y-auto lg:p-6">
        {children}
      </section>
    </main>
  );
}
