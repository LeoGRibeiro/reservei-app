/**
 * @file route.ts
 * @description API Route Handler para recebimento assíncrono de Webhooks transacionais
 * de liquidação Pix (Asaas, Mercado Pago, Efí) e confirmação em tempo real de reservas.
 *
 * Segurança:
 * - Gateway simulado (mock): aceita confirmações apenas fora de produção (ou com
 *   PAGAMENTO_SIMULADO_HABILITADO=true, para demonstrações). Em produção, qualquer pessoa poderia
 *   confirmar qualquer reserva enviando um txid.
 * - Asaas: em produção exige ASAAS_WEBHOOK_SECRET, validado pelo gateway no cabeçalho
 *   `asaas-access-token`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterPaymentGateway } from "@/lib/pagamento/paymentGateway";
import { pagamentoSimuladoHabilitado } from "@/lib/pagamento/simulacao";
import { processarConfirmacaoPagamento } from "@/lib/pagamento/confirmacaoServidorService";

export const dynamic = "force-dynamic";

/**
 * Endpoint de recebimento de notificações de pagamento.
 * POST /api/webhooks/pagamentos
 */
export async function POST(request: NextRequest) {
  const gateway = obterPaymentGateway();

  if (gateway.provedor === "mock" && !pagamentoSimuladoHabilitado()) {
    return NextResponse.json({ status: "rejected", motivo: "Gateway simulado desabilitado." }, { status: 403 });
  }
  if (gateway.provedor === "asaas" && process.env.NODE_ENV === "production" && !process.env.ASAAS_WEBHOOK_SECRET) {
    console.error("[Webhook API] ASAAS_WEBHOOK_SECRET ausente em produção: webhook recusado.");
    return NextResponse.json({ status: "rejected", motivo: "Webhook sem segredo configurado." }, { status: 503 });
  }

  try {
    const body = await request.json();

    // Normaliza os dados do webhook utilizando a estratégia do provedor ativo
    const eventoNormalizado = gateway.normalizarWebhook(request.headers, body);

    if (!eventoNormalizado) {
      return NextResponse.json(
        { status: "ignored", motivo: "Evento irrelevante ou assinatura inválida." },
        { status: 200 }
      );
    }

    if (eventoNormalizado.evento === "PAGAMENTO_CONFIRMADO") {
      const resultado = await processarConfirmacaoPagamento(
        eventoNormalizado.txid,
        eventoNormalizado.valorPago,
        eventoNormalizado.dataPagamento
      );

      return NextResponse.json({
        status: "success",
        processado: resultado.sucesso,
        reservaId: resultado.reservaId,
      });
    }

    return NextResponse.json({ status: "processed", evento: eventoNormalizado.evento });
  } catch (err) {
    console.error("[Webhook API] Erro ao processar payload do gateway:", err);
    return NextResponse.json(
      { error: "Erro interno no processamento do webhook" },
      { status: 500 }
    );
  }
}

/**
 * Verificação de liveness do webhook.
 */
export async function GET() {
  return NextResponse.json({
    servico: "Reservei Payment Webhook Handler",
    status: "online",
    provedorAtivo: obterPaymentGateway().provedor,
    timestamp: new Date().toISOString(),
  });
}
