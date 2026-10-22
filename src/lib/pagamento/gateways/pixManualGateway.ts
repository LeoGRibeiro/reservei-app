/**
 * @file pixManualGateway.ts
 * @description "Gateway" do modo manual: gera o Pix copia e cola estático com o valor exato na chave Pix
 * da própria arena. Não há webhook — o balcão confirma o recebimento no painel.
 */

import type {
  PaymentGateway,
  ProvedorGateway,
  RequisicaoCobrancaPix,
  ResultadoCriacaoPix,
  StatusPagamentoPix,
  WebhookPagamentoPayload,
} from "../types";
import type { PixManualArena } from "@/lib/arena/types";
import { gerarBrCodePix } from "../brCode";
import { gerarQrCodeDataUrl } from "../qrCode";

/**
 * Identificador curto da reserva usado como txid no extrato da arena (até 25 caracteres alfanuméricos).
 *
 * @param reservaId Id da reserva
 * @returns Ex.: "RSV3F2A9C1B"
 */
export function txidManualDaReserva(reservaId: string): string {
  return `RSV${reservaId.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`.slice(0, 25);
}

export class PixManualGateway implements PaymentGateway {
  readonly provedor: ProvedorGateway = "manual";

  constructor(private readonly pix: PixManualArena) {}

  async gerarPix(requisicao: RequisicaoCobrancaPix): Promise<ResultadoCriacaoPix> {
    try {
      const txid = txidManualDaReserva(requisicao.reservaId);
      const copiaECola = gerarBrCodePix({ ...this.pix, valor: requisicao.valor, txid });
      const expiraEm = new Date(Date.now() + (requisicao.expiracaoMinutos || 10) * 60 * 1000).toISOString();

      return {
        sucesso: true,
        cobranca: {
          txid,
          transacaoId: requisicao.reservaId,
          copiaECola,
          qrCodeUrl: await gerarQrCodeDataUrl(copiaECola),
          valor: requisicao.valor,
          expiraEm,
          provedor: this.provedor,
        },
      };
    } catch (err) {
      console.error("[PixManualGateway] Falha ao montar o Pix da arena:", err);
      return { sucesso: false, erro: "A chave Pix da arena está incompleta. Avise a arena." };
    }
  }

  async consultarStatus(): Promise<StatusPagamentoPix> {
    return "aguardando_pagamento";
  }

  async cancelarCobranca(): Promise<boolean> {
    return true;
  }

  normalizarWebhook(): WebhookPagamentoPayload | null {
    return null;
  }
}
