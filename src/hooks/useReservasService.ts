/**
 * Camada de abstração entre a UI e o banco de dados Supabase (com sincronização em tempo real).
 * Nenhum componente de UI deve importar o Zustand ou Supabase diretamente.
 * Este hook é o único ponto de acesso ao estado de reservas.
 */

"use client";

import { useEffect, useCallback, useMemo } from "react";
import {
  useReservasStore,
  type Reserva,
  type StatusReserva,
} from "@/store/useReservasStore";
import {
  calcularValorSinal,
  calcularValorPendente,
  calcularValorTotal,
} from "@/lib/constants";
import type { Esporte } from "@/lib/quadras";
import {
  fetchReservasSupabase,
  fetchReservasPorMesSupabase,
  inserirReservaSupabase,
  atualizarReservaSupabase,
  removerReservaSupabase,
  subscreverReservasSupabase,
} from "@/lib/supabase/reservasService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  listarUsuariosCadastrados,
  getTelefonesCadastradosLocal,
} from "@/lib/supabase/authService";
import {
  construirBloqueio,
  construirReservaManual,
  validarConflitoBloqueio,
  validarReservaManual,
} from "@/lib/adminAgenda/adminAgendaService";
import type {
  DadosCriacaoBloqueio,
  DadosCriacaoReservaManual,
  ResultadoOperacaoAgenda,
} from "@/lib/adminAgenda/types";
import { LockService } from "@/lib/pagamento/lockService";

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

// ─── Helper de enriquecimento com usuários cadastrados ───────────────────────

async function enriquecerReservasComUsuarios(lista: Reserva[]): Promise<Reserva[]> {
  try {
    const usuarios = await listarUsuariosCadastrados();
    const telMap = new Map(usuarios.map((u) => [u.telefone.replace(/\D/g, ""), u.id]));

    return lista.map((r) => {
      if (!r.userId && r.whatsappCliente) {
        const digits = r.whatsappCliente.replace(/\D/g, "");
        if (telMap.has(digits)) {
          const resolvedId = telMap.get(digits)!;
          void atualizarReservaSupabase(r.id, { userId: resolvedId });
          return { ...r, userId: resolvedId };
        }
      }
      return r;
    });
  } catch {
    return lista;
  }
}

// ─── Gerenciamento singleton de canal Realtime ────────────────────────────────

