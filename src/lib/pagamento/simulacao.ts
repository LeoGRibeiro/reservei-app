/**
 * @file simulacao.ts
 * @description Regra única que decide se o pagamento simulado (gateway mock) pode confirmar reservas.
 */

/**
 * Indica se confirmações simuladas são permitidas neste ambiente.
 * Liberado fora de produção; em produção, só com PAGAMENTO_SIMULADO_HABILITADO=true (demonstrações).
 *
 * @returns true se o botão "Simular pagamento" e o webhook mock podem confirmar reservas
 */
export function pagamentoSimuladoHabilitado(): boolean {
  if (process.env.PAGAMENTO_SIMULADO_HABILITADO === "true") return true;
  return process.env.NODE_ENV !== "production";
}
