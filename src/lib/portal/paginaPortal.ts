/**
 * @file paginaPortal.ts
 * @description Apoio das páginas do portal no servidor: arena da requisição (subdomínio ou arena
 * raiz), metadados (título, `noindex` em demonstrações, cor do tema) e carga dos dados.
 */

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import { SLUG_ARENA_RAIZ, construirUrlArena } from "@/lib/arena/subdomain";
import { carregarDadosPortal } from "./portalRepository";
import type { DadosPortal } from "./types";

/** Slug da arena atendida nesta requisição (cabeçalho do proxy ou arena raiz). */
export async function slugDaRequisicao(): Promise<string> {
  return (await headers()).get("x-arena-slug") || SLUG_ARENA_RAIZ;
}

/** Dados do portal, uma única leitura por requisição (metadados e página usam a mesma). */
export const dadosDoPortal = cache((slug: string): Promise<DadosPortal | null> => carregarDadosPortal(slug));

/**
 * Arena inexistente no endereço acessado: se o endereço é o antigo de uma arena que trocou de
 * subdomínio, redireciona (301) para o novo, no mesmo caminho; senão, responde 404.
 *
 * @param slug Subdomínio acessado
 * @param caminho Caminho da página (ex.: "/regras"), mantido no endereço novo
 *
 * @example
 * ```ts
 * if (!dados) return arenaNaoEncontrada(slug, "/regras");
 * ```
 */
export async function arenaNaoEncontrada(slug: string, caminho: string = "/"): Promise<never> {
  const atual = await ArenaRepository.buscarSlugAtualPorAnterior(slug);
  if (atual && atual !== slug) permanentRedirect(`${construirUrlArena(atual)}${caminho === "/" ? "" : caminho}`);
  notFound();
}

/**
 * Metadados da página da arena. Arenas em demonstração (pagamento simulado) ficam fora dos buscadores.
 *
 * @param dados Dados do portal
 * @param titulo Título da página (padrão: "Arena · Reservas")
 */
export function metadadosDaArena(dados: DadosPortal | null, titulo?: string): Metadata {
  if (!dados) return { title: "Arena não encontrada" };
  const { arena } = dados;
  return {
    title: titulo ?? `${arena.nome} · Reservas`,
    description: `Reserve quadra na ${arena.nome}${arena.bairro ? `, no ${arena.bairro}` : ""} (${arena.cidade}/${arena.estado}). Horários em tempo real e sinal no Pix.`,
    robots: arena.modoPagamento === "simulado" ? { index: false, follow: false } : undefined,
  };
}

/** Cor do navegador no celular = cor de marca da arena. */
export function viewportDaArena(dados: DadosPortal | null): Viewport {
  return { themeColor: dados?.tema.marca, viewportFit: "cover" };
}
