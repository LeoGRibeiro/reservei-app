/**
 * Painel Administrativo de Gerenciamento do Programa de Fidelidade.
 * Permite ao gestor da arena configurar parâmetros da campanha (horas necessárias,
 * validade em meses, prazo do voucher), acompanhar métricas de retenção (LTV)
 * e inspecionar todos os vouchers e selos emitidos no sistema.
 *
 * No topo, a fila {@link FilaHorasGratis}: horas grátis que bateram a meta e esperam o dono (ou
 * gerente) liberar ou recusar (SPEC/2026-11-02-admin-ajustes-demo.md §10).
 */

"use client";

import { useContext, useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Save,
  TrendingUp,
  Ticket,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { formatarMoeda, formatarDataExibicao } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFidelidadeService } from "@/hooks/useFidelidadeService";
import {
  fetchTodosVouchersAdminSupabase,
  fetchTodosSelosAdminSupabase,
} from "@/lib/supabase/fidelidadeService";
import type { VoucherFidelidade, SeloFidelidade } from "@/lib/fidelidade/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import Link from "next/link";
import { hrefReserva } from "@/lib/admin/navegacao";
import { Botao, CabecalhoPagina } from "@/components/admin/ui";
import { chamarApi } from "@/lib/api/clienteApi";
import { ContextoPainel } from "@/components/admin/painel/ContextoPainel";
import { FilaHorasGratis, type Decisao } from "./fidelidade/FilaHorasGratis";

/** Status do voucher com nome de negócio. */
const ROTULO_STATUS_VOUCHER: Record<string, string> = {
  em_analise: "Em análise",
  disponivel: "Liberada",
  recusado: "Recusada",
  utilizado: "Usada",
  expirado: "Vencida",
};

