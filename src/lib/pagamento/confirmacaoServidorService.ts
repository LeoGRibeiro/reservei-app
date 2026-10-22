/**
 * @file confirmacaoServidorService.ts
 * @description Casos de uso (somente servidor) disparados pelo gateway de pagamento ou por rotinas
 * agendadas: confirmação de Pix liquidado e liberação de locks de checkout expirados.
 *
 * Usa o cliente service role, pois webhooks não têm sessão de usuário e o RLS bloquearia as
 * gravações. A fonte da verdade é sempre o banco, nunca o estado do navegador.
 */

import { supabaseAdmin, isAdminClientConfigured } from "@/lib/supabase/adminClient";
import { rowToReserva, type ReservaDbRow } from "@/lib/supabase/types";
import { LockService } from "./lockService";
import { consumirVouchersDaReserva } from "@/lib/fidelidade/fidelidadeServidorService";

/** Tolerância de centavos ao comparar o valor pago com o total da reserva. */
const TOLERANCIA_CENTAVOS = 0.01;

/** Opções de escopo e autoria da confirmação. */
export interface OpcoesConfirmacao {
  /** Restringe a busca às reservas desta arena (webhooks por arena e confirmação pelo balcão) */
  arenaId?: string;
  /** Operador que confirmou manualmente (Pix manual) */
  confirmadoPor?: string;
}

/** Resultado do processamento de uma confirmação. */
export interface ResultadoConfirmacao {
  sucesso: boolean;
  reservaId?: string;
  erro?: string;
}

/**
 * Processa a liquidação definitiva de um Pix (webhook do gateway ou simulação em desenvolvimento).
 *
 * Regras:
 * - Localiza a reserva pelo txid, pelo id da transação no gateway ou pelo próprio id.
 * - Idempotente: reservas já confirmadas ou com sinal pago não são processadas de novo.
 * - Valor pago ≥ total → `confirmada` (quitada). Valor menor (sinal) → `pendente` (restante no local).
 * - Se o lock já tinha expirado e o horário foi ocupado por outra pessoa, não confirma: registra o
 *   conflito para estorno manual.
 * - Consome os vouchers de fidelidade anotados na reserva.
 *
 * @param txid Identificador da cobrança informado pelo gateway
 * @param valorPago Valor liquidado
 * @param dataPagamento Data/hora da liquidação (ISO)
 * @param opcoes Escopo por arena e autoria da confirmação manual
 * @returns Resultado do processamento
 */
