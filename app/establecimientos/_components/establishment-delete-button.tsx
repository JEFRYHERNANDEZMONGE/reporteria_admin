"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteEstablishmentAction,
  type DeleteEstablishmentState,
} from "@/app/establecimientos/actions";

type EstablishmentDeleteButtonProps = {
  establishmentId: number;
  plain?: boolean;
};

const INITIAL_STATE: DeleteEstablishmentState = {
  error: null,
  success: false,
};

export function EstablishmentDeleteButton({
  establishmentId,
  plain = false,
}: EstablishmentDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    deleteEstablishmentAction,
    INITIAL_STATE
  );
  useEffect(() => { if (state.error) toast.error(state.error); }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          plain
            ? "text-[12px] font-semibold text-[#5A7984]"
            : "rounded-[8px] border border-[#D6A7A7] px-3 py-1.5 text-[12px] font-semibold text-[#9B1C1C]"
        }
      >
        Eliminar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-[12px] border border-[var(--border)] bg-white p-4">
            <h3 className="text-[16px] font-semibold text-foreground">
              Eliminar establecimiento
            </h3>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              Esta accion no se puede deshacer. Deseas continuar?
            </p>

            <form action={formAction} className="mt-3 space-y-3">
              <input
                type="hidden"
                name="establishmentId"
                value={establishmentId}
              />

              {state.error ? (
                <p className="text-[13px] font-medium text-[#9B1C1C]">
                  {state.error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-[8px] bg-[#9B1C1C] px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Eliminando..." : "Confirmar eliminacion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