export function AdminFidelidadePage() {
  const { campanha, atualizarCampanha, carregando } = useFidelidadeService();
  const painel = useContext(ContextoPainel);

  // Estados locais para edição das configurações
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [horasNecessarias, setHorasNecessarias] = useState<number>(12);
  const [mesesValidade, setMesesValidade] = useState<number>(3);
  const [diasValidadeVoucher, setDiasValidadeVoucher] = useState<number>(60);
  const [ativo, setAtivo] = useState<boolean>(true);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Estados de listagens globais
  const [todosVouchers, setTodosVouchers] = useState<VoucherFidelidade[]>([]);
  const [todosSelos, setTodosSelos] = useState<SeloFidelidade[]>([]);
  const [carregandoListas, setCarregandoListas] = useState(true);
  // Nome de cada atleta (conta) para as tabelas: nunca mostrar ids internos ao dono
  const [nomes, setNomes] = useState<Record<string, string>>({});

  // Filtros
  const [buscaVoucher, setBuscaVoucher] = useState("");
  const [filtroStatusVoucher, setFiltroStatusVoucher] = useState<string>("todos");
  const [abaAtual, setAbaAtual] = useState<"configuracao" | "vouchers" | "metricas">("metricas");

  // Inicializa dados do formulário quando campanha carrega
  const [campanhaCarregada, setCampanhaCarregada] = useState(campanha);
  if (campanha && campanha !== campanhaCarregada) {
    setCampanhaCarregada(campanha);
    setNomeCampanha(campanha.nome);
    setHorasNecessarias(campanha.horasNecessarias);
    setMesesValidade(campanha.mesesValidade);
    setDiasValidadeVoucher(campanha.diasValidadeVoucher);
    setAtivo(campanha.ativo);
  }

  // Carrega todos os vouchers e selos do sistema
  const carregarDadosGlobais = async () => {
    setCarregandoListas(true);
    try {
      const [vouchersData, selosData] = await Promise.all([
        fetchTodosVouchersAdminSupabase(),
        fetchTodosSelosAdminSupabase(),
      ]);
      setTodosVouchers(vouchersData);
      setTodosSelos(selosData);
      const ids = [...new Set([...vouchersData.map((v) => v.usuarioId), ...selosData.map((s) => s.usuarioId)])].filter(Boolean);
      if (ids.length > 0 && isSupabaseConfigured()) {
        const { data } = await supabase.from("usuarios").select("id, auth_user_id, nome").or(`id.in.(${ids.join(",")}),auth_user_id.in.(${ids.join(",")})`);
        const mapa: Record<string, string> = {};
        for (const u of (data ?? []) as { id: string; auth_user_id: string | null; nome: string }[]) {
          mapa[u.id] = u.nome;
          if (u.auth_user_id) mapa[u.auth_user_id] = u.nome;
        }
        setNomes(mapa);
      }
    } catch (err) {
      console.error("[AdminFidelidadePage] Erro ao carregar dados administrativos:", err);
      toast.error("Erro ao carregar dados do programa.");
    } finally {
      setCarregandoListas(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(carregarDadosGlobais);
  }, []);

  // ── Salvar Configurações ──────────────────────────────────────────────────

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomeCampanha.trim()) {
      toast.error("O nome da campanha é obrigatório.");
      return;
    }

    if (horasNecessarias < 1 || horasNecessarias > 100) {
      toast.error("A meta de horas deve estar entre 1 e 100.");
      return;
    }

    if (mesesValidade < 1 || mesesValidade > 12) {
      toast.error("A validade em meses deve estar entre 1 e 12 meses.");
      return;
    }

    if (diasValidadeVoucher < 5 || diasValidadeVoucher > 365) {
      toast.error("A validade do voucher deve estar entre 5 e 365 dias.");
      return;
    }

    setSalvandoConfig(true);
    try {
      const ok = await atualizarCampanha({
        nome: nomeCampanha.trim(),
        horasNecessarias,
        mesesValidade,
        diasValidadeVoucher,
        ativo,
      });

      if (ok) {
        toast.success("Configurações do programa de fidelidade salvas com sucesso!");
      } else {
        toast.error("Erro ao salvar configurações.");
      }
    } finally {
      setSalvandoConfig(false);
    }
  };

  // ── Métricas Computadas ───────────────────────────────────────────────────

  const metricas = useMemo(() => {
    const totalVouchersEmitidos = todosVouchers.length;
    const vouchersUtilizados = todosVouchers.filter((v) => v.status === "utilizado");
    const vouchersDisponiveis = todosVouchers.filter((v) => v.status === "disponivel");
    const vouchersExpirados = todosVouchers.filter((v) => v.status === "expirado");

    const totalHorasAcumuladas = todosSelos.reduce(
      (acc, s) => acc + (s.horasContabilizadas || 1),
      0
    );

    const valorTotalDescontosConcedidos = vouchersUtilizados.reduce(
      (acc, v) => acc + (Number(v.valorTeto) || 0),
      0
    );

    const taxaResgate =
      totalVouchersEmitidos > 0
        ? Math.round((vouchersUtilizados.length / totalVouchersEmitidos) * 100)
        : 0;

    // Clientes únicos participantes
    const usuariosUnicos = new Set(todosSelos.map((s) => s.usuarioId)).size;

    return {
      totalVouchersEmitidos,
      vouchersUtilizados: vouchersUtilizados.length,
      vouchersDisponiveis: vouchersDisponiveis.length,
      vouchersExpirados: vouchersExpirados.length,
      totalHorasAcumuladas,
      valorTotalDescontosConcedidos,
      taxaResgate,
      usuariosUnicos,
    };
  }, [todosVouchers, todosSelos]);

  // Vouchers filtrados para tabela
  const vouchersFiltrados = useMemo(() => {
    return todosVouchers.filter((v) => {
      const matchBusca =
        !buscaVoucher ||
        v.codigo.toLowerCase().includes(buscaVoucher.toLowerCase()) ||
        v.usuarioId.toLowerCase().includes(buscaVoucher.toLowerCase());

      const matchStatus =
        filtroStatusVoucher === "todos" || v.status === filtroStatusVoucher;

      return matchBusca && matchStatus;
    });
  }, [todosVouchers, buscaVoucher, filtroStatusVoucher]);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Fidelidade"
        descricao="O Clube da arena: horas jogadas viram selos e os selos viram horas grátis."
        acoes={
          <Botao variante="secundario" tamanho="sm" icone={RefreshCw} onClick={carregarDadosGlobais} carregando={carregandoListas}>
            Atualizar
          </Botao>
        }
      />

      <FilaHorasGratis
        pedidos={todosVouchers.filter((v) => v.status === "em_analise")}
        selos={todosSelos}
        nomeAtleta={(id) => nomes[id] ?? "Atleta"}
        aoDecidir={async (voucherId: string, decisao: Decisao) => {
          const r = await chamarApi<{ voucher: VoucherFidelidade }>(`/api/admin/fidelidade/vouchers/${encodeURIComponent(voucherId)}`, {
            method: "POST",
            corpo: { arenaSlug: painel?.arenaSlug ?? "", ...decisao },
          });
          if (!r.ok) return r.erro ?? "Não foi possível salvar a decisão.";
          await carregarDadosGlobais();
          return null;
        }}
      />

      {/* ── Cards de Métricas Principais ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-painel-suave">Horas Acumuladas</span>
            <Clock className="w-4 h-4 text-painel-destaque" />
          </div>
          <p className="text-2xl font-semibold text-painel-tinta">{metricas.totalHorasAcumuladas}h</p>
          <p className="text-xs text-painel-suave mt-1">
            {metricas.usuariosUnicos} jogador(es) ativos na cartela
          </p>
        </div>

        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-painel-suave">Vouchers Emitidos</span>
            <Ticket className="w-4 h-4 text-teal-700" />
          </div>
          <p className="text-2xl font-semibold text-painel-tinta">{metricas.totalVouchersEmitidos}</p>
          <p className="text-xs text-teal-700 mt-1">
            {metricas.vouchersDisponiveis} pronto(s) para uso
          </p>
        </div>

        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-painel-suave">Taxa de Resgate</span>
            <TrendingUp className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-2xl font-semibold text-painel-tinta">{metricas.taxaResgate}%</p>
          <p className="text-xs text-painel-suave mt-1">
            {metricas.vouchersUtilizados} voucher(s) utilizados
          </p>
        </div>

        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-painel-suave">Descontos Aplicados</span>
            <Sparkles className="w-4 h-4 text-purple-700" />
          </div>
          <p className="text-2xl font-semibold text-painel-tinta">
            {formatarMoeda(metricas.valorTotalDescontosConcedidos)}
          </p>
          <p className="text-xs text-painel-suave mt-1">Recompensa convertida em jogos</p>
        </div>
      </div>

      {/* ── Navegação por Abas ──────────────────────────────────────────────── */}
      <div className="flex border-b border-painel-linha gap-6 text-sm font-semibold">
        <button
          onClick={() => setAbaAtual("metricas")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            abaAtual === "metricas"
              ? "border-emerald-400 text-painel-destaque"
              : "border-transparent text-painel-suave hover:text-painel-tinta"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Visão Geral & Selos
        </button>

        <button
          onClick={() => setAbaAtual("vouchers")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            abaAtual === "vouchers"
              ? "border-emerald-400 text-painel-destaque"
              : "border-transparent text-painel-suave hover:text-painel-tinta"
          }`}
        >
          <Ticket className="w-4 h-4" />
          Vouchers Emitidos ({todosVouchers.length})
        </button>

        <button
          onClick={() => setAbaAtual("configuracao")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            abaAtual === "configuracao"
              ? "border-emerald-400 text-painel-destaque"
              : "border-transparent text-painel-suave hover:text-painel-tinta"
          }`}
        >
          <Save className="w-4 h-4" />
          Configuração da Campanha
        </button>
      </div>

      {/* ── Conteúdo da Aba: Configuração ───────────────────────────────────── */}
      {abaAtual === "configuracao" && (
        <div className="bg-painel-superficie border border-painel-linha rounded-3xl p-6 sm:p-8 max-w-3xl">
          <div className="mb-6">
            <h3 className="text-base font-bold text-painel-tinta">Regras da Campanha de Fidelidade</h3>
            <p className="text-xs text-painel-suave mt-1">
              Defina os parâmetros de horas, prazos de validade e comportamento da premiação.
            </p>
          </div>

          <form onSubmit={handleSalvarConfig} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nomeCampanha" className="text-xs font-bold text-painel-tinta">
                Nome da Campanha
              </Label>
              <Input
                id="nomeCampanha"
                value={nomeCampanha}
                onChange={(e) => setNomeCampanha(e.target.value)}
                placeholder="Ex: Fidelidade Campeão"
                className="bg-painel-superficie border-painel-linha text-painel-tinta"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="horasNecessarias" className="text-xs font-bold text-painel-tinta">
                  Horas Necessárias (Meta)
                </Label>
                <div className="relative">
                  <Input
                    id="horasNecessarias"
                    type="number"
                    min="1"
                    max="100"
                    value={horasNecessarias}
                    onChange={(e) => setHorasNecessarias(Number(e.target.value))}
                    className="bg-painel-superficie border-painel-linha text-painel-tinta pr-8"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-painel-suave font-bold">h</span>
                </div>
                <p className="text-xs text-painel-suave">Padrão alinhado: 12 horas</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mesesValidade" className="text-xs font-bold text-painel-tinta">
                  Janela da Cartela
                </Label>
                <div className="relative">
                  <Input
                    id="mesesValidade"
                    type="number"
                    min="1"
                    max="12"
                    value={mesesValidade}
                    onChange={(e) => setMesesValidade(Number(e.target.value))}
                    className="bg-painel-superficie border-painel-linha text-painel-tinta pr-14"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-painel-suave font-bold">
                    meses
                  </span>
                </div>
                <p className="text-xs text-painel-suave">Padrão alinhado: 3 meses</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diasValidadeVoucher" className="text-xs font-bold text-painel-tinta">
                  Validade do Voucher
                </Label>
                <div className="relative">
                  <Input
                    id="diasValidadeVoucher"
                    type="number"
                    min="5"
                    max="365"
                    value={diasValidadeVoucher}
                    onChange={(e) => setDiasValidadeVoucher(Number(e.target.value))}
                    className="bg-painel-superficie border-painel-linha text-painel-tinta pr-12"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-painel-suave font-bold">
                    dias
                  </span>
                </div>
                <p className="text-xs text-painel-suave">Prazo para utilizar o prêmio</p>
              </div>
            </div>

            {/* Switch Ativo / Inativo */}
            <div className="p-4 rounded-lg bg-painel-superficie border border-painel-linha flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-painel-tinta">Programa de Fidelidade Ativo</p>
                <p className="text-xs text-painel-suave mt-0.5">
                  Quando ativo, novas reservas concluídas acumulam selos e geram vouchers
                  automaticamente.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-painel-elevada peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-painel-destaque" />
              </label>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={salvandoConfig || carregando}
                className="bg-painel-destaque hover:bg-painel-destaque-forte text-white font-bold px-6 h-11 rounded-md gap-2"
              >
                <Save className="w-4 h-4" />
                {salvandoConfig ? "Salvando Alterações..." : "Salvar Configurações"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Conteúdo da Aba: Tabela de Vouchers ───────────────────────────────── */}
      {abaAtual === "vouchers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-painel-suave absolute left-3 top-3" />
              <Input
                placeholder="Buscar código ou usuário..."
                value={buscaVoucher}
                onChange={(e) => setBuscaVoucher(e.target.value)}
                className="pl-9 bg-painel-superficie border-painel-linha text-xs text-painel-tinta"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Filter className="w-4 h-4 text-painel-suave" />
              <select
                value={filtroStatusVoucher}
                onChange={(e) => setFiltroStatusVoucher(e.target.value)}
                className="bg-painel-superficie border border-painel-linha text-painel-tinta rounded-md px-3 py-2 text-xs focus:outline-none"
              >
                <option value="todos">Todos os Status</option>
                <option value="em_analise">Em análise</option>
                <option value="disponivel">Liberada</option>
                <option value="recusado">Recusada</option>
                <option value="utilizado">Usada</option>
                <option value="expirado">Vencida</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-painel-linha bg-painel-superficie">
            <table className="w-full text-left text-xs text-painel-tinta">
              <thead className="bg-painel-superficie text-painel-suave font-medium text-xs border-b border-painel-linha">
                <tr>
                  <th className="py-3 px-4">Código Voucher</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Teto Desconto</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Criado Em</th>
                  <th className="py-3 px-4">Validade</th>
                  <th className="py-3 px-4">Reserva Usada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-painel-linha">
                {vouchersFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-painel-suave">
                      Nenhum voucher encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  vouchersFiltrados.map((v) => (
                    <tr key={v.id} className="hover:bg-painel-elevada transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-painel-destaque">
                        {v.codigo}
                      </td>
                      <td className="py-3.5 px-4 text-painel-tinta">
                        <span className="truncate block max-w-[180px]">{nomes[v.usuarioId] ?? "Atleta"}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-painel-tinta">
                        {formatarMoeda(v.valorTeto)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            v.status === "disponivel"
                              ? "bg-painel-destaque-suave text-painel-destaque border border-painel-destaque"
                              : v.status === "em_analise"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : v.status === "utilizado"
                              ? "bg-painel-elevada text-painel-suave"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {ROTULO_STATUS_VOUCHER[v.status] ?? v.status}
                        </span>
                        {v.status === "recusado" && v.motivoAnalise && <span className="mt-1 block text-xs text-painel-suave">{v.motivoAnalise}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-painel-suave">
                        {formatarDataExibicao(v.criadoEm.split("T")[0])}
                      </td>
                      <td className="py-3.5 px-4 text-painel-suave">
                        {formatarDataExibicao(v.expiraEm)}
                      </td>
                      <td className="py-3.5 px-4 text-painel-suave">
                        {v.reservaUtilizadaId ? (
                          <span className="font-mono text-xs text-teal-700">
                            #{v.reservaUtilizadaId.substring(0, 8)}
                          </span>
                        ) : (
                          <span className="text-painel-apagada">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Conteúdo da Aba: Visão Geral e Selos Recentes ───────────────────── */}
      {abaAtual === "metricas" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-painel-linha bg-painel-superficie p-6">
            <h3 className="text-base font-bold text-painel-tinta mb-2">
              Últimos Selos de Horas Registrados
            </h3>
            <p className="text-xs text-painel-suave mb-4">
              Cada selo representa horas jogadas em reservas avulsas concluídas e pagas.
            </p>

            <div className="overflow-x-auto rounded-lg border border-painel-linha">
              <table className="w-full text-left text-xs text-painel-tinta">
                <thead className="bg-painel-superficie text-painel-suave font-medium text-xs border-b border-painel-linha">
                  <tr>
                    <th className="py-3 px-4">Atleta</th>
                    <th className="py-3 px-4">Reserva</th>
                    <th className="py-3 px-4">Horas</th>
                    <th className="py-3 px-4">Valor / Hora</th>
                    <th className="py-3 px-4">Data do Jogo</th>
                    <th className="py-3 px-4">Expiração do Selo</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-painel-linha">
                  {todosSelos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-painel-suave">
                        Nenhum selo registrado ainda. Os selos são gerados automaticamente quando
                        reservas avulsas são concluídas.
                      </td>
                    </tr>
                  ) : (
                    todosSelos.slice(0, 15).map((selo) => (
                      <tr key={selo.id} className="hover:bg-painel-elevada transition-colors">
                        <td className="py-3.5 px-4 text-painel-tinta truncate max-w-[180px]">{nomes[selo.usuarioId] ?? "Atleta"}</td>
                        <td className="py-3.5 px-4">
                          <Link href={hrefReserva(selo.reservaId)} className="text-painel-destaque hover:underline">
                            Abrir reserva
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-painel-tinta">
                          {selo.horasContabilizadas}h
                        </td>
                        <td className="py-3.5 px-4">{formatarMoeda(selo.valorPorHora)}</td>
                        <td className="py-3.5 px-4 text-painel-suave">
                          {formatarDataExibicao(selo.dataJogo)}
                        </td>
                        <td className="py-3.5 px-4 text-painel-suave">
                          {formatarDataExibicao(selo.expiraEm)}
                        </td>
                        <td className="py-3.5 px-4">
                          {selo.resgatado ? (
                            <span className="text-teal-700 font-semibold text-xs">
                              Resgatado em Voucher
                            </span>
                          ) : (
                            <span className="text-painel-destaque font-semibold text-xs">
                              Ativo na Cartela
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
