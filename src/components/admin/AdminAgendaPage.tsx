/**
 * AdminAgendaPage — Agenda Completa do Administrador.
 *
 * Oferece três modos de visualização integrados:
 *  1. Calendário Mensal: Visão macro do mês com navegação temporal (histórico até 6 meses no futuro) e lazy loading.
 *  2. Grade do Dia: Visão micro facilitada por quadra (semelhante ao portal do cliente) com ações de reserva manual e bloqueio.
 *  3. Timeline Operacional (Gantt): Visão contínua com cronômetros regressivos e alertas de montagem esportiva.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Calendar as CalendarIcon,
  LayoutGrid,
  Clock,
  Wifi,
  Timer,
  Wrench,
  PlusCircle,
  Lock,
} from "lucide-react";
import { useReservasService } from "@/hooks/useReservasService";
import { PREPARACAO_POR_ESPORTE } from "@/lib/quadras";
import { useQuadrasCatalogo, useHorariosCatalogo } from "@/store/useCatalogoArenaStore";
import { gerarDiasDisponiveis, formatarDataExibicao } from "@/lib/constants";
import type { Reserva } from "@/store/useReservasStore";
import { getTelefonesCadastradosLocal } from "@/lib/supabase/authService";
import {
  calcularProgressoAtivo,
  formatarTempoRestante,
  horarioParaMinutos,
  obterDataHojeLocal as hojeLocal,
} from "@/lib/adminAgenda/adminAgendaService";

import { CalendarioMensal } from "./agenda/CalendarioMensal";
import { VisaoDiaGrade } from "./agenda/VisaoDiaGrade";
import { BarraNavegacaoDia } from "./agenda/BarraNavegacaoDia";
import { ModalReservaManual } from "./agenda/ModalReservaManual";
import { ModalBloqueioHorario } from "./agenda/ModalBloqueioHorario";
import { ModalDetalhesReserva } from "./ModalDetalhesReserva";

// ─── Helpers de tempo ─────────────────────────────────────────────────────────

function minutosAgora(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ─── Constantes de layout da Timeline ─────────────────────────────────────────

const COL_LABEL_W = 80;
const SLOT_W = 72;
const ROW_H = 88;

const STATUS_STYLE: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  confirmada: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/50",
    text: "text-emerald-300",
    badge: "bg-emerald-500/30 text-emerald-300",
  },
  pendente: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-300",
    badge: "bg-amber-500/30 text-amber-300",
  },
  em_processamento: {
    bg: "bg-sky-500/15",
    border: "border-sky-500/40",
    text: "text-sky-300",
    badge: "bg-sky-500/30 text-sky-300",
  },
  cancelada: {
    bg: "bg-slate-700/40",
    border: "border-slate-600/40",
    text: "text-slate-500",
    badge: "bg-slate-600/30 text-slate-500",
  },
};

// ─── Componente: Bloco de Reserva na Timeline ─────────────────────────────────

interface BlocoProps {
  reserva: Reserva;
  colInicio: number;
  duracao: number;
  dataExibida: string;
  agora: number;
  onClick: (reserva: Reserva) => void;
}

function BlocoReserva({
  reserva,
  colInicio,
  duracao,
  dataExibida,
  agora,
  onClick,
}: BlocoProps) {
  const progresso = calcularProgressoAtivo(reserva, dataExibida, agora);
  const eAtivo = progresso !== null;

  const fimMin = horarioParaMinutos(reserva.horaFim);
  const minutosRestantes = eAtivo ? fimMin - agora : 0;

  const ehBloqueio = reserva.tipoReserva === "manutencao_bloqueio";
  const ehManual = reserva.tipoReserva === "admin_manual";

  const style = ehBloqueio
    ? {
        bg: "bg-amber-500/20",
        border: "border-amber-500/50",
        text: "text-amber-300",
        badge: "bg-amber-500/30 text-amber-300",
      }
    : ehManual
    ? {
        bg: "bg-sky-500/20",
        border: "border-sky-500/50",
        text: "text-sky-300",
        badge: "bg-sky-500/30 text-sky-300",
      }
    : STATUS_STYLE[reserva.status] ?? STATUS_STYLE.pendente;

  const left = COL_LABEL_W + colInicio * SLOT_W + 4;
  const width = duracao * SLOT_W - 8;

  return (
    <div
      onClick={() => onClick(reserva)}
      title={`${reserva.nomeCliente} · ${reserva.horaInicio}–${reserva.horaFim}`}
      className={`absolute top-2 rounded-xl border cursor-pointer select-none
        transition-all duration-150 overflow-hidden group
        hover:scale-[1.02] hover:z-20 hover:shadow-lg
        ${style.bg} ${style.border}`}
      style={{
        left,
        width,
        bottom: 8,
      }}
    >
      {eAtivo && (
        <div
          className="absolute inset-0 bg-white/5 origin-left transition-none"
          style={{ transform: `scaleX(${progresso})` }}
        />
      )}

      {eAtivo && (
        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
      )}

      <div className="relative px-2 pt-1.5 pb-1 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between gap-1">
          <p
            className={`text-[10px] font-semibold leading-tight truncate flex-1 ${style.text}`}
          >
            {(() => {
              const telDigits = reserva.whatsappCliente
                ? reserva.whatsappCliente.replace(/\D/g, "")
                : "";
              const isMembro = Boolean(
                reserva.userId ||
                  (telDigits && getTelefonesCadastradosLocal().has(telDigits))
              );
              return isMembro ? "⭐ " : "";
            })()}
            {reserva.tipoReserva === "escolinha"
              ? "🎓 "
              : reserva.tipoReserva === "grupo"
              ? "🔁 "
              : reserva.tipoReserva === "admin_manual"
              ? "🛡️ "
              : ehBloqueio
              ? "⚠️ "
              : reserva.reservaGratuitaFidelidade || (reserva.descontoFidelidade && reserva.descontoFidelidade > 0)
              ? "🎁 "
              : ""}
            {reserva.nomeCliente || "—"}
          </p>
          {eAtivo && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-emerald-400 flex-shrink-0">
              <Timer className="w-2.5 h-2.5" />
              {formatarTempoRestante(minutosRestantes)}
            </span>
          )}
        </div>

        {width > 64 && (
          <div className="flex items-center justify-between gap-1 mt-auto">
            {ehBloqueio ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full leading-none bg-amber-500/30 text-amber-300">
                Bloqueio
              </span>
            ) : reserva.reservaGratuitaFidelidade ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full leading-none bg-purple-500/30 text-purple-300 font-bold">
                100% Fidelidade
              </span>
            ) : reserva.descontoFidelidade && reserva.descontoFidelidade > 0 ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full leading-none bg-purple-500/30 text-purple-300 font-bold">
                Voucher
              </span>
            ) : reserva.esporte ? (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full leading-none ${style.badge}`}
              >
                {reserva.esporte}
              </span>
            ) : null}
            <span
              className={`text-[9px] font-mono ${style.text} opacity-70 ml-auto`}
            >
              {reserva.horaInicio}–{reserva.horaFim}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente: Indicador de Montagem na Timeline ───────────────────────────

interface MontagemProps {
  colIndex: number;
  esporteAnterior: string;
  esportePosterior: string;
  preparacao: string;
}

function IndicadorMontagem({
  colIndex,
  esporteAnterior,
  esportePosterior,
  preparacao,
}: MontagemProps) {
  const [hover, setHover] = useState(false);
  const left = COL_LABEL_W + colIndex * SLOT_W - 10;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 z-30"
      style={{ left }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="w-5 h-5 rounded-full bg-orange-500 border-2 border-slate-900 flex items-center justify-center shadow-lg cursor-help">
        <Wrench className="w-2.5 h-2.5 text-white" />
      </div>

      {hover && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-52 bg-slate-800 border border-orange-500/40 rounded-xl p-3 shadow-2xl pointer-events-none">
          <p className="text-orange-400 text-xs font-bold mb-1 flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            Montagem Necessária
          </p>
          <p className="text-slate-300 text-[10px] leading-relaxed">
            <span className="text-slate-400">Troca:</span>{" "}
            <strong>{esporteAnterior}</strong> →{" "}
            <strong>{esportePosterior}</strong>
          </p>
          <p className="text-slate-500 text-[10px] mt-1">{preparacao}</p>
        </div>
      )}
    </div>
  );
}

// ─── Componente: Linha de Hora Atual na Timeline ─────────────────────────────

function LinhaHoraAtual({
  dataExibida,
  agora,
}: {
  dataExibida: string;
  agora: number;
}) {
  const horariosCatalogo = useHorariosCatalogo();
  if (dataExibida !== hojeLocal()) return null;

  const primeiroSlotMin = horarioParaMinutos(horariosCatalogo[0]);
  const ultimoSlotMin =
    horarioParaMinutos(horariosCatalogo[horariosCatalogo.length - 1]) +
    60;

  if (agora < primeiroSlotMin || agora > ultimoSlotMin) return null;

  const proporcao =
    (agora - primeiroSlotMin) / (ultimoSlotMin - primeiroSlotMin);
  const totalW = horariosCatalogo.length * SLOT_W;
  const left = COL_LABEL_W + proporcao * totalW;

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-25 pointer-events-none"
      style={{ left }}
    >
      <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
    </div>
  );
}

// ─── Componente Principal da Página de Agenda ─────────────────────────────────

type ModoVisualizacao = "calendario" | "grade_dia" | "timeline";

export function AdminAgendaPage() {
  const horariosCatalogo = useHorariosCatalogo();
  const quadrasCatalogo = useQuadrasCatalogo();
  const { reservas, carregarReservasDoMes } = useReservasService();

  const hoje = useMemo(() => new Date(), []);
  const [modo, setModo] = useState<ModoVisualizacao>("calendario");

  // Estado do Calendário Mensal
  const [anoCalendario, setAnoCalendario] = useState(hoje.getFullYear());
  const [mesCalendario, setMesCalendario] = useState(hoje.getMonth() + 1);

  // Estado do Dia Selecionado
  const [dataSelecionada, setDataSelecionada] = useState(hojeLocal());

  // Estado do Cronômetro da Timeline
  const [agora, setAgora] = useState(minutosAgora());

  // Estados de Modais
  const [modalReservaAberto, setModalReservaAberto] = useState(false);
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [quadraModal, setQuadraModal] = useState<string | undefined>(undefined);
  const [horariosModal, setHorariosModal] = useState<string[] | undefined>(undefined);
  const [reservaDetalhes, setReservaDetalhes] = useState<Reserva | null>(null);

  // Lazy Loading: Busca dados do mês selecionado sob demanda
  useEffect(() => {
    void carregarReservasDoMes(anoCalendario, mesCalendario);
  }, [anoCalendario, mesCalendario, carregarReservasDoMes]);

  // Tick a cada 10s para atualizar cronômetros da timeline
  useEffect(() => {
    const interval = setInterval(() => setAgora(minutosAgora()), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Quando clica num dia no calendário mensal, navega para a grade simplificada daquele dia
  function handleSelecionarDiaNoCalendario(dia: string) {
    setDataSelecionada(dia);
    setModo("grade_dia");
  }

  function handleIrParaHoje() {
    const agora = new Date();
    setAnoCalendario(agora.getFullYear());
    setMesCalendario(agora.getMonth() + 1);
    setDataSelecionada(hojeLocal());
  }

  function abrirReservaManual(quadraId?: string, horario?: string) {
    setQuadraModal(quadraId);
    setHorariosModal(horario ? [horario] : undefined);
    setModalReservaAberto(true);
  }

  function abrirBloqueio(quadraId?: string, horario?: string) {
    setQuadraModal(quadraId);
    setHorariosModal(horario ? [horario] : undefined);
    setModalBloqueioAberto(true);
  }

  // Reservas do dia exibido na timeline
  const reservasDoDia = reservas.filter(
    (r) => r.data === dataSelecionada && r.status !== "cancelada"
  );

  function dadosPorQuadraTimeline(quadraId: string) {
    const reservasQuadra = reservasDoDia
      .filter((r) => r.quadraId === quadraId)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

    const blocos = reservasQuadra.map((r) => {
      const colInicio = horariosCatalogo.indexOf(r.horaInicio);
      const colFim = horariosCatalogo.indexOf(r.horaFim);
      const duracao =
        colFim >= 0
          ? colFim - colInicio
          : horariosCatalogo.length - colInicio;
      return { reserva: r, colInicio, duracao };
    });

    const alertas: Array<{
      colIndex: number;
      esporteAnterior: string;
      esportePosterior: string;
      preparacao: string;
    }> = [];

    for (let i = 0; i < reservasQuadra.length - 1; i++) {
      const atual = reservasQuadra[i];
      const prox = reservasQuadra[i + 1];
      const esporteAtual = atual.esporte;
      const esporteProx = prox.esporte;

      if (
        atual.horaFim === prox.horaInicio &&
        esporteAtual &&
        esporteProx &&
        esporteAtual !== esporteProx
      ) {
        const colTransicao = horariosCatalogo.indexOf(prox.horaInicio);
        if (colTransicao >= 0) {
          alertas.push({
            colIndex: colTransicao,
            esporteAnterior: esporteAtual,
            esportePosterior: esporteProx,
            preparacao:
              PREPARACAO_POR_ESPORTE[esporteProx] ?? "Preparação necessária",
          });
        }
      }
    }

    return { blocos, alertas };
  }

  const isHoje = dataSelecionada === hojeLocal();
  const totalW = COL_LABEL_W + horariosCatalogo.length * SLOT_W;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Topbar Principal da Agenda ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <span>Agenda Completa do Admin</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Controle de reservas online, agendamento manual no balcão e bloqueios de manutenção
          </p>
        </div>

        {/* Botões de Ação Global */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="admin-agenda-btn-bloquear"
            onClick={() => abrirBloqueio()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Bloquear Horário
          </button>

          <button
            type="button"
            id="admin-agenda-btn-reserva-manual"
            onClick={() => abrirReservaManual()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Nova Reserva Manual
          </button>
        </div>
      </div>

      {/* ── Seletor de Modo de Visualização (Abas) ─────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            id="tab-agenda-calendario"
            onClick={() => setModo("calendario")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              modo === "calendario"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Calendário Mensal
          </button>

          <button
            type="button"
            id="tab-agenda-grade-dia"
            onClick={() => setModo("grade_dia")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              modo === "grade_dia"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grade do Dia (Simplificada)
          </button>

          <button
            type="button"
            id="tab-agenda-timeline"
            onClick={() => setModo("timeline")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              modo === "timeline"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Timeline Operacional (Gantt)
          </button>
        </div>

        {/* Indicador de Status Realtime */}
        <div className="flex items-center gap-2 text-xs text-emerald-400/90 font-medium">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sincronização Ativa</span>
        </div>
      </div>

      {/* ── 1. Modo: Calendário Mensal ────────────────────────────────────────── */}
      {modo === "calendario" && (
        <CalendarioMensal
          ano={anoCalendario}
          mes={mesCalendario}
          dataSelecionada={dataSelecionada}
          reservas={reservas}
          onMudarMes={(novoAno, novoMes) => {
            setAnoCalendario(novoAno);
            setMesCalendario(novoMes);
          }}
          onSelecionarDia={handleSelecionarDiaNoCalendario}
          onIrParaHoje={handleIrParaHoje}
        />
      )}

      {/* ── 2. Modo: Grade do Dia (Simplificada estilo usuário) ───────────────── */}
      {modo === "grade_dia" && (
        <VisaoDiaGrade
          data={dataSelecionada}
          onMudarData={setDataSelecionada}
          onAbrirReservaManual={abrirReservaManual}
          onAbrirBloqueio={abrirBloqueio}
          onVerDetalhesReserva={setReservaDetalhes}
        />
      )}

      {/* ── 3. Modo: Timeline Operacional (Gantt) ─────────────────────────────── */}
      {modo === "timeline" && (
        <div className="space-y-4">
          {/* Seletor unificado de dia para a Timeline com setas + calendário */}
          <BarraNavegacaoDia
            data={dataSelecionada}
            onMudarData={setDataSelecionada}
            subtitulo="Timeline operacional contínua com monitoramento em tempo real"
          >
            <button
              type="button"
              onClick={() => abrirBloqueio()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Bloquear Horário
            </button>

            <button
              type="button"
              onClick={() => abrirReservaManual()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Nova Reserva Manual
            </button>
          </BarraNavegacaoDia>

          {/* Barra de Legenda de Status (Fora do card de data e ações) */}
          <div className="flex items-center gap-2 flex-wrap px-2 py-1">
            <span className="text-xs font-semibold text-slate-400 mr-1">
              Legenda:
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmada
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Pendente
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Reserva Admin
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
              <Wrench className="w-3 h-3 text-amber-400" /> Bloqueio
            </span>
          </div>

          {/* Grade da Timeline */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <div style={{ minWidth: totalW }}>
                {/* Header: horários */}
                <div
                  className="flex border-b border-slate-700/50 bg-slate-800/50"
                  style={{ height: 40 }}
                >
                  <div
                    className="flex-shrink-0 flex items-center px-4 border-r border-slate-700/50"
                    style={{ width: COL_LABEL_W }}
                  >
                    <CalendarDays className="w-4 h-4 text-slate-500" />
                  </div>

                  {horariosCatalogo.map((h) => {
                    const minH = horarioParaMinutos(h);
                    const eAgora = isHoje && agora >= minH && agora < minH + 60;
                    return (
                      <div
                        key={h}
                        className={`flex-shrink-0 flex items-center justify-center border-r border-slate-700/30 text-xs font-mono transition-colors
                          ${
                            eAgora
                              ? "text-red-400 font-bold bg-red-500/5"
                              : "text-slate-500"
                          }`}
                        style={{ width: SLOT_W }}
                      >
                        {h}
                      </div>
                    );
                  })}
                </div>

                {/* Linhas das quadras */}
                {quadrasCatalogo.map((quadra, qi) => {
                  const { blocos, alertas } = dadosPorQuadraTimeline(quadra.id);
                  return (
                    <div
                      key={quadra.id}
                      className={`relative flex border-b last:border-b-0 border-slate-700/30 ${
                        qi % 2 === 1 ? "bg-slate-800/20" : ""
                      }`}
                      style={{ height: ROW_H }}
                    >
                      <div
                        className="flex-shrink-0 flex flex-col items-start justify-center px-4 border-r border-slate-700/50"
                        style={{ width: COL_LABEL_W }}
                      >
                        <p className="text-xs font-bold text-white leading-tight">
                          Q{quadra.numero}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Quadra {quadra.numero}
                        </p>
                      </div>

                      {horariosCatalogo.map((h) => {
                        const minH = horarioParaMinutos(h);
                        const eAgora =
                          isHoje && agora >= minH && agora < minH + 60;
                        return (
                          <div
                            key={h}
                            className={`flex-shrink-0 border-r border-slate-700/20 ${
                              eAgora ? "bg-red-500/5" : ""
                            }`}
                            style={{ width: SLOT_W }}
                          />
                        );
                      })}

                      <LinhaHoraAtual dataExibida={dataSelecionada} agora={agora} />

                      {blocos.map(({ reserva, colInicio, duracao }) =>
                        colInicio >= 0 && duracao > 0 ? (
                          <BlocoReserva
                            key={reserva.id}
                            reserva={reserva}
                            colInicio={colInicio}
                            duracao={duracao}
                            dataExibida={dataSelecionada}
                            agora={agora}
                            onClick={setReservaDetalhes}
                          />
                        ) : null
                      )}

                      {alertas.map((alerta) => (
                        <IndicadorMontagem
                          key={`${quadra.id}-${alerta.colIndex}`}
                          {...alerta}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modais ───────────────────────────────────────────────────────────── */}
      <ModalReservaManual
        aberto={modalReservaAberto}
        quadraIdPadrao={quadraModal}
        dataPadrao={dataSelecionada}
        horariosPadrao={horariosModal}
        onFechar={() => setModalReservaAberto(false)}
      />

      <ModalBloqueioHorario
        aberto={modalBloqueioAberto}
        quadraIdPadrao={quadraModal}
        dataPadrao={dataSelecionada}
        horariosPadrao={horariosModal}
        onFechar={() => setModalBloqueioAberto(false)}
      />

      <ModalDetalhesReserva
        reserva={reservaDetalhes}
        onFechar={() => setReservaDetalhes(null)}
      />
    </div>
  );
}
