/**
 * @file asaasGateway.ts
 * @description Implementação oficial da integração com a API do Asaas para emissão
 * e liquidação de Pix dinâmico, consulta transacional e processamento de webhooks.
 */

import type {
  PaymentGateway,
  ProvedorGateway,
  RequisicaoCobrancaPix,
  ResultadoCriacaoPix,
  StatusPagamentoPix,
  WebhookPagamentoPayload,
} from "../types";

export class AsaasGateway implements PaymentGateway {
  readonly provedor: ProvedorGateway = "asaas";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, isSandbox = false) {
    this.apiKey = apiKey || process.env.ASAAS_API_KEY || "";
    this.baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";
  }

  /**
   * Emite uma cobrança Pix no Asaas e extrai o QR Code oficial e payload Copia e Cola.
   */
  async gerarPix(requisicao: RequisicaoCobrancaPix): Promise<ResultadoCriacaoPix> {
    if (!this.apiKey) {
      return {
        sucesso: false,
        erro: "Chave de API do Asaas (ASAAS_API_KEY) não configurada no ambiente.",
      };
    }

    try {
      const hoje = new Date().toISOString().split("T")[0];

      // 1. Cria ou identifica cliente no Asaas
      const clienteRes = await fetch(`${this.baseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          name: requisicao.nomeCliente || "Cliente Reservei",
          mobilePhone: requisicao.whatsappCliente?.replace(/\D/g, ""),
          cpfCnpj: requisicao.cpfCliente?.replace(/\D/g, "") || undefined,
        }),
      });

      const clienteData = await clienteRes.json();
      const customerId = clienteData.id;

      if (!customerId) {
        return {
          sucesso: false,
          erro: `Falha ao registrar cliente no Asaas: ${JSON.stringify(clienteData.errors || clienteData)}`,
        };
      }

      // 2. Cria a cobrança Pix
      const cobrancaRes = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: "PIX",
          value: requisicao.valor,
          dueDate: hoje,
          description: requisicao.descricao,
          externalReference: requisicao.reservaId,
        }),
      });

      const cobrancaData = await cobrancaRes.json();
      if (!cobrancaData.id) {
        return {
          sucesso: false,
          erro: `Falha ao emitir cobrança no Asaas: ${JSON.stringify(cobrancaData.errors || cobrancaData)}`,
        };
      }

      // 3. Obtém o QR Code e o Copia e Cola do Pix
      const qrCodeRes = await fetch(
        `${this.baseUrl}/payments/${cobrancaData.id}/pixQrCode`,
        {
          headers: {
            access_token: this.apiKey,
          },
        }
      );

      const qrCodeData = await qrCodeRes.json();
      const copiaECola = qrCodeData.payload || "";
      const qrCodeBase64 = qrCodeData.encodedImage
        ? `data:image/png;base64,${qrCodeData.encodedImage}`
        : "";

      const expiraEm =
        qrCodeData.expirationDate ||
        new Date(Date.now() + (requisicao.expiracaoMinutos || 10) * 60 * 1000).toISOString();

      return {
        sucesso: true,
        cobranca: {
          txid: cobrancaData.id,
          transacaoId: cobrancaData.id,
          copiaECola,
          qrCodeUrl: qrCodeBase64,
          valor: requisicao.valor,
          expiraEm,
          provedor: this.provedor,
        },
      };
    } catch (err) {
      console.error("[AsaasGateway] Erro de comunicação com a API do Asaas:", err);
      return {
        sucesso: false,
        erro: "Falha de conexão com o gateway Asaas.",
      };
    }
  }

  /**
   * Consulta o status de uma cobrança no Asaas.
   */
  async consultarStatus(transacaoId: string): Promise<StatusPagamentoPix> {
    if (!this.apiKey || !transacaoId) return "aguardando_pagamento";

    try {
      const res = await fetch(`${this.baseUrl}/payments/${transacaoId}`, {
        headers: { access_token: this.apiKey },
      });
      const data = await res.json();

      switch (data.status) {
        case "RECEIVED":
        case "CONFIRMED":
        case "RECEIVED_IN_CASH":
          return "pago";
        case "OVERDUE":
          return "expirado";
        case "REFUNDED":
          return "estornado";
        default:
          return "aguardando_pagamento";
      }
    } catch {
      return "aguardando_pagamento";
    }
  }

  /**
   * Cancela uma cobrança no Asaas.
   */
  async cancelarCobranca(transacaoId: string): Promise<boolean> {
    if (!this.apiKey || !transacaoId) return false;

    try {
      const res = await fetch(`${this.baseUrl}/payments/${transacaoId}`, {
        method: "DELETE",
        headers: { access_token: this.apiKey },
      });
      const data = await res.json();
      return Boolean(data.deleted);
    } catch {
      return false;
    }
  }

  /**
   * Normaliza o payload de webhook recebido do Asaas.
   */
  normalizarWebhook(
    headers: Headers,
    body: Record<string, unknown>
  ): WebhookPagamentoPayload | null {
    if (!body || typeof body !== "object") return null;

    // Valida token de webhook se configurado
    const segredoEsperado = process.env.ASAAS_WEBHOOK_SECRET;
    if (segredoEsperado) {
      const tokenRecebido = headers.get("asaas-access-token");
      if (tokenRecebido !== segredoEsperado) {
        console.warn("[AsaasGateway] Webhook rejeitado: token de segurança inválido.");
        return null;
      }
    }

    const event = String(body.event || "");
    const payment = (body.payment as Record<string, unknown>) || {};
    const txid = String(payment.id || "");
    const valorPago = Number(payment.value || 0);
    const dataPagamento = String(payment.paymentDate || new Date().toISOString());

    let eventoNormalizado: WebhookPagamentoPayload["evento"] = "PAGAMENTO_CONFIRMADO";
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      eventoNormalizado = "PAGAMENTO_CONFIRMADO";
    } else if (event === "PAYMENT_OVERDUE") {
      eventoNormalizado = "PAGAMENTO_EXPIRADO";
    } else if (event === "PAYMENT_REFUNDED") {
      eventoNormalizado = "PAGAMENTO_ESTORNADO";
    } else {
      return null;
    }

    return {
      evento: eventoNormalizado,
      txid,
      transacaoId: txid,
      valorPago,
      dataPagamento,
      provedor: this.provedor,
      rawPayload: body,
    };
  }
}
