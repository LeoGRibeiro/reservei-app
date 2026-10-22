/**
 * @file reservasApi.ts
 * @description Chamadas do navegador às rotas de reservas do servidor (checkout público e ações do
 * atleta). O navegador nunca grava em `reservas` diretamente: o servidor valida e recalcula tudo.
 */

import { chamarApi, type RespostaApi } from "@/lib/api/clienteApi";
import type { Esporte } from "@/lib/quadras";

/** Intenção de reserva enviada ao servidor. */
export interface PedidoCheckout {
  arenaId: string;
  quadraId: string;
  data: string;
  horarios: string[];
  nomeCliente: string;
  whatsappCliente: string;
  esporte?: Esporte;
  observacoes?: string;
  tipoPagamento: "sinal" | "integral";
  voucherIds: string[];
}

/** Reserva criada pelo servidor no checkout. */
export interface ReservaCheckout {
  id: string;
  status: "em_processamento" | "confirmada";
  valorOriginal: number;
  descontoFidelidade: number;
  valorTotal: number;
  valorSinal: number;
  valorPendente: number;
  expiraEm: string | null;
  reservaGratuitaFidelidade: boolean;
}

/** Status de acompanhamento do checkout. */
export interface StatusCheckout {
  status: string;
  expiraEm: string | null;
  valorSinal: number;
  valorPendente: number;
}

/**
 * Cria a reserva (lock de 10 minutos) com preço e disponibilidade validados no servidor.
 *
 * @param pedido Intenção de reserva
 * @returns Reserva criada e o token secreto do checkout
 */
export function criarCheckout(
  pedido: PedidoCheckout
): Promise<RespostaApi<{ reserva: ReservaCheckout; checkoutToken: string }>> {
  return chamarApi("/api/reservas/checkout", { method: "POST", corpo: pedido });
}

/**
 * Consulta o status da reserva do checkout (detecta a confirmação do Pix pelo webhook).
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 */
export function consultarStatusCheckout(
  reservaId: string,
  checkoutToken: string
): Promise<RespostaApi<StatusCheckout>> {
  return chamarApi(`/api/reservas/${encodeURIComponent(reservaId)}?token=${encodeURIComponent(checkoutToken)}`);
}

/**
 * Libera o horário de um checkout abandonado.
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 */
export function cancelarCheckout(
  reservaId: string,
  checkoutToken: string
): Promise<RespostaApi<{ liberado: boolean }>> {
  return chamarApi(`/api/reservas/${encodeURIComponent(reservaId)}?token=${encodeURIComponent(checkoutToken)}`, {
    method: "DELETE",
  });
}

/**
 * Pix manual: avisa a arena que o atleta pagou (segura o horário até a conferência do balcão).
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 * @returns Novo prazo do lock
 */
export function informarPagamentoManual(
  reservaId: string,
  checkoutToken: string
): Promise<RespostaApi<{ expiraEm: string }>> {
  return chamarApi(`/api/reservas/${encodeURIComponent(reservaId)}/pagamento-informado`, {
    method: "POST",
    corpo: { checkoutToken },
  });
}

/**
 * Confirma o Pix no gateway simulado (apenas desenvolvimento/demonstração).
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 * @param tipoPagamento Sinal ou integral
 */
export function simularPagamentoCheckout(
  reservaId: string,
  checkoutToken: string,
  tipoPagamento: "sinal" | "integral"
): Promise<RespostaApi<{ reservaId: string }>> {
  return chamarApi("/api/pagamentos/simular", {
    method: "POST",
    corpo: { reservaId, checkoutToken, tipoPagamento },
  });
}

/**
 * Vincula a reserva do checkout à conta recém-criada pelo visitante.
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 */
export function vincularReservaDoCheckout(
  reservaId: string,
  checkoutToken: string
): Promise<RespostaApi<object>> {
  return chamarApi(`/api/reservas/${encodeURIComponent(reservaId)}/vincular`, {
    method: "POST",
    corpo: { checkoutToken },
  });
}

/**
 * Cancela uma reserva do atleta autenticado.
 *
 * @param reservaId Reserva
 */
export function cancelarReservaDoAtleta(reservaId: string): Promise<RespostaApi<object>> {
  return chamarApi(`/api/reservas/${encodeURIComponent(reservaId)}/cancelar`, { method: "POST" });
}

/**
 * Abre, altera ou fecha as vagas da partida do atleta autenticado.
 *
 * @param reservaId Reserva
 * @param vagasAbertas Quantidade de vagas (0 fecha)
 */
export function atualizarVagasDoAtleta(
  reservaId: string,
  vagasAbertas: number
): Promise<RespostaApi<{ permiteVagas: boolean; vagasAbertas: number }>> {
  return chamarApi(`/api/reservas/${encodeURIComponent(reservaId)}/vagas`, {
    method: "POST",
    corpo: { vagasAbertas },
  });
}
