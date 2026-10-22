/**
 * @file useCheckoutReserva.ts
 * @description Orquestra o checkout de uma reserva no portal público.
 *
 * Com Supabase, tudo passa pelo servidor: criação da reserva (preço e disponibilidade validados lá),
 * emissão do Pix, acompanhamento da confirmação feita pelo webhook, simulação (desenvolvimento) e
 * desistência. Sem Supabase (modo offline/demonstração local), o mesmo fluxo roda na store local.
 */

"use client";

import { useCallback, useRef } from "react";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { LockService } from "@/lib/pagamento/lockService";
import { solicitarPixParaReserva } from "@/lib/pagamento/pagamentoService";
import type { PixCobranca } from "@/lib/pagamento/types";
import type { Arena } from "@/lib/arena/types";
import {
  cancelarCheckout,
  consultarStatusCheckout,
  criarCheckout,
  simularPagamentoCheckout,
  type PedidoCheckout,
} from "@/lib/reservas/reservasApi";

/** Valores calculados no navegador, usados apenas no modo offline (o servidor recalcula os seus). */
export interface ValoresLocais {
  valorOriginal: number;
  descontoFidelidade: number;
  valorTotal: number;
  valorSinal: number;
  valorPendente: number;
  codigosVouchers: string[];
}

/** Checkout em andamento. */
export interface CheckoutAtivo {
  reservaId: string;
  checkoutToken: string;
  reserva: Reserva;
}

/** Resultado da criação do checkout. */
export type ResultadoInicioCheckout =
  | { ok: true; checkout: CheckoutAtivo; gratuita: boolean }
  | { ok: false; erro: string };

const TOKEN_LOCAL = "local";

/** Hora de término do último slot de 1h (ex.: '21:00' -> '22:00'). */
function horaFim(horarios: string[]): string {
  const ultima = parseInt(horarios[horarios.length - 1], 10);
  return `${String(ultima + 1).padStart(2, "0")}:00`;
}

/**
 * Hook do checkout do portal.
 *
 * @returns Ações do checkout
 *
 * @example
 * ```tsx
 * const { iniciar, gerarPix, aguardarConfirmacao, cancelar } = useCheckoutReserva();
 * const r = await iniciar(pedido, valoresLocais, userId);
 * ```
 */
