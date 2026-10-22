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
import { gerarBrCodePix } from "../brCode";
import { gerarQrCodeDataUrl } from "../qrCode";

/** Chave Pix fictícia usada nas demonstrações (não pertence a ninguém). */
export const CHAVE_PIX_DEMONSTRACAO = "00000000-0000-0000-0000-000000000000";

export class MockGateway implements PaymentGateway {
  readonly provedor: ProvedorGateway = "mock";

  /**
   * Emite uma cobrança Pix simulada com Copia e Cola no formato BR Code e QR Code PNG em data URL.
   */
  async gerarPix(requisicao: RequisicaoCobrancaPix): Promise<ResultadoCriacaoPix> {
    const txid = `TXMOCK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const transacaoId = `pay_${Date.now()}_mock`;
    const expiraEm = new Date(Date.now() + (requisicao.expiracaoMinutos || 10) * 60 * 1000).toISOString();

    // BR Code em formato real (chave fictícia): o QR é escaneável, mas nenhum banco aceita pagar nele
    const copiaECola = gerarBrCodePix({
      chave: CHAVE_PIX_DEMONSTRACAO,
      tipoChave: "aleatoria",
      nomeRecebedor: requisicao.arena.nome || "Arena Demo",
      cidadeRecebedor: requisicao.arena.cidade || "Belem",
      valor: requisicao.valor,
      txid,
    });
    const qrCodeUrl = await gerarQrCodeDataUrl(copiaECola);

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
