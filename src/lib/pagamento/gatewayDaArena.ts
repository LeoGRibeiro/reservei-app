/**
 * @file gatewayDaArena.ts
 * @description Escolha do gateway de pagamento conforme a configuração da arena (somente servidor).
 *
 * Cada arena recebe na própria conta (SPEC/2026-10-22-mvp-go-live.md §3): Asaas da arena, chave Pix da
 * arena (manual) ou simulação em demonstrações. Não há fallback silencioso entre modos: se a arena escolheu
 * Asaas e a credencial sumiu, o checkout falha com mensagem clara em vez de cobrar em outra conta.
 */

import type { Arena } from "@/lib/arena/types";
import type { PaymentGateway } from "./types";
import { AsaasGateway } from "./gateways/asaasGateway";
import { MockGateway } from "./gateways/mockGateway";
import { PixManualGateway } from "./gateways/pixManualGateway";
import { obterPaymentGateway } from "./paymentGateway";
import { pagamentoSimuladoHabilitado } from "./simulacao";
import { carregarCredencialAsaas } from "./credenciaisArenaRepository";

/** A arena não tem um meio de pagamento online utilizável no momento. */
export class ErroPagamentoIndisponivel extends Error {
  readonly status = 503;
  constructor(message = "O pagamento online desta arena está indisponível no momento. Fale com a arena pelo WhatsApp.") {
    super(message);
    this.name = "ErroPagamentoIndisponivel";
  }
}

/**
 * Indica, sem consultar credenciais, se a arena tem um meio de pagamento online configurado.
 * Usado pelo portal para avisar o atleta antes do checkout.
 *
 * @param arena Arena
 * @returns `true` se o checkout online pode gerar cobrança
 */
export function arenaAceitaPagamentoOnline(arena: Pick<Arena, "modoPagamento" | "pixManual">): boolean {
  switch (arena.modoPagamento) {
    case "manual":
      return Boolean(arena.pixManual);
    case "simulado":
      return pagamentoSimuladoHabilitado();
    case "asaas":
    case "legado":
    case undefined:
      return true;
  }
}

/**
 * Retorna o gateway que cobra na conta da arena.
 *
 * @param arena Arena da reserva
 * @returns Gateway pronto para emitir cobranças
 * @throws ErroPagamentoIndisponivel se o modo escolhido não estiver utilizável
 *
 * @example
 * ```ts
 * const gateway = await obterGatewayDaArena(arena);
 * const r = await gateway.gerarPix({ ... });
 * ```
 */
export async function obterGatewayDaArena(arena: Arena): Promise<PaymentGateway> {
  switch (arena.modoPagamento) {
    case "asaas": {
      const credencial = await carregarCredencialAsaas(arena.id);
      if (!credencial) throw new ErroPagamentoIndisponivel();
      return new AsaasGateway(credencial.apiKey, credencial.sandbox, credencial.webhookToken);
    }
    case "manual":
      if (!arena.pixManual) throw new ErroPagamentoIndisponivel();
      return new PixManualGateway(arena.pixManual);
    case "simulado":
      if (!pagamentoSimuladoHabilitado()) throw new ErroPagamentoIndisponivel();
      return new MockGateway();
    default:
      // Banco sem a Fase 8: mantém o comportamento anterior (gateway global do ambiente)
      return obterPaymentGateway();
  }
}
