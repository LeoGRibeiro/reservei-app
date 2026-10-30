/**
 * @file usePortalBasico.ts
 * @description Hooks pequenos do portal: relógio da página, media query, sombra do topo, botão de
 * voltar ao topo e scroll spy das seções do menu (mesmos números do protótipo).
 *
 * Relógio e media query usam `useSyncExternalStore`: no servidor e na hidratação vale o valor do
 * servidor; depois, o do navegador, sem divergência de hidratação.
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Intervalo de atualização do relógio da página. */
const TIQUE_RELOGIO_MS = 30_000;

/** Relógio compartilhado do navegador (um único intervalo para a página inteira). */
const relogio = {
  agora: typeof window === "undefined" ? 0 : Date.now(),
  ouvintes: new Set<() => void>(),
  intervalo: null as ReturnType<typeof setInterval> | null,
};

function assinarRelogio(ouvinte: () => void): () => void {
  relogio.ouvintes.add(ouvinte);
  if (!relogio.intervalo) {
    relogio.agora = Date.now();
    relogio.intervalo = setInterval(() => {
      relogio.agora = Date.now();
      relogio.ouvintes.forEach((o) => o());
    }, TIQUE_RELOGIO_MS);
  }
  return () => {
    relogio.ouvintes.delete(ouvinte);
    if (!relogio.ouvintes.size && relogio.intervalo) {
      clearInterval(relogio.intervalo);
      relogio.intervalo = null;
    }
  };
}

/**
 * Relógio da página: o instante do servidor no primeiro desenho; depois, o do navegador, atualizado
 * a cada 30 s.
 *
 * @param agoraServidorIso Instante do servidor no primeiro desenho
 */
export function useRelogio(agoraServidorIso: string): Date {
  const ms = useSyncExternalStore(
    assinarRelogio,
    () => relogio.agora,
    () => new Date(agoraServidorIso).getTime()
  );
  return new Date(ms);
}

/**
 * Media query reativa. No servidor (e na hidratação) vale `inicial`.
 *
 * @example
 * ```ts
 * const telaLarga = useMidia("(min-width: 1120px)", true);
 * ```
 */
export function useMidia(consulta: string, inicial: boolean): boolean {
  return useSyncExternalStore(
    (ouvinte) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", ouvinte);
      return () => mq.removeEventListener("change", ouvinte);
    },
    () => window.matchMedia(consulta).matches,
    () => inicial
  );
}

/**
 * Estado da rolagem para o topo (sombra depois de 8 px) e para o botão de subir (depois de 700 px).
 */
export function useRolagemDaPagina(): { rolado: boolean; mostrarSubir: boolean } {
  const [estado, setEstado] = useState({ rolado: false, mostrarSubir: false });
  useEffect(() => {
    const aoRolar = () => {
      const y = window.scrollY;
      setEstado((e) => (e.rolado === y > 8 && e.mostrarSubir === y >= 700 ? e : { rolado: y > 8, mostrarSubir: y >= 700 }));
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    requestAnimationFrame(aoRolar);
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);
  return estado;
}

/**
 * Scroll spy: a seção do menu com mais área visível fica marcada. Nas seções fora do menu (Clube,
 * Instagram), nenhum item fica marcado.
 *
 * @param ids Ids das seções do menu, na ordem da página
 * @param ativo Desliga o espião (ex.: na Minha conta)
 * @returns Id da seção ativa, ou null
 */
export function useSecaoVisivel(ids: string[], ativo = true): string | null {
  const [secao, setSecao] = useState<string | null>(null);
  const chave = ids.join(",");
  useEffect(() => {
    if (!ativo) return;
    const lista = chave.split(",");
    const visivel: Record<string, number> = {};
    const espiao = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) visivel[en.target.id] = en.isIntersecting ? en.intersectionRect.height : 0;
        const maior = Math.max(0, ...lista.map((id) => visivel[id] ?? 0));
        setSecao(maior > 0 ? (lista.find((id) => (visivel[id] ?? 0) === maior) ?? null) : null);
      },
      { rootMargin: "-72px 0px -35% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    for (const id of lista) {
      const el = document.getElementById(id);
      if (el) espiao.observe(el);
    }
    return () => espiao.disconnect();
  }, [chave, ativo]);
  return ativo ? secao : null;
}
