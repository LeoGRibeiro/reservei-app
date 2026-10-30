/**
 * @file AncorasRegras.tsx
 * @description Âncoras da página de Regras com a rolagem suave do Lenis. O Lenis respeita o
 * `scroll-margin-top` do `.bloco` (altura do topo + 12 px), então a seção para logo abaixo do topo.
 */

"use client";

import { useEffect } from "react";

/** Liga as âncoras internas (`href="#..."`) ao Lenis. Não desenha nada. */
export function AncorasRegras() {
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      const alvo = a && document.getElementById(a.getAttribute("href")?.slice(1) ?? "");
      const lenis = window.__lenis;
      if (!alvo || !lenis) return;
      e.preventDefault();
      lenis.resize();
      lenis.scrollTo(alvo, { duration: 0.85, force: true });
      history.replaceState(null, "", a.getAttribute("href"));
    };
    document.addEventListener("click", clique);
    return () => document.removeEventListener("click", clique);
  }, []);
  return null;
}
