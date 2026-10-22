import { supabase, isSupabaseConfigured } from "./client";
import { rowToContrato, contratoToRow, type ContratoDbRow } from "@/lib/recorrencia/contratoMapper";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";

const TABELA_CONTRATOS = "contratos_recorrentes";

/**
 * Busca os contratos recorrentes da arena ativa. Visitantes enxergam apenas escolinhas ativas
 * (dados comerciais); grupos e mensalistas ficam restritos aos operadores pelo RLS.
 *
 * @returns Contratos da arena, ou null se o Supabase não estiver disponível ou a consulta falhar
 */
export async function fetchContratosSupabase(): Promise<ContratoRecorrente[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase
      .from(TABELA_CONTRATOS)
      .select("*")
      .eq("arena_id", arenaId)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("[Supabase] Erro ao carregar contratos:", error.message);
      return null;
    }
    return (data as ContratoDbRow[]).map(rowToContrato);
  } catch (err) {
    console.error("[Supabase] Falha inesperada ao buscar contratos:", err);
    return null;
  }
}

/**
 * Insere um contrato na arena ativa (somente operadores, garantido pelo RLS).
 *
 * @param contrato Contrato a gravar
 * @returns true em caso de sucesso
 */
export async function inserirContratoSupabase(contrato: ContratoRecorrente): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return false;

    const { error } = await supabase
      .from(TABELA_CONTRATOS)
      .insert([{ ...contratoToRow(contrato), arena_id: arenaId }]);
    if (error) {
      console.error("[Supabase] Erro ao inserir contrato:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Supabase] Falha inesperada ao inserir contrato:", err);
    return false;
  }
}

/**
 * Atualiza campos de um contrato existente.
 *
 * @param id Identificador do contrato
 * @param dados Campos a alterar
 * @returns true se o banco confirmou a alteração
 */
export async function atualizarContratoSupabase(
  id: string,
  dados: Partial<ContratoRecorrente>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from(TABELA_CONTRATOS)
      .update(contratoToRow(dados))
      .eq("id", id);

    if (error) {
      console.error(`[Supabase] Erro ao atualizar contrato ${id}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase] Falha inesperada ao atualizar contrato ${id}:`, err);
    return false;
  }
}
