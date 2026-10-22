/**
 * @file pagamentoManualServidorService.ts
 * @description Casos de uso (somente servidor) do Pix manual (SPEC/2026-10-22-mvp-go-live.md §3.4):
 * o atleta informa que pagou na chave da arena e o balcão confirma ou recusa o recebimento.
 *
 * Regra central: quem informou o pagamento não perde o horário por demora do balcão. O lock é estendido
 * até o fim da partida, e as rotinas de limpeza ignoram reservas com pagamento informado.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { rowToReserva, type ReservaDbRow } from "@/lib/supabase/types";
import { instanteNoFuso } from "@/lib/datas/fusoHorario";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { registrarAuditoria } from "@/lib/servidor/auditoria";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";
import { carregarReservaDoCheckout } from "@/lib/reservas/checkoutServidorService";
import { LockService } from "./lockService";
import { processarConfirmacaoPagamento } from "./confirmacaoServidorService";

/** Folga mínima do lock após o atleta informar o pagamento, mesmo para partidas iminentes. */
const FOLGA_MINIMA_MINUTOS = 30;

/**
 * Calcula até quando o horário fica segurado depois que o atleta informa o pagamento: o fim da partida
 * (com folga mínima), para que o balcão tenha até o jogo para conferir o extrato.
 *
 * @param reserva Linha da reserva (data, hora_inicio, hora_fim)
 * @param agora Instante de referência
 * @returns Novo `expira_em` (ISO)
 */
export function calcularValidadeAposInformar(
  reserva: Pick<ReservaDbRow, "data" | "hora_inicio" | "hora_fim">,
  agora: Date = new Date()
): string {
  const data = String(reserva.data).split("T")[0];
  const inicio = instanteNoFuso(data, String(reserva.hora_inicio ?? "00:00")).getTime();
  let fim = instanteNoFuso(data, String(reserva.hora_fim ?? reserva.hora_inicio ?? "00:00")).getTime();
  if (fim <= inicio) fim = inicio + 60 * 60 * 1000; // ex.: partida que termina à meia-noite
  const minimo = agora.getTime() + FOLGA_MINIMA_MINUTOS * 60 * 1000;
  return new Date(Math.max(fim, minimo)).toISOString();
}

/** Verifica se outra reserva ativa ocupa algum horário desta. */
async function horarioFoiOcupado(linha: ReservaDbRow & { arena_id?: unknown }): Promise<boolean> {
  const reserva = rowToReserva(linha);
  const { data, error } = await supabaseAdmin
    .from("reservas")
    .select("*")
    .eq("arena_id", String(linha.arena_id))
    .eq("quadra_id", reserva.quadraId)
    .eq("data", reserva.data)
    .neq("id", reserva.id)
    .in("status", ["confirmada", "pendente", "em_processamento"]);
  if (error) throw new Error(error.message);

  return ((data ?? []) as ReservaDbRow[])
    .map(rowToReserva)
    .some((r) => LockService.isReservaOcupandoSlot(r) && r.horarios.some((h) => reserva.horarios.includes(h)));
}

/**
 * O atleta informa que pagou o Pix manual: segura o horário até a decisão do balcão.
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout (prova de autoria)
 * @returns Novo prazo do lock (ISO)
 * @throws ErroHttp 404 (reserva/token), 409 (não é Pix manual, já decidida ou horário perdido)
 */
export async function informarPagamentoManual(reservaId: string, checkoutToken: string): Promise<{ expiraEm: string }> {
  const linha = await carregarReservaDoCheckout(reservaId, checkoutToken);

  if (linha.gateway_provedor !== "manual") {
    throw new ErroHttp("Esta reserva não usa Pix direto para a arena.", 409);
  }
  if (linha.status !== "em_processamento") {
    throw new ErroHttp("Esta reserva já foi processada pela arena.", 409);
  }

  // Lock vencido antes do aviso: só segura de novo se ninguém ocupou o horário nesse meio-tempo
  const reserva = rowToReserva(linha);
  if (!LockService.isLockAtivo(reserva) && (await horarioFoiOcupado(linha))) {
    throw new ErroHttp(
      "O tempo para pagamento acabou e o horário foi reservado por outra pessoa. Se você já pagou, fale com a arena para receber o estorno.",
      409
    );
  }

  const expiraEm = calcularValidadeAposInformar(linha);
  const { data, error } = await supabaseAdmin
    .from("reservas")
    .update({ pagamento_informado_em: new Date().toISOString(), expira_em: expiraEm })
    .eq("id", reservaId)
    .eq("status", "em_processamento")
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new ErroHttp("Esta reserva já foi processada pela arena.", 409);
  return { expiraEm };
}

/** Carrega uma reserva de Pix manual da arena do operador. */
async function carregarReservaManualDaArena(membro: MembroArena, reservaId: string) {
  const { data, error } = await supabaseAdmin
    .from("reservas")
    .select("*")
    .eq("id", reservaId)
    .eq("arena_id", membro.arenaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new ErroHttp("Reserva não encontrada.", 404);
  if (data.gateway_provedor !== "manual") throw new ErroHttp("Esta reserva não usa Pix direto para a arena.", 409);
  return data as ReservaDbRow & { pix_valor?: number | null; arena_id?: string };
}

/**
 * O balcão confirma o recebimento do Pix manual (mesmo caminho do webhook: sinal → `pendente`, total →
 * `confirmada`, vouchers consumidos). Reservas canceladas por tempo podem ser reativadas se o horário
 * continuar livre.
 *
 * @param membro Operador autorizado
 * @param reservaId Reserva
 * @throws ErroHttp 404/409
 */
export async function confirmarPagamentoManual(membro: MembroArena, reservaId: string): Promise<void> {
  const linha = await carregarReservaManualDaArena(membro, reservaId);
  if (linha.status === "confirmada" || linha.status === "pendente") return; // idempotente

  const valor = Number(linha.pix_valor ?? linha.valor_sinal ?? 0) || Number(linha.valor_total ?? 0);
  const resultado = await processarConfirmacaoPagamento(reservaId, valor, new Date().toISOString(), {
    arenaId: membro.arenaId,
    confirmadoPor: membro.userId,
  });
  if (!resultado.sucesso) throw new ErroHttp(resultado.erro ?? "Não foi possível confirmar o pagamento.", 409);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "pagamento.confirmacao_manual",
    alvoId: reservaId,
    detalhes: { valor },
  });
}

/**
 * O balcão recusa o pagamento informado (não caiu no extrato): cancela e libera o horário.
 *
 * @param membro Operador autorizado
 * @param reservaId Reserva
 * @param motivo Motivo registrado na auditoria
 * @throws ErroHttp 404/409
 */
export async function recusarPagamentoManual(membro: MembroArena, reservaId: string, motivo: string): Promise<void> {
  const linha = await carregarReservaManualDaArena(membro, reservaId);
  if (linha.status !== "em_processamento") {
    throw new ErroHttp("Só é possível recusar pagamentos que ainda aguardam confirmação.", 409);
  }

  const { error } = await supabaseAdmin
    .from("reservas")
    .update({ status: "cancelada" })
    .eq("id", reservaId)
    .eq("arena_id", membro.arenaId)
    .eq("status", "em_processamento");
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "pagamento.recusa_manual",
    alvoId: reservaId,
    detalhes: { motivo: motivo.slice(0, 300) },
  });
}
