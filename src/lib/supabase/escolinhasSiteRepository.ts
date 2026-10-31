/**
 * @module supabase/escolinhasSiteRepository
 *
 * Repositório das escolinhas do site (`landing_page_schools`) para o painel do dono. Opera só na
 * arena ativa (subdomínio); a RLS garante que apenas a equipe da arena grava. Falhas do banco são
 * propagadas para a tela avisar o operador em vez de fingir que salvou.
 *
 * @see SPEC/2026-10-31-escolinhas-admin.md
 */

import { supabase, isSupabaseConfigured } from "./client";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";
import {
  limparNomeProfessor,
  linkValido,
  mensagemPadraoEscolinha,
  normalizarWhatsApp,
  resumirTurmas,
  turmasPreenchidas,
  type EscolinhaSite,
  type EscolinhaSiteInput,
  type TurmaSite,
} from "@/lib/institucional/escolinhasSite";

const TABELA = "landing_page_schools";

/** Linha do banco (colunas usadas pelo painel). */
export interface EscolinhaSiteDbRow {
  id: string;
  nome?: string | null;
  sport_name: string;
  teacher_name: string;
  teacher_image_url?: string | null;
  descricao?: string | null;
  turmas?: unknown;
  whatsapp_number?: string | null;
  botao_tipo?: string | null;
  botao_url?: string | null;
  mensagem_whatsapp?: string | null;
  ordem?: number | null;
  is_active?: boolean | null;
}

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Converte a linha do banco na escolinha do painel. A categoria da turma é gravada como `nivel`
 * no JSON (mesma chave que o site lê).
 */
export function linhaParaEscolinhaSite(row: EscolinhaSiteDbRow): EscolinhaSite {
  const turmas: TurmaSite[] = Array.isArray(row.turmas)
    ? row.turmas
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .map((t) => ({ dias: texto(t.dias), horas: texto(t.horas), categoria: texto(t.nivel) }))
    : [];
  return {
    id: row.id,
    nome: texto(row.nome),
    esporte: texto(row.sport_name),
    professor: limparNomeProfessor(texto(row.teacher_name)),
    fotoProfessorUrl: texto(row.teacher_image_url),
    descricao: texto(row.descricao),
    turmas,
    tipoBotao: row.botao_tipo === "link" ? "link" : "whatsapp",
    whatsapp: texto(row.whatsapp_number),
    mensagemWhatsapp: texto(row.mensagem_whatsapp),
    linkBotao: texto(row.botao_url),
    ordem: row.ordem ?? 0,
    ativa: row.is_active ?? true,
  };
}

/**
 * Monta as colunas gravadas a partir do formulário. Mensagem igual à padrão é gravada vazia, para
 * acompanhar mudanças de esporte ou professor; o link só é gravado quando o botão é de link.
 */
export function escolinhaSiteParaColunas(input: EscolinhaSiteInput): Record<string, unknown> {
  const professor = limparNomeProfessor(input.professor);
  const mensagem = input.mensagemWhatsapp.trim();
  const ehLink = input.tipoBotao === "link" && linkValido(input.linkBotao);
  const turmas = turmasPreenchidas(input.turmas);
  return {
    nome: input.nome.trim() || null,
    sport_name: input.esporte.trim(),
    teacher_name: professor,
    teacher_image_url: input.fotoProfessorUrl.trim() || null,
    descricao: input.descricao.trim() || null,
    turmas: turmas.map((t) => ({ dias: t.dias, horas: t.horas, nivel: t.categoria })),
    schedule_info: resumirTurmas(turmas) || null,
    whatsapp_number: normalizarWhatsApp(input.whatsapp) || null,
    botao_tipo: ehLink ? "link" : "whatsapp",
    botao_url: ehLink ? input.linkBotao.trim() : null,
    mensagem_whatsapp: !mensagem || mensagem === mensagemPadraoEscolinha(input.esporte, professor) ? null : mensagem,
    ordem: input.ordem,
    is_active: input.ativa,
  };
}

async function exigirArena(): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Banco de dados não configurado.");
  const arenaId = await obterArenaAtivaId();
  if (!arenaId) throw new Error("Arena não identificada para esta operação.");
  return arenaId;
}

function lancarSeErro(error: { message: string } | null, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

/**
 * Lista as escolinhas da arena ativa (visíveis e ocultas), na ordem do site.
 *
 * @throws Error se o banco recusar a leitura
 */
export async function listarEscolinhasSite(): Promise<EscolinhaSite[]> {
  const arenaId = await exigirArena();
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .eq("arena_id", arenaId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  lancarSeErro(error, "Falha ao carregar as escolinhas");
  return ((data ?? []) as EscolinhaSiteDbRow[]).map(linhaParaEscolinhaSite);
}

/**
 * Cadastra uma escolinha na arena ativa.
 *
 * @example
 * ```ts
 * const criada = await criarEscolinhaSite({ ...escolinhaVazia(), esporte: "Vôlei", professor: "Lucas" });
 * ```
 * @throws Error se o banco recusar a gravação
 */
export async function criarEscolinhaSite(input: EscolinhaSiteInput): Promise<EscolinhaSite> {
  const arenaId = await exigirArena();
  const id = `esc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabase
    .from(TABELA)
    .insert({ id, arena_id: arenaId, ...escolinhaSiteParaColunas(input) })
    .select("*")
    .single();
  lancarSeErro(error, "Falha ao salvar a escolinha");
  return linhaParaEscolinhaSite(data as EscolinhaSiteDbRow);
}

/**
 * Atualiza uma escolinha da arena ativa.
 *
 * @throws Error se o banco recusar a gravação ou a escolinha não for da arena
 */
export async function atualizarEscolinhaSite(id: string, input: EscolinhaSiteInput): Promise<EscolinhaSite> {
  const arenaId = await exigirArena();
  const { data, error } = await supabase
    .from(TABELA)
    .update(escolinhaSiteParaColunas(input))
    .eq("id", id)
    .eq("arena_id", arenaId)
    .select("*")
    .maybeSingle();
  lancarSeErro(error, "Falha ao atualizar a escolinha");
  if (!data) throw new Error("Escolinha não encontrada nesta arena.");
  return linhaParaEscolinhaSite(data as EscolinhaSiteDbRow);
}

/**
 * Mostra ou esconde a escolinha no site, sem mexer no resto.
 *
 * @throws Error se o banco recusar a gravação
 */
export async function alterarVisibilidadeEscolinhaSite(id: string, ativa: boolean): Promise<void> {
  const arenaId = await exigirArena();
  const { error } = await supabase.from(TABELA).update({ is_active: ativa }).eq("id", id).eq("arena_id", arenaId);
  lancarSeErro(error, "Falha ao alterar a escolinha");
}

/**
 * Exclui a escolinha do site. As turmas da agenda (contratos) continuam; só perdem o vínculo.
 *
 * @throws Error se o banco recusar a exclusão
 */
export async function excluirEscolinhaSite(id: string): Promise<void> {
  const arenaId = await exigirArena();
  const { error } = await supabase.from(TABELA).delete().eq("id", id).eq("arena_id", arenaId);
  lancarSeErro(error, "Falha ao excluir a escolinha");
  await supabase.from("contratos_recorrentes").update({ escolinha_id: null }).eq("escolinha_id", id).eq("arena_id", arenaId);
}
