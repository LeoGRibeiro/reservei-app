/**
 * @file arenaAtiva.ts
 * @description Resolve, uma única vez por aba do navegador, o `arena_id` da arena do subdomínio atual.
 *
 * Todos os serviços do navegador (reservas, contratos, fidelidade, galeria e escolinhas) usam este
 * módulo para filtrar leituras e preencher gravações com o `arena_id` correto. Sem isso, um operador
 * vinculado a duas arenas veria dados misturados, e o RLS rejeitaria gravações com `arena_id` nulo.
 *
 * Sem subdomínio (localhost puro ou domínio raiz), usa a arena demo (ambiente de desenvolvimento).
 */

import { ArenaRepository } from "./arenaRepository";
import { ARENA_PADRAO_ID, ARENA_PADRAO_SLUG } from "./defaultArena";
import { extrairSubdominio } from "./subdomain";

let promessaArenaAtiva: Promise<string | null> | null = null;

/**
 * Slug da arena do host atual (subdomínio) ou o slug da demo quando não houver subdomínio.
 *
 * @returns Slug da arena ativa
 *
 * @example
 * ```ts
 * // em https://central.reservei.com.br
 * obterSlugArenaAtiva(); // "central"
 * ```
 */
export function obterSlugArenaAtiva(): string {
  if (typeof window === "undefined") return ARENA_PADRAO_SLUG;
  return extrairSubdominio(window.location.host) ?? ARENA_PADRAO_SLUG;
}

/**
 * Retorna o `arena_id` da arena ativa (memoizado por aba).
 *
 * @returns Identificador da arena, ou null se o subdomínio não corresponde a nenhuma arena ativa
 *
 * @example
 * ```ts
 * const arenaId = await obterArenaAtivaId();
 * if (arenaId) await supabase.from("contratos_recorrentes").select("*").eq("arena_id", arenaId);
 * ```
 */
export function obterArenaAtivaId(): Promise<string | null> {
  if (!promessaArenaAtiva) {
    const slug = obterSlugArenaAtiva();
    promessaArenaAtiva =
      slug === ARENA_PADRAO_SLUG
        ? Promise.resolve(ARENA_PADRAO_ID)
        : ArenaRepository.buscarPorSlug(slug)
            .then((arena) => arena?.id ?? null)
            .catch(() => null);
  }
  return promessaArenaAtiva;
}

/**
 * Descarta a arena memoizada. Uso exclusivo de testes automatizados.
 */
export function redefinirArenaAtivaParaTestes(): void {
  promessaArenaAtiva = null;
}
