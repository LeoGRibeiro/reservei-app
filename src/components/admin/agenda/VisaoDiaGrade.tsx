/**
 * VisaoDiaGrade — Visualização simplificada da agenda diária por quadras.
 * Inspirada na experiência do usuário final para facilitar o panorama geral do dia,
 * permitindo ao administrador identificar horários livres, reservas manuais e bloqueios.
 */

"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Wrench,
  GraduationCap,
  UsersRound,
  Layers,
  Sparkles,
  Calendar,
} from "lucide-react";
import { type Quadra } from "@/lib/quadras";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { formatarDataExibicao, formatarMoeda } from "@/lib/constants";
import type { Reserva } from "@/store/useReservasStore";
import { montarSlotsQuadraDia } from "@/lib/adminAgenda/adminAgendaService";
import type { SlotAgendaAdmin } from "@/lib/adminAgenda/types";
import { useReservasService } from "@/hooks/useReservasService";
import { BarraNavegacaoDia } from "./BarraNavegacaoDia";
import { toast } from "sonner";

interface Props {
  data: string;
  onMudarData: (novaData: string) => void;
  onAbrirReservaManual: (quadraId?: string, horario?: string) => void;
  onAbrirBloqueio: (quadraId?: string, horario?: string) => void;
  onVerDetalhesReserva: (reserva: Reserva) => void;
}

