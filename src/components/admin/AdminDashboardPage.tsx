/**
 * Página de Visão Geral — KPI Cards do dia atual.
 * Lê dados diretamente do useReservasService (Zustand).
 */

"use client";

import { useQuadrasCatalogo, useHorariosCatalogo, descreverQuadra } from "@/store/useCatalogoArenaStore";
import { useMemo } from "react";
import {
  CalendarCheck,
  TrendingUp,
  Clock,
  Activity,
  ArrowUpRight,
  GraduationCap,
  Users,
  Calendar,
  Wrench,
} from "lucide-react";
import { useReservasService } from "@/hooks/useReservasService";
import { getTelefonesCadastradosLocal } from "@/lib/supabase/authService";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hoje() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface Props {
  /** Exibe o KPI de receita (sinais recebidos); oculto para operadores de balcão */
  exibirReceita?: boolean;
}

export function AdminDashboardPage({ exibirReceita = true }: Props = {}) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const horariosCatalogo = useHorariosCatalogo();
  const { reservas } = useReservasService();
  const dataHoje = hoje();

  const reservasHoje = useMemo(() => {
    return reservas
      .filter((r) => r.data === dataHoje && r.status !== "cancelada")
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [reservas, dataHoje]);

  const reservasAvulsas = useMemo(() => {
    return reservasHoje.filter(
      (r) =>
        r.tipoReserva !== "escolinha" &&
        r.tipoReserva !== "grupo" &&
        r.tipoReserva !== "manutencao_bloqueio"
    );
  }, [reservasHoje]);

  const aulasEscolinhas = useMemo(() => {
    return reservasHoje.filter((r) => r.tipoReserva === "escolinha");
  }, [reservasHoje]);

  const reservasGrupos = useMemo(() => {
    return reservasHoje.filter((r) => r.tipoReserva === "grupo");
  }, [reservasHoje]);

  const bloqueiosManutencao = useMemo(() => {
    return reservasHoje.filter((r) => r.tipoReserva === "manutencao_bloqueio");
  }, [reservasHoje]);

  const kpis = useMemo(() => {
    const sinaisPagos = reservasHoje.filter(
      (r) => r.status === "confirmada" || r.status === "pendente"
    );

    const totalSinaisRecebidos = sinaisPagos.reduce(
      (acc, r) => acc + r.valorSinal,
      0
    );

    const totalPendenteNoLocal = reservasHoje
      .filter((r) => r.status === "pendente")
      .reduce((acc, r) => acc + r.valorPendente, 0);

    const totalReservas = reservasHoje.length;

    // Taxa de ocupação: quadras da arena × horários de funcionamento
    const totalSlots = quadrasCatalogo.length * horariosCatalogo.length;
    const slotsOcupados = reservasHoje.reduce(
      (acc, r) => acc + r.horarios.length,
      0
    );
    const taxaOcupacao =
      totalSlots > 0 ? Math.round((slotsOcupados / totalSlots) * 100) : 0;

    return {
      totalReservas,
      totalSinaisRecebidos,
      totalPendenteNoLocal,
      taxaOcupacao,
    };
  }, [reservasHoje, quadrasCatalogo.length, horariosCatalogo.length]);

  const cards = [
    {
      id: "kpi-reservas",
      label: "Reservas hoje",
      valor: String(kpis.totalReservas),
      subLabel: "agendamentos ativos",
      icon: CalendarCheck,
      cor: "emerald",
      gradiente: "from-emerald-500/10 to-emerald-500/5",
      borderCor: "border-emerald-500/20",
      iconBg: "bg-emerald-500/10",
      iconCor: "text-emerald-400",
    },
    {
      id: "kpi-sinais",
      label: "Sinais confirmados",
      valor: formatarMoeda(kpis.totalSinaisRecebidos),
      subLabel: "pagos via Pix",
      icon: TrendingUp,
      cor: "sky",
      gradiente: "from-sky-500/10 to-sky-500/5",
      borderCor: "border-sky-500/20",
      iconBg: "bg-sky-500/10",
      iconCor: "text-sky-400",
    },
    {
      id: "kpi-pendente",
      label: "Pendente no local",
      valor: formatarMoeda(kpis.totalPendenteNoLocal),
      subLabel: "a receber presencialmente",
      icon: Clock,
      cor: "amber",
      gradiente: "from-amber-500/10 to-amber-500/5",
      borderCor: "border-amber-500/20",
      iconBg: "bg-amber-500/10",
      iconCor: "text-amber-400",
    },
    {
      id: "kpi-ocupacao",
      label: "Taxa de ocupação",
      valor: `${kpis.taxaOcupacao}%`,
      subLabel: "dos slots disponíveis",
      icon: Activity,
      cor: "violet",
      gradiente: "from-violet-500/10 to-violet-500/5",
      borderCor: "border-violet-500/20",
      iconBg: "bg-violet-500/10",
      iconCor: "text-violet-400",
    },
  ];
  const cardsVisiveis = exibirReceita ? cards : cards.filter((c) => c.id !== "kpi-sinais");

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
        <p className="text-slate-400 text-sm mt-1 capitalize">{dataFormatada}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cardsVisiveis.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              id={card.id}
              className={`relative bg-gradient-to-br ${card.gradiente} border ${card.borderCor} rounded-2xl p-5 overflow-hidden group hover:scale-[1.02] transition-transform duration-200`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Decoração de fundo */}
              <div
                className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${card.iconBg} blur-2xl opacity-60`}
              />

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl ${card.iconBg} border ${card.borderCor} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${card.iconCor}`} />
                  </div>
                  <ArrowUpRight
                    className={`w-4 h-4 ${card.iconCor} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                  />
                </div>

                <p className="text-slate-400 text-xs font-medium mb-1">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-white leading-none mb-1">
                  {card.valor}
                </p>
                <p className="text-slate-500 text-xs">{card.subLabel}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seções verticais de reservas de hoje separadas por categoria */}
      <div className="space-y-8">
        {/* Seção 1: Reservas Avulsas & Balcão */}
        <SecaoReservasAvulsas reservas={reservasAvulsas} />

        {/* Seção 2: Aulas de Escolinhas */}
        <SecaoAulasEscolinhas reservas={aulasEscolinhas} />

        {/* Seção 3: Grupos & Mensalistas Recorrentes */}
        <SecaoGruposMensalistas reservas={reservasGrupos} />

        {/* Seção 4: Bloqueios Técnicos (se houver) */}
        {bloqueiosManutencao.length > 0 && (
          <SecaoBloqueiosManutencao reservas={bloqueiosManutencao} />
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes: Seções Verticais Especializadas ──────────────────────────

import type { Reserva } from "@/store/useReservasStore";

const STATUS_CONFIG: Record<
  string,
  { label: string; cor: string; bg: string }
> = {
  confirmada: {
    label: "Confirmada",
    cor: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  pendente: {
    label: "Pendente",
    cor: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  em_processamento: {
    label: "Processando",
    cor: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  cancelada: {
    label: "Cancelada",
    cor: "text-slate-500",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
};

/**
 * Seção de Reservas Avulsas & Balcão.
 * Exibe reservas feitas via portal ou balcão físico por clientes.
 */
function SecaoReservasAvulsas({ reservas }: { reservas: Reserva[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Reservas Avulsas & Balcão
            </h2>
            <p className="text-xs text-slate-400">
              Agendamentos individuais realizados pelo portal ou balcão para hoje
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          {reservas.length} {reservas.length === 1 ? "reserva ativa" : "reservas ativas"}
        </span>
      </div>

      {reservas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 text-center">
          <CalendarCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 font-medium text-sm">Nenhuma reserva avulsa para hoje</p>
          <p className="text-slate-600 text-xs mt-0.5">
            As reservas feitas pelo portal ou registradas no balcão aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Cliente</span>
            <span className="text-center">Quadra</span>
            <span className="text-center">Horário</span>
            <span className="text-right">Status</span>
          </div>

          <div className="divide-y divide-slate-700/30">
            {reservas.map((r) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pendente;
              const nomeQuadra = descreverQuadra(r.quadraId);
              const telDigits = r.whatsappCliente ? r.whatsappCliente.replace(/\D/g, "") : "";
              const isMembro = Boolean(
                r.userId || (telDigits && getTelefonesCadastradosLocal().has(telDigits))
              );
              const isBalcao = r.metodoPagamento === "balcao" || r.tipoReserva === "admin_manual";

              return (
                <a
                  key={r.id}
                  href={`/admin/reserva/${r.id}`}
                  className="w-full text-left px-5 py-3.5 flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 sm:items-center hover:bg-slate-800/60 active:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white text-sm group-hover:text-emerald-300 transition-colors">
                        {r.nomeCliente || "—"}
                      </p>
                      {isBalcao ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          🛡️ Balcão Admin
                        </span>
                      ) : isMembro ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ⭐ Cadastrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Avulsa
                        </span>
                      )}
                      {r.reservaGratuitaFidelidade ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          🎁 100% Fidelidade
                        </span>
                      ) : r.descontoFidelidade && r.descontoFidelidade > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          🎁 -{formatarMoeda(r.descontoFidelidade)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {r.esporte ?? "Sem esporte"} ·{" "}
                      {r.reservaGratuitaFidelidade
                        ? "🎁 Grátis por Fidelidade"
                        : r.valorPendente === 0
                        ? `${formatarMoeda(r.valorSinal)} integral`
                        : `${formatarMoeda(r.valorSinal)} sinal`}
                    </p>
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
                      {nomeQuadra}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-mono text-slate-300">
                      {r.horaInicio} – {r.horaFim}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                        r.reservaGratuitaFidelidade
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                          : `${cfg.bg} ${cfg.cor}`
                      }`}
                    >
                      {r.reservaGratuitaFidelidade ? "🎁 Voucher" : cfg.label}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seção de Aulas de Escolinhas & Turmas.
 * Exibe horários de formação de escolinhas fixas para hoje.
 */
