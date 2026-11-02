/**
 * @file fidelidadeServidorService.ts
 * @description Casos de uso do programa de fidelidade executados SOMENTE no servidor (service role).
 *
 * - Emissão de selos das partidas concluídas e do pedido de hora grátis ao atingir a meta
 *   (nasce "em análise"; o dono ou gerente libera ou recusa em {@link analisarVoucher}).
 * - Validação dos vouchers aplicados no checkout (titularidade, arena, status e validade).
 * - Consumo dos vouchers quando a reserva é efetivamente paga ou 100% coberta.
 *
 * Nenhuma dessas operações é exposta ao navegador: o atleta não consegue forjar selos ou vouchers.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { rowToReserva, type ReservaDbRow } from "@/lib/supabase/types";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { arenaTemModulo } from "@/lib/servidor/modulosServidor";
import type { CampanhaFidelidade, SeloFidelidade, VoucherFidelidade } from "./types";
import {
  CAMPANHA_PADRAO,
  avaliarElegibilidadeReservaParaSelo,
  calcularProgressoUsuario,
  construirSeloParaReserva,
  isDataExpirada,
  obterDataHojeIso,
  resgatarVoucherFidelidade,
} from "./fidelidadeService";
import {
  rowToCampanha,
  rowToSelo,
  rowToVoucher,
  seloToRow,
  voucherToRow,
  type CampanhaDbRow,
  type SeloDbRow,
  type VoucherDbRow,
} from "./fidelidadeMapper";

/** Limite de vouchers aplicáveis numa única reserva (defesa contra payloads abusivos). */
const MAX_VOUCHERS_POR_RESERVA = 10;

/**
 * Carrega a campanha da arena (ou a padrão, quando a arena ainda não configurou a sua).
 *
 * @param arenaId Arena
 * @returns Campanha vigente
 */
