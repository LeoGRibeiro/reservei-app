/**
 * CalendarioMensal — Visualização panorâmica da agenda do complexo em formato de calendário mensal.
 * Permite navegação temporal (histórico passado ilimitado e até 6 meses no futuro) com lazy loading,
 * exibindo indicadores de ocupação, reservas manuais e bloqueios em cada dia.
 */

"use client";

import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ShieldCheck,
  Wrench,
  Clock,
  Sparkles,
} from "lucide-react";
import type { Reserva } from "@/store/useReservasStore";
import {
  gerarDiasCalendarioMensal,
  calcularResumoMes,
  isNavegacaoMesPermitida,
  getNomeMesExtenso,
} from "@/lib/adminAgenda/adminAgendaService";
import type { DiaCalendarioMensal } from "@/lib/adminAgenda/types";

interface Props {
  ano: number;
  mes: number;
  dataSelecionada: string;
  reservas: Reserva[];
  onMudarMes: (novoAno: number, novoMes: number) => void;
  onSelecionarDia: (data: string) => void;
  onIrParaHoje: () => void;
}

const DIAS_SEMANA_CABECALHO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarioMensal({
  ano,
  mes,
  dataSelecionada,
  reservas,
  onMudarMes,
  onSelecionarDia,
  onIrParaHoje,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const hoje = useMemo(() => new Date(), []);
  const hojeIso = useMemo(() => {
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, "0");
    const d = String(hoje.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [hoje]);

  const dias = useMemo(() => {
    return gerarDiasCalendarioMensal(ano, mes, reservas, hojeIso);
  }, [ano, mes, reservas, hojeIso]);

  const resumo = useMemo(() => {
    return calcularResumoMes(ano, mes, dias);
  }, [ano, mes, dias]);

  const { podeVoltar, podeAvancar } = useMemo(() => {
    return isNavegacaoMesPermitida(ano, mes, hoje);
  }, [ano, mes, hoje]);

  function voltarMes() {
    if (!podeVoltar) return;
    if (mes === 1) {
      onMudarMes(ano - 1, 12);
    } else {
      onMudarMes(ano, mes - 1);
    }
  }

  function avancarMes() {
    if (!podeAvancar) return;
    if (mes === 12) {
      onMudarMes(ano + 1, 1);
    } else {
      onMudarMes(ano, mes + 1);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Barra Superior de Navegação do Calendário ── */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <CalendarIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">
              {getNomeMesExtenso(mes)} <span className="text-slate-400 font-mono">{ano}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Navegação de histórico e projeções da agenda completa
            </p>
          </div>
        </div>

        {/* Controles de Mês */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onIrParaHoje}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Mês Atual
          </button>

          <div className="flex items-center rounded-xl bg-slate-800/80 border border-slate-700/80 p-0.5">
            <button
              type="button"
              id="btn-calendario-mes-anterior"
              onClick={voltarMes}
              disabled={!podeVoltar}
              title="Mês anterior (histórico)"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-slate-700 mx-0.5" />
            <button
              type="button"
              id="btn-calendario-proximo-mes"
              onClick={avancarMes}
              disabled={!podeAvancar}
              title={
                podeAvancar
                  ? "Próximo mês"
                  : "Limite de 6 meses no futuro atingido"
              }
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Cards de Métricas do Mês ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Reservas do Mês
          </p>
          <p className="text-xl font-bold text-white mt-1">
            {resumo.totalReservas}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            em {resumo.diasComReservas} dias com jogos
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider flex items-center gap-1">
            <Wrench className="w-3 h-3 text-amber-400" />
            Bloqueios
          </p>
          <p className="text-xl font-bold text-amber-300 mt-1">
            {resumo.totalBloqueios}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            manutenções e eventos
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            Horas Ocupadas
          </p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {resumo.totalHorariosOcupados}h
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            total {quadrasCatalogo.length === 1 ? "na quadra" : `nas ${quadrasCatalogo.length} quadras`}
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-sky-400/90 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sky-400" />
            Dia Selecionado
          </p>
          <p className="text-sm font-bold text-sky-300 mt-1.5 font-mono truncate">
            {dataSelecionada}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            clique em um dia abaixo
          </p>
        </div>
      </div>

      {/* ── Grid Principal do Calendário Mensal ── */}
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-slate-700/50 bg-slate-800/60 text-center py-2.5">
          {DIAS_SEMANA_CABECALHO.map((diaSemana, idx) => (
            <span
              key={diaSemana}
              className={`text-xs font-bold uppercase tracking-wider ${
                idx === 0 || idx === 6 ? "text-emerald-400/80" : "text-slate-400"
              }`}
            >
              {diaSemana}
            </span>
          ))}
        </div>

        {/* Grade de Células de Dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/70 border-b border-slate-800">
          {dias.map((d: DiaCalendarioMensal) => {
            const isSelecionado = d.data === dataSelecionada;
            const temAtividade = d.totalReservas > 0 || d.totalBloqueios > 0;

            return (
              <button
                key={d.data}
                type="button"
                onClick={() => onSelecionarDia(d.data)}
                className={`min-h-[88px] sm:min-h-[104px] p-2 flex flex-col justify-between text-left transition-all relative group cursor-pointer ${
                  !d.mesAtual
                    ? "bg-slate-950/40 text-slate-600 hover:bg-slate-900/50"
                    : isSelecionado
                    ? "bg-emerald-500/10 ring-2 ring-emerald-500 ring-inset z-10"
                    : d.isHoje
                    ? "bg-slate-800/40 hover:bg-slate-800/80"
                    : "bg-slate-900/90 hover:bg-slate-800/50 text-slate-300"
                }`}
              >
                {/* Linha superior: Número do dia + badges */}
                <div className="flex items-start justify-between w-full">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                      d.isHoje
                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                        : isSelecionado
                        ? "bg-emerald-500/20 text-emerald-400 font-black"
                        : d.mesAtual
                        ? "text-slate-200 group-hover:text-white"
                        : "text-slate-600"
                    }`}
                  >
                    {d.diaNumero}
                  </span>

                  {d.isHoje && (
                    <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline-block">
                      Hoje
                    </span>
                  )}
                </div>

                {/* Linha intermediária / inferior: Indicadores de Ocupação */}
                <div className="mt-1 space-y-1 w-full">
                  {d.totalReservas > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="truncate">
                        {d.totalReservas} {d.totalReservas === 1 ? "reserva" : "reservas"}
                      </span>
                    </div>
                  )}

                  {d.totalBloqueios > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold truncate">
                      <Wrench className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                      <span className="truncate">
                        {d.totalBloqueios} {d.totalBloqueios === 1 ? "bloqueio" : "bloqueios"}
                      </span>
                    </div>
                  )}

                  {!temAtividade && d.mesAtual && (
                    <p className="text-[10px] text-slate-600 italic px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Livre
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