function SecaoAulasEscolinhas({ reservas }: { reservas: Reserva[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Aulas de Escolinhas & Turmas
            </h2>
            <p className="text-xs text-slate-400">
              Turmas fixas de treinamento e formação esportiva com reserva garantida
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
          {reservas.length} {reservas.length === 1 ? "turma ativa" : "turmas ativas"}
        </span>
      </div>

      {reservas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 text-center">
          <GraduationCap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 font-medium text-sm">Nenhuma aula de escolinha hoje</p>
          <p className="text-slate-600 text-xs mt-0.5">
            Turmas de escolinhas programadas para este dia aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Turma / Escolinha</span>
            <span className="text-center">Quadra</span>
            <span className="text-center">Horário</span>
            <span className="text-right">Modalidade</span>
          </div>

          <div className="divide-y divide-slate-700/30">
            {reservas.map((r) => {
              const nomeQuadra = descreverQuadra(r.quadraId);

              return (
                <a
                  key={r.id}
                  href={`/admin/reserva/${r.id}`}
                  className="w-full text-left px-5 py-3.5 flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 sm:items-center hover:bg-slate-800/60 active:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">
                        {r.nomeCliente || "Escolinha"}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        🎓 Escolinha
                      </span>
                    </div>
                    <p className="text-indigo-300/70 text-xs mt-0.5">
                      {r.esporte ?? "Esporte"} · Treinamento esportivo e aula regular
                    </p>
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
                      {nomeQuadra}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-mono text-slate-300">
                      {r.horaInicio} – {r.horaFim}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                      🎓 Aula Ativa
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seção de Grupos & Mensalistas Recorrentes.
 * Exibe peladas fixas e reservas recorrentes contratadas mensalmente.
 */
function SecaoGruposMensalistas({ reservas }: { reservas: Reserva[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Grupos & Mensalistas Recorrentes
            </h2>
            <p className="text-xs text-slate-400">
              Peladas fixas e reservas recorrentes contratadas mensalmente
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
          {reservas.length} {reservas.length === 1 ? "grupo hoje" : "grupos hoje"}
        </span>
      </div>

      {reservas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 text-center">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 font-medium text-sm">Nenhum grupo mensalista hoje</p>
          <p className="text-slate-600 text-xs mt-0.5">
            Grupos e horários fixos de mensalistas para este dia aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
            <span>Grupo / Mensalista</span>
            <span className="text-center">Quadra</span>
            <span className="text-center">Horário</span>
            <span className="text-right">Contrato</span>
          </div>

          <div className="divide-y divide-slate-700/30">
            {reservas.map((r) => {
              const nomeQuadra = descreverQuadra(r.quadraId);

              return (
                <a
                  key={r.id}
                  href={`/admin/reserva/${r.id}`}
                  className="w-full text-left px-5 py-3.5 flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 sm:items-center hover:bg-slate-800/60 active:bg-slate-800 transition-colors duration-150 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white text-sm group-hover:text-amber-300 transition-colors">
                        {r.nomeCliente || "Grupo Mensalista"}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        🔁 Mensalista
                      </span>
                      {r.avisoCancelamentoEm && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          ⚠️ Cancelamento em {r.avisoCancelamentoEm}
                        </span>
                      )}
                    </div>
                    <p className="text-amber-300/70 text-xs mt-0.5">
                      {r.esporte ?? "Esporte Geral"} · Horário fixo recorrente semanal
                    </p>
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
                      {nomeQuadra}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-xs font-mono text-slate-300">
                      {r.horaInicio} – {r.horaFim}
                    </span>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">
                      🔁 Horário Fixo
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seção de Bloqueios Técnicos & Manutenções.
 * Exibe interdições temporárias de quadras registradas pelo admin.
 */
function SecaoBloqueiosManutencao({ reservas }: { reservas: Reserva[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Bloqueios Técnicos & Manutenções
            </h2>
            <p className="text-xs text-slate-400">
              Horários interditados na agenda para manutenção ou reparos
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
          {reservas.length} {reservas.length === 1 ? "bloqueio ativo" : "bloqueios ativos"}
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Motivo / Bloqueio</span>
          <span className="text-center">Quadra</span>
          <span className="text-center">Horário</span>
          <span className="text-right">Status</span>
        </div>

        <div className="divide-y divide-slate-700/30">
          {reservas.map((r) => {
            const nomeQuadra = descreverQuadra(r.quadraId);

            return (
              <div
                key={r.id}
                className="w-full text-left px-5 py-3.5 flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 sm:items-center bg-slate-900/60"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-300 text-sm">
                      {r.observacoes || "Bloqueio Técnico da Quadra"}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      ⚠️ Manutenção
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Horário reservado pela administração para intervenções estruturais
                  </p>
                </div>

                <div className="text-center">
                  <span className="text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg">
                    {nomeQuadra}
                  </span>
                </div>

                <div className="text-center">
                  <span className="text-xs font-mono text-slate-300">
                    {r.horaInicio} – {r.horaFim}
                  </span>
                </div>

                <div className="sm:text-right">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/30">
                    Interditado
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
