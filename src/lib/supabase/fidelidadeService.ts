/**
 * Camada de persistência do Sistema de Fidelidade no navegador.
 *
 * - Leituras (campanha, selos e vouchers) são feitas direto no Supabase, sempre na arena ativa; o RLS
 *   garante que o atleta só veja os próprios selos e vouchers e que operadores vejam os da arena.
 * - A emissão de selos e vouchers acontece SOMENTE no servidor (`POST /api/fidelidade/sincronizar`),
 *   para que nenhum atleta consiga forjar benefícios pelo navegador.
 * - Sem Supabase (desenvolvimento offline), os dados ficam no LocalStorage e a regra roda localmente.
 */

import { supabase, isSupabaseConfigured } from "./client";
import type { Reserva } from "@/store/useReservasStore";
import type {
  CampanhaFidelidade,
  SeloFidelidade,
  VoucherFidelidade,
} from "@/lib/fidelidade/types";
import {
  CAMPANHA_PADRAO,
  avaliarElegibilidadeReservaParaSelo,
  construirSeloParaReserva,
  calcularProgressoUsuario,
  resgatarVoucherFidelidade,
} from "@/lib/fidelidade/fidelidadeService";
import {
  campanhaToRow,
  rowToCampanha,
  rowToSelo,
  rowToVoucher,
  type CampanhaDbRow,
  type SeloDbRow,
  type VoucherDbRow,
} from "@/lib/fidelidade/fidelidadeMapper";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";
import { ARENA_PADRAO_ID } from "@/lib/arena/defaultArena";
import { chamarApi } from "@/lib/api/clienteApi";

const TABELA_CAMPANHA = "fidelidade_campanha";
const TABELA_SELOS = "fidelidade_selos";
const TABELA_VOUCHERS = "fidelidade_vouchers";

const STORAGE_CAMPANHA_KEY = "reservei_fidelidade_campanha";
const STORAGE_SELOS_KEY = "reservei_fidelidade_selos";
const STORAGE_VOUCHERS_KEY = "reservei_fidelidade_vouchers";

// ── Helpers de LocalStorage (modo offline) ───────────────────────────────────

function lerLocalStorage<T>(chave: string, valorPadrao: T): T {
  if (typeof window === "undefined") return valorPadrao;
  try {
    const raw = localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : valorPadrao;
  } catch {
    return valorPadrao;
  }
}

function salvarLocalStorage<T>(chave: string, valor: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (err) {
    console.error(`[FidelidadeService] Falha ao persistir LocalStorage (${chave}):`, err);
  }
}

/**
 * Id da campanha de uma arena. A demo mantém o id padrão histórico; as demais arenas recebem um id
 * próprio, já que `id` é chave primária e não pode colidir entre arenas.
 */
export function idCampanhaDaArena(arenaId: string): string {
  return arenaId === ARENA_PADRAO_ID ? CAMPANHA_PADRAO.id : `campanha_${arenaId}`;
}

// ── Campanha ────────────────────────────────────────────────────────────────

/**
 * Carrega a campanha de fidelidade da arena ativa (ou a padrão, se a arena ainda não configurou).
 *
 * @returns Campanha vigente
 */
export async function fetchCampanhaSupabase(): Promise<CampanhaFidelidade> {
  if (!isSupabaseConfigured()) {
    return lerLocalStorage<CampanhaFidelidade>(STORAGE_CAMPANHA_KEY, CAMPANHA_PADRAO);
  }

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return CAMPANHA_PADRAO;

    const { data, error } = await supabase
      .from(TABELA_CAMPANHA)
      .select("*")
      .eq("arena_id", arenaId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { ...CAMPANHA_PADRAO, id: idCampanhaDaArena(arenaId) };
    }
    return rowToCampanha(data as CampanhaDbRow);
  } catch (err) {
    console.error("[FidelidadeService] Erro ao buscar campanha do Supabase:", err);
    return CAMPANHA_PADRAO;
  }
}

