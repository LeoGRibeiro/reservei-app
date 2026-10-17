/**
 * @file useArena.ts
 * @description Hook React para carregamento e gerenciamento do contexto da Arena ativa,
 * suas quadras esportivas e respectiva tabela de precificação dinâmica.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Arena, Quadra, QuadraPreco } from "@/lib/arena/types";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import {
  ARENA_PADRAO,
  ARENA_PADRAO_SLUG,
  QUADRAS_PADRAO,
  PRECOS_PADRAO,
} from "@/lib/arena/defaultArena";

export interface UseArenaRetorno {
  /** Dados cadastrais da arena ativa */
  arena: Arena;
  /** Lista de quadras ativas da arena */
  quadras: Quadra[];
  /** Regras de precificação dinâmica configuradas */
  precos: QuadraPreco[];
  /** Indica se os dados estão sendo consultados no backend */
  carregando: boolean;
  /** Mensagem de erro caso a consulta falhe */
  erro: string | null;
  /** Função para forçar revalidação e recarga dos dados da arena */
  recarregar: () => Promise<void>;
}

/**
 * Hook para obter a arena por slug ou identificador com fallback automático para a Arena Padrão.
 * 
 * @param slugOrId Slug textual (ex: 'praia-leopoldina') ou ID da arena. Se omitido, usa a demo.
 * @returns Contexto completo da arena, quadras e precos
 * 
 * @example
 * ```tsx
 * const { arena, quadras, carregando } = useArena("praia-leopoldina");
 * ```
 */
export function useArena(slugOrId: string = ARENA_PADRAO_SLUG): UseArenaRetorno {
  const [arena, setArena] = useState<Arena>(ARENA_PADRAO);
  const [quadras, setQuadras] = useState<Quadra[]>(QUADRAS_PADRAO);
  const [precos, setPrecos] = useState<QuadraPreco[]>(PRECOS_PADRAO);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      // 1. Tenta buscar a arena pelo slug ou ID
      let arenaEncontrada: Arena | null = null;

      if (!slugOrId || slugOrId === ARENA_PADRAO_SLUG || slugOrId === ARENA_PADRAO.id) {
        arenaEncontrada = ARENA_PADRAO;
      } else {
        arenaEncontrada = await ArenaRepository.buscarPorSlug(slugOrId);
        if (!arenaEncontrada) {
          arenaEncontrada = await ArenaRepository.buscarPorId(slugOrId);
        }
      }

      const arenaFinal = arenaEncontrada || ARENA_PADRAO;
      setArena(arenaFinal);

      // 2. Busca quadras e preços vinculados à arena encontrada
      const [listaQuadras, listaPrecos] = await Promise.all([
        ArenaRepository.listarQuadras(arenaFinal.id),
        ArenaRepository.listarPrecos(arenaFinal.id),
      ]);

      setQuadras(listaQuadras.length > 0 ? listaQuadras : QUADRAS_PADRAO);
      setPrecos(listaPrecos.length > 0 ? listaPrecos : PRECOS_PADRAO);
    } catch (err) {
      console.error("[useArena] Erro ao carregar dados da arena:", err);
      setErro("Não foi possível carregar os dados atualizados da arena.");
      setArena(ARENA_PADRAO);
      setQuadras(QUADRAS_PADRAO);
      setPrecos(PRECOS_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [slugOrId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  return {
    arena,
    quadras,
    precos,
    carregando,
    erro,
    recarregar: carregarDados,
  };
}
