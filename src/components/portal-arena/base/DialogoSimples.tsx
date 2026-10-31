/**
 * @file DialogoSimples.tsx
 * @description Diálogo simples do portal: topo azul com título e subtítulo, corpo de papel.
 * No celular abre por baixo, como gaveta (CSS `.dlg`).
 */

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useDialogoModal } from "@/hooks/portal/useDialogoModal";
import { Icone } from "../Icone";

export interface DialogoSimplesProps {
  /** Se o diálogo está aberto */
  aberto: boolean;
  /** Fecha o diálogo */
  aoFechar: () => void;
  /** Título no topo azul */
  titulo: string;
  /** Linha menor abaixo do título */
  subtitulo?: string;
  /** Corpo de papel */
  children: ReactNode;
  /** Muda quando o conteúdo troca de etapa: o foco volta para o título (como no protótipo) */
  chaveFoco?: string;
}

/**
 * @example
 * ```tsx
 * <DialogoSimples aberto titulo="Cancelar reserva" subtitulo="Areia 2 · Amanhã · 19:00 às 21:00" aoFechar={fechar}>
 *   <p className="dlg-txt">...</p>
 * </DialogoSimples>
 * ```
 */
export function DialogoSimples({ aberto, aoFechar, titulo, subtitulo, children, chaveFoco }: DialogoSimplesProps) {
  const ref = useDialogoModal(aberto, aoFechar);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (aberto) tituloRef.current?.focus();
  }, [aberto, chaveFoco]);

  return (
    <dialog ref={ref} className="dlg" id="dlg" aria-labelledby="dlg-titulo" data-lenis-prevent="">
      <div className="dlg-topo">
        <div>
          <h2 id="dlg-titulo" tabIndex={-1} ref={tituloRef}>
            {titulo}
          </h2>
          <span id="dlg-sub">{subtitulo ?? ""}</span>
        </div>
        <button type="button" className="dlg-fechar" aria-label="Fechar" onClick={() => ref.current?.close()}>
          <Icone nome="x" />
        </button>
      </div>
      <div className="dlg-corpo" id="dlg-corpo">
        {children}
      </div>
    </dialog>
  );
}
