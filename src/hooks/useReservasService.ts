/**
 * @module hooks/useReservasService
 *
 * Reservas do painel administrativo, com sincronização em tempo real. Nunca traz o histórico inteiro
 * da arena: carrega uma janela em volta de hoje (35 dias para trás e 90 para a frente) e a Agenda pede
 * os meses que abrir. As mutações só mudam a tela depois que o banco confirma; quando o banco recusa
 * (ex.: horário já ocupado), a mensagem volta para a tela e nada muda.
 *
 * Nenhum componente de UI deve importar o Zustand ou o Supabase diretamente.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano C)
 */

"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useReservasStore, type Reserva, type StatusReserva } from "@/store/useReservasStore";
import type { Esporte } from "@/lib/quadras";
import {
  fetchReservasPeriodoSupabase,
  fetchReservasPorMesSupabase,
  inserirReservaSupabase,
  atualizarReservaSupabase,
  removerReservaSupabase,
  subscreverReservasSupabase,
  type ResultadoGravacao,
} from "@/lib/supabase/reservasService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  construirBloqueio,
  construirReservaManual,
  validarConflitoBloqueio,
  validarReservaManual,
} from "@/lib/adminAgenda/adminAgendaService";
import type { DadosCriacaoBloqueio, DadosCriacaoReservaManual, ResultadoOperacaoAgenda } from "@/lib/adminAgenda/types";
import { LockService } from "@/lib/pagamento/lockService";
import { getHoje } from "@/lib/constants";
import { somarDias } from "@/lib/datas/fusoHorario";

// ─── Tipos de entrada para criação ───────────────────────────────────────────

export interface DadosCriacaoReserva {
  arenaId?: string;
  quadraId: string;
  data: string;
  horarios: string[];
  userId?: string;
  nomeCliente?: string;
  whatsappCliente?: string;
  cpfCliente?: string;
  esporte?: Esporte;
  observacoes?: string;
  valorTotal?: number;
  valorSinal?: number;
  valorPendente?: number;
}

/** Janela carregada ao abrir o painel (dias antes e depois de hoje). */
export const JANELA_DIAS_ANTES = 35;
export const JANELA_DIAS_DEPOIS = 90;

/** Janela inicial do painel em volta de hoje. */
export function janelaInicial(hoje: string = getHoje()): { inicio: string; fim: string } {
  return { inicio: somarDias(hoje, -JANELA_DIAS_ANTES), fim: somarDias(hoje, JANELA_DIAS_DEPOIS) };
}

const FALHA_CONEXAO: ResultadoGravacao = { ok: false, erro: "O banco não confirmou a alteração. Confira a conexão e tente de novo." };

// ─── Gerenciamento singleton de canal Realtime ────────────────────────────────

