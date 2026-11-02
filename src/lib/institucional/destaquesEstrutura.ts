/**
 * @module institucional/destaquesEstrutura
 *
 * Tópicos "Na arena" da seção Estrutura do site ("**3 quadras de areia** tratada"), gravados em
 * `arena_conteudo.destaques_estrutura`. O dono adiciona, edita, reordena e exclui pela tela Site.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §9.1
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";
import type { DestaqueEstrutura } from "@/lib/portal/types";

export type { DestaqueEstrutura };

/** Limites (o site é um box estreito ao lado das fotos). */
export const MAX_DESTAQUES = 8;
export const MAX_DESTAQUE = 40;
export const MAX_RESTO = 70;

/**
 * Valida a lista antes de gravar.
 *
 * @returns Mensagens de erro (vazia = válida)
 *
 * @example
 * ```ts
 * validarDestaques([{ destaque: "", resto: "x" }]); // ["Tópico 1: escreva a parte em negrito."]
 * ```
 */
export function validarDestaques(lista: DestaqueEstrutura[]): string[] {
  const erros: string[] = [];
  if (lista.length > MAX_DESTAQUES) erros.push(`Use até ${MAX_DESTAQUES} tópicos.`);
  const vistos = new Set<string>();
  lista.forEach((d, i) => {
    const n = i + 1;
    const destaque = d.destaque.trim();
    if (!destaque) erros.push(`Tópico ${n}: escreva a parte em negrito.`);
    else if (destaque.length > MAX_DESTAQUE) erros.push(`Tópico ${n}: a parte em negrito tem até ${MAX_DESTAQUE} letras.`);
    if (d.resto.trim().length > MAX_RESTO) erros.push(`Tópico ${n}: o complemento tem até ${MAX_RESTO} letras.`);
    const chave = destaque.toLowerCase();
    if (destaque && vistos.has(chave)) erros.push(`Tópico ${n}: repetido.`);
    vistos.add(chave);
  });
  return erros;
}

/** Limpa espaços e tira linhas totalmente vazias. */
export function limparDestaques(lista: DestaqueEstrutura[]): DestaqueEstrutura[] {
  return lista.map((d) => ({ destaque: d.destaque.trim(), resto: d.resto.trim() })).filter((d) => d.destaque || d.resto);
}

/**
 * Move um item uma posição para cima (-1) ou para baixo (+1).
 *
 * @example
 * ```ts
 * mover(["a", "b", "c"], 2, -1); // ["a", "c", "b"]
 * ```
 */
export function mover<T>(lista: readonly T[], indice: number, sentido: -1 | 1): T[] {
  const destino = indice + sentido;
  if (destino < 0 || destino >= lista.length) return [...lista];
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

const CHAVE_LOCAL = "reservei:destaques-estrutura";

/** Converte o JSON do banco (ignora itens sem a parte em negrito). */
export function lerDestaquesDoBanco(valor: unknown): DestaqueEstrutura[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>) : {}))
    .filter((o) => typeof o.destaque === "string" && o.destaque.trim())
    .map((o) => ({ destaque: String(o.destaque), resto: typeof o.resto === "string" ? o.resto : "" }));
}

/**
 * Lê os tópicos da arena ativa.
 *
 * @throws Error se a consulta falhar
 */
export async function carregarDestaques(): Promise<DestaqueEstrutura[]> {
  if (!isSupabaseConfigured()) {
    try {
      return lerDestaquesDoBanco(JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? "[]"));
    } catch {
      return [];
    }
  }
  const arenaId = await obterArenaAtivaId();
  if (!arenaId) throw new Error("Arena não identificada.");
  const { data, error } = await supabase.from("arena_conteudo").select("destaques_estrutura").eq("arena_id", arenaId).maybeSingle();
  if (error) throw new Error(`Não foi possível ler os tópicos: ${error.message}`);
  return lerDestaquesDoBanco(data?.destaques_estrutura);
}

/**
 * Grava os tópicos da arena ativa (cria a linha de conteúdo se a arena ainda não tiver).
 *
 * @throws Error se o banco recusar
 */
export async function salvarDestaques(lista: DestaqueEstrutura[]): Promise<void> {
  const limpos = limparDestaques(lista);
  if (!isSupabaseConfigured()) {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(limpos));
    } catch {
      // Sem armazenamento local: nada a fazer no modo sem banco
    }
    return;
  }
  const arenaId = await obterArenaAtivaId();
  if (!arenaId) throw new Error("Arena não identificada.");
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("arena_conteudo")
    .update({ destaques_estrutura: limpos, atualizado_em: agora })
    .eq("arena_id", arenaId)
    .select("arena_id");
  if (error) throw new Error(`Não foi possível salvar os tópicos: ${error.message}`);
  if (!data || data.length === 0) {
    const { error: erroInsert } = await supabase.from("arena_conteudo").insert({ arena_id: arenaId, destaques_estrutura: limpos, atualizado_em: agora });
    if (erroInsert) throw new Error(`Não foi possível salvar os tópicos: ${erroInsert.message}`);
  }
}