/**
 * Salva a configuração da campanha de fidelidade da arena ativa (painel administrativo).
 *
 * @param campanha Campanha a gravar
 * @returns Campanha salva
 * @throws Error se o banco recusar a gravação
 */
export async function salvarCampanhaSupabase(
  campanha: CampanhaFidelidade
): Promise<CampanhaFidelidade> {
  const payload = { ...campanha, atualizadoEm: new Date().toISOString() };

  if (!isSupabaseConfigured()) {
    salvarLocalStorage(STORAGE_CAMPANHA_KEY, payload);
    return payload;
  }

  const arenaId = await obterArenaAtivaId();
  if (!arenaId) throw new Error("Arena não identificada para salvar a campanha.");

  const salva = {
    ...payload,
    id: payload.id && payload.id !== CAMPANHA_PADRAO.id ? payload.id : idCampanhaDaArena(arenaId),
  };
  const { error } = await supabase.from(TABELA_CAMPANHA).upsert(campanhaToRow(salva, arenaId));
  if (error) throw new Error(`Falha ao salvar a campanha: ${error.message}`);
  return salva;
}

// ── Selos e vouchers (leitura) ──────────────────────────────────────────────

/**
 * Retorna os selos do usuário na arena ativa.
 *
 * @param usuarioId Id do atleta (uid do Supabase Auth)
 * @returns Selos, do mais recente ao mais antigo
 */
export async function fetchSelosUsuarioSupabase(usuarioId: string): Promise<SeloFidelidade[]> {
  if (!isSupabaseConfigured() || !usuarioId) {
    return lerLocalStorage<SeloFidelidade[]>(STORAGE_SELOS_KEY, []).filter((s) => s.usuarioId === usuarioId);
  }

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase
      .from(TABELA_SELOS)
      .select("*")
      .eq("arena_id", arenaId)
      .eq("usuario_id", usuarioId)
      .order("criado_em", { ascending: false });

    if (error || !data) return [];
    return (data as SeloDbRow[]).map(rowToSelo);
  } catch (err) {
    console.error("[FidelidadeService] Erro ao buscar selos do Supabase:", err);
    return [];
  }
}

/**
 * Retorna os vouchers do usuário na arena ativa.
 *
 * @param usuarioId Id do atleta (uid do Supabase Auth)
 * @returns Vouchers, do mais recente ao mais antigo
 */
export async function fetchVouchersUsuarioSupabase(
  usuarioId: string
): Promise<VoucherFidelidade[]> {
  if (!isSupabaseConfigured() || !usuarioId) {
    return lerLocalStorage<VoucherFidelidade[]>(STORAGE_VOUCHERS_KEY, []).filter(
      (v) => v.usuarioId === usuarioId
    );
  }

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase
      .from(TABELA_VOUCHERS)
      .select("*")
      .eq("arena_id", arenaId)
      .eq("usuario_id", usuarioId)
      .order("criado_em", { ascending: false });

    if (error || !data) return [];
    return (data as VoucherDbRow[]).map(rowToVoucher);
  } catch (err) {
    console.error("[FidelidadeService] Erro ao buscar vouchers do Supabase:", err);
    return [];
  }
}

/**
 * Retorna todos os vouchers emitidos pela arena ativa (relatórios do administrador).
 */
export async function fetchTodosVouchersAdminSupabase(): Promise<VoucherFidelidade[]> {
  if (!isSupabaseConfigured()) {
    return lerLocalStorage<VoucherFidelidade[]>(STORAGE_VOUCHERS_KEY, []);
  }

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase
      .from(TABELA_VOUCHERS)
      .select("*")
      .eq("arena_id", arenaId)
      .order("criado_em", { ascending: false });

    if (error || !data) return [];
    return (data as VoucherDbRow[]).map(rowToVoucher);
  } catch (err) {
    console.error("[FidelidadeService] Erro ao buscar todos os vouchers no Supabase:", err);
    return [];
  }
}

/**
 * Retorna todos os selos da arena ativa (métricas do administrador).
 */
