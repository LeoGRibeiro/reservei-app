/**
 * @module hooks/useReservaDetalhe
 *
 * Uma reserva aberta no painel: carrega pelo id (do que já está na tela ou do banco), acompanha o
 * tempo real pelo store, lê o histórico e executa as ações do balcão pelo servidor
 * (`POST /api/admin/reservas/{id}`). A tela só muda depois que o servidor confirma.
 *
 * @example
 * ```tsx
 * const { reserva, eventos, executar, ocupado } = useReservaDetalhe(id, arenaSlug);
 * const r = await executar({ acao: "quitar", forma: "dinheiro", valorRecebido: 50 });
 * if (!r.ok) toast.error(r.erro);
 * ```
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano E)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";
import { buscarReservaSupabase, listarEventosReservaSupabase, type EventoReserva } from "@/lib/supabase/reservasService";
import { chamarApi } from "@/lib/api/clienteApi";
import type { AcaoBalcao } from "@/lib/reservas/balcaoServidorService";

export type EstadoCarga = "carregando" | "pronta" | "nao_encontrada" | "erro";

export function useReservaDetalhe(reservaId: string, arenaSlug: string) {
  const daTela = useReservasStore((s) => s.reservas.find((r) => r.id === reservaId));
  const [estado, setEstado] = useState<EstadoCarga>(daTela ? "pronta" : "carregando");
  const [eventos, setEventos] = useState<EventoReserva[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const recarregarEventos = useCallback(async () => {
    setEventos(await listarEventosReservaSupabase(reservaId));
  }, [reservaId]);

  // Busca no banco (sempre: a tela pode ter uma cópia antiga) e o histórico
  useEffect(() => {
    let ativo = true;
    buscarReservaSupabase(reservaId).then((encontrada) => {
      if (!ativo) return;
      if (encontrada) {
        useReservasStore.getState().mesclarReservas([encontrada]);
        setEstado("pronta");
      } else if (encontrada === null) {
        setEstado("nao_encontrada");
      } else {
        setEstado(useReservasStore.getState().getReservaById(reservaId) ? "pronta" : "erro");
      }
    });
    listarEventosReservaSupabase(reservaId).then((lista) => {
      if (ativo) setEventos(lista);
    });
    return () => {
      ativo = false;
    };
  }, [reservaId]);

  /**
   * Executa uma ação do balcão no servidor e atualiza a tela com a reserva devolvida.
   *
   * @returns `{ ok: true }` ou a mensagem do servidor
   */
  const executar = useCallback(
    async (acao: AcaoBalcao): Promise<{ ok: true; reserva: Reserva } | { ok: false; erro: string }> => {
      setOcupado(true);
      try {
        const resposta = await chamarApi<{ reserva: Reserva }>(`/api/admin/reservas/${encodeURIComponent(reservaId)}`, {
          method: "POST",
          corpo: { arenaSlug, ...acao },
        });
        if (!resposta.ok || !resposta.dados?.reserva) return { ok: false, erro: resposta.erro ?? "Não foi possível concluir. Tente de novo." };
        useReservasStore.getState().mesclarReservas([resposta.dados.reserva]);
        void recarregarEventos();
        return { ok: true, reserva: resposta.dados.reserva };
      } finally {
        setOcupado(false);
      }
    },
    [arenaSlug, reservaId, recarregarEventos]
  );

  return { reserva: daTela ?? null, estado: daTela ? "pronta" : estado, eventos, executar, ocupado };
}
