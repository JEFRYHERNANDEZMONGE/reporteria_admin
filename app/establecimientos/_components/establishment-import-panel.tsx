"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  importEstablishmentsTemplateAction,
  type EstablishmentImportState,
} from "@/app/establecimientos/actions";

const INITIAL_STATE: EstablishmentImportState = {
  error: null,
  success: null,
  details: [],
};

export function EstablishmentImportPanel() {
  const [state, formAction, isPending] = useActionState(
    importEstablishmentsTemplateAction,
    INITIAL_STATE
  );

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Carga masiva de establecimientos</p>
        </div>

        <Link
          href="/establecimientos/plantilla"
          className="rounded-[8px] border border-[var(--border)] px-3 py-2 text-[12px] font-semibold text-foreground"
        >
          Descargar plantilla
        </Link>
      </div>

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-[260px] flex-1">
          <span className="mb-1.5 block text-[12px] font-semibold text-[var(--muted)]">Archivo Excel</span>
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="h-10 w-full rounded-[8px] border border-[var(--border)] bg-white px-2 text-[12px] text-foreground outline-none file:mr-2 file:rounded-[6px] file:border-0 file:bg-[#E8ECE8] file:px-2 file:py-1.5 file:text-[12px] file:font-semibold"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-[8px] bg-foreground px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Importando..." : "Importar Excel"}
        </button>
      </form>

      {state.error ? <p className="mt-2 text-[12px] font-medium text-[#9B1C1C]">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-[12px] font-medium text-[#166534]">{state.success}</p> : null}

      {state.details.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[12px] text-[#8A2C0D]">
          {state.details.map((detail) => (
            <li key={detail}>- {detail}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