export function useCheckoutReserva() {
  const pararAcompanhamento = useRef<(() => void) | null>(null);

  /**
   * Cria a reserva com lock de 10 minutos.
   *
   * @param pedido Intenção de reserva
   * @param valoresLocais Valores do modo offline (ignorados pelo servidor)
   * @param userId Atleta logado (modo offline; no servidor vem do token)
   */
  const iniciar = useCallback(
    async (pedido: PedidoCheckout, valoresLocais: ValoresLocais, userId?: string): Promise<ResultadoInicioCheckout> => {
      const horarios = [...pedido.horarios].sort();
      const base: Omit<Reserva, "id" | "status" | "valorTotal" | "valorSinal" | "valorPendente"> = {
        arenaId: pedido.arenaId,
        userId,
        quadraId: pedido.quadraId,
        data: pedido.data,
        horarios,
        horaInicio: horarios[0],
        horaFim: horaFim(horarios),
        nomeCliente: pedido.nomeCliente,
        whatsappCliente: pedido.whatsappCliente,
        cpfCliente: "",
        statusWhatsApp: "nao_enviado",
        criadaEm: new Date().toISOString(),
        esporte: pedido.esporte,
        observacoes: pedido.observacoes,
        tipoReserva: "avulsa",
      };

      if (!isSupabaseConfigured()) {
        const gratuita = valoresLocais.valorTotal === 0 && valoresLocais.codigosVouchers.length > 0;
        const reserva: Reserva = {
          ...base,
          id: `rsv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: gratuita ? "confirmada" : "em_processamento",
          valorTotal: valoresLocais.valorTotal,
          valorSinal: valoresLocais.valorSinal,
          valorPendente: valoresLocais.valorPendente,
          valorOriginal: valoresLocais.valorOriginal,
          descontoFidelidade: valoresLocais.descontoFidelidade,
          vouchersUtilizados: valoresLocais.codigosVouchers,
          reservaGratuitaFidelidade: gratuita,
          expiraEm: gratuita ? undefined : LockService.gerarTimestampExpiracaoLock(),
        };
        useReservasStore.getState().adicionarReserva(reserva);
        return { ok: true, gratuita, checkout: { reservaId: reserva.id, checkoutToken: TOKEN_LOCAL, reserva } };
      }

      const res = await criarCheckout({ ...pedido, horarios });
      if (!res.ok || !res.dados) return { ok: false, erro: res.erro ?? "Não foi possível reservar." };

      const criada = res.dados.reserva;
      const reserva: Reserva = {
        ...base,
        id: criada.id,
        status: criada.status,
        valorTotal: criada.valorTotal,
        valorSinal: criada.valorSinal,
        valorPendente: criada.valorPendente,
        valorOriginal: criada.valorOriginal,
        descontoFidelidade: criada.descontoFidelidade,
        reservaGratuitaFidelidade: criada.reservaGratuitaFidelidade,
        expiraEm: criada.expiraEm ?? undefined,
      };
      useReservasStore.getState().adicionarReserva(reserva);
      return {
        ok: true,
        gratuita: criada.reservaGratuitaFidelidade,
        checkout: { reservaId: criada.id, checkoutToken: res.dados.checkoutToken, reserva },
      };
    },
    []
  );

  /**
   * Gera a cobrança Pix do checkout.
   */
  const gerarPix = useCallback(
    async (
      checkout: CheckoutAtivo,
      arena: Arena,
      tipoPagamento: "sinal" | "integral"
    ): Promise<{ ok: true; cobranca: PixCobranca } | { ok: false; erro: string }> => {
      const r = await solicitarPixParaReserva({
        reserva: checkout.reserva,
        arena,
        checkoutToken: checkout.checkoutToken,
        tipoPagamento,
      });
      return r.sucesso && r.cobranca ? { ok: true, cobranca: r.cobranca } : { ok: false, erro: r.erro ?? "Erro ao gerar o Pix." };
    },
    []
  );

  /** Marca a reserva como paga na store local. */
  const registrarPagamentoLocal = useCallback((reservaId: string, tipoPagamento: "sinal" | "integral") => {
    const reserva = useReservasStore.getState().getReservaById(reservaId);
    if (!reserva) return;
    useReservasStore.getState().atualizarReserva(
      reservaId,
      tipoPagamento === "integral"
        ? { status: "confirmada", valorSinal: reserva.valorTotal, valorPendente: 0, statusWhatsApp: "enviado" }
        : { status: "pendente", statusWhatsApp: "enviado" }
    );
  }, []);

  /**
   * Acompanha a confirmação do Pix (webhook) consultando o servidor a cada 4 segundos.
   *
   * @param checkout Checkout em andamento
   * @param aoConfirmar Chamado uma única vez quando o pagamento é confirmado
   * @returns Função que encerra o acompanhamento
   */
  const aguardarConfirmacao = useCallback(
    (checkout: CheckoutAtivo, aoConfirmar: () => void): (() => void) => {
      pararAcompanhamento.current?.();
      if (!isSupabaseConfigured()) return () => {};

      let ativo = true;
      const verificar = async () => {
        const res = await consultarStatusCheckout(checkout.reservaId, checkout.checkoutToken);
        if (!ativo || !res.ok || !res.dados) return;
        if (res.dados.status === "confirmada" || res.dados.status === "pendente") {
          ativo = false;
          clearInterval(intervalo);
          useReservasStore.getState().atualizarReserva(checkout.reservaId, {
            status: res.dados.status,
            valorSinal: res.dados.valorSinal,
            valorPendente: res.dados.valorPendente,
          });
          aoConfirmar();
        }
      };
      const intervalo = setInterval(() => void verificar(), 4000);
      const parar = () => {
        ativo = false;
        clearInterval(intervalo);
      };
      pararAcompanhamento.current = parar;
      return parar;
    },
    []
  );

  /**
   * Confirma o pagamento no gateway simulado (desenvolvimento) ou na store local (offline).
   */
  const simularPagamento = useCallback(
    async (checkout: CheckoutAtivo, tipoPagamento: "sinal" | "integral"): Promise<{ ok: boolean; erro?: string }> => {
      if (!isSupabaseConfigured()) {
        registrarPagamentoLocal(checkout.reservaId, tipoPagamento);
        return { ok: true };
      }

      const res = await simularPagamentoCheckout(checkout.reservaId, checkout.checkoutToken, tipoPagamento);
      if (!res.ok) return { ok: false, erro: res.erro };

      const status = await consultarStatusCheckout(checkout.reservaId, checkout.checkoutToken);
      if (status.ok && status.dados) {
        useReservasStore.getState().atualizarReserva(checkout.reservaId, {
          status: status.dados.status as Reserva["status"],
          valorSinal: status.dados.valorSinal,
          valorPendente: status.dados.valorPendente,
        });
      } else {
        registrarPagamentoLocal(checkout.reservaId, tipoPagamento);
      }
      return { ok: true };
    },
    [registrarPagamentoLocal]
  );

  /**
   * Desiste do checkout e libera o horário.
   */
  const cancelar = useCallback(async (checkout: CheckoutAtivo): Promise<void> => {
    pararAcompanhamento.current?.();
    useReservasStore.getState().removerReserva(checkout.reservaId);
    if (isSupabaseConfigured() && checkout.checkoutToken !== TOKEN_LOCAL) {
      await cancelarCheckout(checkout.reservaId, checkout.checkoutToken);
    }
  }, []);

  return { iniciar, gerarPix, aguardarConfirmacao, simularPagamento, cancelar };
}