export function VisaoDiaGrade({
  data,
  onMudarData,
  onAbrirReservaManual,
  onAbrirBloqueio,
  onVerDetalhesReserva,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const { reservas, removerBloqueio } = useReservasService();
  const [quadraFiltro, setQuadraFiltro] = useState<string>("todas");

  // Navegação entre dias (anterior e próximo)
  function navDia(delta: number) {
    const [y, m, d] = data.split("-").map(Number);
    const atual = new Date(y, m - 1, d);
    atual.setDate(atual.getDate() + delta);
    const novoAno = atual.getFullYear();
    const novoMes = String(atual.getMonth() + 1).padStart(2, "0");
    const novoDia = String(atual.getDate()).padStart(2, "0");
    onMudarData(`${novoAno}-${novoMes}-${novoDia}`);
  }

  const quadrasExibidas =
    quadraFiltro === "todas"
      ? quadrasCatalogo
      : quadrasCatalogo.filter((q) => q.id === quadraFiltro);

  async function handleDesbloquear(bloqueioId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const confirmou = window.confirm(
      "Deseja realmente remover este bloqueio e liberar o horário?"
    );
    if (!confirmou) return;

    const ok = await removerBloqueio(bloqueioId);
    if (ok) {
      toast.success("Horário desbloqueado com sucesso!");
    } else {
      toast.error("Não foi possível desbloquear o horário.");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Topbar de Navegação Unificada do Dia (Setas + Calendário) e Ações ── */}
      <BarraNavegacaoDia
        data={data}
        onMudarData={onMudarData}
        subtitulo="Grade diária completa · Visão detalhada por quadra"
      >
        <button
          type="button"
          id="btn-topo-bloquear-horario"
          onClick={() => onAbrirBloqueio()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          Bloquear Horário
        </button>

        <button
          type="button"
          id="btn-topo-reserva-manual"
          onClick={() => onAbrirReservaManual()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Nova Reserva Manual
        </button>
      </BarraNavegacaoDia>

      {/* ── Filtro de Quadras ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => setQuadraFiltro("todas")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            quadraFiltro === "todas"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
              : "bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
          }`}
        >
          Todas as Quadras (3)
        </button>
        {quadrasCatalogo.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setQuadraFiltro(q.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              quadraFiltro === q.id
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            Quadra {q.numero}
          </button>
        ))}
      </div>

      {/* ── Seção de Cada Quadra ── */}
      <div className="space-y-6">
        {quadrasExibidas.map((quadra: Quadra) => {
          const slots = montarSlotsQuadraDia(quadra.id, data, reservas);
          const ocupadosCount = slots.filter((s) => s.tipo !== "disponivel").length;

          return (
            <div
              key={quadra.id}
              className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl"
            >
              {/* Header da Quadra */}
              <div className="px-5 py-3.5 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                    Q{quadra.numero}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Quadra {quadra.numero}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {quadra.descricao} · {ocupadosCount} de {slots.length} horários ocupados
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAbrirBloqueio(quadra.id)}
                    className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center gap-1 font-medium px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    <span className="hidden sm:inline">Bloquear Horário</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAbrirReservaManual(quadra.id)}
                    className="text-xs text-sky-400/90 hover:text-sky-300 flex items-center gap-1 font-medium px-2 py-1 rounded-lg hover:bg-sky-500/10 transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">Agendar</span>
                  </button>
                </div>
              </div>

              {/* Grid de Horários da Quadra */}
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                  {slots.map((slot: SlotAgendaAdmin) => {
                    // 1. Slot Disponível
                    if (slot.tipo === "disponivel") {
                      return (
                        <div
                          key={slot.horario}
                          className="flex flex-col justify-between p-3 rounded-xl border border-slate-700/70 bg-slate-800/30 hover:border-emerald-500/60 hover:bg-slate-800/80 transition-all group select-none min-h-[105px] overflow-hidden"
                        >
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                              Disponível
                            </span>
                            <p className="text-sm font-bold text-white mt-1 font-mono">
                              {slot.horario} – {slot.horaFim}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/40 mt-2 w-full min-w-0">
                            <button
                              type="button"
                              onClick={() => onAbrirReservaManual(quadra.id, slot.horario)}
                              title="Criar Reserva Manual neste horário"
                              className="flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 hover:border-sky-400 text-sky-300 text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                              <PlusCircle className="w-3 h-3 text-sky-400 flex-shrink-0" />
                              <span className="truncate">Reserva</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onAbrirBloqueio(quadra.id, slot.horario)}
                              title="Bloquear este horário para manutenção"
                              className="flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/50 text-amber-300 text-[11px] font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                              <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                              <span className="truncate">Bloquear</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 2. Slot com Bloqueio de Manutenção
                    if (slot.tipo === "manutencao_bloqueio") {
                      return (
                        <div
                          key={slot.horario}
                          className="flex flex-col justify-between p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 transition-all select-none min-h-[105px] group relative overflow-hidden"
                        >
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              Bloqueio
                            </span>
                            <p className="text-sm font-bold text-amber-100 mt-1 font-mono">
                              {slot.horario} – {slot.horaFim}
                            </p>
                            <p className="text-xs text-amber-300/90 mt-1 truncate font-medium">
                              {slot.motivoBloqueio}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-amber-500/20 mt-2 flex items-center justify-between gap-1 w-full min-w-0">
                            <span className="text-xs text-amber-400/70 italic font-medium truncate">
                              Interditado
                            </span>
                            {slot.reserva && (
                              <button
                                type="button"
                                onClick={(e) => handleDesbloquear(slot.reserva!.id, e)}
                                title="Remover este bloqueio"
                                className="text-xs text-amber-200 hover:text-white font-bold flex items-center gap-1 bg-amber-500/25 border border-amber-500/40 px-2 py-0.5 rounded-lg hover:bg-amber-500/40 transition-all cursor-pointer active:scale-95 flex-shrink-0"
                              >
                                <Unlock className="w-3 h-3 flex-shrink-0" />
                                Liberar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 3. Slot com Reserva Manual do Admin (Destaque Visual Azul)
                    if (slot.tipo === "admin_manual") {
                      return (
                        <button
                          key={slot.horario}
                          type="button"
                          onClick={() => slot.reserva && onVerDetalhesReserva(slot.reserva)}
                          className="flex flex-col justify-between p-3 rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 transition-all text-left select-none min-h-[105px] group cursor-pointer ring-1 ring-sky-500/20 shadow-md shadow-sky-950/40 overflow-hidden"
                        >
                          <div className="min-w-0 w-full">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                              Reserva Admin
                            </span>
                            <p className="text-sm font-bold text-sky-100 mt-1 font-mono">
                              {slot.horario} – {slot.horaFim}
                            </p>
                            <p className="text-xs font-semibold text-white mt-1 truncate">
                              {slot.nomeExibicao}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-sky-500/20 mt-2 flex items-center justify-between w-full min-w-0">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                slot.pago
                                  ? "bg-emerald-500/30 text-emerald-300"
                                  : "bg-amber-500/30 text-amber-300"
                              }`}
                            >
                              {slot.pago ? "✓ Pago" : "Pendente"}
                            </span>
                            <span className="text-xs text-sky-400 font-medium group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                              Detalhes →
                            </span>
                          </div>
                        </button>
                      );
                    }

                    // 4. Slot com Reserva de Escolinha ou Grupo
                    if (slot.tipo === "escolinha" || slot.tipo === "grupo") {
                      const ehEscolinha = slot.tipo === "escolinha";
                      return (
                        <button
                          key={slot.horario}
                          type="button"
                          onClick={() => slot.reserva && onVerDetalhesReserva(slot.reserva)}
                          className="flex flex-col justify-between p-3 rounded-xl border border-violet-500/40 bg-violet-500/15 hover:bg-violet-500/25 transition-all text-left select-none min-h-[105px] group cursor-pointer overflow-hidden"
                        >
                          <div className="min-w-0 w-full">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1">
                              {ehEscolinha ? (
                                 <>
                                  <GraduationCap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                                  Escolinha
                                </>
                              ) : (
                                <>
                                  <UsersRound className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                                  Grupo
                                </>
                              )}
                            </span>
                            <p className="text-sm font-bold text-violet-100 mt-1 font-mono">
                              {slot.horario} – {slot.horaFim}
                            </p>
                            <p className="text-xs font-semibold text-white mt-1 truncate">
                              {slot.nomeExibicao}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-violet-500/20 mt-2 flex items-center justify-between w-full min-w-0">
                            <span className="text-[10px] text-violet-300 font-medium">
                              Recorrente
                            </span>
                            <span className="text-xs text-violet-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                              Ver →
                            </span>
                          </div>
                        </button>
                      );
                    }

                    // 5. Slot com Reserva Online de Cliente (Comum)
                    return (
                      <button
                        key={slot.horario}
                        type="button"
                        onClick={() => slot.reserva && onVerDetalhesReserva(slot.reserva)}
                        className="flex flex-col justify-between p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left select-none min-h-[105px] group cursor-pointer overflow-hidden"
                      >
                        <div className="min-w-0 w-full">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 flex-shrink-0" />
                            {slot.reserva?.reservaGratuitaFidelidade
                              ? "🎁 100% Fidelidade"
                              : slot.reserva?.descontoFidelidade && slot.reserva.descontoFidelidade > 0
                              ? "🎁 Voucher Fidelidade"
                              : "Cliente Online"}
                          </span>
                          <p className="text-sm font-bold text-emerald-100 mt-1 font-mono">
                            {slot.horario} – {slot.horaFim}
                          </p>
                          <p className="text-xs font-semibold text-white mt-1 truncate">
                            {slot.nomeExibicao}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-emerald-500/20 mt-2 flex items-center justify-between w-full min-w-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              slot.reserva?.reservaGratuitaFidelidade
                                ? "bg-purple-500/30 text-purple-300"
                                : slot.pago
                                ? "bg-emerald-500/30 text-emerald-300"
                                : "bg-amber-500/30 text-amber-300"
                            }`}
                          >
                            {slot.reserva?.reservaGratuitaFidelidade
                              ? "🎁 100% Voucher"
                              : slot.pago
                              ? "✓ Pago"
                              : "Pendente"}
                          </span>
                          <span className="text-xs text-emerald-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                            Detalhes →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
