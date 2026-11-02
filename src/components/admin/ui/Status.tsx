/**
 * @file Status.tsx
 * @description Etiquetas do painel. As cores existem só para status (cada tom tem cor fixa), para que
 * o dono aprenda o significado: âmbar = falta pagar, verde = quitada, vermelho = cancelada.
 */

"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { descreverStatus, type TomStatus } from "@/lib/admin/formatos";
import type { Reserva } from "@/store/useReservasStore";

const TONS: Record<TomStatus, string> = {
  neutro: "bg-stone-100 text-stone-700 ring-stone-200",
  aguardando: "bg-sky-50 text-sky-800 ring-sky-200",
  sinal: "bg-amber-50 text-amber-800 ring-amber-200",
  quitada: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelada: "bg-red-50 text-red-700 ring-red-200",
  bloqueio: "bg-stone-200 text-stone-800 ring-stone-300",
  fixo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
};

/** Etiqueta com tom de status. */
export function Etiqueta({ tom = "neutro", children, className }: { tom?: TomStatus; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONS[tom], className)}>
      {children}
    </span>
  );
}

/**
 * Status da reserva com nome de negócio ("Sinal pago · falta R$ 50,00", "Quitada", "Aguardando Pix").
 */
export function StatusReserva({ reserva, className }: { reserva: Pick<Reserva, "status" | "valorPendente" | "tipoReserva" | "pagamentoInformadoEm">; className?: string }) {
  const { rotulo, tom } = descreverStatus(reserva);
  return (
    <Etiqueta tom={tom} className={className}>
      {rotulo}
    </Etiqueta>
  );
}
