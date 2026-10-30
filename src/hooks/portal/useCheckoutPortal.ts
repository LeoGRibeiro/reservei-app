/**
 * @file useCheckoutPortal.ts
 * @description Caso de uso do checkout no portal: dados → Pix → confirmada. A reserva e o preço são
 * criados e conferidos pelo servidor (`/api/reservas/checkout`), que trava o horário por 10 minutos.
 * No modo `simulado`, "Simular pagamento" confirma pelo mesmo caminho de um webhook; nos outros
 * modos, a tela acompanha a confirmação consultando o status a cada 4 s.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chamarApi } from "@/lib/api/clienteApi";
import {
  cancelarCheckout,
  consultarStatusCheckout,
  criarCheckout,
  informarPagamentoManual,
  simularPagamentoCheckout,
  type PedidoCheckout,
} from "@/lib/reservas/reservasApi";
import type { PixCobranca } from "@/lib/pagamento/types";
import type { Esporte } from "@/lib/quadras";
import { hh } from "@/lib/portal/formatos";
import type { ResumoSelecao } from "@/lib/portal/agenda";

export type EtapaCheckout = "dados" | "pix" | "ok";

/** Reserva confirmada (tela final). */
export interface ReservaConfirmada {
  reservaId: string;
  resumo: ResumoSelecao;
  dia: string;
  /** O que foi pago no Pix */
  pago: number;
  /** Carimbos na cartela antes desta reserva */
  carimbosAntes: number;
}

/** Estado da etapa do Pix. */
export interface EstadoPix {
  carregando: boolean;
  cobranca: PixCobranca | null;
  expiraEm: string | null;
  expirado: boolean;
  /** Pix manual: o atleta avisou que pagou */
  informado: boolean;
}

const PIX_INICIAL: EstadoPix = { carregando: false, cobranca: null, expiraEm: null, expirado: false, informado: false };
const INTERVALO_STATUS_MS = 4000;

/** Dados do formulário "Seus dados". */
export interface DadosCheckout {
  arenaId: string;
  resumo: ResumoSelecao;
  dia: string;
  nome: string;
  whatsapp: string;
  esporte: string;
  integral: boolean;
  horaGratisId: string | null;
  carimbosAntes: number;
}

/**
 * @param aoErro Mostra um aviso de erro
 */
