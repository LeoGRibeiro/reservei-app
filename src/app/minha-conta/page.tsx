"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserAuth } from "@/hooks/useUserAuth";
import { useReservasService } from "@/hooks/useReservasService";
import {
  formatarDataExibicao,
  formatarMoeda,
  mascaraWhatsApp,
  getHoje,
} from "@/lib/constants";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { useArena } from "@/hooks/useArena";
import { whatsappInternacional } from "@/hooks/useConfiguracaoSiteArena";
import { temModuloAtivo } from "@/lib/arena/modulos";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useReservasStore } from "@/store/useReservasStore";
import { cancelarReservaDoAtleta } from "@/lib/reservas/reservasApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  User,
  Phone,
  LogOut,
  Trash2,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  History,
  ShieldAlert,
  Loader2,
  Sparkles,
  Users,
  Gift,
} from "lucide-react";
import { useVagasService } from "@/hooks/useVagasService";
import { useFidelidadeService } from "@/hooks/useFidelidadeService";
import { CartelaFidelidadeTimeline } from "@/components/fidelidade/CartelaFidelidadeTimeline";
import { ModalGerenciarVagas } from "@/components/vagas/ModalGerenciarVagas";
import type { Reserva } from "@/store/useReservasStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function MinhaContaPage() {
  const quadrasCatalogo = useQuadrasCatalogo();
  const { arena } = useArena();
  const whatsappArena = whatsappInternacional(arena.whatsapp || arena.telefone);
  const temVagas = temModuloAtivo(arena.modulosAtivos, "vagas");
  const temFidelidade = temModuloAtivo(arena.modulosAtivos, "fidelidade");
  const router = useRouter();
  const { user, loading, logout, atualizarPerfil, excluirConta } = useUserAuth();
  const { reservas, cancelarReserva } = useReservasService();
  const { getTotalNovosInteressados } = useVagasService();
  const { progresso, carregando: carregandoFidelidade, resgatarVoucher } = useFidelidadeService();
  const [reservaGerenciarVagas, setReservaGerenciarVagas] = useState<Reserva | null>(null);
  const [reservaParaCancelar, setReservaParaCancelar] = useState<Reserva | null>(null);
  const [cancelandoReserva, setCancelandoReserva] = useState(false);

  const handleConfirmarCancelamento = async () => {
    if (!reservaParaCancelar) return;
    setCancelandoReserva(true);
    try {
      if (isSupabaseConfigured()) {
        // O servidor confere que a reserva é do atleta e que a partida ainda não começou
        const res = await cancelarReservaDoAtleta(reservaParaCancelar.id);
        if (!res.ok) {
          toast.error("Não foi possível cancelar", { description: res.erro });
          return;
        }
        useReservasStore.getState().atualizarReserva(reservaParaCancelar.id, {
          status: "cancelada",
          permiteVagas: false,
          vagasAbertas: 0,
        });
      } else {
        cancelarReserva(reservaParaCancelar.id);
      }
      toast.success("Reserva cancelada com sucesso.");
      setReservaParaCancelar(null);
    } catch {
      toast.error("Ocorreu um erro ao cancelar o agendamento.");
    } finally {
      setCancelandoReserva(false);
    }
  };

  const [tabAtiva, setTabAtiva] = useState<"reservas" | "fidelidade" | "perfil" | "contato" | "seguranca">("reservas");

  // Estado edição de perfil
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState("");
  const [telefoneEdit, setTelefoneEdit] = useState("");
  const [dataNascimentoEdit, setDataNascimentoEdit] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  // Modal de exclusão de conta
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [excluindoConta, setExcluindoConta] = useState(false);

  // Inicializa formulário de edição quando clica em editar
  const handleIniciarEdicao = () => {
    if (!user) return;
    setNomeEdit(user.nome);
    setTelefoneEdit(user.telefone);
    setDataNascimentoEdit(user.dataNascimento || "");
    setEditando(true);
  };

  const handleSalvarPerfil = async () => {
    if (!nomeEdit.trim() || nomeEdit.length < 3) {
      toast.error("Nome inválido");
      return;
    }

    setSalvandoPerfil(true);
    const ok = await atualizarPerfil({
      nome: nomeEdit.trim(),
      telefone: telefoneEdit,
      dataNascimento: dataNascimentoEdit || null,
    });
    setSalvandoPerfil(false);

    if (ok) {
      toast.success("Perfil atualizado com sucesso!");
      setEditando(false);
    } else {
      toast.error("Erro ao salvar alterações no perfil.");
    }
  };

  const handleExcluirConta = async () => {
    setExcluindoConta(true);
    const ok = await excluirConta();
    setExcluindoConta(false);
    setModalExcluirAberto(false);

    if (ok) {
      toast.success("Sua conta e dados foram excluídos com sucesso.");
      router.push("/");
    } else {
      toast.error("Não foi possível excluir a conta. Tente novamente.");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.info("Você saiu da sua conta.");
    router.push("/");
  };

  // Filtra as reservas pertencentes a este usuário (por userId ou pelo telefone cadastrado)
  const userReservas = useMemo(() => {
    if (!user) return [];
    const userDigits = user.telefone.replace(/\D/g, "");
    return reservas.filter((r) => {
      if (r.userId && r.userId === user.id) return true;
      const rsvDigits = r.whatsappCliente.replace(/\D/g, "");
      return rsvDigits && rsvDigits === userDigits;
    });
  }, [reservas, user]);

  const hoje = getHoje();

  // Divide entre Próximas e Histórico
  const proximasReservas = useMemo(() => {
    return userReservas
      .filter((r) => r.data >= hoje && r.status !== "cancelada")
      .sort((a, b) => (a.data > b.data ? 1 : -1));
  }, [userReservas, hoje]);

  const historicoReservas = useMemo(() => {
    return userReservas
      .filter((r) => r.data < hoje || r.status === "cancelada")
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [userReservas, hoje]);

  // Estatísticas do usuário
  const totalConcluidas = useMemo(() => {
    return userReservas.filter((r) => r.status === "confirmada" || r.status === "pendente").length;
  }, [userReservas]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="text-center max-w-sm">
          <span className="text-4xl">🔒</span>
          <h1 className="text-xl font-black mt-4">Acesso Restrito</h1>
          <p className="text-slate-400 text-xs mt-2">
            Você precisa estar conectado à sua conta para acessar esta área.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/login">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
                Fazer Login
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="w-full text-slate-400 hover:text-white">
                Voltar para o início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Topo Navegação */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden sm:inline">Nova Reserva</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xl">🏟️</span>
            <span className="font-black text-white text-base tracking-tight">{arena.nome}</span>
            <span className="text-xs text-slate-500 hidden md:inline">· Portal do Cliente</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 text-xs flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Cabeçalho do Perfil & Boas-vindas */}
      <div className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                {user.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {user.nome}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Sparkles className="w-2.5 h-2.5" /> Membro
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {user.telefone}
                </p>
              </div>
            </div>

            {/* Resumo Rápido de Estatísticas */}
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center sm:text-left">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Agendamentos
                </p>
                <p className="text-xl font-black text-emerald-400">{userReservas.length}</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center sm:text-left">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Ativas
                </p>
                <p className="text-xl font-black text-white">{proximasReservas.length}</p>
              </div>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
            <button
              onClick={() => setTabAtiva("reservas")}
              className={`pb-3 px-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                tabAtiva === "reservas"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Minhas Reservas ({userReservas.length})
            </button>

            {temFidelidade && (
            <button
              onClick={() => setTabAtiva("fidelidade")}
              className={`pb-3 px-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                tabAtiva === "fidelidade"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Gift className="w-4 h-4" />
              Fidelidade
              {progresso.vouchersDisponiveis.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {progresso.vouchersDisponiveis.length} prêmio(s)
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">
                  ({progresso.totalHorasAtivas}/{progresso.horasNecessarias}h)
                </span>
              )}
            </button>
            )}

            <button
              onClick={() => setTabAtiva("perfil")}
              className={`pb-3 px-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                tabAtiva === "perfil"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <User className="w-4 h-4" />
              Meu Perfil
            </button>

            <button
              onClick={() => setTabAtiva("contato")}
              className={`pb-3 px-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                tabAtiva === "contato"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Fale Conosco
            </button>

            <button
              onClick={() => setTabAtiva("seguranca")}
              className={`pb-3 px-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
                tabAtiva === "seguranca"
                  ? "border-red-500 text-red-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Privacidade & Exclusão
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo da Aba */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {/* ABA: RESERVAS */}
        {tabAtiva === "reservas" && (
          <div className="space-y-8">
            {/* Próximas Reservas */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Próximas Reservas ({proximasReservas.length})
                </h2>
                <Link href="/">
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                  >
                    + Novo Agendamento
                  </Button>
                </Link>
              </div>

              {proximasReservas.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
                  <p className="text-slate-400 text-sm">Você não possui reservas agendadas para os próximos dias.</p>
                  <Link href="/" className="inline-block mt-4">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      Ver Horários Disponíveis
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proximasReservas.map((reserva) => {
                    const quadra = quadrasCatalogo.find((q) => q.id === reserva.quadraId);
                    return (
                      <div
                        key={reserva.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors shadow-lg flex flex-col justify-between"
                      >
                        <div>
                          {/* Cabeçalho do Card: Quadra, Suporte e Status */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                                Quadra {quadra?.numero || "Esportiva"}
                              </span>
                              <h3 className="font-bold text-white text-base mt-0.5">
                                {quadra?.descricao || `Quadra ${quadra?.numero || "Poliesportiva"}`}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={`https://wa.me/${whatsappArena}?text=Olá,%20tenho%20uma%20dúvida%20sobre%20minha%20reserva%20no%20dia%20${reserva.data}%20(Quadra%20${quadra?.numero})`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                                title="Falar com o suporte no WhatsApp"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-400" />
                                <span className="hidden sm:inline">Suporte</span>
                              </a>
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  reserva.status === "confirmada"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {reserva.status === "confirmada" ? "Confirmada" : "Sinal Pago"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2.5 text-sm text-slate-200">
                            <div className="flex items-center gap-2.5">
                              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-semibold text-white capitalize">{formatarDataExibicao(reserva.data)}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-200">
                                {reserva.horaInicio} às {reserva.horaFim}{" "}
                                <span className="text-xs text-slate-400 font-normal">
                                  ({reserva.horarios.length}h de jogo)
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="text-slate-400 block text-xs font-medium">Total</span>
                              <span className="text-lg sm:text-xl font-black text-white">
                                {formatarMoeda(reserva.valorTotal)}
                              </span>
                            </div>
                            {reserva.valorPendente > 0 && (
                              <div className="text-right">
                                <span className="text-amber-400/90 block text-xs font-medium">Pendente no local</span>
                                <span className="text-lg sm:text-xl font-black text-amber-400">
                                  {formatarMoeda(reserva.valorPendente)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Bloco de Vagas Abertas: Status e Botão lado a lado */}
                          {temVagas && (
                          <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                                <Users className="w-3 h-3 text-slate-500" />
                                Vagas:
                              </span>
                              {reserva.permiteVagas && (reserva.vagasAbertas ?? 0) > 0 ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  {reserva.vagasAbertas} {reserva.vagasAbertas === 1 ? "vaga aberta" : "vagas abertas"}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/60 text-slate-400 border border-slate-700/50">
                                  Vagas fechadas
                                </span>
                              )}

                              {getTotalNovosInteressados(reserva.id) > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  {getTotalNovosInteressados(reserva.id)} novo(s)
                                </span>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReservaGerenciarVagas(reserva)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 font-bold text-xs h-7 px-3 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                            >
                              <Users className="w-3.5 h-3.5" />
                              Gerenciar Vagas
                            </Button>
                          </div>
                          )}
                        </div>

                        {/* Rodapé: Ação de Cancelamento com destaque */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            Código: <span className="font-mono text-slate-400">#{reserva.id.slice(0, 8)}</span>
                          </span>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReservaParaCancelar(reserva)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/25 hover:border-red-500/40 rounded-xl font-bold text-xs h-8 px-3.5 flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancelar Reserva
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Histórico Passado */}
            <section>
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-slate-400" />
                Histórico Passado ({historicoReservas.length})
              </h2>

              {historicoReservas.length === 0 ? (
                <p className="text-slate-500 text-xs">Nenhum histórico anterior registrado.</p>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden">
                  {historicoReservas.map((r) => {
                    const quadra = quadrasCatalogo.find((q) => q.id === r.quadraId);
                    return (
                      <div key={r.id} className="p-4 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-200">
                            Quadra {quadra?.numero} · {r.horaInicio}–{r.horaFim}
                          </p>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            {formatarDataExibicao(r.data)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === "cancelada"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {r.status === "cancelada" ? "Cancelada" : "Finalizada"}
                          </span>
                          <p className="text-slate-400 font-semibold mt-1">
                            {formatarMoeda(r.valorTotal)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ABA: FIDELIDADE */}
        {temFidelidade && tabAtiva === "fidelidade" && (
          <div className="max-w-4xl space-y-8">
            <CartelaFidelidadeTimeline
              progresso={progresso}
              carregando={carregandoFidelidade}
              onResgatarVoucher={resgatarVoucher}
            />
          </div>
        )}

        {/* ABA: PERFIL */}
        {tabAtiva === "perfil" && (
          <div className="max-w-xl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <h2 className="text-lg font-black text-white tracking-tight mb-2">
                Dados Pessoais
              </h2>
              <p className="text-slate-400 text-xs mb-6">
                Estes dados são preenchidos automaticamente quando você fizer novas reservas.
              </p>

              {!editando ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        Nome Completo
                      </span>
                      <p className="text-sm font-semibold text-white mt-0.5">{user.nome}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        WhatsApp (Login)
                      </span>
                      <p className="text-sm font-semibold text-white mt-0.5">{user.telefone}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        Data de Nascimento
                      </span>
                      <p className="text-sm font-semibold text-white mt-0.5">
                        {user.dataNascimento
                          ? formatarDataExibicao(user.dataNascimento, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "Não informada"}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleIniciarEdicao}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-10 rounded-xl"
                  >
                    Editar Dados
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Nome Completo</Label>
                    <Input
                      value={nomeEdit}
                      onChange={(e) => setNomeEdit(e.target.value)}
                      className="bg-slate-800 border-slate-700 h-10 rounded-xl text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">WhatsApp</Label>
                    <Input
                      value={telefoneEdit}
                      onChange={(e) => setTelefoneEdit(mascaraWhatsApp(e.target.value))}
                      className="bg-slate-800 border-slate-700 h-10 rounded-xl text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Data de Nascimento</Label>
                    <Input
                      type="date"
                      value={dataNascimentoEdit}
                      onChange={(e) => setDataNascimentoEdit(e.target.value)}
                      className="bg-slate-800 border-slate-700 h-10 rounded-xl text-white block w-full [color-scheme:dark]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSalvarPerfil}
                      disabled={salvandoPerfil}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-10 rounded-xl"
                    >
                      {salvandoPerfil ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditando(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: CONTATO */}
        {tabAtiva === "contato" && (
          <div className="max-w-xl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white tracking-tight">Fale Conosco</h2>
              <p className="text-slate-400 text-xs mt-1 mb-6">
                Precisa de suporte com um horário, alteração especial ou dúvida sobre o complexo?
              </p>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3 text-xs mb-6">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Complexo</span>
                  <p className="text-sm font-semibold text-white">{arena.nome}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    WhatsApp de Atendimento
                  </span>
                  <p className="text-sm font-semibold text-emerald-400">{arena.whatsapp || arena.telefone}</p>
                </div>
              </div>

              <a
                href={`https://wa.me/${whatsappArena}?text=Olá,%20sou%20${encodeURIComponent(user.nome)}%20e%20gostaria%20de%20tirar%20uma%20dúvida.`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold h-11 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Abrir Conversa no WhatsApp
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* ABA: PRIVACIDADE & SEGURANÇA */}
        {tabAtiva === "seguranca" && (
          <div className="max-w-xl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">
                  Privacidade e Dados (LGPD)
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Seus dados são armazenados exclusivamente para agilizar suas reservas na plataforma.
                  Você possui o direito de solicitar a exclusão definitiva a qualquer momento.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-white">Dados armazenados atualmente:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>Nome: {user.nome}</li>
                  <li>WhatsApp: {user.telefone}</li>
                  <li>Nascimento: {user.dataNascimento || "Não informado"}</li>
                  <li>Total de agendamentos associados: {userReservas.length}</li>
                </ul>
              </div>

              {/* Zona de Perigo */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-sm font-bold text-red-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" /> Zona de Perigo
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Ao excluir sua conta, seus dados de perfil serão permanentemente apagados do sistema.
                </p>

                <Button
                  variant="destructive"
                  onClick={() => setModalExcluirAberto(true)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 h-10 rounded-xl font-bold text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Excluir Minha Conta Permanentemente
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={modalExcluirAberto} onOpenChange={setModalExcluirAberto}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Tem certeza que deseja excluir sua conta?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2">
              Esta ação é irreversível. Todos os seus dados pessoais e histórico de acesso serão removidos
              do sistema de acordo com as normas de privacidade.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setModalExcluirAberto(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleExcluirConta}
              disabled={excluindoConta}
              className="bg-red-600 hover:bg-red-700 font-bold"
            >
              {excluindoConta ? "Excluindo..." : "Confirmar e Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Cancelamento de Reserva */}
      <Dialog open={Boolean(reservaParaCancelar)} onOpenChange={(open) => !open && setReservaParaCancelar(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Cancelar Agendamento?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2">
              Tem certeza que deseja cancelar esta reserva? Esta ação liberará a quadra e o horário no sistema para outros clientes.
            </DialogDescription>
          </DialogHeader>

          {reservaParaCancelar && (
            <div className="my-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Quadra:</span>
                <span className="font-semibold text-white">
                  {quadrasCatalogo.find((q) => q.id === reservaParaCancelar.quadraId)?.descricao || `Quadra ${reservaParaCancelar.quadraId}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Data:</span>
                <span className="font-semibold text-white">{formatarDataExibicao(reservaParaCancelar.data)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Horário:</span>
                <span className="font-semibold text-white">
                  {reservaParaCancelar.horaInicio} às {reservaParaCancelar.horaFim}
                </span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
                <span className="text-slate-500">Valor Total:</span>
                <span className="font-bold text-white">{formatarMoeda(reservaParaCancelar.valorTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="ghost"
              disabled={cancelandoReserva}
              onClick={() => setReservaParaCancelar(null)}
              className="text-slate-400 hover:text-white"
            >
              Manter Reserva
            </Button>
            <Button
              variant="destructive"
              disabled={cancelandoReserva}
              onClick={handleConfirmarCancelamento}
              className="bg-red-600 hover:bg-red-700 font-bold text-xs"
            >
              {cancelandoReserva ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gerenciamento de Vagas Abertas da Reserva */}
      {reservaGerenciarVagas && (
        <ModalGerenciarVagas
          open={Boolean(reservaGerenciarVagas)}
          onClose={() => setReservaGerenciarVagas(null)}
          reserva={reservaGerenciarVagas}
        />
      )}
    </div>
  );
}