let activeRealtimeCleanup: (() => void) | null = null;
let realtimeListenersCount = 0;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReservasService() {
  const {
    reservas,
    isLoadedFromDb,
    setReservas,
    adicionarReserva,
    atualizarReserva,
    removerReserva,
    getReservaById,
  } = useReservasStore();

  // ── Sincronização inicial com o Supabase e Realtime ─────────────────────────
  useEffect(() => {
    let isMounted = true;

    // Busca dados do Supabase na inicialização apenas se ainda não carregados
    if (isSupabaseConfigured() && !useReservasStore.getState().isLoadedFromDb) {
      fetchReservasSupabase().then(async (dados) => {
        if (isMounted && dados) {
          const enriquecidos = await enriquecerReservasComUsuarios(dados);
          if (isMounted) {
            setReservas(enriquecidos);
          }
        }
      });
    }

    // Configura canal Realtime compartilhado
    realtimeListenersCount++;
    if (realtimeListenersCount === 1 && isSupabaseConfigured()) {
      activeRealtimeCleanup = subscreverReservasSupabase(
        (nova) => {
          void enriquecerReservasComUsuarios([nova]).then(([enriquecida]) => {
            useReservasStore.getState().adicionarReserva(enriquecida || nova);
          });
        },
        (atualizada) => {
          void enriquecerReservasComUsuarios([atualizada]).then(([enriquecida]) => {
            const finalReserva = enriquecida || atualizada;
            useReservasStore.getState().atualizarReserva(finalReserva.id, finalReserva);
          });
        },
        (idDeletado) => {
          useReservasStore.getState().removerReserva(idDeletado);
        }
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

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Reservas ativas para uma data e quadra específicas (considerando status confirmada, pendente e locks ativos) */
  const getHorariosOcupados = useCallback(
    (data: string, quadraId: string): string[] => {
      return LockService.filtrarHorariosOcupadosComLock(reservas, quadraId, data);
    },
    [reservas]
  );

  /** Verifica se um horário específico está ocupado numa quadra/data */
  const isHorarioOcupado = useCallback(
    (data: string, quadraId: string, horario: string): boolean => {
      return getHorariosOcupados(data, quadraId).includes(horario);
    },
    [getHorariosOcupados]
  );

  /** Retorna todos os horários ocupados em qualquer quadra para um dia */
  const getHorariosOcupadosDia = useCallback(
    (data: string): { quadraId: string; horario: string }[] => {
      const agora = new Date();
      return reservas
        .filter((r) => r.data === data && LockService.isReservaOcupandoSlot(r, agora))
        .flatMap((r) => r.horarios.map((h) => ({ quadraId: r.quadraId, horario: h })));
    },
    [reservas]
  );

  /** Reservas para o Dashboard Admin */
  const getTodasReservas = useCallback((): Reserva[] => reservas, [reservas]);

  /** Totais financeiros com discriminação de receita líquida e subsídios de fidelidade */
  const financeiro = useMemo(() => {
    // "pendente" = sinal pago e restante no balcão; "confirmada" = quitada. Ambas já entraram no caixa.
    // Checkouts "em_processamento" (Pix ainda não pago) não são receita.
    const confirmadas = reservas.filter((r) => r.status === "confirmada" || r.status === "pendente");
    const naoCaneladas = confirmadas;

    // Total de descontos e benefícios concedidos através do programa de fidelidade
    const totalDescontoFidelidade = naoCaneladas.reduce(
      (acc, r) => acc + (Number(r.descontoFidelidade) || 0),
      0
    );

    // Faturamento bruto de tabela correspondente às quadras reservadas
    const totalBrutoQuadras = naoCaneladas.reduce((acc, r) => {
      const original =
        r.valorOriginal !== undefined && !isNaN(Number(r.valorOriginal)) && Number(r.valorOriginal) > 0
          ? Number(r.valorOriginal)
          : (Number(r.valorTotal) || 0) + (Number(r.descontoFidelidade) || 0);
      return acc + (isNaN(original) ? 0 : original);
    }, 0);

    // Total líquido efetivamente arrecadado em dinheiro/Pix já confirmado
    const totalConfirmado = confirmadas.reduce((acc, r) => acc + (Number(r.valorSinal) || 0), 0);

    // Saldo pendente a receber em dinheiro/Pix no balcão
    const pendenteSinalConfirmado = confirmadas.reduce(
      (acc, r) => acc + (Number(r.valorPendente) || 0),
      0
    );

    // Total líquido previsto a entrar em caixa (Pix + Balcão)
    const totalPrevisto = naoCaneladas.reduce((acc, r) => acc + (Number(r.valorTotal) || 0), 0);

    return {
      totalConfirmado,
      totalPrevisto,
      pendenteSinalConfirmado,
      totalDescontoFidelidade,
      totalBrutoQuadras,
    };
  }, [reservas]);

  // ── Mutations Assíncronas (Sync com Supabase) ───────────────────────────────
  // O checkout público (criar reserva, identificação, pagamento e desistência) vive em
  // `useCheckoutReserva` e passa pelo servidor. As mutações abaixo são do painel administrativo
  // (operadores autorizados pelo RLS) ou do modo offline.

  /**
   * Admin: Confirma o pagamento restante no local (quitação integral).
   * Dispara UPDATE no banco Supabase.
   */
  const confirmarPagamentoRestante = useCallback(
    (id: string) => {
      const reserva = getReservaById(id);
      if (!reserva) return;

      const atualizacao: Partial<Reserva> = {
        status: "confirmada",
        valorSinal: reserva.valorTotal,
        valorPendente: 0,
      };

      atualizarReserva(id, atualizacao);
      void atualizarReservaSupabase(id, atualizacao);
    },
    [atualizarReserva, getReservaById]
  );

  /** Admin: cancela uma reserva confirmada (UPDATE status = 'cancelada') */
  const cancelarReserva = useCallback(
    (id: string) => {
      atualizarReserva(id, { status: "cancelada" });
      void atualizarReservaSupabase(id, { status: "cancelada" });
    },
    [atualizarReserva]
  );

  /** Admin: atualiza qualquer status de uma reserva (UPDATE status no Supabase) */
  const atualizarStatus = useCallback(
    (id: string, status: StatusReserva) => {
      atualizarReserva(id, { status });
      void atualizarReservaSupabase(id, { status });
    },
    [atualizarReserva]
  );

  /** Força recarregamento das reservas do Supabase com enriquecimento de usuários */
  const recarregarReservas = useCallback(async () => {
    const dados = await fetchReservasSupabase();
    if (dados) {
      const enriquecidos = await enriquecerReservasComUsuarios(dados);
      setReservas(enriquecidos);
    }
  }, [setReservas]);

  /**
   * Atualiza as configurações de vagas abertas de uma reserva (abrir, fechar ou alterar quantidade).
   */
  const atualizarVagasReserva = useCallback(
    (reservaId: string, permiteVagas: boolean, vagasAbertas: number) => {
      atualizarReserva(reservaId, { permiteVagas, vagasAbertas });
      void atualizarReservaSupabase(reservaId, { permiteVagas, vagasAbertas });
    },
    [atualizarReserva]
  );

  /** Retorna todas as reservas de um usuário específico */
  const getReservasDoUsuario = useCallback(
    (userId: string): Reserva[] => {
      return reservas.filter((r) => r.userId === userId);
    },
    [reservas]
  );

  /** Verifica se a reserva pertence a um cliente cadastrado (membro) */
  const isReservaDeMembro = useCallback(
    (reserva: Reserva): boolean => {
      if (reserva.userId) return true;
      if (!reserva.whatsappCliente) return false;
      const digits = reserva.whatsappCliente.replace(/\D/g, "");
      return getTelefonesCadastradosLocal().has(digits);
    },
    []
  );

  /**
   * Admin: Carrega reservas de um mês específico sob demanda (Lazy Loading).
   */
  const carregarReservasDoMes = useCallback(
    async (ano: number, mes: number) => {
      if (!isSupabaseConfigured()) return;
      try {
        const dados = await fetchReservasPorMesSupabase(ano, mes);
        if (dados && dados.length > 0) {
          const enriquecidos = await enriquecerReservasComUsuarios(dados);
          for (const item of enriquecidos) {
            adicionarReserva(item);
          }
        }
      } catch (err) {
        console.error(`[useReservasService] Erro ao carregar mês ${mes}/${ano}:`, err);
      }
    },
    [adicionarReserva]
  );

  /**
   * Admin: Criação de reserva manual no balcão com controle de pagamento e destaque visual.
   */
  const criarReservaManual = useCallback(
    async (dados: DadosCriacaoReservaManual): Promise<ResultadoOperacaoAgenda> => {
      const validacao = validarReservaManual(dados, reservas);
      if (!validacao.valido) {
        return {
          ok: false,
          motivo: validacao.erros[0] ?? "Dados inválidos.",
          conflitoCom: validacao.conflitoCom,
        };
      }

      const novaReserva = construirReservaManual(dados);

      // Atualização otimista no estado local
      adicionarReserva(novaReserva);

      // Persistência assíncrona no Supabase
      void inserirReservaSupabase(novaReserva);

      return {
        ok: true,
        reserva: novaReserva,
      };
    },
    [adicionarReserva, reservas]
  );

  /**
   * Admin: Bloqueia horários para manutenção ou evento interno.
   * Impede a operação se já houver reserva no horário.
   */
  const criarBloqueio = useCallback(
    async (dados: DadosCriacaoBloqueio): Promise<ResultadoOperacaoAgenda> => {
      const validacao = validarConflitoBloqueio(
        dados.quadraId,
        dados.data,
        dados.horarios,
        reservas
      );

      if (!validacao.valido) {
        return {
          ok: false,
          motivo: validacao.motivo ?? "Conflito de horário detectado.",
          conflitoCom: validacao.conflitoCom,
        };
      }

      const novoBloqueio = construirBloqueio(dados);

      // Atualização otimista no estado local
      adicionarReserva(novoBloqueio);

      // Persistência assíncrona no Supabase
      void inserirReservaSupabase(novoBloqueio);

      return {
        ok: true,
        reserva: novoBloqueio,
      };
    },
    [adicionarReserva, reservas]
  );

  /**
   * Admin: Remove um bloqueio de horário (desbloqueia).
   */
  const removerBloqueio = useCallback(
    async (bloqueioId: string): Promise<boolean> => {
      const item = getReservaById(bloqueioId);
      if (!item || item.tipoReserva !== "manutencao_bloqueio") {
        return false;
      }

      removerReserva(bloqueioId);
      void removerReservaSupabase(bloqueioId);
      return true;
    },
    [getReservaById, removerReserva]
  );

  return {
    // Queries
    reservas,
    getReservaById,
    getHorariosOcupados,
    isHorarioOcupado,
    getHorariosOcupadosDia,
    getTodasReservas,
    financeiro,
    isSupabaseConfigured: isSupabaseConfigured(),
    isReservaDeMembro,

    // Mutations
    confirmarPagamentoRestante,
    cancelarReserva,
    atualizarStatus,
    recarregarReservas,
    getReservasDoUsuario,
    atualizarVagasReserva,

    // Admin Agenda Mutations & Lazy Loading
    carregarReservasDoMes,
    criarReservaManual,
    criarBloqueio,
    removerBloqueio,
  };
}
