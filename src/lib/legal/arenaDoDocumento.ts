/**
 * @file arenaDoDocumento.ts
 * @description Resolve, no servidor, a arena cujos dados preenchem os documentos legais: a do subdomínio
 * (cabeçalho `x-arena-slug` do proxy) ou a arena raiz do host.
 */

import { headers } from "next/headers";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import { SLUG_ARENA_RAIZ } from "@/lib/arena/subdomain";
import type { DadosArenaTermos } from "./termos";

/**
 * Dados da arena para os documentos legais.
 *
 * @returns Dados da arena, ou um texto neutro se ela não for encontrada
 */
export async function obterArenaDoDocumento(): Promise<DadosArenaTermos> {
  const slug = (await headers()).get("x-arena-slug") || SLUG_ARENA_RAIZ;
  const arena = await ArenaRepository.buscarPorSlug(slug).catch(() => null);
  if (!arena) return { nome: "arena" };
  return {
    nome: arena.nome,
    cidade: arena.cidade,
    estado: arena.estado,
    email: arena.email,
    whatsapp: arena.whatsapp,
    cnpjCpf: arena.cnpjCpf,
    politicaCancelamento: arena.politicaCancelamento,
  };
}
