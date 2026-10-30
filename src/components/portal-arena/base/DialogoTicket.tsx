/**
 * @file DialogoTicket.tsx
 * @description Diálogo em forma de ticket de papel (checkout e conta): lado azul com o resumo,
 * picote com recortes e canhoto de papel com o botão de fechar. No celular vira tela cheia.
 */

"use client";

import type { ReactNode } from "react";
import { useDialogoModal } from "@/hooks/portal/useDialogoModal";
import { Icone } from "../Icone";

export interface DialogoTicketProps {
  /** Id do `<dialog>` (ex.: `ck`, `auth`) */
  id: string;
  /** Se o diálogo está aberto */
  aberto: boolean;
  /** Fecha o diálogo (Esc, fundo, botão X) */
  aoFechar: () => void;
  /** Id do título, para `aria-labelledby` */
  idTitulo: string;
  /** Rótulo acessível do lado azul */
  rotuloResumo: string;
  /** Conteúdo do lado azul */
  resumo: ReactNode;
  /** Conteúdo do canhoto de papel */
  children: ReactNode;
  /** Classe extra (ex.: `au` no diálogo de conta) */
  className?: string;
  /** Etapa atual (`data-etapa`, usada pelo CSS do celular) */
  etapa?: string;
  /** Id do lado azul */
  idResumo?: string;
}

/**
 * @example
 * ```tsx
 * <DialogoTicket id="ck" aberto={aberto} aoFechar={fechar} idTitulo="ck-titulo"
 *   rotuloResumo="Resumo da reserva" resumo={<ResumoCheckout />}>
 *   <FormularioDados />
 * </DialogoTicket>
 * ```
 */
export function DialogoTicket({
  id,
  aberto,
  aoFechar,
  idTitulo,
  rotuloResumo,
  resumo,
  children,
  className,
  etapa,
  idResumo,
}: DialogoTicketProps) {
  const ref = useDialogoModal(aberto, aoFechar);
  return (
    <dialog
      ref={ref}
      className={className ? `ck ${className}` : "ck"}
      id={id}
      aria-labelledby={idTitulo}
      data-lenis-prevent=""
      data-etapa={etapa}
    >
      <div className="ck-ticket">
        <section className="ck-resumo" id={idResumo} aria-label={rotuloResumo}>
          {resumo}
        </section>
        <div className="ck-stub">
          <button type="button" className="ck-fechar" aria-label="Fechar" onClick={() => ref.current?.close()}>
            <Icone nome="x" />
          </button>
          {children}
        </div>
      </div>
    </dialog>
  );
}
