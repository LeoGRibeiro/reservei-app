/**
 * @file route.ts
 * @description API Route Handler para recebimento assíncrono de Webhooks transacionais
 * de liquidação Pix (Asaas, Mercado Pago, Efí) e confirmação em tempo real de reservas.
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterPaymentGateway } from "@/lib/pagamento/paymentGateway";
import { processarConfirmacaoPagamento } from "@/lib/pagamento/pagamentoService";

export const dynamic = "force-dynamic";

/**
 * Endpoint de recebimento de notificações de pagamento.
 * POST /api/webhooks/pagamentos
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gateway = obterPaymentGateway();

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