export async function carregarCampanhaDaArena(arenaId: string): Promise<CampanhaFidelidade> {
  const { data, error } = await supabaseAdmin
    .from("fidelidade_campanha")
    .select("*")
    .eq("arena_id", arenaId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToCampanha(data as CampanhaDbRow) : CAMPANHA_PADRAO;
}

/**
 * Valida os vouchers escolhidos no checkout: precisam pertencer ao atleta autenticado e à arena,
 * estar disponíveis e dentro da validade.
 *
 * @param usuarioId Atleta autenticado (null para visitantes)
 * @param arenaId Arena da reserva
 * @param voucherIds Ids escolhidos no navegador
 * @returns Vouchers válidos, na ordem recebida
 * @throws ErroHttp 401 (visitante tentando usar voucher) ou 422 (voucher inválido)
 */
export async function validarVouchersParaCheckout(
  usuarioId: string | null,
  arenaId: string,
  voucherIds: string[]
): Promise<VoucherFidelidade[]> {
  const ids = [...new Set(voucherIds.filter((id) => typeof id === "string" && id.trim()))];
  if (ids.length === 0) return [];
  if (!usuarioId) throw new ErroHttp("Entre na sua conta para usar vouchers de fidelidade.", 401);
  if (ids.length > MAX_VOUCHERS_POR_RESERVA) throw new ErroHttp("Quantidade de vouchers inválida.", 422);

  const { data, error } = await supabaseAdmin
    .from("fidelidade_vouchers")
    .select("*")
    .in("id", ids)
    .eq("arena_id", arenaId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error(error.message);

  const hoje = obterDataHojeIso();
  const validos = ((data ?? []) as VoucherDbRow[])
    .map(rowToVoucher)
    .filter((v) => v.status === "disponivel" && !isDataExpirada(v.expiraEm, hoje));

  if (validos.length !== ids.length) {
    throw new ErroHttp("Um ou mais vouchers não estão mais disponíveis. Atualize a página.", 422);
  }
  return validos;
}

/**
 * Marca como utilizados os vouchers aplicados numa reserva (chamado na confirmação do pagamento
 * ou na criação de uma reserva 100% coberta). Só altera vouchers ainda disponíveis.
 *
 * @param arenaId Arena da reserva
 * @param codigos Códigos gravados em `reservas.vouchers_utilizados`
 * @param reservaId Reserva beneficiada
 */
export async function consumirVouchersDaReserva(
  arenaId: string,
  codigos: string[],
  reservaId: string
): Promise<void> {
  if (!codigos || codigos.length === 0) return;
  const { error } = await supabaseAdmin
    .from("fidelidade_vouchers")
    .update({ status: "utilizado", reserva_utilizada_id: reservaId, utilizado_em: new Date().toISOString() })
    .eq("arena_id", arenaId)
    .eq("status", "disponivel")
    .in("codigo", codigos);
  if (error) throw new Error(error.message);
}

/**
 * Contabiliza os selos das partidas concluídas do atleta na arena e emite o voucher automático
 * quando a meta de horas da campanha é atingida.
 *
 * Idempotente: cada reserva gera no máximo um selo (índice único em `fidelidade_selos.reserva_id`).
 *
 * @param usuarioId Atleta autenticado
 * @param arenaId Arena
 * @returns Voucher emitido nesta execução (ou null) e quantidade de selos novos
 */
export async function sincronizarFidelidadeServidor(
  usuarioId: string,
  arenaId: string
): Promise<{ voucherGerado: VoucherFidelidade | null; novosSelos: number }> {
  if (!(await arenaTemModulo(arenaId, "fidelidade"))) return { voucherGerado: null, novosSelos: 0 };
  const campanha = await carregarCampanhaDaArena(arenaId);
  if (!campanha.ativo) return { voucherGerado: null, novosSelos: 0 };

  // Reservas do atleta: vinculadas ao usuário ou feitas com o mesmo WhatsApp do cadastro
  const { data: perfil } = await supabaseAdmin
    .from("usuarios")
    .select("telefone")
    .eq("id", usuarioId)
    .maybeSingle();
  const telefone = String(perfil?.telefone ?? "").replace(/\D/g, "");

  let consulta = supabaseAdmin.from("reservas").select("*").eq("arena_id", arenaId);
  consulta = telefone
    ? consulta.or(`user_id.eq.${usuarioId},whatsapp_cliente.eq.${telefone}`)
    : consulta.eq("user_id", usuarioId);
  const { data: linhasReservas, error: erroReservas } = await consulta;
  if (erroReservas) throw new Error(erroReservas.message);
  const reservas = ((linhasReservas ?? []) as ReservaDbRow[]).map(rowToReserva);

  const [{ data: linhasSelos, error: erroSelos }, { data: linhasVouchers, error: erroVouchers }] =
    await Promise.all([
      supabaseAdmin.from("fidelidade_selos").select("*").eq("arena_id", arenaId).eq("usuario_id", usuarioId),
      supabaseAdmin.from("fidelidade_vouchers").select("*").eq("arena_id", arenaId).eq("usuario_id", usuarioId),
    ]);
  if (erroSelos) throw new Error(erroSelos.message);
  if (erroVouchers) throw new Error(erroVouchers.message);

  const selosAtuais = ((linhasSelos ?? []) as SeloDbRow[]).map(rowToSelo);
  const vouchersAtuais = ((linhasVouchers ?? []) as VoucherDbRow[]).map(rowToVoucher);

  // 1. Novos selos das partidas concluídas ainda não contabilizadas
  const agora = new Date();
  const novos: SeloFidelidade[] = [];
  for (const reserva of reservas) {
    if (avaliarElegibilidadeReservaParaSelo(reserva, [...selosAtuais, ...novos], agora).elegivel) {
      novos.push(construirSeloParaReserva(reserva, usuarioId, campanha));
    }
  }
  if (novos.length > 0) {
    const { error } = await supabaseAdmin
      .from("fidelidade_selos")
      .upsert(novos.map((s) => seloToRow(s, arenaId)), { onConflict: "reserva_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  // 2. Voucher automático ao atingir a meta
  const progresso = calcularProgressoUsuario(usuarioId, [...selosAtuais, ...novos], vouchersAtuais, campanha);
  if (!progresso.podeResgatar) return { voucherGerado: null, novosSelos: novos.length };

  // Bateu a meta: o pedido entra "em análise" e só vale depois que o dono liberar
  const resgate = resgatarVoucherFidelidade(usuarioId, progresso.selosAtivos, campanha);
  resgate.voucher.status = "em_analise";
  const { error: erroVoucher } = await supabaseAdmin
    .from("fidelidade_vouchers")
    .insert(voucherToRow(resgate.voucher, arenaId));
  if (erroVoucher) throw new Error(erroVoucher.message);

  const { error: erroResgate } = await supabaseAdmin
    .from("fidelidade_selos")
    .update({ resgatado: true, voucher_id: resgate.voucher.id })
    .in(
      "id",
      resgate.selosUtilizados.map((s) => s.id)
    )
    .eq("resgatado", false);
  if (erroResgate) throw new Error(erroResgate.message);

  return { voucherGerado: resgate.voucher, novosSelos: novos.length };
}

// ── Aprovação da hora grátis pelo dono (SPEC/2026-11-02-admin-ajustes-demo.md §10) ──────────────

/** Decisão do dono sobre um pedido de hora grátis. */
export type DecisaoVoucher = { decisao: "liberar" } | { decisao: "recusar"; motivo: string };

/** Tamanho do motivo da recusa. */
export const MOTIVO_RECUSA_MIN = 3;
export const MOTIVO_RECUSA_MAX = 200;

/**
 * Valida o corpo da requisição de análise.
 *
 * @throws ErroHttp 400 com a mensagem para o dono
 */
export function validarDecisaoVoucher(corpo: Record<string, unknown>): DecisaoVoucher {
  if (corpo.decisao === "liberar") return { decisao: "liberar" };
  if (corpo.decisao === "recusar") {
    const motivo = String(corpo.motivo ?? "").trim();
    if (motivo.length < MOTIVO_RECUSA_MIN) throw new ErroHttp("Diga o motivo da recusa (o atleta pode perguntar).", 400);
    if (motivo.length > MOTIVO_RECUSA_MAX) throw new ErroHttp(`O motivo tem até ${MOTIVO_RECUSA_MAX} letras.`, 400);
    return { decisao: "recusar", motivo };
  }
  throw new ErroHttp("Decisão inválida.", 400);
}

/**
 * Nova validade ao liberar: o prazo que o voucher teria a partir da emissão passa a contar do dia
 * da liberação (o atleta não perde dias enquanto a arena analisa).
 *
 * @example
 * ```ts
 * validadeAoLiberar("2026-11-01T10:00:00Z", "2026-12-31", "2026-11-05"); // "2027-01-04"
 * ```
 */
export function validadeAoLiberar(criadoEm: string, expiraEm: string, hoje: string): string {
  const dia = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const prazo = Math.max(1, Math.round((dia(expiraEm.slice(0, 10)) - dia(criadoEm.slice(0, 10))) / 86_400_000));
  const fim = new Date(dia(hoje) + prazo * 86_400_000);
  return fim.toISOString().slice(0, 10);
}

/**
 * Libera ou recusa um pedido de hora grátis "em análise". Só o dono ou o gerente (verificado na
 * rota). A troca de status é atômica (`status = 'em_analise'` no filtro): duas pessoas analisando
 * ao mesmo tempo não liberam duas vezes.
 *
 * @param membro Quem analisa (já autorizado para `analisar_voucher`)
 * @param voucherId Voucher
 * @param decisao Liberar ou recusar com motivo
 * @returns Voucher atualizado
 * @throws ErroHttp 404 (não existe nesta arena) ou 409 (já analisado)
 */
export async function analisarVoucher(
  membro: { userId: string; email: string | null; arenaId: string },
  voucherId: string,
  decisao: DecisaoVoucher
): Promise<VoucherFidelidade> {
  const { data: atual, error: erroLeitura } = await supabaseAdmin
    .from("fidelidade_vouchers")
    .select("*")
    .eq("id", voucherId)
    .eq("arena_id", membro.arenaId)
    .maybeSingle();
  if (erroLeitura) throw new Error(erroLeitura.message);
  if (!atual) throw new ErroHttp("Pedido não encontrado nesta arena.", 404);
  const voucher = rowToVoucher(atual as VoucherDbRow);
  if (voucher.status !== "em_analise") throw new ErroHttp("Este pedido já foi analisado. Atualize a página.", 409);

  // Nome do membro fica no cadastro do Auth (convite da Equipe); sem nome, vale o e-mail
  const { data: conta } = await supabaseAdmin.auth.admin.getUserById(membro.userId);
  const nomeMeta = conta?.user?.user_metadata?.nome;
  const nome = String((typeof nomeMeta === "string" && nomeMeta.trim()) || membro.email || "Equipe");
  const agora = new Date().toISOString();
  const payload =
    decisao.decisao === "liberar"
      ? { status: "disponivel", expira_em: validadeAoLiberar(voucher.criadoEm, voucher.expiraEm, obterDataHojeIso()), motivo_analise: null }
      : { status: "recusado", motivo_analise: decisao.motivo };

  const { data, error } = await supabaseAdmin
    .from("fidelidade_vouchers")
    .update({ ...payload, analisado_por: membro.userId, analisado_por_nome: nome, analisado_em: agora })
    .eq("id", voucherId)
    .eq("arena_id", membro.arenaId)
    .eq("status", "em_analise")
    .select("*");
  if (error) throw new Error(error.message);
  const linha = (data ?? [])[0];
  if (!linha) throw new ErroHttp("Este pedido já foi analisado. Atualize a página.", 409);
  return rowToVoucher(linha as VoucherDbRow);
}
