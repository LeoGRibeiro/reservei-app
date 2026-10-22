/**
 * @file useCatalogoArenaStore.ts
 * @description Catálogo operacional da arena ativa: quadras e horários de início disponíveis.
 *
 * É preenchido pelo `useArena` assim que a arena do subdomínio é carregada, e lido por toda a
 * interface (grade do portal, agenda do admin, contratos, vagas) e pelas regras de domínio que
 * precisam validar quadra/horário. Até a arena carregar, vale o catálogo legado da demo
 * (q1–q3, 08h–21h), o que também mantém testes e o modo offline funcionando.
 */

import { create } from "zustand";
import { HORARIOS_DISPONIVEIS, QUADRAS, type Quadra as QuadraCatalogo } from "@/lib/quadras";
import type { Arena, Quadra } from "@/lib/arena/types";
import { gerarHorariosOperacionais } from "@/lib/arena/arenaService";

export type { QuadraCatalogo };

interface CatalogoArenaState {
  /** Arena ativa carregada (null até o carregamento; usado pela marca white-label) */
  arena: Arena | null;
  /** Quadras ativas da arena, na ordem de exibição */
  quadras: QuadraCatalogo[];
  /** Horários de início reserváveis (ex: ['08:00', '09:00', ...]) */
  horarios: string[];
  /** Antecedência mínima (minutos) para reservas online */
  antecedenciaMinutos: number;
  /** Substitui o catálogo pelos dados da arena carregada */
  definirCatalogo: (arena: Arena, quadras: Quadra[]) => void;
  /** Restaura o catálogo legado (uso de testes) */
  redefinir: () => void;
}

const ANTECEDENCIA_PADRAO_MINUTOS = 10;

/**
 * Converte as quadras da arena para o formato enxuto usado pela interface.
 *
 * @param quadras Quadras da arena
 * @returns Quadras ativas ordenadas
 */
export function quadrasParaCatalogo(quadras: Quadra[]): QuadraCatalogo[] {
  return [...quadras]
    .filter((q) => q.ativa !== false)
    .sort((a, b) => (a.ordem ?? a.numero) - (b.ordem ?? b.numero))
    .map((q) => ({
      id: q.id,
      numero: q.numero,
      descricao: q.nome || q.descricao || `Quadra ${q.numero}`,
      esportes: q.esportes,
    }));
}

export const useCatalogoArenaStore = create<CatalogoArenaState>((set) => ({
  arena: null,
  quadras: QUADRAS,
  horarios: HORARIOS_DISPONIVEIS,
  antecedenciaMinutos: ANTECEDENCIA_PADRAO_MINUTOS,
  definirCatalogo: (arena, quadras) => {
    const horarios = gerarHorariosOperacionais(
      arena.horarioAbertura,
      arena.horarioFechamento,
      arena.intervaloMinutos || 60
    );
    set({
      arena,
      quadras: quadrasParaCatalogo(quadras),
      horarios: horarios.length > 0 ? horarios : HORARIOS_DISPONIVEIS,
      antecedenciaMinutos: Math.max(0, arena.antecedenciaMinimaMinutos ?? ANTECEDENCIA_PADRAO_MINUTOS),
    });
  },
  redefinir: () =>
    set({
      arena: null,
      quadras: QUADRAS,
      horarios: HORARIOS_DISPONIVEIS,
      antecedenciaMinutos: ANTECEDENCIA_PADRAO_MINUTOS,
    }),
}));

/** Quadras da arena ativa (leitura fora de componentes React). */
export const obterQuadrasCatalogo = (): QuadraCatalogo[] => useCatalogoArenaStore.getState().quadras;

/** Horários reserváveis da arena ativa (leitura fora de componentes React). */
export const obterHorariosCatalogo = (): string[] => useCatalogoArenaStore.getState().horarios;

/** Hook: quadras da arena ativa. */
export const useQuadrasCatalogo = (): QuadraCatalogo[] => useCatalogoArenaStore((s) => s.quadras);

/** Hook: horários reserváveis da arena ativa. */
export const useHorariosCatalogo = (): string[] => useCatalogoArenaStore((s) => s.horarios);

/**
 * Descrição amigável da quadra a partir do catálogo.
 *
 * @param quadraId Id da quadra
 * @param quadras Catálogo (padrão: o atual)
 * @returns Ex: "Quadra 1 - Areia"
 */
export function descreverQuadra(quadraId: string, quadras: QuadraCatalogo[] = obterQuadrasCatalogo()): string {
  const q = quadras.find((item) => item.id === quadraId);
  return q ? q.descricao : "Quadra";
}