export function useCheckoutPortal(aoErro: (mensagem: string) => void) {
  const [etapa, setEtapa] = useState<EtapaCheckout>("dados");
  const [pix, setPix] = useState<EstadoPix>(PIX_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [confirmada, setConfirmada] = useState<ReservaConfirmada | null>(null);
  const checkout = useRef<{ reservaId: string; token: string; dados: DadosCheckout } | null>(null);
  const acompanhamento = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararAcompanhamento = useCallback(() => {
    if (acompanhamento.current) clearInterval(acompanhamento.current);
    acompanhamento.current = null;
  }, []);

  const concluir = useCallback(() => {
    const c = checkout.current;
    if (!c) return;
    pararAcompanhamento();
    setConfirmada({
      reservaId: c.reservaId,
      resumo: c.dados.resumo,
      dia: c.dados.dia,
      pago: c.dados.resumo.agora,
      carimbosAntes: c.dados.carimbosAntes,
    });
    checkout.current = null;
    setEtapa("ok");
  }, [pararAcompanhamento]);

  const acompanhar = useCallback(() => {
    pararAcompanhamento();
    acompanhamento.current = setInterval(async () => {
      const c = checkout.current;
      if (!c) return;
      const r = await consultarStatusCheckout(c.reservaId, c.token);
      if (r.ok && r.dados && (r.dados.status === "confirmada" || r.dados.status === "pendente")) concluir();
    }, INTERVALO_STATUS_MS);
  }, [concluir, pararAcompanhamento]);

  useEffect(() => pararAcompanhamento, [pararAcompanhamento]);

  /** Envia "Seus dados": cria a reserva (lock) e gera o Pix. */
  const enviarDados = useCallback(
    async (dados: DadosCheckout) => {
      if (enviando) return;
      setEnviando(true);
      const pedido: PedidoCheckout = {
        arenaId: dados.arenaId,
        quadraId: dados.resumo.quadra.id,
        data: dados.dia,
        horarios: dados.resumo.horas.map(hh),
        nomeCliente: dados.nome,
        whatsappCliente: dados.whatsapp.replace(/\D/g, ""),
        esporte: (dados.esporte || undefined) as Esporte | undefined,
        tipoPagamento: dados.integral ? "integral" : "sinal",
        voucherIds: dados.horaGratisId ? [dados.horaGratisId] : [],
        aceiteTermos: false,
        aceitePolitica: true,
      };
      const criado = await criarCheckout(pedido);
      setEnviando(false);
      if (!criado.ok || !criado.dados) {
        aoErro(criado.erro ?? "Não foi possível reservar. Tente de novo.");
        return;
      }
      checkout.current = { reservaId: criado.dados.reserva.id, token: criado.dados.checkoutToken, dados };
      if (criado.dados.reserva.status === "confirmada") {
        concluir();
        return;
      }
      setEtapa("pix");
      setPix({ ...PIX_INICIAL, carregando: true });
      const emitido = await chamarApi<{ cobranca: PixCobranca }>("/api/pagamentos/pix", {
        method: "POST",
        corpo: {
          reservaId: criado.dados.reserva.id,
          checkoutToken: criado.dados.checkoutToken,
          tipoPagamento: pedido.tipoPagamento,
          expiracaoMinutos: 10,
          nomeCliente: pedido.nomeCliente,
          whatsappCliente: pedido.whatsappCliente,
        },
      });
      if (!emitido.ok || !emitido.dados?.cobranca) {
        aoErro(emitido.erro ?? "Não foi possível gerar o Pix. Tente de novo.");
        void cancelarCheckout(criado.dados.reserva.id, criado.dados.checkoutToken);
        checkout.current = null;
        setPix(PIX_INICIAL);
        setEtapa("dados");
        return;
      }
      setPix({
        ...PIX_INICIAL,
        cobranca: emitido.dados.cobranca,
        expiraEm: criado.dados.reserva.expiraEm ?? emitido.dados.cobranca.expiraEm,
      });
      acompanhar();
    },
    [acompanhar, aoErro, concluir, enviando]
  );

  /** "Simular pagamento" (só no modo simulado). */
  const simular = useCallback(async () => {
    const c = checkout.current;
    if (!c) return;
    const r = await simularPagamentoCheckout(c.reservaId, c.token, c.dados.integral ? "integral" : "sinal");
    if (!r.ok) {
      aoErro(r.erro ?? "Não foi possível simular o pagamento.");
      return;
    }
    concluir();
  }, [aoErro, concluir]);

  /** Pix manual: avisa a arena que pagou (o acompanhamento continua). */
  const informarPagamento = useCallback(async () => {
    const c = checkout.current;
    if (!c) return;
    const r = await informarPagamentoManual(c.reservaId, c.token);
    if (!r.ok) {
      aoErro(r.erro ?? "Não foi possível avisar a arena.");
      return;
    }
    setPix((p) => ({ ...p, informado: true, expiraEm: r.dados?.expiraEm ?? p.expiraEm }));
  }, [aoErro]);

  /** O prazo do Pix acabou: o horário foi liberado. */
  const expirar = useCallback(() => {
    pararAcompanhamento();
    const c = checkout.current;
    if (c) void cancelarCheckout(c.reservaId, c.token);
    checkout.current = null;
    setPix((p) => ({ ...p, expirado: true }));
  }, [pararAcompanhamento]);

  /** Volta do Pix para "Seus dados" (libera o horário; um novo lock nasce ao enviar de novo). */
  const voltar = useCallback(() => {
    pararAcompanhamento();
    const c = checkout.current;
    if (c) void cancelarCheckout(c.reservaId, c.token);
    checkout.current = null;
    setPix(PIX_INICIAL);
    setEtapa("dados");
  }, [pararAcompanhamento]);

  /** Fecha o checkout: um Pix não pago libera o horário. */
  const encerrar = useCallback(() => {
    pararAcompanhamento();
    const c = checkout.current;
    if (c && !pix.informado) void cancelarCheckout(c.reservaId, c.token);
    checkout.current = null;
    setPix(PIX_INICIAL);
    setEtapa("dados");
  }, [pararAcompanhamento, pix.informado]);

  return { etapa, pix, enviando, confirmada, enviarDados, simular, informarPagamento, expirar, voltar, encerrar };
}
