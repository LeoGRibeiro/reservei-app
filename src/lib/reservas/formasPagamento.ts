/**
 * @module reservas/formasPagamento
 *
 * Formas de pagamento do restante no balcão (compartilhado entre servidor e painel).
 */

export type FormaPagamento = "dinheiro" | "pix" | "cartao";

/** Rótulo de cada forma, como o dono fala. */
export const FORMAS_PAGAMENTO: Record<FormaPagamento, string> = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };
