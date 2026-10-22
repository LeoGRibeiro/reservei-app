/**
 * ModalBloqueioHorario — Permite ao administrador bloquear quadras para manutenção ou motivos internos.
 * Possui validação estrita de prevenção de conflitos, impedindo bloquear horários que já tenham reservas confirmadas.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Wrench,
  Calendar,
  Clock,
  Layers,
  AlertTriangle,
  Lock,
  MessageSquare,
} from "lucide-react";
import { useQuadrasCatalogo, useHorariosCatalogo } from "@/store/useCatalogoArenaStore";
import { MOTIVOS_BLOQUEIO_SUGERIDOS } from "@/lib/adminAgenda/types";
import { formatarDataExibicao, saoConsecutivos } from "@/lib/constants";
import { useReservasService } from "@/hooks/useReservasService";
import { toast } from "sonner";

interface Props {
  aberto: boolean;
  quadraIdPadrao?: string;
  dataPadrao?: string;
  horariosPadrao?: string[];
  onFechar: () => void;
  onSucesso?: () => void;
}

export function ModalBloqueioHorario({
  aberto,
  quadraIdPadrao,
  dataPadrao,
  horariosPadrao,
  onFechar,
  onSucesso,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const horariosCatalogo = useHorariosCatalogo();
  const { reservas, criarBloqueio } = useReservasService();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [quadraId, setQuadraId] = useState(quadraIdPadrao || quadrasCatalogo[0]?.id || "");
  const [data, setData] = useState(dataPadrao || new Date().toISOString().split("T")[0]);
  const [horarios, setHorarios] = useState<string[]>(horariosPadrao || ["08:00"]);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_BLOQUEIO_SUGERIDOS[0]);
  const [motivoCustomizado, setMotivoCustomizado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [conflitoMensagem, setConflitoMensagem] = useState<string | null>(null);

  // Sincroniza dados iniciais ao abrir o modal
  useEffect(() => {
    if (aberto) {
      if (quadraIdPadrao) setQuadraId(quadraIdPadrao);
      if (dataPadrao) setData(dataPadrao);
      if (horariosPadrao && horariosPadrao.length > 0) {
        setHorarios([...horariosPadrao].sort());
      }
      setMotivo(MOTIVOS_BLOQUEIO_SUGERIDOS[0]);
      setMotivoCustomizado("");
      setObservacoes("");
      setConflitoMensagem(null);
    }
  }, [aberto, quadraIdPadrao, dataPadrao, horariosPadrao]);

  // Fechar com Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    },
    [onFechar]
  );

  useEffect(() => {
    if (!aberto) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [aberto, handleKeyDown]);

  // Verifica se há conflito prévio toda vez que quadra, data ou horários mudam
  useEffect(() => {
    if (!aberto) return;

    const conflito = reservas.find(
      (r) =>
        r.quadraId === quadraId &&
        r.data === data &&
        r.status !== "cancelada" &&
        r.horarios.some((h) => horarios.includes(h))
    );

    if (conflito) {
      if (conflito.tipoReserva === "manutencao_bloqueio") {
        setConflitoMensagem(
          `O horário já está bloqueado (${conflito.nomeCliente}).`
        );
      } else {
        setConflitoMensagem(
          `Conflito: Já existe reserva confirmada para "${conflito.nomeCliente}" (${conflito.horaInicio}–${conflito.horaFim}). Cancele ou remaneje a reserva antes de bloquear.`
        );
      }
    } else {
      setConflitoMensagem(null);
    }
  }, [aberto, quadraId, data, horarios, reservas]);

  if (!aberto) return null;

  function toggleHorario(h: string) {
    let proximo: string[];
    if (horarios.includes(h)) {
      proximo = horarios.filter((item) => item !== h);
    } else {
      proximo = [...horarios, h].sort();
    }

    if (proximo.length > 1 && !saoConsecutivos(proximo)) {
      toast.warning("Selecione horários consecutivos", {
        description: "Os horários de um mesmo bloqueio devem ser contínuos.",
      });
      return;
    }

    setHorarios(proximo);
  }

  const motivoFinal =
    motivo === "Outro motivo administrativo" && motivoCustomizado.trim()
      ? motivoCustomizado.trim()
      : motivo;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (horarios.length === 0) {
      toast.error("Selecione ao menos um horário para aplicar o bloqueio.");
      return;
    }

    if (!motivoFinal.trim()) {
      toast.error("Informe o motivo do bloqueio.");
      return;
    }

    setSalvando(true);

    try {
      const res = await criarBloqueio({
        quadraId,
        data,
        horarios,
        motivo: motivoFinal,
        observacoes: observacoes.trim(),
      });

      if (!res.ok) {
        toast.error("Não foi possível realizar o bloqueio", {
          description: res.motivo,
        });
        return;
      }

      toast.success("Horário bloqueado com sucesso!", {
        description: `Bloqueio aplicado para ${formatarDataExibicao(data)} (${horarios.join(", ")}).`,
      });

      onSucesso?.();
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onFechar}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900 sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  Bloquear Horário na Quadra
                </h2>
                <p className="text-xs text-slate-400">
                  Interditar horários para manutenção, limpeza ou motivos internos
                </p>
              </div>
            </div>
            <button
              onClick={onFechar}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Alerta de Conflito Ativo */}
            {conflitoMensagem && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 animate-shake">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-200">Ação Bloqueada por Conflito</p>
                  <p className="mt-0.5 leading-relaxed text-red-300/90">{conflitoMensagem}</p>
                </div>
              </div>
            )}

            {/* Linha 1: Quadra e Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Quadra
                </label>
                <select
                  value={quadraId}
                  onChange={(e) => setQuadraId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {quadrasCatalogo.map((q) => (
                    <option key={q.id} value={q.id}>
                      Quadra {q.numero} (Poliesportiva)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Data do Bloqueio
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Linha 2: Horários */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Horários a Interditar ({horarios.length}h selecionadas)
                </span>
                <span className="text-[11px] text-slate-500 lowercase">
                  clique para alternar
                </span>
              </label>

              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl max-h-36 overflow-y-auto">
                {horariosCatalogo.map((h) => {
                  const selecionado = horarios.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleHorario(h)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                        selecionado
                          ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                          : "bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha 3: Motivo */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Motivo do Bloqueio
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              >
                {MOTIVOS_BLOQUEIO_SUGERIDOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {motivo === "Outro motivo administrativo" && (
                <input
                  type="text"
                  placeholder="Especifique o motivo do bloqueio..."
                  value={motivoCustomizado}
                  onChange={(e) => setMotivoCustomizado(e.target.value)}
                  className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              )}
            </div>

            {/* Linha 4: Observações adicionais */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                Detalhes ou Instruções da Equipe (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Empresa terceirizada de manutenção chegará às 09h; chaves com o porteiro."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>

            {/* Informação sobre faturamento */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-2.5 text-xs text-slate-400">
              <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span>
                Horários bloqueados aparecerão como <strong>indisponíveis</strong> para os clientes no portal e <strong>não afetam os relatórios de faturamento</strong>.
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/50">
              <button
                type="button"
                onClick={onFechar}
                disabled={salvando}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-confirmar-bloqueio"
                disabled={salvando || Boolean(conflitoMensagem)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                {salvando ? "Bloqueando..." : "Confirmar Bloqueio"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
