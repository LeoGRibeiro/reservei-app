/**
 * @file ModalPix.tsx
 * @description Modal de checkout e pagamento via Pix dinâmico.
 * Exibe o QR Code gerado pelo gateway, código Copia e Cola, botão com cópia para
 * área de transferência, contagem regressiva de expiração do lock e listener
 * reativo para confirmação automática via Webhook em tempo real.
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatarMoeda } from "@/lib/constants";
import {
  CheckCircle2,
  X,
  ArrowLeft,
  Copy,
  Check,
  Clock,
  Loader2,
  QrCode as QrCodeIcon,
} from "lucide-react";
import { toast } from "sonner";
import { calcularTempoRestanteLockSegundos } from "@/lib/pagamento/lockService";
import type { PixCobranca } from "@/lib/pagamento/types";
import { useReservasStore } from "@/store/useReservasStore";

// ── Fake QR Code SVG (Fallback visual quando offline ou sem imagem externa) ─────

const QR_ROWS = [
  "1111111011101111111",
  "1000001001001000001",
  "1011101010101011101",
  "1011101001011011101",
  "1011101010101011101",
  "1000001001001000001",
  "1111111010101111111",
  "0000000001100000000",
  "1101011111001011011",
  "0010100101010100100",
  "1001011010101011001",
  "0100000001010010010",
  "1101011011011011011",
  "0000000001110001001",
  "1111111010101110111",
  "1000001001011001001",
  "1011101011001010111",
  "1000001001010100001",
  "1111111010101111111",
];

function FakeQrCode() {
  const size = 19;
  const cellSize = 10;
  const total = size * cellSize;

  return (
    <svg
      width={total}
      height={total}
      viewBox={`0 0 ${total} ${total}`}
      className="rounded-lg"
      style={{ imageRendering: "pixelated" }}
      aria-label="Código QR Code Pix"
    >
      <rect width={total} height={total} fill="white" />
      {QR_ROWS.map((row, y) =>
        row.split("").map((cell, x) =>
          cell === "1" ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}

// ── Utilitário de formatação de tempo ──────────────────────────────────────────

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60).toString().padStart(2, "0");
  const s = (segundos % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Props do Componente ───────────────────────────────────────────────────────

export interface ModalPixProps {
  /** Se o modal está aberto */
  open: boolean;
  /** Identificador da reserva atual */
  reservaId?: string | null;
  /** Modalidade: sinal (40%) ou valor integral (100%) */
  tipoPagamento: "sinal" | "integral";
  /** Valor nominal do sinal em reais */
  valorSinal: number;
  /** Valor nominal total em reais */
  valorTotal: number;
  /** Nome do cliente para exibição */
  nomeCliente: string;
  /** Dados transacionais da cobrança emitida pelo gateway */
  cobrancaPix?: PixCobranca | null;
  /** Se os dados do Pix ainda estão sendo gerados */
  carregando?: boolean;
  /** Callback para simular aprovação instantânea (ambiente de teste/sandbox) */
  onSimularPagamento: (tipo: "sinal" | "integral") => void;
  /** Callback ao clicar no botão voltar */
  onVoltar: () => void;
  /** Callback ao cancelar a reserva */
  onCancelar: () => void;
}

