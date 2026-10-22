/**
 * AdminReservaDetalhes — Página completa de detalhes de uma reserva.
 * Acessada via /admin/reserva/[id].
 * Permite abrir múltiplas reservas em abas paralelas.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
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
  Shield,
  Sparkles,
  ShieldCheck,
  Wrench,
  Gift,
  Ticket,
} from "lucide-react";
import { useReservasStore } from "@/store/useReservasStore";
import { useReservasService } from "@/hooks/useReservasService";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { descreverQuadra } from "@/store/useCatalogoArenaStore";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import { NOME_PRODUTO } from "@/lib/marca";
import { formatarMoeda, formatarDataExibicao } from "@/lib/constants";
import { PREPARACAO_POR_ESPORTE } from "@/lib/quadras";
import type { Reserva } from "@/store/useReservasStore";
import { getTelefonesCadastradosLocal } from "@/lib/supabase/authService";

// ─── Config de status ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  confirmada: {
    label: "Confirmada",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
  },
  pendente: {
    label: "Pendente (pagar no local)",
    icon: AlertCircle,
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-500",
  },
  em_processamento: {
    label: "Em Processamento",
    icon: Loader2,
    bg: "bg-sky-500/10 border-sky-500/30",
    text: "text-sky-400",
    dot: "bg-sky-500",
  },
  cancelada: {
    label: "Cancelada",
    icon: XCircle,
    bg: "bg-slate-600/20 border-slate-600/30",
    text: "text-slate-500",
    dot: "bg-slate-600",
  },
};

// ─── Sub-componente: Card de seção ────────────────────────────────────────────

function SecaoCard({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
        {titulo}
      </p>
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─── Sub-componente: Linha de detalhe ─────────────────────────────────────────

function DetalheRow({
  icon: Icon,
  label,
  value,
  valueClass = "text-white",
  borderless = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  borderless?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 ${!borderless ? "border-b border-slate-700/40 last:border-0" : ""}`}
    >
      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <div className={`text-sm font-medium break-words ${valueClass}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: Botões de WhatsApp ───────────────────────────────────────

function gerarUrlWA(numero: string, texto: string): string {
  const nums = numero.replace(/\D/g, "");
  const ddi = nums.startsWith("55") ? nums : `55${nums}`;
  return `https://wa.me/${ddi}?text=${encodeURIComponent(texto)}`;
}

function BotoesWhatsApp({
  reserva,
  tipoPagamento,
}: {
  reserva: Reserva;
  tipoPagamento: "sinal" | "integral";
}) {
  const nomeQuadra = descreverQuadra(reserva.quadraId);
  const nomeArena = useConfiguracaoSiteArena().nomePlataforma;
  const dataFormatada = formatarDataExibicao(reserva.data, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
    `Olá, *${reserva.nomeCliente}*! Entrando em contato sobre sua reserva na ${nomeQuadra} no dia ${dataFormatada} (${reserva.horaInicio}–${reserva.horaFim}). `;

  const botoes = [
    {
      id: "wpp-confirmacao",
      label: "Enviar Confirmação",
      descricao: "Dados completos da reserva + pagamento",
      classe:
        "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20",
      icone: CheckCircle2,
      mensagem: msgConfirmacao,
    },
    ...(tipoPagamento === "sinal"
      ? [
          {
            id: "wpp-pendente",
            label: "Cobrar Pendência",
            descricao: `Lembrar de pagar ${formatarMoeda(reserva.valorPendente)} no local`,
            classe:
              "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30",
            icone: AlertCircle,
            mensagem: msgPendente,
          },
        ]
      : []),
    {
      id: "wpp-livre",
      label: "Mensagem Livre",
      descricao: "Abre o WhatsApp com texto base editável",
      classe:
        "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50",
      icone: MessageCircle,
      mensagem: msgCustom,
    },
  ];

  return (
    <div className="space-y-3">
      {botoes.map((btn) => {
        const Icon = btn.icone;
        return (
          <a
            key={btn.id}
            id={btn.id}
            href={gerarUrlWA(reserva.whatsappCliente, btn.mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl font-medium text-sm transition-all duration-150 group ${btn.classe}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold">{btn.label}</p>
              <p className="text-[11px] mt-0.5 opacity-70">{btn.descricao}</p>
            </div>
            <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
          </a>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AdminReservaDetalhes({ reservaId }: { reservaId: string }) {
  const router = useRouter();
  const { autenticado } = useAdminAuth();
  const reservas = useReservasStore((s) => s.reservas);
  const { confirmarPagamentoRestante } = useReservasService();

  function handleMarcarComoPago() {
    confirmarPagamentoRestante(reservaId);
    toast.success("Pagamento confirmado com sucesso!", {
      description: "A reserva foi marcada como paga integralmente.",
    });
  }

  // Proteção: redireciona para login se não autenticado
  useEffect(() => {
    if (autenticado === false) {
      router.replace("/admin");
    }
  }, [autenticado, router]);

  if (autenticado === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!autenticado) return null;

  const reserva = reservas.find((r) => r.id === reservaId);

  if (!reserva) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-white font-bold text-xl">Reserva não encontrada</p>
        <p className="text-slate-500 text-sm">
          O ID <code className="text-slate-400 font-mono">{reservaId}</code> não
          existe ou foi removido.
        </p>
        <button
          onClick={() => router.push("/admin/dashboard")}
          className="mt-2 px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm transition-colors"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[reserva.status] ?? STATUS_CONFIG.pendente;
  const StatusIcon = statusCfg.icon;
  const nomeQuadra = descreverQuadra(reserva.quadraId);
  const tipoPagamento: "sinal" | "integral" =
    reserva.valorPendente === 0 ? "integral" : "sinal";

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

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="reserva-voltar"
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-slate-400">
                {NOME_PRODUTO} Admin
              </span>
              <span className="text-slate-700">/</span>
              <span className="text-sm text-white font-mono">
                #{reserva.id.slice(-8).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Badge de status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </div>
        </div>
      </header>

      {/* ── Conteúdo ─────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-1">
            {reserva.nomeCliente || "Cliente sem nome"}
          </h1>
          <p className="text-slate-400 capitalize">{dataFormatada}</p>

          {/* Chips de resumo */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300">
              {nomeQuadra}
            </span>
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-sm font-mono text-slate-300">
              {reserva.horaInicio} – {reserva.horaFim}
            </span>
            {reserva.esporte && (
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400">
                {reserva.esporte}
              </span>
            )}
            {reserva.tipoReserva === "admin_manual" && (
              <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full text-sm text-sky-400 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Reserva Manual (Admin)
              </span>
            )}
            {reserva.tipoReserva === "manutencao_bloqueio" && (
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-sm text-amber-400 flex items-center gap-1.5 font-medium">
                <Wrench className="w-3.5 h-3.5" />
                Bloqueio de Manutenção
              </span>
            )}
            {reserva.reservaGratuitaFidelidade ? (
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-sm text-purple-300 flex items-center gap-1.5 font-bold">
                <Gift className="w-3.5 h-3.5" />
                100% Fidelidade (Grátis)
              </span>
            ) : reserva.descontoFidelidade && reserva.descontoFidelidade > 0 ? (
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-sm text-purple-300 flex items-center gap-1.5 font-medium">
                <Gift className="w-3.5 h-3.5" />
                Voucher (-{formatarMoeda(reserva.descontoFidelidade)})
              </span>
            ) : null}
            <span
              className={`px-3 py-1 rounded-full border text-sm ${statusCfg.bg} ${statusCfg.text}`}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Grid de cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* ── Coluna esquerda ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Status */}
            <div
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl border ${statusCfg.bg}`}
            >
              <StatusIcon className={`w-6 h-6 flex-shrink-0 ${statusCfg.text}`} />
              <div>
                <p className={`font-semibold ${statusCfg.text}`}>
                  {statusCfg.label}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Criada em {criadaEm}
                </p>
              </div>
            </div>

            {/* Cliente */}
            <SecaoCard titulo="Cliente">
              {(() => {
                const telDigits = reserva.whatsappCliente ? reserva.whatsappCliente.replace(/\D/g, "") : "";
                const isMembro = Boolean(reserva.userId || (telDigits && getTelefonesCadastradosLocal().has(telDigits)));
                return (
                  <DetalheRow
                    icon={Sparkles}
                    label="Tipo de Cliente"
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
              <DetalheRow icon={User} label="Nome" value={reserva.nomeCliente || "—"} />
              <DetalheRow
                icon={Phone}
                label="WhatsApp"
                value={
                  reserva.whatsappCliente ? (
                    <a
                      href={`https://wa.me/55${reserva.whatsappCliente.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                    >
                      {reserva.whatsappCliente}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </SecaoCard>

            {/* Agendamento */}
            <SecaoCard titulo="Agendamento">
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
            </SecaoCard>
          </div>

          {/* ── Coluna direita ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Financeiro */}
            <SecaoCard titulo="Financeiro">
              {/* Card detalhado de Abatimento se houver Fidelidade */}
              {temFidelidade && (
                <div className="mx-5 mb-3 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
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
              />
              <DetalheRow
                icon={Banknote}
                label={
                  ehGratisFidelidade
                    ? "Forma de Pagamento"
                    : isRecorrente
                    ? "Tipo de Cobrança"
                    : tipoPagamento === "integral"
                    ? "Pago (integral 100%)"
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

              {/* Barra de progresso */}
              <div className="px-5 pb-5 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">
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
                      : `${Math.round(
                          (reserva.valorSinal / reserva.valorTotal) * 100
                        )}%`}
                  </span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
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
                          : `${Math.round(
                              (reserva.valorSinal / reserva.valorTotal) * 100
                            )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Botão de Marcar como Pago */}
              {reserva.valorPendente > 0 && !reserva.reservaGratuitaFidelidade && reserva.status !== "cancelada" && (
                <div className="px-5 pb-5">
                  <button
                    type="button"
                    id="admin-detalhe-marcar-pago-btn"
                    onClick={handleMarcarComoPago}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar como Pago (Quitar {formatarMoeda(reserva.valorPendente)})
                  </button>
                </div>
              )}
            </SecaoCard>

            {/* Notificação / WhatsApp */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
                Contato via WhatsApp
              </p>

              {/* Status automático */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl mb-3 overflow-hidden">
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
                  borderless
                />
              </div>

              {/* Botões de mensagem */}
              {reserva.whatsappCliente ? (
                <BotoesWhatsApp
                  reserva={reserva}
                  tipoPagamento={tipoPagamento}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 text-center">
                  <p className="text-slate-500 text-sm">
                    Número de WhatsApp não informado pelo cliente.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
