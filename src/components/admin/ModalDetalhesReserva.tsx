/**
 * ModalDetalhesReserva — exibe todas as informações de uma reserva.
 * Acionado pelo clique em qualquer item da tabela (Dashboard) ou
 * bloco da timeline (Agenda).
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  User,
  Phone,
  CreditCard,
  CalendarDays,
  Clock,
  Layers,
  Dumbbell,
  MessageSquare,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  DollarSign,
  MessageCircle,
  ExternalLink,
  Send,
  Sparkles,
  ShieldCheck,
  Wrench as WrenchIcon,
  Gift,
  Ticket,
} from "lucide-react";
import type { Reserva } from "@/store/useReservasStore";
import { descreverQuadra } from "@/store/useCatalogoArenaStore";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { formatarMoeda, formatarDataExibicao } from "@/lib/constants";
import { PREPARACAO_POR_ESPORTE } from "@/lib/quadras";
import { getTelefonesCadastradosLocal } from "@/lib/supabase/authService";
import { useReservasService } from "@/hooks/useReservasService";
import { toast } from "sonner";

// ─── Config de status ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  confirmada: {
    label: "Confirmada",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    iconCor: "text-emerald-400",
  },
  pendente: {
    label: "Pendente (pagar no local)",
    icon: AlertCircle,
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    iconCor: "text-amber-400",
  },
  em_processamento: {
    label: "Em Processamento",
    icon: Loader2,
    bg: "bg-sky-500/10 border-sky-500/30",
    text: "text-sky-400",
    iconCor: "text-sky-400",
  },
  cancelada: {
    label: "Cancelada",
    icon: XCircle,
    bg: "bg-slate-600/20 border-slate-600/30",
    text: "text-slate-500",
    iconCor: "text-slate-500",
  },
};

// ─── Sub-componente: Linha de detalhe ─────────────────────────────────────────

function DetalheRow({
  icon: Icon,
  label,
  value,
  valueClass = "text-white",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-700/40 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className={`text-sm font-medium break-words ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Botões de WhatsApp contextual ───────────────────────────────────────────

interface BotoesWhatsAppProps {
  reserva: Reserva;
  tipoPagamento: "sinal" | "integral";
}

function gerarUrlWA(numero: string, texto: string): string {
  const nums = numero.replace(/\D/g, "");
  // Adiciona DDI 55 (Brasil) se não tiver
  const ddi = nums.startsWith("55") ? nums : `55${nums}`;
  return `https://wa.me/${ddi}?text=${encodeURIComponent(texto)}`;
}

function BotoesWhatsApp({ reserva, tipoPagamento }: BotoesWhatsAppProps) {
  const nomeQuadra = descreverQuadra(reserva.quadraId);
  const nomeArena = useConfiguracaoSiteArena().nomePlataforma;
  const dataFormatada = formatarDataExibicao(reserva.data, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Mensagens pré-prontas ──────────────────────────────────────────────────

  const isRecorrente = Boolean(
    reserva.contratoId ||
    reserva.tipoReserva === "escolinha" ||
    reserva.tipoReserva === "grupo"
  );
  const temFidelidade = Boolean(
    !isRecorrente &&
    ((reserva.descontoFidelidade && reserva.descontoFidelidade > 0) ||
      reserva.reservaGratuitaFidelidade ||
      (reserva.vouchersUtilizados && reserva.vouchersUtilizados.length > 0))
  );
  const ehGratisFidelidade = Boolean(
    !isRecorrente &&
    (reserva.reservaGratuitaFidelidade ||
      reserva.metodoPagamento === "fidelidade" ||
      (temFidelidade && reserva.valorTotal === 0))
  );

  const textoPagamentoConfirmacao =
    ehGratisFidelidade
      ? "100% Coberta pelo Programa de Fidelidade 🎉 (R$ 0,00)"
      : isRecorrente
      ? "Contrato Mensal / Recorrente ⚽"
      : tipoPagamento === "integral"
      ? "Integral — pago por completo ✅"
      : `Sinal de *${formatarMoeda(reserva.valorSinal)}* pago ✅`;

  const msgConfirmacao =
    `Olá, *${reserva.nomeCliente}*! 👋\n\n` +
    `✅ Sua reserva no *${nomeArena}* está confirmada!\n\n` +
    `📋 *Detalhes da reserva:*\n` +
    `• ${nomeQuadra} — ${dataFormatada}\n` +
    `• Horário: *${reserva.horaInicio} – ${reserva.horaFim}*\n` +
    (reserva.esporte ? `• Esporte: *${reserva.esporte}*\n` : ``) +
    `\n💰 *Pagamento:* ${textoPagamentoConfirmacao}\n` +
    (tipoPagamento === "sinal" && !ehGratisFidelidade && !isRecorrente
      ? `• Restante a pagar no local: *${formatarMoeda(reserva.valorPendente)}*\n`
      : ``) +
    `\nNos vemos lá! 🏟️`;

  const msgPendente =
    `Olá, *${reserva.nomeCliente}*! 👋\n\n` +
    `🔔 Lembrete da sua reserva no *${nomeArena}*:\n\n` +
    `📋 *Detalhes:*\n` +
    `• ${nomeQuadra} — ${dataFormatada}\n` +
    `• Horário: *${reserva.horaInicio} – ${reserva.horaFim}*\n\n` +
    `💳 *Pagamento pendente no local:*\n` +
    `• Sinal pago: *${formatarMoeda(reserva.valorSinal)}* ✅\n` +
    `• *A pagar na entrada: ${formatarMoeda(reserva.valorPendente)}*\n\n` +
    `Por favor, chegue com o valor em mãos (dinheiro ou Pix). Até logo! 🏟️`;

  const msgCustom =
    `Olá, *${reserva.nomeCliente}*! ` +
    `Entrando em contato sobre sua reserva na ${nomeQuadra} no dia ${dataFormatada} (${reserva.horaInicio}–${reserva.horaFim}). `;

  const botoes: Array<{
    id: string;
    label: string;
    descricao: string;
    cor: string;
    borda: string;
    icone: React.ElementType;
    mensagem: string;
    destaque?: boolean;
  }> = [
    {
      id: "wpp-confirmacao",
      label: "Enviar Confirmação",
      descricao: "Dados completos da reserva + pagamento",
      cor: "bg-emerald-500 hover:bg-emerald-400 text-slate-950",
      borda: "border-emerald-500",
      icone: CheckCircle2,
      mensagem: msgConfirmacao,
      destaque: true,
    },
    ...(tipoPagamento === "sinal"
      ? [
          {
            id: "wpp-pendente",
            label: "Cobrar Pendência",
            descricao: `Lembrar de pagar ${formatarMoeda(reserva.valorPendente)} no local`,
            cor: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30",
            borda: "border-amber-500/30",
            icone: AlertCircle,
            mensagem: msgPendente,
          },
        ]
      : []),
    {
      id: "wpp-custom",
      label: "Mensagem Livre",
      descricao: "Abre conversa com texto base editável",
      cor: "bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600/50",
      borda: "border-slate-600/50",
      icone: MessageCircle,
      mensagem: msgCustom,
    },
  ];

  return (
    <div className="space-y-2">
      {botoes.map((btn) => {
        const Icon = btn.icone;
        return (
          <a
            key={btn.id}
            id={btn.id}
            href={gerarUrlWA(reserva.whatsappCliente, btn.mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 group ${btn.cor}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold leading-tight">{btn.label}</p>
              <p className={`text-[11px] leading-tight mt-0.5 ${btn.destaque ? "text-slate-800/70" : "text-slate-500"}`}>
                {btn.descricao}
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────


interface Props {
  reserva: Reserva | null;
  onFechar: () => void;
}

export function ModalDetalhesReserva({ reserva, onFechar }: Props) {
  const { confirmarPagamentoRestante } = useReservasService();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fechar com Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    },
    [onFechar]
  );

  const handleMarcarComoPago = useCallback(() => {
    if (!reserva) return;
    confirmarPagamentoRestante(reserva.id);
    toast.success("Pagamento confirmado com sucesso!", {
      description: `A reserva de ${reserva.nomeCliente} foi marcada como paga integralmente.`,
    });
  }, [reserva, confirmarPagamentoRestante]);

  useEffect(() => {
    if (!reserva) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [reserva, handleKeyDown]);

  if (!reserva || !mounted) return null;

  const statusCfg =
    STATUS_CONFIG[reserva.status] ?? STATUS_CONFIG.pendente;
  const StatusIcon = statusCfg.icon;

  const nomeQuadra = descreverQuadra(reserva.quadraId);
  const tipoPagamento = reserva.valorPendente === 0 ? "integral" : "sinal";

  const isRecorrente = Boolean(
    reserva.contratoId ||
    reserva.tipoReserva === "escolinha" ||
    reserva.tipoReserva === "grupo"
  );
  const temFidelidade = Boolean(
    !isRecorrente &&
    ((reserva.descontoFidelidade && reserva.descontoFidelidade > 0) ||
      reserva.reservaGratuitaFidelidade ||
      (reserva.vouchersUtilizados && reserva.vouchersUtilizados.length > 0))
  );
  const ehGratisFidelidade = Boolean(
    !isRecorrente &&
    (reserva.reservaGratuitaFidelidade ||
      reserva.metodoPagamento === "fidelidade" ||
      (temFidelidade && reserva.valorTotal === 0))
  );
  const dataFormatada = formatarDataExibicao(reserva.data, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const criadaEm = new Date(reserva.criadaEm).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Drawer lateral fixado na borda direita sem bloquear o restante da tela */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby="modal-detalhes-titulo"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] max-w-full h-full flex flex-col bg-slate-900 border-l border-slate-700/80 shadow-2xl animate-slide-in-right overflow-y-auto pointer-events-auto"
      >

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-slate-700/50 sticky top-0 bg-slate-900 z-10">
          <div>
            <p className="text-xs text-slate-500 font-mono mb-1">
              #{reserva.id.slice(-8).toUpperCase()}
            </p>
            <h2 className="text-lg font-bold text-white leading-tight">
              Detalhes da Reserva
            </h2>
          </div>
          <button
            id="modal-detalhes-fechar"
            onClick={onFechar}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-all flex-shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Badge de status */}
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${statusCfg.bg}`}
          >
            <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusCfg.iconCor}`} />
            <div>
              <p className={`text-sm font-semibold ${statusCfg.text}`}>
                {statusCfg.label}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reserva criada em {criadaEm}
              </p>
            </div>
          </div>

          {/* Destaque para Reserva com Fidelidade / Voucher */}
          {temFidelidade && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
              <Gift className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">
                  {ehGratisFidelidade
                    ? "🎁 100% Gratuita (Voucher Fidelidade)"
                    : `🎁 Desconto Fidelidade (-${formatarMoeda(reserva.descontoFidelidade || 0)})`}
                </p>
                <p className="text-[11px] text-purple-300/80 mt-0.5">
                  Benefício concedido pelo programa de fidelidade da arena.
                </p>
              </div>
            </div>
          )}

          {/* Destaque para Reserva Manual ou Bloqueio */}
          {reserva.tipoReserva === "admin_manual" && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300">
              <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">Reserva Manual pelo Admin</p>
                <p className="text-[11px] text-sky-300/80 mt-0.5">
                  Agendada diretamente pelo balcão ou atendimento via WhatsApp.
                </p>
              </div>
            </div>
          )}

          {reserva.tipoReserva === "manutencao_bloqueio" && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <WrenchIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">Bloqueio Administrativo / Manutenção</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  {reserva.observacoes || "Horário interditado para uso."}
                </p>
              </div>
            </div>
          )}

          {/* Seção: Cliente */}
          <section>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Cliente
            </p>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4">
              {(() => {
                const telDigits = reserva.whatsappCliente ? reserva.whatsappCliente.replace(/\D/g, "") : "";
                const isMembro = Boolean(reserva.userId || (telDigits && getTelefonesCadastradosLocal().has(telDigits)));
                return (
                  <DetalheRow
                    icon={Sparkles}
                    label="Conta / Origem"
                    value={
                      isMembro ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          ⭐ Cliente Cadastrado (Membro)
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">
                          Reserva Avulsa (Visitante)
                        </span>
                      )
                    }
                  />
                );
              })()}
              <DetalheRow
                icon={User}
                label="Nome"
                value={reserva.nomeCliente || "—"}
              />
              <DetalheRow
                icon={Phone}
                label="WhatsApp"
                value={reserva.whatsappCliente || "—"}
              />
            </div>
          </section>

          {/* Seção: Agendamento */}
          <section>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Agendamento
            </p>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4">
              <DetalheRow
                icon={CalendarDays}
                label="Data"
                value={<span className="capitalize">{dataFormatada}</span>}
              />
              <DetalheRow
                icon={Clock}
                label="Horário"
                value={`${reserva.horaInicio} – ${reserva.horaFim} (${reserva.horarios.length}h)`}
                valueClass="text-white font-mono"
              />
              <DetalheRow
                icon={Layers}
                label="Quadra"
                value={nomeQuadra}
              />
              {reserva.esporte && (
                <DetalheRow
                  icon={Dumbbell}
                  label="Esporte"
                  value={
                    <span>
                      {reserva.esporte}
                      <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                        {PREPARACAO_POR_ESPORTE[reserva.esporte]}
                      </span>
                    </span>
                  }
                />
              )}
              {reserva.observacoes && (
                <DetalheRow
                  icon={MessageSquare}
                  label="Observações"
                  value={reserva.observacoes}
                  valueClass="text-slate-300"
                />
              )}
            </div>
          </section>

          {/* Seção: Financeiro */}
          <section>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Financeiro
            </p>

            {/* Card detalhado de Abatimento se houver Fidelidade */}
            {temFidelidade && (
              <div className="mb-3 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-purple-400" />
                  <p className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                    {ehGratisFidelidade
                      ? "Reserva 100% Coberta por Fidelidade"
                      : "Desconto de Fidelidade Aplicado"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Valor de Tabela:</span>
                    <span className="text-slate-300 font-mono line-through">
                      {formatarMoeda(
                        reserva.valorOriginal !== undefined && !isNaN(Number(reserva.valorOriginal)) && Number(reserva.valorOriginal) > 0
                          ? Number(reserva.valorOriginal)
                          : (Number(reserva.valorTotal) || 0) + (Number(reserva.descontoFidelidade) || 0)
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-300 block text-[11px]">Abatimento Fidelidade:</span>
                    <span className="text-purple-400 font-bold font-mono">
                      -{formatarMoeda(Number(reserva.descontoFidelidade) || (Number(reserva.valorOriginal) || Number(reserva.valorTotal) || 0))}
                    </span>
                  </div>
                </div>

                {reserva.vouchersUtilizados && reserva.vouchersUtilizados.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex items-center gap-1.5 flex-wrap">
                    <Ticket className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="text-[11px] text-purple-300 font-medium">Vouchers Utilizados:</span>
                    {reserva.vouchersUtilizados.map((cod) => (
                      <span
                        key={cod}
                        className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-[10px] font-mono text-purple-200"
                      >
                        {cod}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4">
              <DetalheRow
                icon={DollarSign}
                label="Valor Líquido a Pagar"
                value={
                  ehGratisFidelidade ? (
                    <span className="text-purple-400 font-bold">R$ 0,00 (100% Coberta)</span>
                  ) : isRecorrente ? (
                    <span className="text-amber-400 font-bold">
                      {reserva.valorTotal > 0 ? formatarMoeda(reserva.valorTotal) : "Contrato Mensal"}
                    </span>
                  ) : (
                    formatarMoeda(reserva.valorTotal)
                  )
                }
                valueClass={ehGratisFidelidade ? "text-purple-400" : "text-white"}
              />
              <DetalheRow
                icon={Banknote}
                label={
                  ehGratisFidelidade
                    ? "Forma de Pagamento"
                    : isRecorrente
                    ? "Tipo de Cobrança"
                    : tipoPagamento === "integral"
                    ? "Pago (integral)"
                    : "Sinal pago (40%)"
                }
                value={
                  ehGratisFidelidade
                    ? "🎁 100% Voucher Fidelidade"
                    : isRecorrente
                    ? "⚽ Contrato Recorrente"
                    : formatarMoeda(reserva.valorSinal)
                }
                valueClass={ehGratisFidelidade ? "text-purple-400" : "text-emerald-400"}
              />
              {tipoPagamento === "sinal" && !ehGratisFidelidade && !isRecorrente && (
                <DetalheRow
                  icon={AlertCircle}
                  label="Pendente no local (60%)"
                  value={formatarMoeda(reserva.valorPendente)}
                  valueClass="text-amber-400"
                />
              )}
            </div>

            {/* Resumo visual */}
            <div className="mt-3 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">
                  {ehGratisFidelidade
                    ? "100% Coberta por Voucher"
                    : isRecorrente
                    ? "Contrato Recorrente"
                    : tipoPagamento === "integral"
                    ? "Pago integralmente"
                    : "Progresso do pagamento"}
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {ehGratisFidelidade || isRecorrente || tipoPagamento === "integral"
                    ? "100%"
                    : `${Math.round((reserva.valorSinal / reserva.valorTotal) * 100)}%`}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ehGratisFidelidade
                      ? "bg-purple-500"
                      : isRecorrente
                      ? "bg-amber-500"
                      : tipoPagamento === "integral"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }`}
                  style={{
                    width:
                      ehGratisFidelidade || isRecorrente || tipoPagamento === "integral"
                        ? "100%"
                        : `${Math.round((reserva.valorSinal / reserva.valorTotal) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Ação rápida: Marcar como Pago */}
            {reserva.valorPendente > 0 && !reserva.reservaGratuitaFidelidade && reserva.status !== "cancelada" && (
              <button
                type="button"
                id="modal-marcar-como-pago-btn"
                onClick={handleMarcarComoPago}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Marcar como Pago (Quitar {formatarMoeda(reserva.valorPendente)})
              </button>
            )}
          </section>

          {/* Seção: WhatsApp / Contato */}
          <section>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Contato via WhatsApp
            </p>

            {/* Status atual */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 mb-3">
              <DetalheRow
                icon={Phone}
                label="Número do cliente"
                value={
                  reserva.whatsappCliente
                    ? <a
                        href={`https://wa.me/55${reserva.whatsappCliente.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                      >
                        {reserva.whatsappCliente}
                      </a>
                    : "—"
                }
              />
              <DetalheRow
                icon={Send}
                label="Última notificação automática"
                value={
                  reserva.statusWhatsApp === "enviado"
                    ? "✅ Confirmação enviada pelo portal"
                    : reserva.statusWhatsApp === "falhou"
                    ? "❌ Falha no envio automático"
                    : "⏳ Não enviado automaticamente"
                }
                valueClass={
                  reserva.statusWhatsApp === "enviado"
                    ? "text-emerald-400"
                    : reserva.statusWhatsApp === "falhou"
                    ? "text-red-400"
                    : "text-slate-400"
                }
              />
            </div>

            {/* Botões de mensagem rápida */}
            {reserva.whatsappCliente ? (
              <BotoesWhatsApp reserva={reserva} tipoPagamento={tipoPagamento} />
            ) : (
              <p className="text-slate-600 text-xs text-center py-3">
                Número de WhatsApp não informado pelo cliente.
              </p>
            )}
          </section>
        </div>
      </aside>

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>,
    document.body
  );
}
