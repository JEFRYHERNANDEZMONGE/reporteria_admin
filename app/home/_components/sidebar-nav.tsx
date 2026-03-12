"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/home/actions";
import { roleHomePath, type AppRole } from "@/lib/auth/roles";

type NavItem = {
  label: string;
  href: string;
  section: "principal" | "operacion";
  enabled: boolean;
};

function getActiveHref(pathname: string, items: NavItem[]) {
  const matched = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length);

  return matched[0]?.href ?? null;
}

export function SidebarNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const canAccessRoutes = role === "admin" || role === "editor" || role === "rutero";
  const canAccessCompanies = role === "admin" || role === "editor";
  const canAccessEstablishments = role === "admin" || role === "editor" || role === "visitante";
  const canAccessProducts = role === "admin" || role === "editor" || role === "visitante";
  const canAccessTasks = role === "admin" || role === "editor" || role === "rutero";
  const canAccessUsers = role === "admin" || role === "editor";
  const canAccessRecords = true;
  const canAccessReports = role === "admin" || role === "editor" || role === "visitante";
  const canAccessOwnProfile = true;

  const navItems: NavItem[] = [
    { label: "Dashboard", href: roleHomePath(role), section: "principal", enabled: true },
    { label: "Rutas", href: "/rutas", section: "operacion", enabled: canAccessRoutes },
    { label: "Tareas", href: "/tareas", section: "operacion", enabled: canAccessTasks },
    {
      label: "Establecimientos",
      href: "/establecimientos",
      section: "operacion",
      enabled: canAccessEstablishments,
    },
    { label: "Registros", href: "/registros", section: "operacion", enabled: canAccessRecords },
    { label: "Empresas", href: "/empresas", section: "operacion", enabled: canAccessCompanies },
    { label: "Productos", href: "/productos", section: "operacion", enabled: canAccessProducts },
    { label: "Reportes", href: "/reportes", section: "operacion", enabled: canAccessReports },
    { label: "Usuarios", href: "/usuarios", section: "operacion", enabled: canAccessUsers },
    { label: "Mi perfil", href: "/mi-perfil", section: "operacion", enabled: canAccessOwnProfile },
  ];

  const principal = navItems.filter((item) => item.section === "principal" && item.enabled);
  const operacion = navItems.filter((item) => item.section === "operacion" && item.enabled);
  const activeHref = getActiveHref(pathname, navItems.filter((item) => item.enabled));

  const navClasses = "h-full bg-white p-4 lg:w-[260px]";

  const itemClass = (active: boolean, size: "compact" | "regular") =>
    [
      "flex items-center rounded-[8px] px-3 text-[14px] font-medium transition-colors",
      size === "compact" ? "h-9" : "h-10",
      active
        ? "bg-[#E9EDE9] text-foreground"
        : "bg-white text-[var(--muted)] hover:bg-[#F5F7F5]",
    ].join(" ");

  const content = (
    <div className={`${navClasses} flex h-full flex-col overflow-x-hidden`}>
      <div className="flex h-14 items-center gap-3">
        <Image
          src="/logo.png"
          alt="Instavista Logo"
          width={48}
          height={48}
          className="h-12 w-auto rounded-[8px]"
        />
        <p className="text-[18px] font-semibold text-foreground">Instavista</p>
      </div>

      <div className="mt-4 space-y-1.5">
        <p className="px-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--placeholder)]">
          PRINCIPAL
        </p>
        {principal.map((item) => {
          const active = activeHref === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={itemClass(active, "regular")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <p className="px-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--placeholder)]">
          OPERACION
        </p>
        <div className="subtle-scrollbar mt-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
          {operacion.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  setIsOpen(false);
                }}
                className={itemClass(active, "compact")}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <form
              action={logoutAction}
              onSubmit={() => {
                setIsOpen(false);
              }}
            >
              <button
                type="submit"
                className="flex h-10 w-full items-center rounded-[8px] px-3 text-left text-[14px] font-medium text-[var(--muted)] transition-colors hover:bg-[#F5F7F5]"
              >
                Cerrar sesion
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-[13px] font-semibold text-foreground"
        >
          Menu
        </button>
        <p className="text-[15px] font-semibold text-foreground">Instavista</p>
        <div className="w-[58px]" />
      </div>

      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:shrink-0 lg:overflow-hidden lg:border-r lg:border-[var(--border)]">
        {content}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-label="Cerrar menu"
          />
          <div className="relative h-full w-[88%] max-w-[300px] p-3">{content}</div>
        </div>
      ) : null}
    </>
  );
}
