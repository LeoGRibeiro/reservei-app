/**
 * AdminUsuariosPage — Gestão completa de Usuários Cadastrados.
 *
 * Funcionalidades:
 *  - Listagem de todos os usuários cadastrados (Supabase e local)
 *  - Busca instantânea por Nome ou WhatsApp
 *  - Indicadores e estatísticas de membros
 *  - Visualização de detalhes e todas as reservas vinculadas a cada usuário
 *  - Edição de dados do cliente (Nome, Telefone, Data de Nascimento)
 *  - Exclusão de conta (LGPD)
 *  - Contato direto via WhatsApp (com mensagem personalizada)
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Phone,
  Calendar,
  MessageCircle,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  Cake,
  Clock,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Loader2,
  ChevronRight,
  TrendingUp,
  X,
  CheckCircle2,
  Ban,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarUsuariosCadastrados,
  atualizarPerfilSupabase,
  excluirContaSupabase,
  toggleBloqueioUsuario,
} from "@/lib/supabase/authService";
import type { UserProfile } from "@/lib/supabase/types";
import { useReservasService } from "@/hooks/useReservasService";
import {
  formatarMoeda,
  formatarDataExibicao,
  mascaraWhatsApp,
} from "@/lib/constants";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import type { Reserva } from "@/store/useReservasStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminUsuariosPage() {
  const quadrasCatalogo = useQuadrasCatalogo();
  const { reservas, recarregarReservas } = useReservasService();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  // Modais
  const [usuarioDetalhes, setUsuarioDetalhes] = useState<UserProfile | null>(null);
  const [usuarioEditar, setUsuarioEditar] = useState<UserProfile | null>(null);
  const [usuarioExcluir, setUsuarioExcluir] = useState<UserProfile | null>(null);
  const [usuarioBloqueio, setUsuarioBloqueio] = useState<UserProfile | null>(null);
  const [motivoBloqueio, setMotivoBloqueio] = useState("");
  const [alterandoBloqueio, setAlterandoBloqueio] = useState(false);

  // Estados dos formulários de edição
  const [nomeEdit, setNomeEdit] = useState("");
  const [telefoneEdit, setTelefoneEdit] = useState("");
  const [dataNascimentoEdit, setDataNascimentoEdit] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Carrega a lista de usuários cadastrados
  const carregarUsuarios = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listarUsuariosCadastrados();
      setUsuarios(lista);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      toast.error("Não foi possível carregar a lista de usuários.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarUsuarios();
  }, [carregarUsuarios]);

  // Mapa de reservas por usuário (agrupando por userId e pelo telefone em dígitos)
  const reservasPorUsuario = useMemo(() => {
    const mapa = new Map<string, Reserva[]>();

    for (const u of usuarios) {
      const uDigits = u.telefone.replace(/\D/g, "");
      const res = reservas.filter((r) => {
        if (r.userId && r.userId === u.id) return true;
        const rDigits = r.whatsappCliente ? r.whatsappCliente.replace(/\D/g, "") : "";
        return rDigits && rDigits === uDigits;
      });
      mapa.set(u.id, res);
    }

    return mapa;
  }, [usuarios, reservas]);

  // Usuários filtrados pela busca
  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;

    const termoDigits = termo.replace(/\D/g, "");

    return usuarios.filter((u) => {
      const nomeMatch = u.nome.toLowerCase().includes(termo);
      const telDigits = u.telefone.replace(/\D/g, "");
      const telMatch = termoDigits ? telDigits.includes(termoDigits) : false;
      return nomeMatch || telMatch;
    });
  }, [usuarios, busca]);

  // Estatísticas globais dos membros
  const stats = useMemo(() => {
    const totalUsuarios = usuarios.length;
    let usuariosComReservas = 0;
    let faturamentoTotal = 0;

    for (const u of usuarios) {
      const userRes = reservasPorUsuario.get(u.id) || [];
      if (userRes.length > 0) {
        usuariosComReservas++;
        for (const r of userRes) {
          if (r.status !== "cancelada") {
            faturamentoTotal += r.valorTotal;
          }
        }
      }
    }

    return {
      totalUsuarios,
      usuariosComReservas,
      faturamentoTotal,
    };
  }, [usuarios, reservasPorUsuario]);

  // Abre modal de edição
  const handleAbrirEdicao = (u: UserProfile) => {
    setUsuarioEditar(u);
    setNomeEdit(u.nome);
    setTelefoneEdit(u.telefone);
    setDataNascimentoEdit(u.dataNascimento || "");
  };

  // Salva alterações do usuário
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditar) return;

    if (!nomeEdit.trim() || nomeEdit.trim().length < 3) {
      toast.error("Informe um nome válido com pelo menos 3 caracteres.");
      return;
    }

    if (telefoneEdit.replace(/\D/g, "").length < 11) {
      toast.error("Informe um número de WhatsApp válido com DDD.");
      return;
    }

    setSalvando(true);
    try {
      const atualizado = await atualizarPerfilSupabase(usuarioEditar.id, {
        nome: nomeEdit.trim(),
        telefone: telefoneEdit,
        dataNascimento: dataNascimentoEdit || null,
      });

      if (atualizado) {
        toast.success("Dados do usuário atualizados com sucesso!");
        setUsuarioEditar(null);
        await carregarUsuarios();
        await recarregarReservas();
      } else {
        toast.error("Erro ao atualizar dados do usuário.");
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast.error("Falha ao salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  };


  const handleToggleBloqueio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioBloqueio) return;
    setAlterandoBloqueio(true);
    try {
      const novoStatus = !usuarioBloqueio.bloqueado;
      const success = await toggleBloqueioUsuario(
        usuarioBloqueio.id,
        novoStatus,
        motivoBloqueio,
        {
          nome: usuarioBloqueio.nome,
          telefone: usuarioBloqueio.telefone,
          dataNascimento: usuarioBloqueio.dataNascimento,
        }
      );
      if (success) {
        toast.success(novoStatus ? "Usuário bloqueado com sucesso." : "Usuário desbloqueado com sucesso.");
        await carregarUsuarios();
        setUsuarioBloqueio(null);
        setUsuarioDetalhes(null);
      } else {
        toast.error("Falha ao alterar bloqueio.");
      }
    } catch (err) {
      console.error("Erro ao alterar bloqueio:", err);
      toast.error("Falha ao alterar bloqueio.");
    } finally {
      setAlterandoBloqueio(false);
    }
  };

  // Exclui conta do usuário
  const handleConfirmarExclusao = async () => {
    if (!usuarioExcluir) return;

    setExcluindo(true);
    try {
      const ok = await excluirContaSupabase(usuarioExcluir.id);
      if (ok) {
        toast.success(`Conta de ${usuarioExcluir.nome} excluída com sucesso.`);
        setUsuarioExcluir(null);
        if (usuarioDetalhes?.id === usuarioExcluir.id) {
          setUsuarioDetalhes(null);
        }
        await carregarUsuarios();
        await recarregarReservas();
      } else {
        toast.error("Não foi possível excluir a conta.");
      }
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
      toast.error("Falha na exclusão da conta.");
    } finally {
      setExcluindo(false);
    }
  };

  // Link para contato via WhatsApp
  const gerarLinkWhatsApp = (u: UserProfile) => {
    const digits = u.telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${u.nome}, aqui é do Complexo Esportivo Reservei! Como podemos te ajudar?`
    );
    return `https://wa.me/55${digits}?text=${msg}`;
  };

  // Verifica se o usuário faz aniversário no mês atual
  const mesAtual = new Date().getMonth() + 1;
  const isAniversarianteMes = (dataNasc?: string | null) => {
    if (!dataNasc) return false;
    const parts = dataNasc.split("-");
    if (parts.length >= 2) {
      return parseInt(parts[1], 10) === mesAtual;
    }
    return false;
  };

  return (
    <div className="space-y-6">
      {/* ── Topo: Título e Ação de Atualização ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Usuários e Clientes
            </h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Consulte membros cadastrados, histórico de reservas, edite cadastros ou inicie contato via WhatsApp.
          </p>
        </div>

        <Button
          onClick={() => {
            carregarUsuarios();
            recarregarReservas();
            toast.info("Lista de usuários atualizada!");
          }}
          disabled={carregando}
          variant="outline"
          className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin text-emerald-400" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Cards de Estatísticas ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total de Usuários</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {stats.totalUsuarios}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Contas criadas no sistema
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Membros Ativos</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">
            {stats.usuariosComReservas}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Com pelo menos 1 reserva registrada
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Volume Movimentado</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {formatarMoeda(stats.faturamentoTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Total em reservas de membros
          </p>
        </div>
      </div>

      {/* ── Barra de Busca ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou número de WhatsApp..."
            className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 h-10 rounded-xl focus:border-emerald-500"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-medium px-2 text-right">
          {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? "usuário" : "usuários"}
        </div>
      </div>

      {/* ── Tabela de Usuários ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {carregando ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Carregando usuários cadastrados...</p>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-slate-300 font-bold text-base">
              {busca ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado ainda"}
            </p>
            <p className="text-slate-500 text-xs max-w-sm mx-auto mt-1">
              {busca
                ? "Tente buscar por outro termo ou limpe o campo de busca."
                : "Os usuários que criarem conta pelo portal ou após uma reserva aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-950/40">
                  <th className="py-3.5 px-4 sm:px-6">Usuário</th>
                  <th className="py-3.5 px-4">WhatsApp</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Nascimento</th>
                  <th className="py-3.5 px-4 text-center">Reservas</th>
                  <th className="py-3.5 px-4 text-right sm:pr-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {usuariosFiltrados.map((u) => {
                  const userRes = reservasPorUsuario.get(u.id) || [];
                  const qtdReservas = userRes.length;
                  const valorTotalGasto = userRes
                    .filter((r) => r.status !== "cancelada")
                    .reduce((acc, r) => acc + r.valorTotal, 0);

                  const aniversarioEsteMes = isAniversarianteMes(u.dataNascimento);

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Usuário (Avatar + Nome + Cadastro) */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-sm shadow-inner flex-shrink-0">
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                                {u.nome}
                              </span>
                              {u.bloqueado && (
                                <span
                                  title={u.motivo_bloqueio ? `Motivo: ${u.motivo_bloqueio}` : "Usuário bloqueado para reservas"}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30"
                                >
                                  <Ban className="w-3 h-3" /> Bloqueado
                                </span>
                              )}
                              {aniversarioEsteMes && (
                                <span
                                  title="Aniversariante deste mês!"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                >
                                  <Cake className="w-3 h-3" /> Niver
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {u.criadoEm
                                ? `Desde ${formatarDataExibicao(u.criadoEm.split("T")[0], { month: "short", year: "numeric" })}`
                                : "Cadastrado"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp com link rápido */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-300 text-xs">
                            {u.telefone}
                          </span>
                          <a
                            href={gerarLinkWhatsApp(u)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Conversar no WhatsApp"
                            className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 flex items-center justify-center transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Data de Nascimento */}
                      <td className="py-4 px-4 hidden md:table-cell text-xs text-slate-400 whitespace-nowrap">
                        {u.dataNascimento ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              {formatarDataExibicao(u.dataNascimento, {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Reservas */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {qtdReservas > 0 ? (
                          <div>
                            <span className="inline-flex items-center text-xs font-bold text-white bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg">
                              {qtdReservas} {qtdReservas === 1 ? "reserva" : "reservas"}
                            </span>
                            <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                              {formatarMoeda(valorTotalGasto)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Sem reservas</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-4 text-right sm:pr-6 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ver Reservas / Detalhes */}
                          <button
                            onClick={() => setUsuarioDetalhes(u)}
                            title="Ver detalhes e reservas"
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar */}
                          <button
                            onClick={() => handleAbrirEdicao(u)}
                            title="Editar dados do usuário"
                            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Bloquear / Desbloquear */}
                          <button
                            onClick={() => {
                              setMotivoBloqueio(u.motivo_bloqueio || "");
                              setUsuarioBloqueio(u);
                            }}
                            title={u.bloqueado ? "Desbloquear usuário" : "Bloquear usuário"}
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                              u.bloqueado
                                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border-slate-700"
                            }`}
                          >
                            {u.bloqueado ? (
                              <CheckCircle className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Excluir */}
                          <button
                            onClick={() => setUsuarioExcluir(u)}
                            title="Excluir usuário"
                            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Detalhes e Reservas do Usuário ── */}
      {usuarioDetalhes && (
        <Dialog
          open={Boolean(usuarioDetalhes)}
          onOpenChange={(v) => !v && setUsuarioDetalhes(null)}
        >
          <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 font-bold text-lg flex items-center justify-center border border-emerald-500/30">
                  {usuarioDetalhes.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                    {usuarioDetalhes.nome}
                    {usuarioDetalhes.bloqueado && (
                      <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                        <Ban className="w-3 h-3" /> Bloqueado
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs mt-0.5">
                    ID: {usuarioDetalhes.id}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Aviso de Bloqueio se aplicável */}
            {usuarioDetalhes.bloqueado && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-xs text-red-300 space-y-1 my-3">
                <div className="flex items-center gap-1.5 font-bold text-red-200">
                  <Ban className="w-4 h-4 text-red-400" /> Usuário Bloqueado
                </div>
                <p className="text-slate-300 text-[11px]">
                  Este usuário está impedido de realizar novas reservas no portal.
                </p>
                {usuarioDetalhes.motivo_bloqueio && (
                  <p className="text-amber-200/90 font-mono text-[11px] bg-slate-950/60 p-2 rounded border border-amber-500/20 mt-1">
                    <strong>Motivo informado:</strong> {usuarioDetalhes.motivo_bloqueio}
                  </p>
                )}
              </div>
            )}

            {/* Informações de Perfil e Contato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs my-3">
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  WhatsApp / Contato
                </span>
                <p className="text-slate-200 font-mono font-medium text-sm mt-0.5">
                  {usuarioDetalhes.telefone}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  Data de Nascimento
                </span>
                <p className="text-slate-200 font-medium text-sm mt-0.5">
                  {usuarioDetalhes.dataNascimento
                    ? formatarDataExibicao(usuarioDetalhes.dataNascimento, {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                    : "Não informada"}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  Data de Cadastro
                </span>
                <p className="text-slate-200 font-medium text-sm mt-0.5">
                  {usuarioDetalhes.criadoEm
                    ? formatarDataExibicao(usuarioDetalhes.criadoEm.split("T")[0], {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                    : "—"}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  Ação Rápida
                </span>
                <div className="mt-1">
                  <a
                    href={gerarLinkWhatsApp(usuarioDetalhes)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Conversar no WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Histórico de Reservas */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  Reservas Vinculadas ({(reservasPorUsuario.get(usuarioDetalhes.id) || []).length})
                </h3>
              </div>

              {(() => {
                const userRes = (reservasPorUsuario.get(usuarioDetalhes.id) || []).sort(
                  (a, b) => (a.data < b.data ? 1 : -1)
                );

                if (userRes.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80">
                      <p className="text-slate-400 text-xs font-medium">
                        Este usuário ainda não possui nenhuma reserva realizada.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                    {userRes.map((r) => {
                      const quadra = quadrasCatalogo.find((q) => q.id === r.quadraId);
                      return (
                        <div
                          key={r.id}
                          className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">
                                {formatarDataExibicao(r.data, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Quadra {quadra?.numero ?? r.quadraId}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.status === "confirmada"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : r.status === "pendente"
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                      : "bg-red-500/10 text-red-400 border-red-500/30"
                                  }`}
                              >
                                {r.status}
                              </span>
                              {r.reservaGratuitaFidelidade ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  🎁 100% Fidelidade
                                </span>
                              ) : r.descontoFidelidade && r.descontoFidelidade > 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  🎁 -{formatarMoeda(r.descontoFidelidade)}
                                </span>
                              ) : null}
                            </div>

                            <p className="text-xs text-slate-400 flex items-center gap-2">
                              <span>🕒 {r.horaInicio} – {r.horaFim} ({r.horarios.length}h)</span>
                              {r.esporte && <span>• ⚽ {r.esporte}</span>}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/40">
                            <div className="text-left sm:text-right">
                              <p className="text-xs font-bold text-emerald-400">
                                {r.reservaGratuitaFidelidade ? "R$ 0,00" : formatarMoeda(r.valorTotal)}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {r.reservaGratuitaFidelidade
                                  ? "🎁 Voucher Fidelidade"
                                  : r.valorPendente === 0
                                    ? "100% pago"
                                    : `Resta ${formatarMoeda(r.valorPendente)}`}
                              </p>
                            </div>

                            <a
                              href={`/admin/reserva/${r.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              Ver <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="mt-5 sm:justify-between border-t border-slate-800 pt-4">
              <Button
                variant="outline"
                onClick={() => setUsuarioDetalhes(null)}
                className="border-slate-700 text-slate-300"
              >
                Fechar
              </Button>


              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    if (usuarioDetalhes) {
                      setMotivoBloqueio(usuarioDetalhes.motivo_bloqueio || "");
                      setUsuarioBloqueio(usuarioDetalhes);
                      setUsuarioDetalhes(null);
                    }
                  }}
                  variant="outline"
                  className={`border-slate-700 hover:bg-slate-800 ${
                    usuarioDetalhes?.bloqueado ? "text-emerald-400" : "text-amber-400"
                  } gap-1.5`}
                >
                  {usuarioDetalhes?.bloqueado ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" /> Desbloquear
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" /> Bloquear
                    </>
                  )}
                </Button>
                <Button

                  onClick={() => {
                    handleAbrirEdicao(usuarioDetalhes);
                    setUsuarioDetalhes(null);
                  }}
                  variant="outline"
                  className="border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button
                  onClick={() => {
                    setUsuarioExcluir(usuarioDetalhes);
                    setUsuarioDetalhes(null);
                  }}
                  variant="destructive"
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL: Edição de Dados do Usuário ── */}
      {usuarioEditar && (
        <Dialog
          open={Boolean(usuarioEditar)}
          onOpenChange={(v) => !v && setUsuarioEditar(null)}
        >
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md p-6">
            <DialogHeader>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                <Edit2 className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-black text-white">
                Editar Dados do Usuário
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Atualize as informações cadastrais de {usuarioEditar.nome}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSalvarEdicao} className="space-y-4 my-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  Nome Completo *
                </Label>
                <Input
                  value={nomeEdit}
                  onChange={(e) => setNomeEdit(e.target.value)}
                  placeholder="Nome do cliente"
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  WhatsApp / Telefone *
                </Label>
                <Input
                  value={telefoneEdit}
                  onChange={(e) => setTelefoneEdit(mascaraWhatsApp(e.target.value))}
                  placeholder="(00) 00000-0000"
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  Data de Nascimento (opcional)
                </Label>
                <Input
                  type="date"
                  value={dataNascimentoEdit}
                  onChange={(e) => setDataNascimentoEdit(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white h-10 [color-scheme:dark]"
                />
              </div>

              <DialogFooter className="pt-3 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUsuarioEditar(null)}
                  disabled={salvando}
                  className="border-slate-700 text-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold gap-2"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL: Confirmação de Exclusão (LGPD) ── */}
      {usuarioExcluir && (
        <Dialog
          open={Boolean(usuarioExcluir)}
          onOpenChange={(v) => !v && setUsuarioExcluir(null)}
        >
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md p-6">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mb-2 mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-black text-center text-white">
                Excluir Conta de Usuário?
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-center text-xs mt-1">
                Esta ação é irreversível. A conta de{" "}
                <strong className="text-white">{usuarioExcluir.nome}</strong>{" "}
                ({usuarioExcluir.telefone}) será apagada permanentemente do sistema em conformidade com a LGPD.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 my-2 text-xs text-slate-400 space-y-1">
              <p>• As reservas já existentes continuarão registradas para controle financeiro da quadra.</p>
              <p>• O usuário não conseguirá mais realizar login com esta senha.</p>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setUsuarioExcluir(null)}
                disabled={excluindo}
                className="border-slate-700 text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
                variant="destructive"
                className="bg-red-600 hover:bg-red-500 text-white font-bold gap-2"
              >
                {excluindo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> Sim, Excluir Conta
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL: Bloqueio / Desbloqueio de Usuário ── */}
      {usuarioBloqueio && (
        <Dialog
          open={Boolean(usuarioBloqueio)}
          onOpenChange={(v) => !v && setUsuarioBloqueio(null)}
        >
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md p-6">
            <DialogHeader>
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 mx-auto ${
                  usuarioBloqueio.bloqueado
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {usuarioBloqueio.bloqueado ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <Ban className="w-6 h-6" />
                )}
              </div>
              <DialogTitle className="text-lg font-black text-center text-white">
                {usuarioBloqueio.bloqueado ? "Desbloquear Usuário?" : "Bloquear Usuário?"}
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-center text-xs mt-1">
                {usuarioBloqueio.bloqueado ? (
                  <>
                    Tem certeza de que deseja desbloquear{" "}
                    <strong className="text-white">{usuarioBloqueio.nome}</strong>?
                    Ele voltará a ter permissão para realizar novas reservas pelo portal.
                  </>
                ) : (
                  <>
                    Ao bloquear <strong className="text-white">{usuarioBloqueio.nome}</strong>,
                    ele não poderá realizar novas reservas pelo portal e receberá um aviso ao tentar.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleToggleBloqueio} className="space-y-4 my-2">
              {!usuarioBloqueio.bloqueado && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Motivo do Bloqueio (opcional)
                  </Label>
                  <Input
                    value={motivoBloqueio}
                    onChange={(e) => setMotivoBloqueio(e.target.value)}
                    placeholder="Ex: Não comparecimento recorrente, pendência financeira..."
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-10 text-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    Este motivo fica registrado para a administração da quadra.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-3 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUsuarioBloqueio(null)}
                  disabled={alterandoBloqueio}
                  className="border-slate-700 text-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={alterandoBloqueio}
                  className={`font-bold gap-2 ${
                    usuarioBloqueio.bloqueado
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }`}
                >
                  {alterandoBloqueio ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Atualizando...
                    </>
                  ) : usuarioBloqueio.bloqueado ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Confirmar Desbloqueio
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" /> Confirmar Bloqueio
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
