/**
 * @file mockGateway.ts
 * @description Provedor de pagamentos simulado (Mock Gateway) para desenvolvimento,
 * testes automatizados isolados e demonstrações offline sem custo.
 */

import type {
  PaymentGateway,
  ProvedorGateway,
  RequisicaoCobrancaPix,
  ResultadoCriacaoPix,
  StatusPagamentoPix,
  WebhookPagamentoPayload,
} from "../types";

export class MockGateway implements PaymentGateway {
  readonly provedor: ProvedorGateway = "mock";

  /**
   * Emite uma cobrança Pix mockada com código Copia e Cola formatado
   * e QR Code SVG inline codificado em base64.
   */
  async gerarPix(requisicao: RequisicaoCobrancaPix): Promise<ResultadoCriacaoPix> {
    const txid = `TXMOCK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const transacaoId = `pay_${Date.now()}_mock`;
    const expiraEm = new Date(Date.now() + (requisicao.expiracaoMinutos || 10) * 60 * 1000).toISOString();

    // Gera um código Pix Copia e Cola simulado no padrão BR Code do Banco Central
    const copiaECola = `00020126580014br.gov.bcb.pix0136${txid}520400005303986540${requisicao.valor.toFixed(2)}5802BR5915${requisicao.arena.nome.substring(0, 15)}6005BELEM62070503***6304${Math.floor(1000 + Math.random() * 9000)}`;

    // QR Code visual SVG em Base64 para exibição direta em tag <img> sem requisições externas
    const svgQrCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><rect width="100" height="100" fill="#ffffff"/><rect x="10" y="10" width="25" height="25" fill="#020617"/><rect x="15" y="15" width="15" height="15" fill="#ffffff"/><rect x="18" y="18" width="9" height="9" fill="#020617"/><rect x="65" y="10" width="25" height="25" fill="#020617"/><rect x="70" y="15" width="15" height="15" fill="#ffffff"/><rect x="73" y="18" width="9" height="9" fill="#020617"/><rect x="10" y="65" width="25" height="25" fill="#020617"/><rect x="15" y="70" width="15" height="15" fill="#ffffff"/><rect x="18" y="73" width="9" height="9" fill="#020617"/><rect x="45" y="20" width="10" height="10" fill="#10b981"/><rect x="40" y="45" width="20" height="20" fill="#10b981"/><rect x="65" y="65" width="15" height="15" fill="#020617"/><rect x="50" y="75" width="10" height="10" fill="#10b981"/></svg>`;
    const qrCodeUrl = `data:image/svg+xml;base64,${btoa(svgQrCode)}`;

    return {
      sucesso: true,
      cobranca: {
        txid,
        copiaECola,
        qrCodeUrl,
        valor: requisicao.valor,
        expiraEm,
        provedor: this.provedor,
        transacaoId,
      },
    };
  }

  /**
   * Consulta o status de uma cobrança simulada.
   */
  async consultarStatus(_transacaoId: string): Promise<StatusPagamentoPix> {
    return "aguardando_pagamento";
  }

  /**
   * Cancela uma cobrança simulada.
   */
  async cancelarCobranca(_transacaoId: string): Promise<boolean> {
    return true;
  }

  /**
   * Normaliza o payload de webhook simulado.
   */
  normalizarWebhook(
    _headers: Headers,
    body: Record<string, unknown>
  ): WebhookPagamentoPayload | null {
    if (!body || typeof body !== "object") return null;

    const txid = String(body.txid || body.id || "");
    const valor = Number(body.valor || body.value || 0);

    return {
      evento: "PAGAMENTO_CONFIRMADO",
      txid,
      transacaoId: String(body.transacaoId || txid),
      valorPago: valor,
      dataPagamento: new Date().toISOString(),
      provedor: this.provedor,
      rawPayload: body,
    };
  }
}
