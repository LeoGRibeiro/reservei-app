/**
 * Camada de abstração para contratos recorrentes (escolinhas e grupos comuns).
 * Orquestra: validação → geração das ocorrências → persistência (Supabase) → estado local.
 * Componentes de UI não devem acessar stores ou Supabase diretamente.
 */

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useContratosStore } from "@/store/useContratosStore";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";
import { useReservasService } from "@/hooks/useReservasService";
import { getHoje } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchContratosSupabase,
  inserirContratoSupabase,
  atualizarContratoSupabase,
} from "@/lib/supabase/contratosService";
import {
  atualizarReservaSupabase,
  atualizarReservasEmLoteSupabase,
  inserirReservasEmLoteSupabase,
} from "@/lib/supabase/reservasService";
import {
  encontrarConflitosDoBloco,
  encontrarConflitosDoContrato,
  gerarReservasDoContrato,
  validarDadosContrato,
  type ConflitoOcorrencia,
} from "@/lib/recorrencia/ocorrencias";
import {
  calcularSituacaoCobranca,
  classificarAviso,
  validarRegistroCancelamento,
  type ClassificacaoAviso,
  type SituacaoCobranca,
} from "@/lib/recorrencia/cancelamento";
import { obterAvisosEscolinha, type AvisoEscolinha } from "@/lib/recorrencia/agenda";
import type {
  ContratoRecorrente,
  DadosNovoContrato,
  TipoContrato,
} from "@/lib/recorrencia/types";
import type { Esporte } from "@/lib/quadras";

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export type ResultadoCriarContrato =
  | { ok: true; contrato: ContratoRecorrente; totalOcorrencias: number }
  | { ok: false; erros: string[]; conflitos?: ConflitoOcorrencia[] };

export type ResultadoCancelamento =
  | { ok: true; classificacao: ClassificacaoAviso }
  | { ok: false; motivo: string };

export type ResultadoSimples = { ok: true } | { ok: false; motivo: string };

