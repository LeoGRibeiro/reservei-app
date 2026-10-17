/**
 * @file pagamentoService.ts
 * @description Casos de uso e orquestrador de pagamentos Pix, lock transacional
 * de horários e processamento assíncrono de confirmações bancárias via Webhooks.
 */

import type { Reserva } from "@/store/useReservasStore";
import type { Arena } from "@/lib/arena/types";
import type { PixCobranca, ResultadoCriacaoPix } from "./types";
import { obterPaymentGateway } from "./paymentGateway";
import { LockService } from "./lockService";
import { atualizarReservaSupabase } from "@/lib/supabase/reservasService";
import { useReservasStore } from "@/store/useReservasStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface SolicitarPixParams {
  reserva: Reserva;
  arena: Arena;
  tipoPagamento?: "sinal" | "integral";
  expiracaoMinutos?: number;
}

/**
 * Solicita uma nova cobrança Pix dinâmica para a reserva, ativando
 * o lock transacional temporário anti double-booking.
 * 
 * @param params Reserva, arena e modalidade de pagamento
 * @returns Resultado contendo o QR Code, Copia e Cola e expiração
 */
export async function solicitarPixParaReserva(
  params: SolicitarPixParams
): Promise<ResultadoCriacaoPix> {
  const { reserva, arena, tipoPagamento = "sinal", expiracaoMinutos = 10 } = params;

  const valor =
    tipoPagamento === "integral"
      ? reserva.valorTotal
      : reserva.valorSinal > 0
      ? reserva.valorSinal
      : reserva.valorTotal;

  if (valor <= 0) {
    return {
      sucesso: false,
      erro: "O valor da reserva deve ser maior que zero para emissão de Pix.",
    };
  }

  const gateway = obterPaymentGateway();

  const resultado = await gateway.gerarPix({
    reservaId: reserva.id,
    arena,
    nomeCliente: reserva.nomeCliente,
    whatsappCliente: reserva.whatsappCliente,
    cpfCliente: reserva.cpfCliente,
    valor,
    descricao: `Reserva ${arena.nome} - Quadra #${reserva.quadraId} (${reserva.data})`,
    expiracaoMinutos,
  });

  if (!resultado.sucesso || !resultado.cobranca) {
    return resultado;
  }

  const cobranca = resultado.cobranca;

  // Atualiza o estado local imediatamente
  useReservasStore.getState().atualizarReserva(reserva.id, {
    status: "em_processamento",
  });

  // Atualiza os metadados transacionais no banco de dados Supabase
  if (isSupabaseConfigured()) {
    void atualizarReservaSupabase(reserva.id, {
      status: "em_processamento",
    });

    try {
      await supabase
        .from("reservas")
        .update({
          pix_txid: cobranca.txid,
          pix_copia_cola: cobranca.copiaECola,
          pix_qr_code_url: cobranca.qrCodeUrl,
          expira_em: cobranca.expiraEm,
          gateway_provedor: cobranca.provedor,
          gateway_transacao_id: cobranca.transacaoId,
        })
        .eq("id", reserva.id);
    } catch (err) {
      console.warn("[PagamentoService] Falha ao persistir metadados do Pix no banco:", err);
    }
  }

  return resultado;
}

/**
 * Processa a confirmação bancária definitiva de um pagamento Pix (originada via Webhook ou Sandbox).
 * Atualiza o status da reserva para 'confirmada', grava o timestamp de liquidação e libera o lock.
 * 
 * @param txid Identificador transacional do Pix
 * @param valorPago Valor liquidado informado pelo gateway
 * @param dataPagamento Data e hora da confirmação
 * @returns Confirmação do processamento
 */
export async function processarConfirmacaoPagamento(
  txid: string,
  valorPago: number,
  dataPagamento: string = new Date().toISOString()
): Promise<{ sucesso: boolean; reservaId?: string; erro?: string }> {
  if (!txid) {
    return { sucesso: false, erro: "Identificador txid não informado." };
  }

  try {
    // 1. Localiza a reserva correspondente no estado global ou no Supabase
    let reservaEncontrada = useReservasStore
      .getState()
      .reservas.find((r) => r.id === txid || ("pix_txid" in r && (r as any).pix_txid === txid));

    if (!reservaEncontrada && isSupabaseConfigured()) {
      const { data } = await supabase
        .from("reservas")
        .select("*")
        .or(`id.eq.${txid},pix_txid.eq.${txid}`)
        .maybeSingle();

      if (data) {
        reservaEncontrada = {
          id: data.id,
          quadraId: data.quadra_id,
          data: data.data,
          horarios: data.horarios,
          horaInicio: data.hora_inicio,
          horaFim: data.hora_fim,
          nomeCliente: data.nome_cliente,
          whatsappCliente: data.whatsapp_cliente,
          cpfCliente: data.cpf_cliente,
          valorTotal: Number(data.valor_total || 0),
          valorSinal: Number(data.valor_sinal || 0),
          valorPendente: Number(data.valor_pendente || 0),
          status: data.status,
          statusWhatsApp: data.status_whatsapp,
          criadaEm: data.criada_em,
        };
      }
    }

    if (!reservaEncontrada) {
      console.warn(`[PagamentoService] Nenhuma reserva localizada para o Pix txid '${txid}'.`);
      return { sucesso: false, erro: "Reserva não encontrada para esta transação." };
    }

    // Se já estiver confirmada, evita duplicidade de processamento
    if (reservaEncontrada.status === "confirmada") {
      return { sucesso: true, reservaId: reservaEncontrada.id };
    }

    // 2. Atualiza status para confirmada
    useReservasStore.getState().atualizarReserva(reservaEncontrada.id, {
      status: "confirmada",
      statusWhatsApp: "enviado",
    });

    if (isSupabaseConfigured()) {
      await supabase
        .from("reservas")
        .update({
          status: "confirmada",
          status_whatsapp: "enviado",
          pago_em: dataPagamento,
        })
        .eq("id", reservaEncontrada.id);
    }

    console.info(
      `[PagamentoService] Pagamento Pix de R$ ${valorPago} confirmado com sucesso para a reserva '${reservaEncontrada.id}'!`
    );

    return { sucesso: true, reservaId: reservaEncontrada.id };
  } catch (err) {
    console.error("[PagamentoService] Erro ao processar confirmação de pagamento:", err);
    return { sucesso: false, erro: "Erro interno no processamento do pagamento." };
  }
}

/**
 * Varre a lista de reservas ativas e cancela aquelas com locks temporários expirados.
 * Libera os horários de clientes que desistiram do checkout.
 */
export async function liberarLocksExpirados(): Promise<string[]> {
  const todas = useReservasStore.getState().reservas;
  const expiradas = LockService.identificarReservasExpiradas(todas);

  if (expiradas.length === 0) return [];

  const idsCancelados: string[] = [];

  for (const exp of expiradas) {
    useReservasStore.getState().atualizarReserva(exp.id, {
      status: "cancelada",
    });
    idsCancelados.push(exp.id);

    if (isSupabaseConfigured()) {
      void supabase
        .from("reservas")
        .update({ status: "cancelada" })
        .eq("id", exp.id);
    }
  }

  return idsCancelados;
}

export const PagamentoService = {
  solicitarPixParaReserva,
  processarConfirmacaoPagamento,
  liberarLocksExpirados,
};
