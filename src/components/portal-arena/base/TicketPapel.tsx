/**
 * @file TicketPapel.tsx
 * @description Ticket azul com picote e recortes laterais (`.ticket`): parte de cima com os dados,
 * canhoto embaixo com o valor e a ação.
 */

import type { ReactNode } from "react";

export interface TicketPapelProps {
  /** Parte de cima (`.t-top`) */
  topo: ReactNode;
  /** Canhoto (`.t-stub`), depois do picote */
  canhoto: ReactNode;
  /** Id do ticket */
  id?: string;
}

/**
 * @example
 * ```tsx
 * <TicketPapel id="ticket" topo={<DadosDoTicket />} canhoto={<ValorEBotao />} />
 * ```
 */
export function TicketPapel({ topo, canhoto, id }: TicketPapelProps) {
  return (
    <div className="ticket" id={id} aria-live="polite">
      <div className="t-top">{topo}</div>
      <div className="t-stub">{canhoto}</div>
    </div>
  );
}
