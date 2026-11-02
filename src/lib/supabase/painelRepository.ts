/**
 * @module supabase/painelRepository
 *
 * Leituras do painel calculadas no banco (a RLS limita à equipe da arena): resumo financeiro do
 * período, lista paginada de reservas do Financeiro e a lista de clientes agrupada por WhatsApp.
 * Nada aqui traz o histórico inteiro para o navegador.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Planos C e F)
 */

import { supabase, isSupabaseConfigured } from "./client";
import { rowToReserva, type ReservaDbRow } from "./types";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";
import { variacoesDoTelefone } from "@/lib/atletas/telefone";
import type { Reserva } from "@/store/useReservasStore";

async function arenaOuErro(): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Banco de dados não configurado.");
  const arenaId = await obterArenaAtivaId();
  if (!arenaId) throw new Error("Arena não identificada.");
  return arenaId;
}

const num = (v: unknown) => Number(v) || 0;

/** Totais do período (pelo dia do jogo). */
export interface ResumoFinanceiro {
  reservas: number;
  recebido: number;
  aReceber: number;
  valorTabela: number;
  descontos: number;
  aguardandoPix: number;
  canceladas: number;
  devolvido: number;
  porDia: { data: string; recebido: number; aReceber: number }[];
  porQuadra: { quadraId: string; reservas: number; recebido: number; aReceber: number }[];
}

/**
 * Resumo financeiro do período, calculado pela função `resumo_financeiro`.
 *
 * @throws Error se o banco recusar (ex.: migração 2026-11-02-b não aplicada)
 */
export async function buscarResumoFinanceiro(inicio: string, fim: string): Promise<ResumoFinanceiro> {
  const arenaId = await arenaOuErro();
  const { data, error } = await supabase.rpc("resumo_financeiro", { p_arena_id: arenaId, p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(`Não foi possível calcular o financeiro: ${error.message}`);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    reservas: num(r.reservas),
    recebido: num(r.recebido),
    aReceber: num(r.a_receber),
    valorTabela: num(r.valor_tabela),
    descontos: num(r.descontos),
    aguardandoPix: num(r.aguardando_pix),
    canceladas: num(r.canceladas),
    devolvido: num(r.devolvido),
    porDia: ((r.por_dia as Record<string, unknown>[]) ?? []).map((d) => ({ data: String(d.data), recebido: num(d.recebido), aReceber: num(d.a_receber) })),
    porQuadra: ((r.por_quadra as Record<string, unknown>[]) ?? []).map((q) => ({
      quadraId: String(q.quadra_id),
      reservas: num(q.reservas),
      recebido: num(q.recebido),
      aReceber: num(q.a_receber),
    })),
  };
}

/** Situação usada no filtro do Financeiro. */
export type SituacaoFinanceiro = "todas" | "falta_pagar" | "quitadas" | "canceladas" | "aguardando_pix";

export interface FiltroFinanceiro {
  inicio: string;
  fim: string;
  situacao: SituacaoFinanceiro;
  quadraId?: string;
  /** Nome ou WhatsApp do cliente */
  busca?: string;
  pagina: number;
  porPagina: number;
}

/**
 * Reservas do período para o Financeiro, paginadas no banco (sem bloqueios).
 *
 * @returns Itens da página e o total do filtro
 */
export async function listarReservasFinanceiro(f: FiltroFinanceiro): Promise<{ itens: Reserva[]; total: number }> {
  const arenaId = await arenaOuErro();
  let consulta = supabase
    .from("reservas")
    .select("*", { count: "exact" })
    .eq("arena_id", arenaId)
    .gte("data", f.inicio)
    .lte("data", f.fim)
    .neq("tipo_reserva", "manutencao_bloqueio");
  if (f.situacao === "falta_pagar") consulta = consulta.eq("status", "pendente").gt("valor_pendente", 0);
  if (f.situacao === "quitadas") consulta = consulta.eq("status", "confirmada");
  if (f.situacao === "canceladas") consulta = consulta.eq("status", "cancelada");
  if (f.situacao === "aguardando_pix") consulta = consulta.eq("status", "em_processamento");
  if (f.quadraId) consulta = consulta.eq("quadra_id", f.quadraId);
  const busca = (f.busca ?? "").trim().replace(/[%,()]/g, " ");
  if (busca) {
    const digitos = busca.replace(/\D/g, "");
    consulta = digitos.length >= 4 ? consulta.ilike("whatsapp_cliente", `%${digitos}%`) : consulta.ilike("nome_cliente", `%${busca}%`);
  }
  const de = (f.pagina - 1) * f.porPagina;
  const { data, error, count } = await consulta
    .order("data", { ascending: false })
    .order("hora_inicio", { ascending: false })
    .range(de, de + f.porPagina - 1);
  if (error) throw new Error(`Não foi possível carregar as reservas: ${error.message}`);
  return { itens: ((data ?? []) as ReservaDbRow[]).map(rowToReserva), total: count ?? 0 };
}

/** Um cliente da arena (com ou sem conta), agrupado pelo WhatsApp. */
export interface ClienteArena {
  telefone: string;
  nome: string;
  outrosNomes: string[];
  usuarioId: string | null;
  reservas: number;
  canceladas: number;
  ultimaData: string | null;
  proximaData: string | null;
  totalGasto: number;
  bloqueado: { motivo: string; por: string | null; em: string } | null;
}

/**
 * Clientes da arena (função `clientes_da_arena`) com o bloqueio desta arena.
 *
 * @throws Error se o banco recusar
 */
export async function listarClientesDaArena(): Promise<ClienteArena[]> {
  const arenaId = await arenaOuErro();
  const [{ data, error }, bloqueios] = await Promise.all([
    supabase.rpc("clientes_da_arena", { p_arena_id: arenaId }),
    supabase.from("arena_clientes_bloqueados").select("telefone, motivo, bloqueado_por_nome, criado_em").eq("arena_id", arenaId),
  ]);
  if (error) throw new Error(`Não foi possível carregar os clientes: ${error.message}`);
  const porTelefone = new Map(((bloqueios.data ?? []) as Record<string, unknown>[]).map((b) => [String(b.telefone), b]));
  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const b = porTelefone.get(String(c.telefone));
    return {
      telefone: String(c.telefone),
      nome: String(c.nome ?? ""),
      outrosNomes: ((c.outros_nomes as string[]) ?? []).filter(Boolean),
      usuarioId: (c.usuario_id as string | null) ?? null,
      reservas: num(c.reservas),
      canceladas: num(c.canceladas),
      ultimaData: (c.ultima_data as string | null) ?? null,
      proximaData: (c.proxima_data as string | null) ?? null,
      totalGasto: num(c.total_gasto),
      bloqueado: b ? { motivo: String(b.motivo), por: (b.bloqueado_por_nome as string | null) ?? null, em: String(b.criado_em) } : null,
    };
  });
}

/**
 * Reservas de um cliente (pelo WhatsApp), da mais nova para a mais antiga.
 *
 * @param telefone WhatsApp do cliente
 * @param limite Máximo de reservas
 */
export async function listarReservasDoCliente(telefone: string, limite = 100): Promise<Reserva[]> {
  const arenaId = await arenaOuErro();
  const variacoes = variacoesDoTelefone(telefone);
  if (variacoes.length === 0) return [];
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .eq("arena_id", arenaId)
    .in("whatsapp_cliente", variacoes)
    .order("data", { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Não foi possível carregar as reservas do cliente: ${error.message}`);
  return ((data ?? []) as ReservaDbRow[]).map(rowToReserva);
}
