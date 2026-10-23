"use client";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  formatarMoeda,
  formatarDataExibicao,
  PERCENTUAL_SINAL,
  ENDERECO_COMPLEXO,
} from "@/lib/constants";
import { useCatalogoArenaStore, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { POLITICA_CANCELAMENTO_PADRAO } from "@/lib/legal/termos";
import { useEnderecoArena, usePercentualSinalArena } from "@/hooks/useConfiguracaoSiteArena";
import { ShoppingCart, MapPin, Calendar, Clock, Trash2, Gift, Ticket, Check, X } from "lucide-react";
import type { VoucherFidelidade } from "@/lib/fidelidade/types";
import { aplicarDescontoVouchers } from "@/lib/fidelidade/fidelidadeService";

interface Props {
  quadraId: string | null;
  data: string;
  horariosSelecionados: string[];
  valorTotal: number;
  valorSinal: number;
  valorPendente: number;
  onContinuar: () => void;
  onLimpar: () => void;
  // Mobile: controla abertura do drawer
  isOpen?: boolean;
  onToggle?: () => void;
  // Fidelidade: vouchers selecionados individualmente
  vouchersSelecionadosIds?: string[];
  onToggleVoucher?: (voucherId: string) => void;
  onLimparVouchers?: () => void;
  vouchersDisponiveis?: VoucherFidelidade[];
  // Retrocompatibilidade
  vouchersAplicados?: boolean;
  onToggleVouchers?: (aplicar: boolean) => void;
  voucherAplicado?: VoucherFidelidade | null;
  onSelecionarVoucher?: (voucher: VoucherFidelidade | null) => void;
}

export function CarrinhoLateral({
  quadraId,
  data,
  horariosSelecionados,
  valorTotal,
  valorSinal,
  valorPendente,
  onContinuar,
  onLimpar,
  vouchersSelecionadosIds,
  onToggleVoucher,
  onLimparVouchers,
  vouchersDisponiveis = [],
  vouchersAplicados,
  onToggleVouchers,
  voucherAplicado,
  onSelecionarVoucher,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const politicaCancelamento =
    useCatalogoArenaStore((s) => s.arena?.politicaCancelamento)?.trim() || POLITICA_CANCELAMENTO_PADRAO;
  const percentualSinal = usePercentualSinalArena(PERCENTUAL_SINAL);
  const enderecoArena = useEnderecoArena(ENDERECO_COMPLEXO);
  const quadra = quadrasCatalogo.find((q) => q.id === quadraId);
  const temItens = (horariosSelecionados ?? []).length > 0;

  const vouchersParaAplicar =
    vouchersSelecionadosIds !== undefined
      ? vouchersDisponiveis.filter((v) => vouchersSelecionadosIds.includes(v.id))
      : (vouchersAplicados !== undefined ? vouchersAplicados : !!voucherAplicado)
      ? vouchersDisponiveis
      : [];

  // Cálculo com os vouchers selecionados
  const resultadoDesconto = vouchersParaAplicar.length > 0
    ? aplicarDescontoVouchers(valorTotal, vouchersParaAplicar)
    : null;
  const valorTotalFinal = resultadoDesconto ? resultadoDesconto.valorFinal : valorTotal;
  const valorSinalFinal = resultadoDesconto
    ? Math.round(valorTotalFinal * percentualSinal * 100) / 100
    : valorSinal;
  const valorPendenteFinal = resultadoDesconto
    ? Math.max(0, valorTotalFinal - valorSinalFinal)
    : valorPendente;

  const horariosOrdenados = [...(horariosSelecionados ?? [])].sort();
  const primeiroHorario = horariosOrdenados[0];
  const ultimoHorario = horariosOrdenados[horariosOrdenados.length - 1];
  const ultimaHora = ultimoHorario
    ? `${String(parseInt(ultimoHorario.split(":")[0]) + 1).padStart(2, "0")}:00`
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
        </div>
        <h2 className="text-base font-bold text-white">Resumo da Reserva</h2>
      </div>

      {!temItens ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 opacity-50">
            <ShoppingCart className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            Selecione uma quadra e horário ao lado para ver o resumo aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Detalhes */}
          <div className="flex-1 space-y-4">
            {/* Local */}
            <div className="flex gap-3 items-start">
              <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Local</p>
                <p className="text-sm text-slate-200">{enderecoArena}</p>
                {quadra && (
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Quadra {quadra.numero}
                  </p>
                )}
              </div>
            </div>

            {/* Data */}
            <div className="flex gap-3 items-start">
              <Calendar className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 font-medium">Data</p>
                <p className="text-sm text-slate-200 first-letter:uppercase">
                  {formatarDataExibicao(data, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
            </div>

            {/* Horários */}
            <div className="flex gap-3 items-start">
              <Clock className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-medium">Horário</p>
                <p className="text-sm text-slate-200">
                  {primeiroHorario} – {ultimaHora}
                  <span className="text-slate-500 ml-1">
                    ({horariosSelecionados.length}h)
                  </span>
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {horariosOrdenados.map((h) => (
                    <span
                      key={h}
                      className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="bg-slate-700/50" />

            {/* Seleção de Voucher de Fidelidade */}
            {vouchersDisponiveis.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Vouchers Fidelidade ({vouchersDisponiveis.length})
                    </span>
                  </div>
                  {vouchersParaAplicar.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onLimparVouchers) {
                          onLimparVouchers();
                        } else {
                          onToggleVouchers?.(false);
                          onSelecionarVoucher?.(null);
                        }
                      }}
                      className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Limpar ({vouchersParaAplicar.length})
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-300">
                  {vouchersDisponiveis.length > 1
                    ? "Selecione quais vouchers deseja aplicar nesta reserva:"
                    : "Você possui 1 voucher de fidelidade disponível:"}
                </p>

                {/* Lista individual de vouchers */}
                <div className="space-y-1.5 pt-0.5">
                  {vouchersDisponiveis.map((v) => {
                    const selecionado = vouchersParaAplicar.some((sel: VoucherFidelidade) => sel.id === v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          if (onToggleVoucher) {
                            onToggleVoucher(v.id);
                          } else {
                            onToggleVouchers?.(!selecionado);
                            onSelecionarVoucher?.(selecionado ? null : v);
                          }
                        }}
                        className={cn(
                          "w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                          selecionado
                            ? "bg-emerald-500/20 border-emerald-500/60 text-white shadow-sm"
                            : "bg-slate-900/70 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors",
                              selecionado
                                ? "bg-emerald-500 border-emerald-400 text-slate-950"
                                : "border-slate-600 bg-slate-800"
                            )}
                          >
                            {selecionado && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-mono font-bold block truncate text-emerald-300">
                              {v.codigo}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Teto de até {formatarMoeda(v.valorTeto)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2",
                            selecionado
                              ? "bg-emerald-400 text-slate-950"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          )}
                        >
                          {selecionado ? "Aplicado" : "Usar"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {vouchersParaAplicar.length > 0 && (
                  <div className="mt-1 p-2.5 bg-slate-900/90 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">
                        Desconto total ({vouchersParaAplicar.length}{" "}
                        {vouchersParaAplicar.length === 1 ? "voucher" : "vouchers"}):
                      </span>
                      {resultadoDesconto?.reservaGratuita && (
                        <span className="text-[10px] font-black uppercase text-emerald-400 block mt-0.5">
                          🎉 100% Grátis com Fidelidade!
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-emerald-400 font-mono text-sm">
                      -{formatarMoeda(resultadoDesconto?.valorDesconto || 0)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Valores */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Valor original</span>
                <span
                  className={
                    resultadoDesconto && resultadoDesconto.valorDesconto > 0
                      ? "text-slate-500 line-through text-xs font-medium"
                      : "text-white font-semibold"
                  }
                >
                  {formatarMoeda(valorTotal)}
                </span>
              </div>

              {resultadoDesconto && resultadoDesconto.valorDesconto > 0 && (
                <div className="flex justify-between text-sm text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1 text-xs">
                    <Ticket className="w-3.5 h-3.5" /> Desconto Fidelidade
                  </span>
                  <span>- {formatarMoeda(resultadoDesconto.valorDesconto)}</span>
                </div>
              )}

              {resultadoDesconto && resultadoDesconto.valorDesconto > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300 font-bold">Total com desconto</span>
                  <span className="text-white font-black">
                    {formatarMoeda(valorTotalFinal)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-slate-400">
                  Sinal ({Math.round(percentualSinal * 100)}%)
                </span>
                <span className="text-emerald-400 font-bold">
                  {formatarMoeda(valorSinalFinal)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Restante no dia</span>
                <span className="text-slate-300">
                  {formatarMoeda(valorPendenteFinal)}
                </span>
              </div>
            </div>

            {/* Política de cancelamento da arena */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-[11px] text-amber-400 leading-relaxed">
                <strong>Cancelamento:</strong> {politicaCancelamento}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="mt-6 space-y-2">
            <Button
              onClick={onContinuar}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-12 rounded-xl text-base shadow-lg shadow-emerald-500/20"
            >
              Continuar →
            </Button>
            <Button
              variant="ghost"
              onClick={onLimpar}
              className="w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 h-9 text-sm gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar seleção
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Botão flutuante para mobile ────────────────────────────────────────────────

interface BotaoCarrinhoProps {
  count: number;
  valorSinal: number;
  onClick: () => void;
}

export function BotaoCarrinhoMobile({ count, valorSinal, onClick }: BotaoCarrinhoProps) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
        "flex items-center gap-3 px-5 py-3.5 rounded-2xl",
        "bg-emerald-500 text-slate-950 font-bold shadow-2xl shadow-emerald-500/40",
        "transition-all duration-300 active:scale-95"
      )}
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 bg-slate-950 text-emerald-400 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
          {count}
        </span>
      </div>
      <span>Ver reserva · {formatarMoeda(valorSinal)}</span>
    </button>
  );
}
