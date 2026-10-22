/**
 * Hook customizado de abstração para gerenciamento do Sistema de Vagas Abertas.
 * Conecta componentes de interface às regras de negócio e à camada de persistência.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useReservasService } from "@/hooks/useReservasService";
import {
  validarAberturaVagas,
  validarDemonstracaoInteresse,
  construirInteresseVaga,
  montarVagasDisponiveis,
  obterInteressadosDaReserva,
  contarInteressadosPendentes,
} from "@/lib/vagas/vagasService";
import {
  fetchInteressesVagasSupabase,
  inserirInteresseVagaSupabase,
  atualizarStatusInteresseSupabase,
  getInteressesLocais,
} from "@/lib/supabase/vagasService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useReservasStore } from "@/store/useReservasStore";
import { atualizarVagasDoAtleta } from "@/lib/reservas/reservasApi";
import type {
  InteresseVaga,
  StatusInteresse,
  VagaDisponivelItem,
  DadosAberturaVagas,
  DadosInteresseVaga,
} from "@/lib/vagas/types";

export function useVagasService() {
  const { reservas, atualizarVagasReserva } = useReservasService();
  const [interesses, setInteresses] = useState<InteresseVaga[]>(() => getInteressesLocais());
  const [carregando, setCarregando] = useState<boolean>(true);

  /**
   * Grava as vagas da partida. Com Supabase, o servidor confere que a reserva é do atleta
   * (o RLS não permite que atletas alterem `reservas`); sem Supabase, atualiza a store local.
   */
  const persistirVagas = useCallback(
    async (reservaId: string, vagasAbertas: number): Promise<{ sucesso: boolean; erro?: string }> => {
      if (!isSupabaseConfigured()) {
        atualizarVagasReserva(reservaId, vagasAbertas > 0, vagasAbertas);
        return { sucesso: true };
      }
      const res = await atualizarVagasDoAtleta(reservaId, vagasAbertas);
      if (!res.ok || !res.dados) return { sucesso: false, erro: res.erro };
      useReservasStore.getState().atualizarReserva(reservaId, {
        permiteVagas: res.dados.permiteVagas,
        vagasAbertas: res.dados.vagasAbertas,
      });
      return { sucesso: true };
    },
    [atualizarVagasReserva]
  );

  // Carregamento inicial de interesses da persistência
  useEffect(() => {
    let ativo = true;

    async function carregarInteresses() {
      try {
        const dados = await fetchInteressesVagasSupabase();
        if (ativo && dados) {
          setInteresses(dados);
        }
      } catch (err) {
        console.error("[useVagasService] Erro ao carregar interesses:", err);
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void carregarInteresses();

    return () => {
      ativo = false;
    };
  }, []);

  /**
   * Lista enriquecida de todas as partidas ativas que possuem vagas abertas.
   * Atualizada reativamente quando o estado de reservas ou interesses muda.
   */
  const vagasDisponiveis: VagaDisponivelItem[] = useMemo(() => {
    return montarVagasDisponiveis(reservas, interesses);
  }, [reservas, interesses]);

  /**
   * Abre vagas para uma reserva existente ou atualiza a quantidade disponível.
   */
  const abrirVagas = useCallback(
    async (
      reservaId: string,
      vagasAbertas: number,
      aceitouTermos: boolean
    ): Promise<{ sucesso: boolean; erro?: string }> => {
      const reserva = reservas.find((r) => r.id === reservaId);
      const payload: DadosAberturaVagas = {
        reservaId,
        vagasAbertas,
        aceitouTermos,
      };

      const validacao = validarAberturaVagas(payload, reserva);
      if (!validacao.valido) {
        return { sucesso: false, erro: validacao.erros[0] };
      }

      try {
        return await persistirVagas(reservaId, vagasAbertas);
      } catch (err) {
        console.error("[useVagasService] Falha ao abrir vagas:", err);
        return { sucesso: false, erro: "Erro inesperado ao salvar alterações." };
      }
    },
    [reservas, persistirVagas]
  );

  /**
   * Encerra a abertura de vagas de uma reserva, desativando a busca por novos participantes.
   */
  const fecharVagas = useCallback(
    async (reservaId: string): Promise<{ sucesso: boolean; erro?: string }> => {
      const reserva = reservas.find((r) => r.id === reservaId);
      if (!reserva) {
        return { sucesso: false, erro: "Reserva não encontrada." };
      }

      try {
        return await persistirVagas(reservaId, 0);
      } catch (err) {
        console.error("[useVagasService] Falha ao fechar vagas:", err);
        return { sucesso: false, erro: "Não foi possível fechar as vagas." };
      }
    },
    [reservas, persistirVagas]
  );

  /**
   * Altera diretamente a contagem de vagas restantes para uma reserva com vagas já abertas.
   */
  const atualizarQuantidadeVagas = useCallback(
    async (
      reservaId: string,
      novaQuantidade: number
    ): Promise<{ sucesso: boolean; erro?: string }> => {
      const reserva = reservas.find((r) => r.id === reservaId);
      if (!reserva) {
        return { sucesso: false, erro: "Reserva não encontrada." };
      }

      if (novaQuantidade <= 0) {
        return persistirVagas(reservaId, 0);
      }

      if (!Number.isInteger(novaQuantidade) || novaQuantidade > 30) {
        return { sucesso: false, erro: "Quantidade de vagas inválida." };
      }

      return persistirVagas(reservaId, novaQuantidade);
    },
    [reservas, persistirVagas]
  );

  /**
   * Registra a manifestação de interesse de um jogador autenticado em participar de uma partida.
   */
  const demonstrarInteresse = useCallback(
    async (dados: DadosInteresseVaga): Promise<{ sucesso: boolean; erro?: string }> => {
      const reserva = reservas.find((r) => r.id === dados.reservaId);
      const validacao = validarDemonstracaoInteresse(dados, reserva, interesses);

      if (!validacao.valido) {
        return { sucesso: false, erro: validacao.erros[0] };
      }

      try {
        const novoInteresse = construirInteresseVaga(dados);
        setInteresses((prev) => [novoInteresse, ...prev]);
        await inserirInteresseVagaSupabase(novoInteresse);
        return { sucesso: true };
      } catch (err) {
        console.error("[useVagasService] Falha ao registrar interesse:", err);
        return { sucesso: false, erro: "Ocorreu um erro ao enviar sua solicitação." };
      }
    },
    [reservas, interesses]
  );

  /**
   * Atualiza o status de contato com um interessado (ex.: marcado como contatado ou rejeitado).
   */
  const atualizarStatusInteresse = useCallback(
    async (
      interesseId: string,
      status: StatusInteresse
    ): Promise<{ sucesso: boolean }> => {
      try {
        setInteresses((prev) =>
          prev.map((i) => (i.id === interesseId ? { ...i, status } : i))
        );
        await atualizarStatusInteresseSupabase(interesseId, status);
        return { sucesso: true };
      } catch (err) {
        console.error("[useVagasService] Erro ao atualizar status:", err);
        return { sucesso: false };
      }
    },
    []
  );

  /**
   * Retorna os interessados em uma reserva específica.
   */
  const getInteressadosReserva = useCallback(
    (reservaId: string): InteresseVaga[] => {
      return obterInteressadosDaReserva(reservaId, interesses);
    },
    [interesses]
  );

  /**
   * Verifica se determinado usuário já registrou interesse ativo em uma reserva.
   */
  const temInteresseRegistrado = useCallback(
    (reservaId: string, usuarioId?: string): boolean => {
      if (!usuarioId) return false;
      return interesses.some(
        (i) =>
          i.reservaId === reservaId &&
          i.usuarioId === usuarioId &&
          i.status !== "rejeitado"
      );
    },
    [interesses]
  );

  /**
   * Retorna a quantidade de interessados pendentes para gerar badges de notificação.
   */
  const getTotalNovosInteressados = useCallback(
    (reservaId: string): number => {
      return contarInteressadosPendentes(reservaId, interesses);
    },
    [interesses]
  );

  return {
    interesses,
    vagasDisponiveis,
    carregando,
    abrirVagas,
    fecharVagas,
    atualizarQuantidadeVagas,
    demonstrarInteresse,
    atualizarStatusInteresse,
    getInteressadosReserva,
    temInteresseRegistrado,
    getTotalNovosInteressados,
  };
}
