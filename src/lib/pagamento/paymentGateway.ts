/**
 * @file paymentGateway.ts
 * @description Fábrica de instâncias de Gateways de Pagamento (Factory Pattern).
 * Permite alternar de forma transparente entre o provedor real (Asaas) e o simulador (Mock).
 */

import type { PaymentGateway, ProvedorGateway } from "./types";
import { MockGateway } from "./gateways/mockGateway";
import { AsaasGateway } from "./gateways/asaasGateway";

let gatewaySingleton: PaymentGateway | null = null;

/**
 * Retorna a instância adequada do gateway de pagamentos conforme as variáveis de ambiente.
 * 
 * @param provedor Força um provedor específico ('asaas' | 'mock')
 * @returns Instância compatível com a interface PaymentGateway
 */
export function obterPaymentGateway(provedor?: ProvedorGateway): PaymentGateway {
  if (provedor === "mock") {
    return new MockGateway();
  }

  if (provedor === "asaas" || (!provedor && Boolean(process.env.ASAAS_API_KEY))) {
    const isSandbox = process.env.ASAAS_SANDBOX === "true";
    return new AsaasGateway(process.env.ASAAS_API_KEY, isSandbox);
  }

  // Padrão defensivo: se nenhuma chave externa estiver configurada, opera em Mock Gateway
  if (!gatewaySingleton) {
    gatewaySingleton = new MockGateway();
  }

  return gatewaySingleton;
}