export function ModalPix({
  open,
  reservaId,
  tipoPagamento,
  valorSinal,
  valorTotal,
  nomeCliente,
  cobrancaPix,
  carregando = false,
  onSimularPagamento,
  onVoltar,
  onCancelar,
}: ModalPixProps) {
  const [copiado, setCopiado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState<number>(10 * 60);

  const valorCobrado = cobrancaPix?.valor ?? (tipoPagamento === "sinal" ? valorSinal : valorTotal);
  const valorRestante = valorTotal - valorSinal;

  const codigoCopiaECola =
    cobrancaPix?.copiaECola ||
    "00020126580014br.gov.bcb.pix0136reservei@complexo.com5204000053039865802BR5915RESERVEI6005BELEM62070503***6304";

  // Reatividade em tempo real: observa a reserva no estado global
  const reservaNoStore = useReservasStore(
    useCallback(
      (state) => (reservaId ? state.reservas.find((r) => r.id === reservaId) : undefined),
      [reservaId]
    )
  );

  // Monitora se o status foi confirmado via Webhook ou Realtime
  useEffect(() => {
    if (open && reservaNoStore && reservaNoStore.status === "confirmada") {
      toast.success("Pagamento Confirmado em Tempo Real! 🚀", {
        description: "Seu pagamento Pix foi identificado e a quadra está garantida.",
        duration: 5000,
      });
      // Fecha e celebra chamando a simulação correspondente
      onSimularPagamento(tipoPagamento);
    }
  }, [open, reservaNoStore?.status, onSimularPagamento, tipoPagamento]);

  // Contagem regressiva precisa baseada na data de expiração do lock
  useEffect(() => {
    if (!open) {
      setCopiado(false);
      return;
    }

    const expiraEm = cobrancaPix?.expiraEm;
    const duracaoInicial = expiraEm
      ? calcularTempoRestanteLockSegundos(expiraEm)
      : 10 * 60;

    setSegundosRestantes(duracaoInicial > 0 ? duracaoInicial : 10 * 60);

    const intervalo = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          toast.error("Tempo de reserva expirado", {
            description: "O prazo de 10 minutos para pagamento encerrou e o horário foi liberado.",
          });
          onCancelar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, [open, cobrancaPix?.expiraEm, onCancelar]);

  // Copia o código Copia e Cola para a área de transferência
  const handleCopiarPix = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigoCopiaECola);
      } else {
        // Fallback para navegadores sem API Clipboard moderna
        const textarea = document.createElement("textarea");
        textarea.value = codigoCopiaECola;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiado(true);
      toast.success("Código Pix copiado!", {
        description: "Cole no aplicativo do seu banco para concluir o pagamento.",
        duration: 3500,
      });

      setTimeout(() => setCopiado(false), 3000);
    } catch (err) {
      console.warn("[ModalPix] Erro ao copiar Pix:", err);
      toast.error("Não foi possível copiar automaticamente", {
        description: "Selecione o código e copie manualmente.",
      });
    }
  }, [codigoCopiaECola]);

  const estaQuaseExpirando = segundosRestantes <= 60;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancelar()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <button
              onClick={onVoltar}
              className="text-slate-400 hover:text-white transition-colors p-1.5 -ml-1 rounded-lg hover:bg-slate-800"
              title="Voltar para formulário"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <DialogTitle className="text-lg font-bold text-center flex-1 pr-4">
              Pagamento via Pix
            </DialogTitle>
          </div>
        </DialogHeader>

        {carregando ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm text-slate-300 font-medium">Gerando cobrança Pix segura...</p>
            <p className="text-xs text-slate-500">Garantindo a trava temporária da quadra</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 pt-1">
            {/* Badge de tipo de pagamento */}
            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                {tipoPagamento === "sinal" ? "Pagamento do Sinal (40%)" : "Pagamento Integral (100%)"}
              </span>

              {/* Valor em destaque */}
              <p className="text-4xl font-black text-white mt-2">
                {formatarMoeda(valorCobrado)}
              </p>

              {tipoPagamento === "sinal" ? (
                <p className="text-xs text-slate-400 mt-1">
                  Restante de <strong className="text-slate-300">{formatarMoeda(valorRestante)}</strong> no dia do jogo
                </p>
              ) : (
                <p className="text-xs text-emerald-400 font-medium mt-1">
                  ✓ Valor total quitado sem pendências
                </p>
              )}
            </div>

            {/* QR Code Container */}
            <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/40 flex items-center justify-center">
              {cobrancaPix?.qrCodeUrl ? (
                <img
                  src={cobrancaPix.qrCodeUrl}
                  alt="QR Code Pix Oficial"
                  className="w-[190px] h-[190px] object-contain rounded-lg"
                />
              ) : (
                <FakeQrCode />
              )}
            </div>

            {/* Chave Pix e Código Copia e Cola */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Pix Copia e Cola:</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {cobrancaPix?.provedor ? `Via ${cobrancaPix.provedor.toUpperCase()}` : "Banco Central"}
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  readOnly
                  value={codigoCopiaECola}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 truncate pr-28 select-all focus:outline-none focus:border-emerald-500/50"
                />
                <Button
                  size="sm"
                  onClick={handleCopiarPix}
                  className={`absolute right-1 h-7 text-xs font-semibold px-2.5 rounded-lg transition-all ${
                    copiado
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {copiado ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>

              {/* Timer de Expiração */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <Clock
                  className={`w-3.5 h-3.5 ${
                    estaQuaseExpirando ? "text-amber-400 animate-pulse" : "text-slate-500"
                  }`}
                />
                <p
                  className={`text-xs tabular-nums transition-colors duration-700 ${
                    estaQuaseExpirando ? "text-amber-400 font-semibold" : "text-slate-400"
                  }`}
                >
                  Horário reservado por mais{" "}
                  <span className="font-bold tracking-wide">
                    {formatarTempo(segundosRestantes)}
                  </span>
                </p>
              </div>
            </div>

            <Separator className="bg-slate-700/50 w-full" />

            {/* Identificação do Titular */}
            <div className="w-full bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">Titular da Reserva</span>
                <span className="text-slate-200 font-semibold text-sm">{nomeCliente || "—"}</span>
              </div>
            </div>

            {/* Banner de Demonstração / Sandbox */}
            <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
              <p className="text-[11px] text-amber-400 text-center leading-relaxed">
                🛠️ <strong>Ambiente Sandbox/Demonstração.</strong> Clique abaixo para simular a liquidação bancária automática.
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="w-full space-y-2">
              <Button
                onClick={() => onSimularPagamento(tipoPagamento)}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-12 rounded-xl gap-2 shadow-lg shadow-emerald-500/20 text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                Simular Pagamento Aprovado
              </Button>
              <Button
                variant="ghost"
                onClick={onCancelar}
                className="w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-9 gap-1.5 text-xs"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar reserva
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
