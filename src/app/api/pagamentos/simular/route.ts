/**
 * @file route.ts
 * @description Confirmação simulada do Pix (somente gateway mock fora de produção, ou em demonstrações
 * com PAGAMENTO_SIMULADO_HABILITADO=true). Percorre o mesmo caminho do webhook real.
 *
 * POST /api/pagamentos/simular
 * Corpo: { reservaId, checkoutToken, tipoPagamento?: "sinal" | "integral" }
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterPaymentGateway } from "@/lib/pagamento/paymentGateway";
import { pagamentoSimuladoHabilitado } from "@/lib/pagamento/simulacao";
import { processarConfirmacaoPagamento } from "@/lib/pagamento/confirmacaoServidorService";
import { carregarReservaDoCheckout } from "@/lib/reservas/checkoutServidorService";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";

export const dynamic = "force-dynamic";

/**
 * Simula a liquidação do Pix da reserva do checkout.
 */
export async function POST(request: NextRequest) {
  if (obterPaymentGateway().provedor !== "mock" || !pagamentoSimuladoHabilitado()) {
    return NextResponse.json({ sucesso: false, erro: "Pagamento simulado indisponível." }, { status: 403 });
  }
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const reservaId = typeof corpo?.reservaId === "string" ? corpo.reservaId : "";
    const token = typeof corpo?.checkoutToken === "string" ? corpo.checkoutToken : "";
    const reserva = await carregarReservaDoCheckout(reservaId, token);

    if (!reserva.pix_txid) {
      return NextResponse.json({ sucesso: false, erro: "Gere o Pix antes de simular o pagamento." }, { status: 409 });
    }

    const valor =
      corpo?.tipoPagamento === "integral" ? Number(reserva.valor_total ?? 0) : Number(reserva.valor_sinal ?? 0);
    const resultado = await processarConfirmacaoPagamento(String(reserva.pix_txid), valor);
    if (!resultado.sucesso) {
      return NextResponse.json({ sucesso: false, erro: resultado.erro }, { status: 409 });
    }
    return NextResponse.json({ sucesso: true, reservaId: resultado.reservaId });
  } catch (err) {
    return responderErro(err, "pagamento-simular");
  }
}
