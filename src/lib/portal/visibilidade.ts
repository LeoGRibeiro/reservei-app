/**
 * @file visibilidade.ts
 * @description Quais seções e itens de menu o portal mostra. Regra da SPEC §4.3: uma seção aparece só
 * quando o módulo está contratado pela arena E existe dado para mostrar. Reservar e Contato sempre aparecem.
 */

import { temModuloAtivo } from "@/lib/arena/modulos";
import type { DadosPortal } from "./types";

/** Seções opcionais do portal. */
export interface SecoesVisiveis {
  escolinhas: boolean;
  eventos: boolean;
  clube: boolean;
  estrutura: boolean;
  instagram: boolean;
  /** Mural "Partidas procurando jogadores" */
  partidas: boolean;
}

/** Item do menu do topo e do rodapé ("Na página"). */
export interface ItemMenu {
  id: string;
  rotulo: string;
}

/**
 * Decide as seções visíveis.
 *
 * @param dados Dados do portal
 * @returns Mapa seção → visível
 *
 * @example
 * ```ts
 * secoesVisiveis(dados).eventos; // false se a arena não contratou "eventos" ou não tem eventos
 * ```
 */
export function secoesVisiveis(dados: DadosPortal): SecoesVisiveis {
  const m = dados.arena.modulos;
  return {
    escolinhas: temModuloAtivo(m, "escolinhas") && dados.escolinhas.length > 0,
    eventos: temModuloAtivo(m, "eventos") && dados.eventos.length > 0,
    clube: temModuloAtivo(m, "fidelidade") && dados.clube !== null,
    estrutura: dados.galeria.length > 0,
    instagram: temModuloAtivo(m, "instagram") && Boolean(dados.arena.instagram) && dados.instagram.posts.length > 0,
    partidas: temModuloAtivo(m, "vagas"),
  };
}

/**
 * Itens do menu na ordem da página. Clube e Instagram nunca entram no menu.
 *
 * @param secoes Seções visíveis
 * @returns Itens do menu
 */
export function itensDoMenu(secoes: SecoesVisiveis): ItemMenu[] {
  return [
    { id: "reservar", rotulo: "Reservar" },
    ...(secoes.escolinhas ? [{ id: "escolinhas", rotulo: "Escolinhas" }] : []),
    ...(secoes.eventos ? [{ id: "eventos", rotulo: "Campeonatos" }] : []),
    ...(secoes.estrutura ? [{ id: "estrutura", rotulo: "Estrutura" }] : []),
    { id: "contato", rotulo: "Contato" },
  ];
}
