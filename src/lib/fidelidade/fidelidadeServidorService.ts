/**
 * @file fidelidadeServidorService.ts
 * @description Casos de uso do programa de fidelidade executados SOMENTE no servidor (service role).
 *
 * - Emissão de selos das partidas concluídas e do voucher automático ao atingir a meta.
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

  const resgate = resgatarVoucherFidelidade(usuarioId, progresso.selosAtivos, campanha);
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
