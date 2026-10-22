/**
 * @file useArena.ts
 * @description Hook React para carregamento e gerenciamento do contexto da Arena ativa,
 * suas quadras esportivas e respectiva tabela de precificação dinâmica.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { Arena, Quadra, QuadraPreco } from "@/lib/arena/types";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import { obterSlugArenaDoNavegador, SLUG_ARENA_RAIZ } from "@/lib/arena/subdomain";
import { useCatalogoArenaStore } from "@/store/useCatalogoArenaStore";
import {
  ARENA_PADRAO,
  ARENA_PADRAO_ID,
  ARENA_PADRAO_SLUG,
  QUADRAS_PADRAO,
  PRECOS_PADRAO,
} from "@/lib/arena/defaultArena";

/**
 * Resolve o slug da arena ativa. Se não informado, usa o subdomínio do host atual
 * (ex: 'central.reservei.com' -> 'central'); sem subdomínio, usa a arena raiz configurada
 * (`NEXT_PUBLIC_ARENA_RAIZ_SLUG`, padrão: demo).
 *
 * @param slugOrId Slug/ID explícito (opcional)
 * @returns Slug/ID efetivo
 */
export function resolverSlugAtivo(slugOrId?: string): string {
  if (slugOrId) return slugOrId;
  return obterSlugArenaDoNavegador();
}

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
 * @param slugOrId Slug textual (ex: 'arena-central') ou ID da arena. Se omitido, usa o subdomínio
 * do host atual; sem subdomínio (localhost puro), usa a demo.
 * @returns Contexto completo da arena, quadras e precos
 * 
 * @example
 * ```tsx
 * const { arena, quadras, carregando } = useArena("arena-central");
 * ```
 */
export function useArena(slugOrIdParam?: string): UseArenaRetorno {
  // Com slug explícito de outra arena, começa neutro: a demo nunca deve "piscar" no portal de um cliente
  // Sem slug explícito vale a arena raiz do host (subdomínios sempre chegam com slug explícito do servidor)
  const slugInicial = slugOrIdParam ?? SLUG_ARENA_RAIZ;
  const outraArena = slugInicial !== ARENA_PADRAO_SLUG && slugInicial !== ARENA_PADRAO_ID;
  const [arena, setArena] = useState<Arena>(() =>
    outraArena ? { ...ARENA_PADRAO, id: "", slug: slugInicial, nome: "" } : ARENA_PADRAO
  );
  const [quadras, setQuadras] = useState<Quadra[]>(() => (outraArena ? [] : QUADRAS_PADRAO));
  const [precos, setPrecos] = useState<QuadraPreco[]>(() => (outraArena ? [] : PRECOS_PADRAO));
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const slugOrId = resolverSlugAtivo(slugOrIdParam);

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

      // Arena inexistente (slug de subdomínio inválido): não exibe dados da demo no lugar
      const naoEncontrada = !arenaEncontrada;
      const arenaFinal = arenaEncontrada || ARENA_PADRAO;
      setArena(arenaFinal);
      if (naoEncontrada) {
        setQuadras([]);
        setPrecos([]);
        setErro(`Arena "${slugOrId}" não encontrada.`);
        return;
      }

      // 2. Busca quadras e preços vinculados à arena encontrada
      const [listaQuadras, listaPrecos] = await Promise.all([
        ArenaRepository.listarQuadras(arenaFinal.id),
        ArenaRepository.listarPrecos(arenaFinal.id),
      ]);

      // Dados de demonstração só substituem listas vazias na própria arena demo
      const ehDemo = arenaFinal.id === ARENA_PADRAO_ID;
      const quadrasFinais = listaQuadras.length > 0 || !ehDemo ? listaQuadras : QUADRAS_PADRAO;
      setQuadras(quadrasFinais);
      setPrecos(listaPrecos.length > 0 || !ehDemo ? listaPrecos : PRECOS_PADRAO);
      useCatalogoArenaStore.getState().definirCatalogo(arenaFinal, quadrasFinais);
    } catch (err) {
      console.error("[useArena] Erro ao carregar dados da arena:", err);
      setErro("Não foi possível carregar os dados atualizados da arena.");
      setArena(ARENA_PADRAO);
      setQuadras(QUADRAS_PADRAO);
      setPrecos(PRECOS_PADRAO);
    } finally {
      setCarregando(false);
    }
  }, [slugOrIdParam]);

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
