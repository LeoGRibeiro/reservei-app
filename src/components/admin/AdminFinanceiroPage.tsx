"use client";

import { useMemo, useState } from "react";
import {
  CircleDollarSign,
  TrendingUp,
  Clock,
  CalendarDays,
  Gift,
  Ticket,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

import { useReservasService } from "@/hooks/useReservasService";
import { descreverQuadra } from "@/store/useCatalogoArenaStore";
import { formatarMoeda, formatarDataExibicao } from "@/lib/constants";
import { getTelefonesCadastradosLocal } from "@/lib/supabase/authService";
import type { Reserva } from "@/store/useReservasStore";

/**
 * Formata data no formato DD/MM para gráficos e resumos.
 */
function formatarDiaMes(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

/**
 * Página Financeira Administrativa
 * Apresenta a auditoria completa de fluxo financeiro, distinguindo receita em dinheiro/Pix,
 * abatimentos de fidelidade (vouchers de gratuidade e desconto), faturamento bruto de tabela
 * e saldos pendentes no balcão.
 */
export function AdminFinanceiroPage() {
  const { reservas, financeiro } = useReservasService();
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "fidelidade" | "gratis" | "pix" | "recorrentes">("todas");
  const [buscaTexto, setBuscaTexto] = useState("");

  // Métricas agregadas de Fidelidade
  const metricasFidelidade = useMemo(() => {
    const reservasComFidelidade = reservas.filter(
      (r) =>
        r.status !== "cancelada" &&
        ((r.descontoFidelidade && r.descontoFidelidade > 0) ||
          r.reservaGratuitaFidelidade ||
          (r.vouchersUtilizados && r.vouchersUtilizados.length > 0))
    );

    const totalVouchersAplicados = reservasComFidelidade.reduce(
      (acc, r) => acc + (r.vouchersUtilizados ? r.vouchersUtilizados.length : 1),
      0
    );

    const reservasTotalmenteGratuitas = reservasComFidelidade.filter(
      (r) =>
        r.reservaGratuitaFidelidade ||
        r.metodoPagamento === "fidelidade" ||
        (r.valorTotal === 0 &&
          Boolean(
            (r.descontoFidelidade && r.descontoFidelidade > 0) ||
              (r.vouchersUtilizados && r.vouchersUtilizados.length > 0)
          ))
    ).length;

    return {
      qtdReservasComFidelidade: reservasComFidelidade.length,
      totalVouchersAplicados,
      reservasTotalmenteGratuitas,
    };
  }, [reservas]);

  // Evolução dos últimos 7 dias
  const dadosUltimosDias = useMemo(() => {
    const hoje = new Date();

    const dias = Array.from({ length: 7 }, (_, index) => {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - (6 - index));

      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      const dia = String(data.getDate()).padStart(2, "0");

      return `${ano}-${mes}-${dia}`;
    });

    return dias.map((data) => {
      const reservasDoDia = reservas.filter(
        (reserva) => reserva.data === data && reserva.status !== "cancelada"
      );

      const recebido = reservasDoDia.reduce(
        (total, reserva) => total + (Number(reserva.valorSinal) || 0),
        0
      );

      const previsto = reservasDoDia.reduce(
        (total, reserva) => total + (Number(reserva.valorTotal) || 0),
        0
      );

      const descontoFidelidade = reservasDoDia.reduce(
        (total, reserva) => total + (Number(reserva.descontoFidelidade) || 0),
        0
      );

      const bruto = reservasDoDia.reduce((total, reserva) => {
        const orig =
          reserva.valorOriginal !== undefined && !isNaN(Number(reserva.valorOriginal)) && Number(reserva.valorOriginal) > 0
            ? Number(reserva.valorOriginal)
            : (Number(reserva.valorTotal) || 0) + (Number(reserva.descontoFidelidade) || 0);
        return total + (isNaN(orig) ? 0 : orig);
      }, 0);

      return {
        data,
        recebido,
        previsto,
        descontoFidelidade,
        bruto,
      };
    });
  }, [reservas]);

  const maiorValor = Math.max(
    ...dadosUltimosDias.map((dia) => dia.bruto || dia.previsto),
    1
  );

  // Totais por quadra (bruto e líquido)
  const reservasPorQuadra = useMemo(() => {
    const resultado: Record<string, { liquido: number; bruto: number; desconto: number }> = {};

    reservas
      .filter((reserva) => reserva.status !== "cancelada")
      .forEach((reserva) => {
        const desc = Number(reserva.descontoFidelidade) || 0;
        const bruto =
          reserva.valorOriginal !== undefined && !isNaN(Number(reserva.valorOriginal)) && Number(reserva.valorOriginal) > 0
            ? Number(reserva.valorOriginal)
            : (Number(reserva.valorTotal) || 0) + desc;

        if (!resultado[reserva.quadraId]) {
          resultado[reserva.quadraId] = { liquido: 0, bruto: 0, desconto: 0 };
        }

        resultado[reserva.quadraId].liquido += Number(reserva.valorTotal) || 0;
        resultado[reserva.quadraId].bruto += isNaN(bruto) ? 0 : bruto;
        resultado[reserva.quadraId].desconto += desc;
      });

    return Object.entries(resultado).sort((a, b) => b[1].bruto - a[1].bruto);
  }, [reservas]);

  // Lista filtrada para auditoria
  const reservasFiltradas = useMemo(() => {
    return reservas
      .filter((r) => r.status !== "cancelada")
      .filter((r) => {
        const isRecorrente = Boolean(
          r.contratoId ||
          r.tipoReserva === "escolinha" ||
          r.tipoReserva === "grupo"
        );
        const temFidelidade = Boolean(
          !isRecorrente &&
          ((r.descontoFidelidade && r.descontoFidelidade > 0) ||
            r.reservaGratuitaFidelidade ||
            (r.vouchersUtilizados && r.vouchersUtilizados.length > 0))
        );
        const ehGratisFidelidade = Boolean(
          !isRecorrente &&
          (r.reservaGratuitaFidelidade ||
            r.metodoPagamento === "fidelidade" ||
            (temFidelidade && r.valorTotal === 0))
        );

        if (filtroTipo === "fidelidade") return temFidelidade;
        if (filtroTipo === "gratis") return ehGratisFidelidade;
        if (filtroTipo === "pix") return !temFidelidade && !isRecorrente;
        if (filtroTipo === "recorrentes") return isRecorrente;
        return true;
      })
      .filter((r) => {
        if (!buscaTexto.trim()) return true;
        const q = buscaTexto.toLowerCase();
        const nome = (r.nomeCliente || "").toLowerCase();
        const tel = (r.whatsappCliente || "").replace(/\D/g, "");
        const vouchers = (r.vouchersUtilizados || []).join(" ").toLowerCase();
        return nome.includes(q) || tel.includes(q) || vouchers.includes(q) || r.id.toLowerCase().includes(q);
      })
      .sort((a, b) => b.data.localeCompare(a.data) || b.horaInicio.localeCompare(a.horaInicio));
  }, [reservas, filtroTipo, buscaTexto]);

  const cardsKpi = [
    {
      titulo: "Total Arrecadado Líquido",
      valor: financeiro.totalConfirmado,
      descricao: "Recebido em dinheiro / Pix confirmado",
      icon: CircleDollarSign,
      cor: "emerald",
      badge: "Caixa / Pix",
    },
    {
      titulo: "Faturamento Bruto em Quadras",
      valor: financeiro.totalBrutoQuadras,
      descricao: "Valor integral de tabela dos horários",
      icon: TrendingUp,
      cor: "sky",
      badge: "Tabela Bruta",
    },
    {
      titulo: "Abatimentos por Fidelidade",
      valor: financeiro.totalDescontoFidelidade,
      descricao: `${metricasFidelidade.qtdReservasComFidelidade} reservas com voucher (${metricasFidelidade.reservasTotalmenteGratuitas} gratuitas)`,
      icon: Gift,
      cor: "purple",
      badge: "Vouchers Fidelidade",
    },
    {
      titulo: "Saldo Pendente no Balcão",
      valor: financeiro.pendenteSinalConfirmado,
      descricao: "A receber presencialmente na entrada",
      icon: Clock,
      cor: "amber",
      badge: "Balcão (60%)",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            Financeiro & Fidelidade
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              Auditoria em Tempo Real
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão transparente de faturamento, liquidações Pix e subsídios concedidos pelo programa de fidelidade.
          </p>
        </div>
      </div>

      {/* ── Cards KPIs ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardsKpi.map((card) => {
          const Icon = card.icon;
          const bgMap: Record<string, string> = {
            emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
            sky: "bg-sky-500/10 border-sky-500/20 text-sky-400",
            purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
            amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
          };

          return (
            <div
              key={card.titulo}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bgMap[card.cor]}`}>
                    {card.badge}
                  </span>
                  <p className="text-sm text-slate-400 mt-2">{card.titulo}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatarMoeda(card.valor)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{card.descricao}</p>
                </div>

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bgMap[card.cor]}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Grid: Gráficos de Evolução e Quadras ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico dos Últimos 7 Dias */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-sky-400" />
              <div>
                <h2 className="text-base font-semibold text-white">
                  Evolução Financeira (Últimos 7 dias)
                </h2>
                <p className="text-xs text-slate-500">
                  Comparativo entre faturamento líquido e abatimentos de vouchers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Recebido Pix
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                Voucher Fidelidade
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {dadosUltimosDias.map((dia) => {
              const percRecebido = Math.max((dia.recebido / maiorValor) * 100, dia.recebido > 0 ? 3 : 0);
              const percDesconto = Math.max((dia.descontoFidelidade / maiorValor) * 100, dia.descontoFidelidade > 0 ? 3 : 0);

              return (
                <div key={dia.data} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">
                      {formatarDiaMes(dia.data)}
                    </span>
                    <div className="flex items-center gap-3">
                      {dia.descontoFidelidade > 0 && (
                        <span className="text-purple-400 font-medium">
                          🎁 -{formatarMoeda(dia.descontoFidelidade)}
                        </span>
                      )}
                      <span className="text-emerald-400 font-bold">
                        {formatarMoeda(dia.recebido)}
                      </span>
                    </div>
                  </div>

                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 rounded-l-full transition-all"
                      style={{ width: `${percRecebido}%` }}
                      title={`Recebido: ${formatarMoeda(dia.recebido)}`}
                    />
                    <div
                      className="h-full bg-purple-500 rounded-r-full transition-all opacity-80"
                      style={{ width: `${percDesconto}%` }}
                      title={`Voucher Fidelidade: ${formatarMoeda(dia.descontoFidelidade)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Faturamento por Quadra */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Valores por Quadra</h2>
            <p className="text-xs text-slate-500 mt-1">
              Desempenho bruto vs. líquido de cada espaço
            </p>
          </div>

          {reservasPorQuadra.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma reserva registrada.</p>
          ) : (
            <div className="space-y-4">
              {reservasPorQuadra.map(([quadraId, vals]) => {
                const nomeQuadra = descreverQuadra(quadraId);
                return (
                  <div
                    key={quadraId}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        {nomeQuadra}
                      </span>
                      <span className="text-sm font-bold text-emerald-400">
                        {formatarMoeda(vals.liquido)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Valor Tabela (Bruto):</span>
                      <span className="font-mono">{formatarMoeda(vals.bruto)}</span>
                    </div>

                    {vals.desconto > 0 && (
                      <div className="flex items-center justify-between text-xs text-purple-400">
                        <span className="flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Abatimentos:
                        </span>
                        <span className="font-mono">-{formatarMoeda(vals.desconto)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Extrato e Auditoria Detalhada de Reservas ───────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-purple-400" />
              Auditoria Financeira & Vouchers
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Registro contábil de todas as reservas, discriminando tabela bruta, abatimentos concedidos e saldo em caixa.
            </p>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Campo de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente ou voucher..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-56"
              />
            </div>

            {/* Abas de filtro */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setFiltroTipo("todas")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  filtroTipo === "todas"
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("fidelidade")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  filtroTipo === "fidelidade"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎁 Com Fidelidade
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("gratis")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  filtroTipo === "gratis"
                    ? "bg-purple-700 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎉 100% Fidelidade
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("pix")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  filtroTipo === "pix"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Pix Comum
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("recorrentes")}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  filtroTipo === "recorrentes"
                    ? "bg-amber-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ⚽ Recorrentes
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Auditoria */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-700/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Agendamento</th>
                <th className="py-3 px-4">Valor Tabela</th>
                <th className="py-3 px-4">Desconto Fidelidade</th>
                <th className="py-3 px-4">Valor Líquido</th>
                <th className="py-3 px-4">Método / Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
              {reservasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma reserva encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                reservasFiltradas.map((r) => {
                  const desc = Number(r.descontoFidelidade) || 0;
                  const isRecorrente = Boolean(
                    r.contratoId ||
                    r.tipoReserva === "escolinha" ||
                    r.tipoReserva === "grupo"
                  );
                  const temFidelidade = Boolean(
                    !isRecorrente &&
                    (desc > 0 ||
                      r.reservaGratuitaFidelidade ||
                      (r.vouchersUtilizados && r.vouchersUtilizados.length > 0))
                  );
                  const ehGratisFidelidade = Boolean(
                    !isRecorrente &&
                    (r.reservaGratuitaFidelidade ||
                      r.metodoPagamento === "fidelidade" ||
                      (temFidelidade && r.valorTotal === 0))
                  );

                  const valorBruto =
                    r.valorOriginal !== undefined && !isNaN(Number(r.valorOriginal)) && Number(r.valorOriginal) > 0
                      ? Number(r.valorOriginal)
                      : temFidelidade
                      ? (Number(r.valorTotal) || 0) + desc
                      : Number(r.valorTotal) || 0;

                  const telDigits = r.whatsappCliente ? r.whatsappCliente.replace(/\D/g, "") : "";
                  const isMembro = Boolean(
                    r.userId || (telDigits && getTelefonesCadastradosLocal().has(telDigits))
                  );

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                            {r.nomeCliente || "Cliente Avulso"}
                          </span>
                          {isMembro && !isRecorrente && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ⭐ Membro
                            </span>
                          )}
                          {isRecorrente && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {r.tipoReserva === "escolinha" ? "⚽ Escolinha" : "👥 Mensalista"}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {r.whatsappCliente || "Sem contato"}
                        </p>
                      </td>

                      {/* Agendamento */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-200">
                          {descreverQuadra(r.quadraId)} · {formatarDiaMes(r.data)}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {r.horaInicio} – {r.horaFim}
                        </p>
                      </td>

                      {/* Valor Tabela */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-300 whitespace-nowrap">
                        {formatarMoeda(valorBruto)}
                      </td>

                      {/* Desconto Fidelidade */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {temFidelidade && (desc > 0 || ehGratisFidelidade) ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              <Gift className="w-3 h-3" />
                              -{formatarMoeda(desc > 0 ? desc : valorBruto)}
                            </span>
                            {r.vouchersUtilizados && r.vouchersUtilizados.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {r.vouchersUtilizados.map((c) => (
                                  <span
                                    key={c}
                                    className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1 rounded border border-slate-700"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Valor Líquido */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-mono font-bold ${
                            ehGratisFidelidade ? "text-purple-400" : "text-emerald-400"
                          }`}
                        >
                          {ehGratisFidelidade ? "R$ 0,00" : formatarMoeda(r.valorTotal)}
                        </span>
                        {r.valorPendente > 0 && (
                          <p className="text-[10px] text-amber-400 mt-0.5">
                            Resta {formatarMoeda(r.valorPendente)} no balcão
                          </p>
                        )}
                      </td>

                      {/* Método / Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              ehGratisFidelidade
                                ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                : r.metodoPagamento === "misto"
                                ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                                : isRecorrente
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : r.valorTotal === 0
                                ? "bg-slate-800 text-slate-300 border-slate-700"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {ehGratisFidelidade
                              ? "🎁 100% Fidelidade"
                              : r.metodoPagamento === "misto"
                              ? "🎁 Misto (Pix + Voucher)"
                              : isRecorrente
                              ? r.tipoReserva === "escolinha"
                                ? "⚽ Escolinha"
                                : "👥 Mensalista"
                              : r.valorTotal === 0
                              ? "🆓 Cortesia"
                              : "Pix"}
                          </span>
                          <span
                            className={`block text-[10px] font-medium ${
                              isRecorrente
                                ? "text-amber-400"
                                : r.status === "confirmada"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {isRecorrente
                              ? "Contrato Mensal"
                              : r.status === "confirmada"
                              ? "✓ Liquidada"
                              : "Pendente Balcão"}
                          </span>
                        </div>
                      </td>

                      {/* Ação */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <a
                          href={`/admin/reserva/${r.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                        >
                          Detalhes
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
