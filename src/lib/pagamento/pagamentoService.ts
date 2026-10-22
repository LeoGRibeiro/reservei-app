/**
 * @file pagamentoService.ts
 * @description Caso de uso do navegador para solicitar a cobrança Pix de uma reserva.
 *
 * A confirmação do pagamento (webhook) e a liberação de locks expirados rodam somente no servidor:
 * ver `confirmacaoServidorService.ts`.
 */

import type { Reserva } from "@/store/useReservasStore";
import type { Arena } from "@/lib/arena/types";
import type { PixCobranca, ResultadoCriacaoPix } from "./types";
import { obterPaymentGateway } from "./paymentGateway";
import { useReservasStore } from "@/store/useReservasStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export interface SolicitarPixParams {
  reserva: Reserva;
  /** Arena recebedora; usada apenas no modo local (sem Supabase). Com Supabase, o servidor a carrega do banco. */
  arena: Arena;
  /** Token secreto devolvido por `POST /api/reservas/checkout` (obrigatório com Supabase) */
  checkoutToken?: string;
  tipoPagamento?: "sinal" | "integral";
  expiracaoMinutos?: number;
}

/**
 * Emite a cobrança Pix pela API segura do servidor (`POST /api/pagamentos/pix`).
 * O servidor lê os valores do banco, gera o Pix no gateway e grava os metadados com service role.
 */
async function emitirPixViaApi(
  reserva: Reserva,
  checkoutToken: string,
  tipoPagamento: "sinal" | "integral",
  expiracaoMinutos: number
): Promise<ResultadoCriacaoPix> {
  try {
    const resposta = await fetch("/api/pagamentos/pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservaId: reserva.id,
        checkoutToken,
        tipoPagamento,
        expiracaoMinutos,
      }),
    });
    const corpo: { sucesso?: boolean; cobranca?: PixCobranca; erro?: string } = await resposta
      .json()
      .catch(() => ({}));

    if (!resposta.ok || !corpo.sucesso || !corpo.cobranca) {
      return { sucesso: false, erro: corpo.erro ?? "Não foi possível gerar o Pix. Tente novamente." };
    }
    return { sucesso: true, cobranca: corpo.cobranca };
  } catch (err) {
    console.warn("[PagamentoService] Falha de conexão ao emitir Pix:", err);
    return { sucesso: false, erro: "Falha de conexão ao gerar o Pix. Tente novamente." };
  }
}

/**
 * Solicita a cobrança Pix dinâmica da reserva em checkout.
 *
 * - Com Supabase configurado: delega ao servidor (`/api/pagamentos/pix`), que confere o token do
 *   checkout, lê os valores do banco, gera o Pix e grava os metadados. O navegador não escreve em `reservas`.
 * - Sem Supabase (desenvolvimento/testes offline): gera o Pix com o gateway simulado localmente.
 *
 * @param params Reserva, arena, token do checkout e modalidade de pagamento
 * @returns Resultado contendo o QR Code, Copia e Cola e expiração
 *
 * @example
 * ```ts
 * const r = await solicitarPixParaReserva({ reserva, arena, checkoutToken, tipoPagamento: "sinal" });
 * if (r.sucesso) setCobranca(r.cobranca);
 * ```
 */
export async function solicitarPixParaReserva(
  params: SolicitarPixParams
): Promise<ResultadoCriacaoPix> {
  const { reserva, arena, checkoutToken = "", tipoPagamento = "sinal", expiracaoMinutos = 10 } = params;

  const valor =
    tipoPagamento === "integral"
      ? reserva.valorTotal
      : reserva.valorSinal > 0
      ? reserva.valorSinal
      : reserva.valorTotal;

  if (valor <= 0) {
    return {
      sucesso: false,
      erro: "O valor da reserva deve ser maior que zero para emissão de Pix.",
    };
  }

  const resultado = isSupabaseConfigured()
    ? await emitirPixViaApi(reserva, checkoutToken, tipoPagamento, expiracaoMinutos)
    : await obterPaymentGateway().gerarPix({
        reservaId: reserva.id,
        arena,
        nomeCliente: reserva.nomeCliente,
        whatsappCliente: reserva.whatsappCliente,
        cpfCliente: reserva.cpfCliente,
        valor,
        descricao: `Reserva ${arena.nome} - Quadra #${reserva.quadraId} (${reserva.data})`,
        expiracaoMinutos,
      });

  if (!resultado.sucesso || !resultado.cobranca) {
    return resultado;
  }

  useReservasStore.getState().atualizarReserva(reserva.id, {
    status: "em_processamento",
    expiraEm: resultado.cobranca.expiraEm,
  });

  return resultado;
}

export const PagamentoService = {
  solicitarPixParaReserva,
};