export async function fetchTodosSelosAdminSupabase(): Promise<SeloFidelidade[]> {
  if (!isSupabaseConfigured()) {
    return lerLocalStorage<SeloFidelidade[]>(STORAGE_SELOS_KEY, []);
  }

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase
      .from(TABELA_SELOS)
      .select("*")
      .eq("arena_id", arenaId)
      .order("criado_em", { ascending: false });

    if (error || !data) return [];
    return (data as SeloDbRow[]).map(rowToSelo);
  } catch (err) {
    console.error("[FidelidadeService] Erro ao buscar todos os selos no Supabase:", err);
    return [];
  }
}

// ── Emissão (servidor ou modo offline) ──────────────────────────────────────

/**
 * Executa a sincronização local (modo offline, sem Supabase): gera selos das partidas concluídas e
 * emite o voucher automático quando a meta é atingida.
 */
function sincronizarFidelidadeLocal(
  usuarioId: string,
  reservasDoUsuario: Reserva[],
  campanha: CampanhaFidelidade
): VoucherFidelidade | null {
  const todosSelos = lerLocalStorage<SeloFidelidade[]>(STORAGE_SELOS_KEY, []);
  const todosVouchers = lerLocalStorage<VoucherFidelidade[]>(STORAGE_VOUCHERS_KEY, []);
  const agora = new Date();

  const novos: SeloFidelidade[] = [];
  for (const reserva of reservasDoUsuario) {
    const doUsuario = [...todosSelos.filter((s) => s.usuarioId === usuarioId), ...novos];
    if (avaliarElegibilidadeReservaParaSelo(reserva, doUsuario, agora).elegivel) {
      novos.push(construirSeloParaReserva(reserva, usuarioId, campanha));
    }
  }
  let selos = [...novos, ...todosSelos];

  const progresso = calcularProgressoUsuario(usuarioId, selos, todosVouchers, campanha);
  let voucher: VoucherFidelidade | null = null;
  if (progresso.podeResgatar) {
    const resgate = resgatarVoucherFidelidade(usuarioId, progresso.selosAtivos, campanha);
    const usados = new Map(resgate.selosUtilizados.map((s) => [s.id, s]));
    selos = selos.map((s) => usados.get(s.id) ?? s);
    voucher = resgate.voucher;
    salvarLocalStorage(STORAGE_VOUCHERS_KEY, [voucher, ...todosVouchers]);
  }

  salvarLocalStorage(STORAGE_SELOS_KEY, selos);
  return voucher;
}

/**
 * Pede ao servidor para contabilizar os selos das partidas concluídas do atleta autenticado e emitir
 * o voucher automático quando a meta for atingida. Sem Supabase, executa a mesma regra localmente.
 *
 * @param usuarioId Id do atleta
 * @param reservasDoUsuario Reservas do atleta (usadas apenas no modo offline)
 * @param campanha Campanha vigente (usada apenas no modo offline)
 * @returns Voucher emitido nesta sincronização, se houver
 */
export async function sincronizarFidelidade(
  usuarioId: string,
  reservasDoUsuario: Reserva[],
  campanha: CampanhaFidelidade
): Promise<{ voucherGerado: VoucherFidelidade | null }> {
  if (!usuarioId || !campanha.ativo) return { voucherGerado: null };

  if (!isSupabaseConfigured()) {
    return { voucherGerado: sincronizarFidelidadeLocal(usuarioId, reservasDoUsuario, campanha) };
  }

  const arenaId = await obterArenaAtivaId();
  if (!arenaId) return { voucherGerado: null };

  const res = await chamarApi<{ voucherGerado?: VoucherFidelidade | null }>("/api/fidelidade/sincronizar", {
    method: "POST",
    corpo: { arenaId },
  });
  if (!res.ok) {
    console.warn("[FidelidadeService] Sincronização de fidelidade indisponível:", res.erro);
    return { voucherGerado: null };
  }
  return { voucherGerado: res.dados?.voucherGerado ?? null };
}
