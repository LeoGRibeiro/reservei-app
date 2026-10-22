"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  mascaraWhatsApp,
  formatarMoeda,
  formatarDataExibicao,
  PERCENTUAL_SINAL,
  TOLERANCIA_CANCELAMENTO_HORAS,
  ENDERECO_COMPLEXO,
} from "@/lib/constants";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { useCatalogoArenaStore, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { useEnderecoArena, usePercentualSinalArena } from "@/hooks/useConfiguracaoSiteArena";
import { POLITICA_CANCELAMENTO_PADRAO } from "@/lib/legal/termos";
import {
  User,
  Phone,
  ChevronRight,
  MapPin,
  Calendar,
  Clock,
  Check,
  ShieldCheck,
  Sparkles,
  Gift,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserAuth } from "@/hooks/useUserAuth";
import type { VoucherFidelidade } from "@/lib/fidelidade/types";
import { toast } from "sonner";

export interface DadosIdentificacao {
  nome: string;
  whatsapp: string;
  esporte: Esporte | "";
  observacoes: string;
  /** Aceite dos Termos de Uso, da Política de Privacidade e da política de cancelamento da arena */
  aceiteTermos: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirmar: (dados: DadosIdentificacao, tipoPagamento: "sinal" | "integral") => void;
  quadraId: string | null;
  data: string;
  horariosSelecionados: string[];
  /** Valor integral da reserva antes de qualquer desconto */
  valorTotalBruto?: number;
  /** Valor total líquido a pagar após eventual abatimento de voucher */
  valorTotal: number;
  /** Valor proporcional de sinal calculado sobre o total líquido */
  valorSinal: number;
  /** Saldo restante a pagar no local */
  valorPendente: number;
  /** Vouchers de fidelidade ativos disponíveis para a conta do usuário */
  vouchersDisponiveis?: VoucherFidelidade[];
  /** IDs dos vouchers selecionados individualmente */
  vouchersSelecionadosIds?: string[];
  /** Alterna a seleção de um voucher individual */
  onToggleVoucher?: (voucherId: string) => void;
  /** Limpa todos os vouchers selecionados */
  onLimparVouchers?: () => void;
  /** Indica se os vouchers disponíveis estão aplicados nesta reserva (retrocompatibilidade) */
  vouchersAplicados?: boolean;
  /** Alterna a aplicação de todos os vouchers na reserva atual (retrocompatibilidade) */
  onToggleVouchers?: (aplicar: boolean) => void;
  /** Indica que o servidor está criando a reserva (desabilita o botão) */
  enviando?: boolean;
}

const initialState: DadosIdentificacao = {
  nome: "",
  whatsapp: "",
  esporte: "",
  observacoes: "",
  aceiteTermos: false,
};

export function FormularioIdentificacao({
  open,
  onClose,
  onConfirmar,
  quadraId,
  data,
  horariosSelecionados,
  valorTotalBruto,
  valorTotal,
  valorSinal,
  valorPendente,
  vouchersDisponiveis = [],
  vouchersSelecionadosIds,
  onToggleVoucher,
  onLimparVouchers,
  vouchersAplicados = false,
  onToggleVouchers,
  enviando = false,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const percentualSinal = usePercentualSinalArena(PERCENTUAL_SINAL);
  const enderecoArena = useEnderecoArena(ENDERECO_COMPLEXO);
  const { user } = useUserAuth();
  const politicaCancelamento =
    useCatalogoArenaStore((s) => s.arena?.politicaCancelamento)?.trim() || POLITICA_CANCELAMENTO_PADRAO;
  const [dados, setDados] = useState<DadosIdentificacao>(initialState);
  const [tipoPagamento, setTipoPagamento] = useState<"sinal" | "integral">("sinal");
  const [errors, setErrors] = useState<Partial<Record<keyof DadosIdentificacao, string>>>({});

  // Preenche dados do usuário automaticamente se estiver logado
  useEffect(() => {
    if (user && open) {
      setDados((prev) => ({
        ...prev,
        nome: prev.nome || user.nome,
        whatsapp: prev.whatsapp || user.telefone,
      }));
    }
  }, [user, open]);

  const quadra = quadrasCatalogo.find((q) => q.id === quadraId);
  const horariosOrdenados = [...(horariosSelecionados ?? [])].sort();
  const primeiroHorario = horariosOrdenados[0] ?? "";
  const ultimoHorario = horariosOrdenados[horariosOrdenados.length - 1];
  const ultimaHora = ultimoHorario
    ? `${String(parseInt(ultimoHorario.split(":")[0], 10) + 1).padStart(2, "0")}:00`
    : "";

  // Filtra quais vouchers estão selecionados para abater
  const vouchersParaAplicar = useMemo(() => {
    if (vouchersSelecionadosIds !== undefined) {
      return vouchersDisponiveis.filter((v) => vouchersSelecionadosIds.includes(v.id));
    }
    return vouchersAplicados ? vouchersDisponiveis : [];
  }, [vouchersSelecionadosIds, vouchersDisponiveis, vouchersAplicados]);

  // Cálculos financeiros e de fidelidade
  const precoOriginal = valorTotalBruto !== undefined ? valorTotalBruto : valorTotal;
  const temVouchersDisponiveis = vouchersDisponiveis.length > 0;
  const qtdVouchers = vouchersDisponiveis.length;
  const temVouchersAplicados = vouchersParaAplicar.length > 0;

  const tetoTotalVouchers = vouchersDisponiveis.reduce(
    (acc: number, v: VoucherFidelidade) => acc + (Number(v.valorTeto) || 0),
    0
  );
  const tetoAplicado = vouchersParaAplicar.reduce(
    (acc: number, v: VoucherFidelidade) => acc + (Number(v.valorTeto) || 0),
    0
  );

  const descontoEfetivo = Math.min(precoOriginal, tetoAplicado);
  const isGratis = temVouchersAplicados && valorTotal === 0;

  const valorCobradoAgora = isGratis
    ? 0
    : tipoPagamento === "sinal"
    ? valorSinal
    : valorTotal;

  const set = (campo: keyof DadosIdentificacao, valor: string) => {
    setDados((prev) => ({ ...prev, [campo]: valor }));
    if (errors[campo]) setErrors((prev) => ({ ...prev, [campo]: undefined }));
  };

  const validar = (): boolean => {
    const novosErrors: typeof errors = {};
    if (!user) {
      if (!dados.nome.trim() || dados.nome.trim().length < 3)
        novosErrors.nome = "Informe seu nome completo.";
      if (dados.whatsapp.replace(/\D/g, "").length < 11)
        novosErrors.whatsapp = "WhatsApp inválido. Use DDD + número.";
    }
    if (!dados.aceiteTermos) novosErrors.aceiteTermos = "Aceite os termos para continuar.";
    setErrors(novosErrors);
    return Object.keys(novosErrors).length === 0;
  };

  const handleSubmit = async () => {
    // O servidor também recusa telefones bloqueados; aqui só evitamos a ida quando já sabemos
    if (user?.bloqueado) {
      toast.error("Conta bloqueada para novas reservas", {
        description: "Sua conta está com restrição para novos agendamentos. Por favor, entre em contato para entender o motivo.",
      });
      return;
    }

    if (user) {
      dados.nome = user.nome;
      dados.whatsapp = user.telefone;
    }
    if (!validar()) return;

    onConfirmar(dados, isGratis ? "integral" : tipoPagamento);
  };

  const handleClose = () => {
    setDados(initialState);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[92vh] overflow-y-auto p-5 md:p-7">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ── Coluna Esquerda: Formulário de Identificação do Cliente ── */}
          <div className="flex flex-col justify-start space-y-4">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl md:text-2xl font-black">
                Confirmar Reserva
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {user
                  ? "Revise os detalhes, escolha o esporte e a modalidade de pagamento."
                  : "Preencha seus dados de contato, revise o resumo da compra e escolha como deseja pagar."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5">
              {user ? (
                /* Card do Usuário Logado (direto, sem pedir nome e telefone) */
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm shadow-inner">
                      {user.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-emerald-400 font-medium">Conta Conectada</span>
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-white leading-tight mt-0.5">{user.nome}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    {user.telefone}
                  </span>
                </div>
              ) : (
                /* Visitante: solicita apenas Nome e WhatsApp */
                <>
                  {/* Nome */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" /> Nome completo *
                    </Label>
                    <Input
                      value={dados.nome}
                      onChange={(e) => set("nome", e.target.value)}
                      placeholder="Seu nome completo"
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-10"
                    />
                    {errors.nome && (
                      <p className="text-xs text-red-400 font-medium">{errors.nome}</p>
                    )}
                  </div>

                  {/* WhatsApp */}
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp *
                    </Label>
                    <Input
                      value={dados.whatsapp}
                      onChange={(e) => set("whatsapp", mascaraWhatsApp(e.target.value))}
                      placeholder="(11) 99999-0000"
                      inputMode="numeric"
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-10"
                    />
                    {errors.whatsapp && (
                      <p className="text-xs text-red-400 font-medium">{errors.whatsapp}</p>
                    )}
                  </div>
                </>
              )}

              {/* Esporte (opcional) */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold">
                  Esporte <span className="text-slate-500 font-normal">(opcional)</span>
                </Label>
                <select
                  value={dados.esporte}
                  onChange={(e) => set("esporte", e.target.value as Esporte | "")}
                  className="w-full h-10 px-3 rounded-md bg-slate-800/80 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                >
                  <option value="">Não informar</option>
                  {ESPORTES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                {dados.esporte && (
                  <p className="text-[11px] text-emerald-400">
                    ✓ Prepararemos a quadra para {dados.esporte}.
                  </p>
                )}
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-semibold">
                  Observações <span className="text-slate-500 font-normal">(opcional)</span>
                </Label>
                <Input
                  value={dados.observacoes}
                  onChange={(e) => set("observacoes", e.target.value)}
                  placeholder="Observações adicionais (opcional)"
                  className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-10"
                />
              </div>

              {/* Termos e Aviso WhatsApp */}
              <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">Política de cancelamento:</strong>{" "}
                  Cancelamentos com mais de{" "}
                  <strong className="text-white">
                    {TOLERANCIA_CANCELAMENTO_HORAS}h de antecedência
                  </strong>{" "}
                  são reembolsados integralmente.
                </p>
                <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  A confirmação da sua reserva será enviada pelo WhatsApp.
                </p>
              </div>
            </div>
          </div>

          {/* ── Coluna Direita: Resumo da Compra, Fidelidade, Pagamento e Botão ── */}
          <div className="space-y-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Resumo da Reserva
                </span>
                {quadra && (
                  <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    Quadra {quadra.numero}
                  </span>
                )}
              </div>

              {/* Informações detalhadas da Reserva */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Local</p>
                    <p className="text-slate-200 font-medium">{enderecoArena}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Data</p>
                    <p className="text-slate-200 font-medium capitalize">
                      {data ? formatarDataExibicao(data, { weekday: "long", day: "numeric", month: "long" }) : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">Horário</p>
                    <p className="text-slate-200 font-medium">
                      {primeiroHorario} – {ultimaHora}
                      <span className="text-slate-500 ml-1.5">
                        ({horariosSelecionados.length} hora{horariosSelecionados.length > 1 ? "s" : ""})
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {horariosOrdenados.map((h) => (
                        <span
                          key={h}
                          className="text-[11px] bg-slate-800 text-emerald-400 border border-slate-700 px-2 py-0.5 rounded-md font-medium"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-800 my-2" />

              {/* ── Seção de Fidelidade / Opção de Usar Vouchers com Alta Visibilidade ── */}
              {temVouchersDisponiveis ? (
                <div
                  className={cn(
                    "rounded-2xl p-4 border transition-all duration-200 space-y-3",
                    temVouchersAplicados
                      ? "bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950/40"
                      : "bg-slate-900/90 border-emerald-500/30 hover:border-emerald-500/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider block">
                          {qtdVouchers > 1
                            ? `Vouchers de Fidelidade (${qtdVouchers})`
                            : "Voucher de Fidelidade"}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-medium">
                          {qtdVouchers > 1
                            ? "Use separadamente ou combine seus vouchers"
                            : `Teto de até ${formatarMoeda(tetoTotalVouchers)}`}
                        </span>
                      </div>
                    </div>
                    {temVouchersAplicados && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onLimparVouchers) {
                            onLimparVouchers();
                          } else {
                            onToggleVouchers?.(false);
                          }
                        }}
                        className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" /> Limpar ({vouchersParaAplicar.length})
                      </button>
                    )}
                  </div>

                  {/* Lista individual de vouchers com botões de alternância */}
                  <div className="space-y-1.5 pt-1">
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
                            }
                          }}
                          className={cn(
                            "w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                            selecionado
                              ? "bg-emerald-500/20 border-emerald-500/60 text-white shadow-sm"
                              : "bg-slate-900/80 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
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
                              <span className="text-xs font-mono font-bold block truncate text-emerald-300">
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
                            {selecionado ? "✓ Aplicado" : "Usar"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {temVouchersAplicados && (
                    <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 flex items-center justify-between mt-2">
                      <div>
                        <p className="text-[11px] text-slate-400">
                          Abatimento ({vouchersParaAplicar.length}{" "}
                          {vouchersParaAplicar.length === 1 ? "voucher selecionado" : "vouchers selecionados"}):
                        </p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-lg font-black text-emerald-400">
                            - {formatarMoeda(descontoEfetivo)}
                          </span>
                          {precoOriginal > 0 && (
                            <span className="text-xs text-slate-500 line-through">
                              {formatarMoeda(precoOriginal)}
                            </span>
                          )}
                        </div>
                      </div>
                      {isGratis && (
                        <span className="text-[10px] font-black uppercase text-slate-950 bg-emerald-400 px-2.5 py-1 rounded-full shadow">
                          🎉 100% Grátis!
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : user ? (
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs text-slate-400 flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    Você está acumulando horas no <strong className="text-slate-200">Programa Fidelidade</strong>! A cada 12h você ganha um voucher gratuito.
                  </span>
                </div>
              ) : null}

              {/* ── Opção de Pagamento Prévia ── */}
              {isGratis ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-emerald-400 font-black text-sm">
                    <Sparkles className="w-4 h-4" /> Reserva 100% Gratuita com Fidelidade!
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Seus vouchers cobrem integralmente o valor desta quadra. Nenhum pagamento via Pix será necessário.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Como deseja pagar agora?
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Opção Sinal */}
                    <button
                      type="button"
                      onClick={() => setTipoPagamento("sinal")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all duration-200 relative",
                        tipoPagamento === "sinal"
                          ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/50"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-200">
                          Sinal ({Math.round(percentualSinal * 100)}%)
                        </span>
                        {tipoPagamento === "sinal" && (
                          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-lg font-black text-emerald-400">
                        {formatarMoeda(valorSinal)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Restante de {formatarMoeda(valorPendente)} no local
                      </p>
                    </button>

                    {/* Opção Integral */}
                    <button
                      type="button"
                      onClick={() => setTipoPagamento("integral")}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all duration-200 relative",
                        tipoPagamento === "integral"
                          ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/50"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-200">
                          Integral (100%)
                        </span>
                        {tipoPagamento === "integral" && (
                          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-lg font-black text-emerald-400">
                          {formatarMoeda(valorTotal)}
                        </p>
                        {vouchersAplicados && precoOriginal > valorTotal && (
                          <span className="text-xs text-slate-500 line-through">
                            {formatarMoeda(precoOriginal)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Pagamento completo sem pendências
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Total Cobrado Agora e Botão de Ação */}
            <div className="space-y-3 mt-3">
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">
                    {isGratis ? "Total a pagar agora" : "Total a pagar agora via Pix"}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black text-emerald-400">
                      {formatarMoeda(valorCobradoAgora)}
                    </p>
                    {vouchersAplicados && precoOriginal > valorCobradoAgora && (
                      <span className="text-xs text-slate-500 line-through">
                        {formatarMoeda(precoOriginal)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                    {isGratis
                      ? "100% Grátis (Fidelidade)"
                      : tipoPagamento === "sinal"
                      ? "Sinal"
                      : "Integral"}
                  </span>
                </div>
              </div>

              {/* Política de cancelamento e aceite dos termos (LGPD) */}
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
                  <p className="font-semibold text-slate-300 mb-0.5">Política de cancelamento</p>
                  <p className="leading-relaxed">{politicaCancelamento}</p>
                </div>
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dados.aceiteTermos}
                    onChange={(e) => {
                      setDados((prev) => ({ ...prev, aceiteTermos: e.target.checked }));
                      if (errors.aceiteTermos) setErrors((prev) => ({ ...prev, aceiteTermos: undefined }));
                    }}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    Li e aceito os{" "}
                    <a href="/termos" target="_blank" className="text-emerald-400 underline">
                      Termos de Uso
                    </a>
                    , a{" "}
                    <a href="/privacidade" target="_blank" className="text-emerald-400 underline">
                      Política de Privacidade
                    </a>{" "}
                    e a política de cancelamento.
                  </span>
                </label>
                {errors.aceiteTermos && <p className="text-[11px] text-red-400">{errors.aceiteTermos}</p>}
              </div>

              {/* Botão de Conclusão / Ir para Pagamento Pix */}
              <Button
                onClick={handleSubmit}
                disabled={enviando}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black h-12 rounded-xl gap-2 text-sm shadow-lg shadow-emerald-500/20"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Reservando horário...
                  </>
                ) : isGratis ? (
                  <>
                    Confirmar Reserva Gratuita 🎉
                  </>
                ) : (
                  <>
                    Ir para pagamento Pix <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
