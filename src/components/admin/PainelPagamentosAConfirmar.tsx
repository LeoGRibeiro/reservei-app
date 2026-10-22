/**
 * @file PainelPagamentosAConfirmar.tsx
 * @description Fila do balcão com os Pix manuais que os atletas informaram como pagos. O operador confere
 * o extrato do banco da arena e confirma (reserva garantida) ou recusa (horário liberado).
 * Não aparece quando não há nada a conferir.
 */

"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Ban, Hourglass, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { chamarApi } from "@/lib/api/clienteApi";
import { formatarDataExibicao, formatarMoeda } from "@/lib/constants";
import { useReservasService } from "@/hooks/useReservasService";
import { descreverQuadra } from "@/store/useCatalogoArenaStore";
import type { Reserva } from "@/store/useReservasStore";

/** Depois deste tempo sem conferência, o item ganha destaque de atraso. */
const MINUTOS_ATRASO = 30;

/**
 * Seleciona os Pix manuais informados e ainda não decididos, do mais antigo para o mais novo.
 *
 * @param reservas Reservas carregadas no painel
 * @returns Fila de conferência
 */
export function filtrarPagamentosAConfirmar(reservas: Reserva[]): Reserva[] {
  return reservas
    .filter((r) => r.status === "em_processamento" && r.gatewayProvedor === "manual" && Boolean(r.pagamentoInformadoEm))
    .sort((a, b) => String(a.pagamentoInformadoEm).localeCompare(String(b.pagamentoInformadoEm)));
}

/**
 * Minutos desde que o atleta informou o pagamento.
 *
 * @param informadoEm Instante ISO
 * @param agora Referência
 * @returns Minutos inteiros (mínimo 0)
 */
export function minutosDesde(informadoEm: string | undefined, agora: Date = new Date()): number {
  if (!informadoEm) return 0;
  return Math.max(0, Math.floor((agora.getTime() - new Date(informadoEm).getTime()) / 60000));
}

interface Props {
  /** Slug da arena (as decisões passam pelo servidor, que confere o vínculo do operador) */
  arenaSlug: string;
}

export function PainelPagamentosAConfirmar({ arenaSlug }: Props) {
  const { reservas, recarregarReservas } = useReservasService();
  const fila = useMemo(() => filtrarPagamentosAConfirmar(reservas), [reservas]);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  if (fila.length === 0) return null;

  const decidir = async (reserva: Reserva, acao: "confirmar" | "recusar") => {
    let motivo = "";
    if (acao === "recusar") {
      motivo = window.prompt("Por que o pagamento está sendo recusado? (ex.: Pix não caiu no extrato)") ?? "";
      if (motivo.trim().length < 3) return;
    }
    setOcupadoId(reserva.id);
    const res = await chamarApi("/api/admin/pagamentos/manual", {
      method: "POST",
      corpo: { arenaSlug, reservaId: reserva.id, acao, motivo },
    });
    setOcupadoId(null);
    if (!res.ok) {
      toast.error(res.erro);
      return;
    }
    toast.success(acao === "confirmar" ? "Pagamento confirmado. Reserva garantida." : "Pagamento recusado. Horário liberado.");
    await recarregarReservas();
  };

  return (
    <section
      aria-label="Pagamentos a confirmar"
      className="mb-6 bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <Hourglass className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-bold text-amber-200">
          Pagamentos a confirmar ({fila.length})
        </h2>
      </div>
      <p className="text-xs text-slate-400">
        Confira no extrato do banco da arena se o Pix caiu antes de confirmar.
      </p>
      <ul className="divide-y divide-amber-500/10">
        {fila.map((r) => {
          const minutos = minutosDesde(r.pagamentoInformadoEm);
          const atrasado = minutos >= MINUTOS_ATRASO;
          const valor = r.pixValor ?? r.valorSinal;
          const telefone = r.whatsappCliente?.replace(/\D/g, "");
          return (
            <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {r.nomeCliente} · {formatarMoeda(valor)}
                </p>
                <p className="text-xs text-slate-400">
                  {descreverQuadra(r.quadraId)} · {formatarDataExibicao(r.data)} · {r.horaInicio}–{r.horaFim}
                </p>
                <p className={`text-[11px] mt-0.5 ${atrasado ? "text-amber-300 font-semibold" : "text-slate-500"}`}>
                  Informado há {minutos} min{atrasado && " · aguardando há bastante tempo"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {telefone && (
                  <a
                    href={`https://wa.me/55${telefone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                <button
                  disabled={ocupadoId === r.id}
                  onClick={() => decidir(r, "recusar")}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-1"
                >
                  <Ban className="w-3.5 h-3.5" /> Recusar
                </button>
                <button
                  disabled={ocupadoId === r.id}
                  onClick={() => decidir(r, "confirmar")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1"
                >
                  <BadgeCheck className="w-3.5 h-3.5" /> Pix recebido
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
