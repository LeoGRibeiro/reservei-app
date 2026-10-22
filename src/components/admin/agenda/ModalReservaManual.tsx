/**
 * ModalReservaManual — Permite ao administrador registrar uma reserva avulsa no balcão ou via WhatsApp.
 * Oferece controle do status de pagamento (pago/não pago), seleção de esportes e observações.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  PlusCircle,
  Calendar,
  Clock,
  Layers,
  User,
  Phone,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { useQuadrasCatalogo, useHorariosCatalogo } from "@/store/useCatalogoArenaStore";
import { calcularValorTotal, formatarDataExibicao, saoConsecutivos } from "@/lib/constants";
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

export function ModalReservaManual({
  aberto,
  quadraIdPadrao,
  dataPadrao,
  horariosPadrao,
  onFechar,
  onSucesso,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const horariosCatalogo = useHorariosCatalogo();
  const { reservas, criarReservaManual } = useReservasService();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [quadraId, setQuadraId] = useState(quadraIdPadrao || quadrasCatalogo[0]?.id || "");
  const [data, setData] = useState(dataPadrao || new Date().toISOString().split("T")[0]);
  const [horarios, setHorarios] = useState<string[]>(horariosPadrao || ["18:00"]);
  const [nomeCliente, setNomeCliente] = useState("");
  const [whatsappCliente, setWhatsappCliente] = useState("");
  const [esporte, setEsporte] = useState<Esporte>("Futsal");
  const [pago, setPago] = useState(false);
  const [valorCustomizado, setValorCustomizado] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Sincroniza props iniciais quando o modal abre
  useEffect(() => {
    if (aberto) {
      if (quadraIdPadrao) setQuadraId(quadraIdPadrao);
      if (dataPadrao) setData(dataPadrao);
      if (horariosPadrao && horariosPadrao.length > 0) {
        setHorarios([...horariosPadrao].sort());
      }
      setNomeCliente("");
      setWhatsappCliente("");
      setPago(false);
      setValorCustomizado("");
      setObservacoes("");
    }
  }, [aberto, quadraIdPadrao, dataPadrao, horariosPadrao]);

  // Fechar no Escape
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

  if (!aberto) return null;

  // Horários ocupados nesta quadra e data
  const horariosOcupados = reservas
    .filter(
      (r) =>
        r.quadraId === quadraId &&
        r.data === data &&
        r.status !== "cancelada"
    )
    .flatMap((r) => r.horarios);

  const valorPadrao = calcularValorTotal(horarios);
  const valorFinal = valorCustomizado !== "" ? parseFloat(valorCustomizado) || 0 : valorPadrao;

  function toggleHorario(h: string) {
    if (horariosOcupados.includes(h)) return;

    let proximo: string[];
    if (horarios.includes(h)) {
      proximo = horarios.filter((item) => item !== h);
    } else {
      proximo = [...horarios, h].sort();
    }

    if (proximo.length > 1 && !saoConsecutivos(proximo)) {
      toast.warning("Selecione horários consecutivos", {
        description: "Os horários de uma mesma reserva não devem ter intervalos.",
      });
      return;
    }

    setHorarios(proximo);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nomeCliente.trim()) {
      toast.error("Informe o nome do cliente ou do grupo.");
      return;
    }

    if (horarios.length === 0) {
      toast.error("Selecione ao menos um horário.");
      return;
    }

    setSalvando(true);

    try {
      const res = await criarReservaManual({
        quadraId,
        data,
        horarios,
        nomeCliente: nomeCliente.trim(),
        whatsappCliente: whatsappCliente.trim(),
        esporte,
        pago,
        valorTotal: valorFinal,
        observacoes: observacoes.trim(),
      });

      if (!res.ok) {
        toast.error("Não foi possível criar a reserva", {
          description: res.motivo,
        });
        return;
      }

      toast.success("Reserva manual criada com sucesso!", {
        description: `Agendada para ${nomeCliente} em ${formatarDataExibicao(data)}.`,
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
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900 sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  Nova Reserva Manual
                </h2>
                <p className="text-xs text-slate-400">
                  Agendamento administrativo pelo balcão ou WhatsApp
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
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
                  Data
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Linha 2: Horários (Seleção múltipla por pills) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Horários Disponíveis ({horarios.length}h selecionadas)
                </span>
                <span className="text-[11px] text-slate-500 lowercase">
                  clique para alternar
                </span>
              </label>

              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl max-h-36 overflow-y-auto">
                {horariosCatalogo.map((h) => {
                  const ocupado = horariosOcupados.includes(h);
                  const selecionado = horarios.includes(h);
                  const horaFim = String(parseInt(h.split(":")[0], 10) + 1).padStart(2, "0") + ":00";

                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={ocupado}
                      onClick={() => toggleHorario(h)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                        selecionado
                          ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20"
                          : ocupado
                          ? "bg-slate-800/40 text-slate-600 line-through cursor-not-allowed border border-slate-800"
                          : "bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                      }`}
                      title={ocupado ? "Horário indisponível" : `${h} às ${horaFim}`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha 3: Cliente & Contato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Nome do Cliente / Grupo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Turma da Quarta / Carlos"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 11999998888"
                  value={whatsappCliente}
                  onChange={(e) => setWhatsappCliente(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Linha 4: Esporte */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Esporte Praticado
              </label>
              <div className="flex flex-wrap gap-2">
                {ESPORTES.map((esp) => {
                  const ativo = esporte === esp;
                  return (
                    <button
                      key={esp}
                      type="button"
                      onClick={() => setEsporte(esp)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        ativo
                          ? "bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-semibold"
                          : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      {esp}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha 5: Financeiro e Pagamento */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Situação de Pagamento
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Defina se o valor foi quitado no balcão ou se ficará pendente
                  </p>
                </div>

                {/* Seletor Segmentado Pago / Pendente */}
                <div className="inline-flex rounded-xl bg-slate-900 border border-slate-700/80 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setPago(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      pago
                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setPago(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      !pago
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Pendente
                  </button>
                </div>
              </div>

              {/* Valor cobrado */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700/40">
                <span className="text-xs font-semibold text-slate-300">Valor final a ser cobrado:</span>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-400 font-bold text-sm select-none">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={valorPadrao.toFixed(2)}
                      value={valorCustomizado}
                      onChange={(e) => setValorCustomizado(e.target.value)}
                      className="w-32 bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl pl-9 pr-3 py-2 text-right text-sm font-bold text-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Linha 6: Observações */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                Observações Administrativas (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Contato feito pelo WhatsApp da diretoria; solicitou bola extra."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
              />
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
                id="btn-confirmar-reserva-manual"
                disabled={salvando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-bold shadow-lg shadow-sky-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {salvando ? "Salvando..." : "Confirmar Agendamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