export async function processarConfirmacaoPagamento(
  txid: string,
  valorPago: number,
  dataPagamento: string = new Date().toISOString(),
  opcoes: OpcoesConfirmacao = {}
): Promise<ResultadoConfirmacao> {
  if (!txid) {
    return { sucesso: false, erro: "Identificador txid não informado." };
  }
  if (!isAdminClientConfigured()) {
    console.error("[Confirmação] SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
    return { sucesso: false, erro: "Servidor sem credenciais para confirmar pagamentos." };
  }
  if (!/^[\w-]+$/.test(txid)) {
    return { sucesso: false, erro: "Identificador txid inválido." };
  }

  try {
    let consulta = supabaseAdmin
      .from("reservas")
      .select("*")
      .or(`pix_txid.eq.${txid},gateway_transacao_id.eq.${txid},id.eq.${txid}`);
    if (opcoes.arenaId) consulta = consulta.eq("arena_id", opcoes.arenaId);
    const { data: linha, error } = await consulta.limit(1).maybeSingle();
    if (error) throw new Error(error.message);

    if (!linha) {
      console.warn(`[Confirmação] Nenhuma reserva localizada para o txid '${txid}'.`);
      return { sucesso: false, erro: "Reserva não encontrada para esta transação." };
    }

    const reserva = rowToReserva(linha as ReservaDbRow);
    if (reserva.status === "confirmada" || reserva.status === "pendente") {
      return { sucesso: true, reservaId: reserva.id };
    }

    // Pagamento chegou depois do lock expirar: só confirma se o horário continua livre
    if (reserva.status === "cancelada" || !LockService.isLockAtivo(reserva)) {
      const { data: ocupantes, error: erroOcupantes } = await supabaseAdmin
        .from("reservas")
        .select("*")
        .eq("arena_id", String(linha.arena_id))
        .eq("quadra_id", reserva.quadraId)
        .eq("data", reserva.data)
        .neq("id", reserva.id)
        .in("status", ["confirmada", "pendente", "em_processamento"]);
      if (erroOcupantes) throw new Error(erroOcupantes.message);

      const conflito = ((ocupantes ?? []) as ReservaDbRow[])
        .map(rowToReserva)
        .some((r) => LockService.isReservaOcupandoSlot(r) && r.horarios.some((h) => reserva.horarios.includes(h)));
      if (conflito) {
        console.error(
          `[Confirmação] Pix '${txid}' pago após o fim do lock e o horário já foi ocupado. Reserva '${reserva.id}' exige estorno manual.`
        );
        return { sucesso: false, reservaId: reserva.id, erro: "Horário ocupado após o fim do prazo de pagamento." };
      }
    }

    const quitada = valorPago + TOLERANCIA_CENTAVOS >= reserva.valorTotal;
    const atualizacao = quitada
      ? { status: "confirmada", valor_sinal: reserva.valorTotal, valor_pendente: 0 }
      : {
          status: "pendente",
          valor_sinal: Math.round(valorPago * 100) / 100,
          valor_pendente: Math.max(0, Math.round((reserva.valorTotal - valorPago) * 100) / 100),
        };

    const autoria = opcoes.confirmadoPor ? { pagamento_confirmado_por: opcoes.confirmadoPor } : {};
    const { data: atualizadas, error: erroUpdate } = await supabaseAdmin
      .from("reservas")
      .update({ ...atualizacao, ...autoria, status_whatsapp: "enviado", pago_em: dataPagamento })
      .eq("id", reserva.id)
      .select("id");

    if (erroUpdate || !atualizadas || atualizadas.length === 0) {
      console.error(
        `[Confirmação] Banco não confirmou a reserva '${reserva.id}':`,
        erroUpdate?.message ?? "nenhuma linha atualizada"
      );
      return { sucesso: false, erro: "Não foi possível confirmar a reserva no banco de dados." };
    }

    if (reserva.vouchersUtilizados && reserva.vouchersUtilizados.length > 0 && linha.arena_id) {
      await consumirVouchersDaReserva(String(linha.arena_id), reserva.vouchersUtilizados, reserva.id);
    }

    console.info(`[Confirmação] Pix de R$ ${valorPago} confirmado para a reserva '${reserva.id}'.`);
    return { sucesso: true, reservaId: reserva.id };
  } catch (err) {
    console.error("[Confirmação] Erro ao processar confirmação de pagamento:", err);
    return { sucesso: false, erro: "Erro interno no processamento do pagamento." };
  }
}

/**
 * Cancela no banco os checkouts cujo lock expirou sem pagamento, liberando os horários. Reservas de Pix
 * manual em que o atleta informou o pagamento não são canceladas: aguardam a decisão do balcão.
 *
 * @param agora Instante de referência
 * @returns Ids das reservas canceladas
 */
export async function liberarLocksExpirados(agora: Date = new Date()): Promise<string[]> {
  if (!isAdminClientConfigured()) return [];

  const { data, error } = await supabaseAdmin
    .from("reservas")
    .update({ status: "cancelada" })
    .eq("status", "em_processamento")
    .lt("expira_em", agora.toISOString())
    .is("pagamento_informado_em", null)
    .select("id");

  if (error) {
    console.error("[Confirmação] Falha ao liberar locks expirados:", error.message);
    return [];
  }
  return (data ?? []).map((r) => String(r.id));
}