let activeRealtimeCleanup: (() => void) | null = null;
let realtimeListenersCount = 0;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReservasService() {
  const { reservas, setReservas, mesclarReservas, adicionarReserva, atualizarReserva, removerReserva, getReservaById } =
    useReservasStore();

  // ── Janela inicial e tempo real ───────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured() && !useReservasStore.getState().isLoadedFromDb) {
      const { inicio, fim } = janelaInicial();
      fetchReservasPeriodoSupabase(inicio, fim).then((dados) => {
        if (isMounted && dados) setReservas(dados);
      });
    }

    realtimeListenersCount++;
    if (realtimeListenersCount === 1 && isSupabaseConfigured()) {
      activeRealtimeCleanup = subscreverReservasSupabase(
        (nova) => useReservasStore.getState().adicionarReserva(nova),
        (atualizada) => useReservasStore.getState().adicionarReserva(atualizada),
        (idDeletado) => useReservasStore.getState().removerReserva(idDeletado)
      );
    }

    return () => {
      isMounted = false;
      realtimeListenersCount--;
      if (realtimeListenersCount <= 0) {
        realtimeListenersCount = 0;
        if (activeRealtimeCleanup) {
          activeRealtimeCleanup();
          activeRealtimeCleanup = null;
        }
      }
    };
  }, [setReservas]);

  // ── Consultas ─────────────────────────────────────────────────────────────

  /** Horários ocupados de uma quadra num dia (reservas ativas e Pix com prazo valendo). */
  const getHorariosOcupados = useCallback(
    (data: string, quadraId: string): string[] => LockService.filtrarHorariosOcupadosComLock(reservas, quadraId, data),
    [reservas]
  );

  const isHorarioOcupado = useCallback(
    (data: string, quadraId: string, horario: string): boolean => getHorariosOcupados(data, quadraId).includes(horario),
    [getHorariosOcupados]
  );

  /** Horários ocupados em todas as quadras num dia. */
  const getHorariosOcupadosDia = useCallback(
    (data: string): { quadraId: string; horario: string }[] => {
      const agora = new Date();
      return reservas
        .filter((r) => r.data === data && LockService.isReservaOcupandoSlot(r, agora))
        .flatMap((r) => r.horarios.map((h) => ({ quadraId: r.quadraId, horario: h })));
    },
    [reservas]
  );

  const getTodasReservas = useCallback((): Reserva[] => reservas, [reservas]);

  /**
   * Totais das reservas carregadas (janela atual). O Financeiro usa o resumo calculado no banco
   * (`resumo_financeiro`); estes totais servem às telas que só olham a janela.
   */
  const financeiro = useMemo(() => {
    // "pendente" = sinal pago e restante no balcão; "confirmada" = quitada. Ambas já entraram no caixa.
    const ativas = reservas.filter((r) => r.status === "confirmada" || r.status === "pendente");
    const totalDescontoFidelidade = ativas.reduce((acc, r) => acc + (Number(r.descontoFidelidade) || 0), 0);
    const totalBrutoQuadras = ativas.reduce((acc, r) => {
      const original =
        r.valorOriginal !== undefined && Number(r.valorOriginal) > 0
          ? Number(r.valorOriginal)
          : (Number(r.valorTotal) || 0) + (Number(r.descontoFidelidade) || 0);
      return acc + (Number.isFinite(original) ? original : 0);
    }, 0);
    const totalPrevisto = ativas.reduce((acc, r) => acc + (Number(r.valorTotal) || 0), 0);
    const pendenteSinalConfirmado = ativas.reduce((acc, r) => acc + (Number(r.valorPendente) || 0), 0);
    return {
      totalConfirmado: totalPrevisto - pendenteSinalConfirmado,
      totalPrevisto,
      pendenteSinalConfirmado,
      totalDescontoFidelidade,
      totalBrutoQuadras,
    };
  }, [reservas]);

  // ── Leituras sob demanda ──────────────────────────────────────────────────

  /** Recarrega a janela inicial do banco. */
  const recarregarReservas = useCallback(async () => {
    const { inicio, fim } = janelaInicial();
    const dados = await fetchReservasPeriodoSupabase(inicio, fim);
    if (dados) mesclarReservas(dados);
  }, [mesclarReservas]);

  /** Carrega um mês (Agenda) e junta ao que já estava carregado. */
  const carregarReservasDoMes = useCallback(
    async (ano: number, mes: number) => {
      if (!isSupabaseConfigured()) return;
      const dados = await fetchReservasPorMesSupabase(ano, mes);
      if (dados) mesclarReservas(dados);
    },
    [mesclarReservas]
  );

  /** Carrega um período qualquer (ex.: datas de uma remarcação) e junta ao que já estava carregado. */
  const carregarPeriodo = useCallback(
    async (inicio: string, fim: string): Promise<Reserva[]> => {
      if (!isSupabaseConfigured()) return useReservasStore.getState().reservas.filter((r) => r.data >= inicio && r.data <= fim);
      const dados = await fetchReservasPeriodoSupabase(inicio, fim);
      if (dados) mesclarReservas(dados);
      return dados ?? [];
    },
    [mesclarReservas]
  );

  // ── Mutações (só mudam a tela depois do banco) ────────────────────────────

  /** Grava campos de uma reserva no banco e, se der certo, na tela. */
  const gravar = useCallback(
    async (id: string, dados: Partial<Reserva>): Promise<ResultadoGravacao> => {
      if (isSupabaseConfigured() && !(await atualizarReservaSupabase(id, dados))) return FALHA_CONEXAO;
      atualizarReserva(id, dados);
      return { ok: true };
    },
    [atualizarReserva]
  );

  /** Quita o restante da reserva no balcão. */
  const confirmarPagamentoRestante = useCallback(
    async (id: string): Promise<ResultadoGravacao> => {
      const reserva = getReservaById(id);
      if (!reserva) return { ok: false, erro: "Reserva não encontrada. Atualize a página." };
      return gravar(id, { status: "confirmada", valorSinal: reserva.valorTotal, valorPendente: 0 });
    },
    [getReservaById, gravar]
  );

  const cancelarReserva = useCallback((id: string) => gravar(id, { status: "cancelada" }), [gravar]);

  const atualizarStatus = useCallback((id: string, status: StatusReserva) => gravar(id, { status }), [gravar]);

  /** Abre, fecha ou muda a quantidade de vagas de uma reserva. */
  const atualizarVagasReserva = useCallback(
    (reservaId: string, permiteVagas: boolean, vagasAbertas: number) => gravar(reservaId, { permiteVagas, vagasAbertas }),
    [gravar]
  );

  /** Reservas carregadas de uma conta de atleta. */
  const getReservasDoUsuario = useCallback((userId: string): Reserva[] => reservas.filter((r) => r.userId === userId), [reservas]);

  /** A reserva pertence a uma conta de atleta. */
  const isReservaDeMembro = useCallback((reserva: Reserva): boolean => Boolean(reserva.userId), []);

  /** Reserva manual no balcão: confere conflito, grava no banco e só então mostra na agenda. */
  const criarReservaManual = useCallback(
    async (dados: DadosCriacaoReservaManual): Promise<ResultadoOperacaoAgenda> => {
      const validacao = validarReservaManual(dados, useReservasStore.getState().reservas);
      if (!validacao.valido) {
        return { ok: false, motivo: validacao.erros[0] ?? "Dados inválidos.", conflitoCom: validacao.conflitoCom };
      }
      const novaReserva = construirReservaManual(dados);
      if (isSupabaseConfigured()) {
        const gravado = await inserirReservaSupabase(novaReserva);
        if (!gravado.ok) return { ok: false, motivo: gravado.erro };
      }
      adicionarReserva(novaReserva);
      return { ok: true, reserva: novaReserva };
    },
    [adicionarReserva]
  );

  /** Bloqueio de horários (manutenção ou evento): impede se já houver reserva. */
  const criarBloqueio = useCallback(
    async (dados: DadosCriacaoBloqueio): Promise<ResultadoOperacaoAgenda> => {
      const validacao = validarConflitoBloqueio(dados.quadraId, dados.data, dados.horarios, useReservasStore.getState().reservas);
      if (!validacao.valido) {
        return { ok: false, motivo: validacao.motivo ?? "Conflito de horário detectado.", conflitoCom: validacao.conflitoCom };
      }
      const novoBloqueio = construirBloqueio(dados);
      if (isSupabaseConfigured()) {
        const gravado = await inserirReservaSupabase(novoBloqueio);
        if (!gravado.ok) return { ok: false, motivo: gravado.erro };
      }
      adicionarReserva(novoBloqueio);
      return { ok: true, reserva: novoBloqueio };
    },
    [adicionarReserva]
  );

  /** Remove um bloqueio (libera o horário). */
  const removerBloqueio = useCallback(
    async (bloqueioId: string): Promise<boolean> => {
      const item = getReservaById(bloqueioId);
      if (!item || item.tipoReserva !== "manutencao_bloqueio") return false;
      if (isSupabaseConfigured() && !(await removerReservaSupabase(bloqueioId))) return false;
      removerReserva(bloqueioId);
      return true;
    },
    [getReservaById, removerReserva]
  );

  return {
    // Consultas
    reservas,
    getReservaById,
    getHorariosOcupados,
    isHorarioOcupado,
    getHorariosOcupadosDia,
    getTodasReservas,
    financeiro,
    isSupabaseConfigured: isSupabaseConfigured(),
    isReservaDeMembro,
    getReservasDoUsuario,

    // Leituras sob demanda
    recarregarReservas,
    carregarReservasDoMes,
    carregarPeriodo,

    // Mutações
    confirmarPagamentoRestante,
    cancelarReserva,
    atualizarStatus,
    atualizarVagasReserva,
    criarReservaManual,
    criarBloqueio,
    removerBloqueio,
  };
}