function gerarIdContrato(): string {
  return `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContratosService() {
  // Garante que as reservas (incluindo ocorrências materializadas) estejam sincronizadas
  const { reservas } = useReservasService();

  const contratos = useContratosStore((s) => s.contratos);
  const setContratos = useContratosStore((s) => s.setContratos);
  const isLoadedFromDb = useContratosStore((s) => s.isLoadedFromDb);

  // ── Sincronização com Supabase ─────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    if (!isSupabaseConfigured()) return;

    fetchContratosSupabase().then((dados) => {
      if (isMounted && dados) setContratos(dados);
    });

    return () => {
      isMounted = false;
    };
  }, [setContratos]);

  // Se existirem reservas com contrato_id cujo contrato ainda não está na store local, sincroniza
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const temContratoFaltando = reservas.some(
      (r) => r.contratoId && !contratos.some((c) => c.id === r.contratoId)
    );
    if (temContratoFaltando) {
      fetchContratosSupabase().then((dados) => {
        if (dados) setContratos(dados);
      });
    }
  }, [reservas, contratos, setContratos]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const getContratosPorTipo = useCallback(
    (tipo: TipoContrato): ContratoRecorrente[] => contratos.filter((c) => c.tipo === tipo),
    [contratos]
  );

  /** Ocorrências (reservas) de um contrato, em ordem cronológica */
  const getOcorrencias = useCallback(
    (contratoId: string): Reserva[] =>
      reservas
        .filter((r) => r.contratoId === contratoId)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [reservas]
  );

  const getAvisosEscolinha = useCallback(
    (data: string, quadraId: string): AvisoEscolinha[] =>
      obterAvisosEscolinha(reservas, contratos, data, quadraId),
    [reservas, contratos]
  );

  const getSituacaoCobranca = useCallback(
    (cancelada: Reserva): SituacaoCobranca =>
      calcularSituacaoCobranca(cancelada, reservas, getHoje()),
    [reservas]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Cria um contrato e materializa todas as ocorrências na agenda.
   * Bloqueia a criação se alguma data colidir com reservas existentes.
   * Com Supabase configurado, só altera o estado local se o banco confirmar.
   */
  const criarContrato = useCallback(
    async (dados: DadosNovoContrato): Promise<ResultadoCriarContrato> => {
      const erros = validarDadosContrato(dados, getHoje());
      if (erros.length > 0) return { ok: false, erros };

      const reservasAtuais = useReservasStore.getState().reservas;
      const conflitos = encontrarConflitosDoContrato(dados, reservasAtuais);
      if (conflitos.length > 0) {
        return {
          ok: false,
          erros: [
            `${conflitos.length} data(s) do contrato colidem com reservas existentes. Cancele-as ou ajuste o período.`,
          ],
          conflitos,
        };
      }

      const contrato: ContratoRecorrente = {
        ...dados,
        nome: dados.nome.trim(),
        responsavelNome: dados.responsavelNome.trim(),
        descricao: dados.descricao?.trim() || undefined,
        id: gerarIdContrato(),
        ativo: true,
        criadoEm: new Date().toISOString(),
      };

      const ocorrencias = gerarReservasDoContrato(contrato);
      if (ocorrencias.length === 0) {
        return { ok: false, erros: ["Nenhuma data foi gerada para o período informado."] };
      }

      if (isSupabaseConfigured()) {
        const contratoSalvo = await inserirContratoSupabase(contrato);
        if (!contratoSalvo) {
          return {
            ok: false,
            erros: [
              "Não foi possível salvar o contrato no banco. Verifique se a migração do schema.sql foi aplicada.",
            ],
          };
        }

        const reservasSalvas = await inserirReservasEmLoteSupabase(ocorrencias);
        if (!reservasSalvas) {
          await atualizarContratoSupabase(contrato.id, { ativo: false });
          return {
            ok: false,
            erros: ["Não foi possível bloquear os horários na agenda. O contrato foi desativado."],
          };
        }
      }

      useContratosStore.getState().adicionarContrato(contrato);
      useReservasStore.setState((state) => {
        const idsNovos = new Set(ocorrencias.map((o) => o.id));
        return {
          reservas: [...ocorrencias, ...state.reservas.filter((r) => !idsNovos.has(r.id))],
        };
      });

      return { ok: true, contrato, totalOcorrencias: ocorrencias.length };
    },
    []
  );

  /**
   * Grupo comum: registra o aviso de cancelamento de uma sessão.
   * Libera o horário ao público e classifica o aviso (sem ônus × tardio).
   */
  const registrarCancelamentoGrupo = useCallback(
    (reservaId: string, dataAviso: string = getHoje()): ResultadoCancelamento => {
      const ocorrencia = useReservasStore.getState().getReservaById(reservaId);
      if (!ocorrencia) return { ok: false, motivo: "Ocorrência não encontrada." };

      const validacao = validarRegistroCancelamento(ocorrencia, dataAviso, getHoje());
      if (!validacao.ok) return { ok: false, motivo: validacao.motivo ?? "Cancelamento inválido." };

      const atualizacao: Partial<Reserva> = {
        status: "cancelada",
        avisoCancelamentoEm: dataAviso,
      };
      useReservasStore.getState().atualizarReserva(reservaId, atualizacao);
      void atualizarReservaSupabase(reservaId, atualizacao);

      return { ok: true, classificacao: classificarAviso(dataAviso, ocorrencia.data) };
    },
    []
  );

  /**
   * Desfaz o cancelamento de uma sessão de grupo, desde que o horário
   * ainda esteja livre (ninguém reservou nesse meio-tempo).
   */
  const reativarOcorrenciaGrupo = useCallback((reservaId: string): ResultadoSimples => {
    const { reservas: atuais, getReservaById } = useReservasStore.getState();
    const ocorrencia = getReservaById(reservaId);

    if (!ocorrencia || ocorrencia.tipoReserva !== "grupo") {
      return { ok: false, motivo: "Ocorrência de grupo não encontrada." };
    }
    if (ocorrencia.status !== "cancelada") {
      return { ok: false, motivo: "Esta ocorrência não está cancelada." };
    }
    if (ocorrencia.data < getHoje()) {
      return { ok: false, motivo: "Não é possível reativar uma sessão que já passou." };
    }
    const conflitos = encontrarConflitosDoBloco(
      ocorrencia.quadraId,
      ocorrencia.data,
      ocorrencia.horarios,
      atuais,
      ocorrencia.id
    );
    if (conflitos.length > 0) {
      return { ok: false, motivo: "O horário já foi reservado por outro cliente." };
    }

    const atualizacao: Partial<Reserva> = { status: "pendente", avisoCancelamentoEm: null };
    useReservasStore.getState().atualizarReserva(reservaId, atualizacao);
    void atualizarReservaSupabase(reservaId, atualizacao);
    return { ok: true };
  }, []);

  /**
   * Encerra um contrato: desativa e cancela (sem ônus) as sessões de hoje em diante.
   * Sessões passadas permanecem no histórico.
   */
  const encerrarContrato = useCallback(
    async (contratoId: string): Promise<{ ok: boolean; sessoesCanceladas: number }> => {
      const hoje = getHoje();
      const futuras = useReservasStore
        .getState()
        .reservas.filter(
          (r) => r.contratoId === contratoId && r.data >= hoje && r.status !== "cancelada"
        );
      const ids = futuras.map((r) => r.id);

      if (isSupabaseConfigured()) {
        const contratoAtualizado = await atualizarContratoSupabase(contratoId, { ativo: false });
        if (!contratoAtualizado) return { ok: false, sessoesCanceladas: 0 };
        if (ids.length > 0) {
          const reservasAtualizadas = await atualizarReservasEmLoteSupabase(ids, {
            status: "cancelada",
          });
          if (!reservasAtualizadas) return { ok: false, sessoesCanceladas: 0 };
        }
      }

      useContratosStore.getState().atualizarContrato(contratoId, { ativo: false });
      const idsSet = new Set(ids);
      useReservasStore.setState((state) => ({
        reservas: state.reservas.map((r) =>
          idsSet.has(r.id) ? { ...r, status: "cancelada" as const } : r
        ),
      }));

      return { ok: true, sessoesCanceladas: ids.length };
    },
    []
  );

  /**
   * Atualiza as informações cadastrais e de divulgação de um contrato recorrente.
   * Propaga automaticamente as alterações para as ocorrências futuras na agenda.
   */
  const atualizarContrato = useCallback(
    async (
      contratoId: string,
      dados: Partial<ContratoRecorrente>
    ): Promise<{ ok: boolean; motivo?: string }> => {
      if (dados.nome !== undefined && !dados.nome.trim()) {
        return { ok: false, motivo: "O nome não pode estar vazio." };
      }
      if (dados.responsavelNome !== undefined && !dados.responsavelNome.trim()) {
        return { ok: false, motivo: "Informe o nome do responsável." };
      }
      if (dados.contatoWhatsapp !== undefined) {
        const whatsLimpo = dados.contatoWhatsapp.replace(/\D/g, "");
        if (whatsLimpo.length < 10) {
          return { ok: false, motivo: "Informe um WhatsApp válido com DDD." };
        }
      }

      const atualizacaoContrato: Partial<ContratoRecorrente> = {
        ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
        ...(dados.esporte !== undefined ? { esporte: dados.esporte } : {}),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao.trim() || undefined } : {}),
        ...(dados.responsavelNome !== undefined ? { responsavelNome: dados.responsavelNome.trim() } : {}),
        ...(dados.contatoWhatsapp !== undefined ? { contatoWhatsapp: dados.contatoWhatsapp } : {}),
        ...(dados.fotoUrl !== undefined ? { fotoUrl: dados.fotoUrl } : {}),
        ...(dados.faixaEtaria !== undefined ? { faixaEtaria: dados.faixaEtaria } : {}),
        ...(dados.escolinhaId !== undefined ? { escolinhaId: dados.escolinhaId } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      };

      if (isSupabaseConfigured()) {
        const ok = await atualizarContratoSupabase(contratoId, atualizacaoContrato);
        if (!ok) {
          return { ok: false, motivo: "Não foi possível salvar as alterações no banco de dados." };
        }

        const futuras = useReservasStore
          .getState()
          .reservas.filter((r) => r.contratoId === contratoId);
        const ids = futuras.map((r) => r.id);
        if (ids.length > 0) {
          const updateReserva: Partial<Reserva> = {
            ...(dados.nome !== undefined ? { nomeCliente: dados.nome.trim() } : {}),
            ...(dados.esporte !== undefined ? { esporte: dados.esporte } : {}),
            ...(dados.contatoWhatsapp !== undefined ? { whatsappCliente: dados.contatoWhatsapp } : {}),
            ...(dados.descricao !== undefined ? { observacoes: dados.descricao.trim() || undefined } : {}),
          };
          await atualizarReservasEmLoteSupabase(ids, updateReserva);
        }
      }

      useContratosStore.getState().atualizarContrato(contratoId, atualizacaoContrato);
      useReservasStore.setState((state) => ({
        reservas: state.reservas.map((r) => {
          if (r.contratoId !== contratoId) return r;
          return {
            ...r,
            ...(dados.nome !== undefined ? { nomeCliente: dados.nome.trim() } : {}),
            ...(dados.esporte !== undefined ? { esporte: dados.esporte } : {}),
            ...(dados.contatoWhatsapp !== undefined ? { whatsappCliente: dados.contatoWhatsapp } : {}),
            ...(dados.descricao !== undefined ? { observacoes: dados.descricao.trim() || undefined } : {}),
          };
        }),
      }));

      return { ok: true };
    },
    []
  );

  return useMemo(
    () => ({
      contratos,
      isLoadedFromDb,
      // Queries
      getContratosPorTipo,
      getOcorrencias,
      getAvisosEscolinha,
      getSituacaoCobranca,
      // Mutations
      criarContrato,
      atualizarContrato,
      registrarCancelamentoGrupo,
      reativarOcorrenciaGrupo,
      encerrarContrato,
    }),
    [
      contratos,
      isLoadedFromDb,
      getContratosPorTipo,
      getOcorrencias,
      getAvisosEscolinha,
      getSituacaoCobranca,
      criarContrato,
      atualizarContrato,
      registrarCancelamentoGrupo,
      reativarOcorrenciaGrupo,
      encerrarContrato,
    ]
  );
}
