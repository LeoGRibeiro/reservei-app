/**
 * @file useDialogoModal.ts
 * @description Liga um `<dialog>` nativo ao estado do React: `showModal()` quando abre, `close()`
 * quando fecha, rolagem da página parada enquanto estiver aberto, clique no fundo e Esc fecham.
 * Comportamento igual ao do protótipo do portal.
 */

"use client";

import { useEffect, useRef } from "react";
import { liberarRolagem, travarRolagem } from "@/lib/portal/rolagem";

/**
 * @param aberto Se o diálogo deve estar aberto
 * @param aoFechar Chamado quando o diálogo fecha por Esc, clique no fundo ou `close()`
 * @returns Ref para o elemento `<dialog>`
 *
 * @example
 * ```tsx
 * const ref = useDialogoModal(aberto, () => setAberto(false));
 * return <dialog ref={ref} className="dlg">...</dialog>;
 * ```
 */
export function useDialogoModal(aberto: boolean, aoFechar: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) {
      if (typeof dialogo.showModal === "function") dialogo.showModal();
      else dialogo.setAttribute("open", "");
      travarRolagem();
    } else if (!aberto && dialogo.open) {
      if (typeof dialogo.close === "function") dialogo.close();
      else dialogo.removeAttribute("open");
    }
  }, [aberto]);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    const fechou = () => {
      liberarRolagem();
      aoFecharRef.current();
    };
    // Clique no fundo escuro: o alvo é o próprio <dialog>, fora do conteúdo
    const clicou = (e: MouseEvent) => {
      if (e.target === dialogo) dialogo.close();
    };
    dialogo.addEventListener("close", fechou);
    dialogo.addEventListener("click", clicou);
    return () => {
      dialogo.removeEventListener("close", fechou);
      dialogo.removeEventListener("click", clicou);
      if (dialogo.open) liberarRolagem();
    };
  }, []);

  return ref;
}
