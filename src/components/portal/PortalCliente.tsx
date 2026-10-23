"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { CalendarioSelector } from "./CalendarioSelector";
import { QuadraHorarioItem } from "./QuadraHorarioItem";
import { CarrinhoLateral, BotaoCarrinhoMobile } from "./CarrinhoLateral";
import { FormularioIdentificacao, type DadosIdentificacao } from "./FormularioIdentificacao";
import { ModalPix } from "./ModalPix";
import { ModalPosReservaCadastro } from "./ModalPosReservaCadastro";
import { MuralVagasAbertas } from "@/components/vagas/MuralVagasAbertas";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SecaoContato } from "@/components/landing/SecaoContato";
import { secoesDoPortal } from "@/lib/landingPage/secoes";
import { useInstitucionalService } from "@/hooks/useInstitucionalService";
import { SecaoEstrutura } from "@/components/landing/SecaoEstrutura";
import { SecaoEscolinhas } from "@/components/landing/SecaoEscolinhas";
import { CabecalhoReserva, ID_TITULO_RESERVA } from "@/components/landing/CabecalhoReserva";
import { BotaoVoltarAoTopo } from "@/components/landing/BotaoVoltarAoTopo";
import { SmoothScrollProvider } from "@/components/landing/SmoothScrollProvider";
import { SECAO_IDS } from "@/lib/landingPage/secoes";

import { useReservasService } from "@/hooks/useReservasService";
import { useContratosService } from "@/hooks/useContratosService";
import { useUserAuth } from "@/hooks/useUserAuth";
import { useFidelidadeService } from "@/hooks/useFidelidadeService";
import { useCheckoutReserva, type CheckoutAtivo } from "@/hooks/useCheckoutReserva";
import { aplicarDescontoVouchers } from "@/lib/fidelidade/fidelidadeService";
import {
  gerarDiasDisponiveis,
  getHoje,
  calcularValorTotal,
  calcularValorSinal,
  saoConsecutivos,
  isHorarioExpirado,
} from "@/lib/constants";
import { calcularPrecoReserva } from "@/lib/arena/arenaService";
import { useArena } from "@/hooks/useArena";
import { usePrecoCalculado } from "@/hooks/usePrecoCalculado";
import { useCatalogoArenaStore } from "@/store/useCatalogoArenaStore";
import { temModuloAtivo } from "@/lib/arena/modulos";
import type { PixCobranca } from "@/lib/pagamento/types";

type Etapa = "formulario" | "pix";

/** Intervalo de atualização da grade pública (o Realtime só entrega eventos das próprias reservas). */
const INTERVALO_ATUALIZACAO_GRADE_MS = 30_000;

export interface PortalClienteProps {
  /** Slug da arena para carregar dados multi-tenant (ex: subdomínio) */
  arenaSlug?: string;
}

/**
 * Portal público de agendamento da arena: grade de horários, checkout com Pix, fidelidade e mural
 * de vagas. Toda reserva é criada e precificada pelo servidor (`/api/reservas/checkout`).
 *
 * @param props Slug da arena (opcional; padrão: subdomínio atual)
 */
export function PortalCliente({ arenaSlug }: PortalClienteProps = {}) {
  // ── Contexto da Arena Multi-Tenant ─────────────────────────────────────
  const { arena, quadras: listaQuadras, precos, carregando: carregandoArena } = useArena(arenaSlug);
  const antecedenciaMinutos = useCatalogoArenaStore((s) => s.antecedenciaMinutos);
  // Módulos contratados pela arena (Feature Flags): o portal só exibe o que foi vendido
  const temVagas = temModuloAtivo(arena.modulosAtivos, "vagas");
  const temFidelidade = temModuloAtivo(arena.modulosAtivos, "fidelidade");
  const temEscolinhas = temModuloAtivo(arena.modulosAtivos, "escolinhas");
  // Seções sem conteúdo real nunca aparecem: a Estrutura só existe depois que a arena sobe fotos
  const { galeria, escolinhasAtivas } = useInstitucionalService();
  const temFotosEstrutura = galeria.some((foto) => foto.isActive !== false);
  const exibirEscolinhas = temEscolinhas && escolinhasAtivas.length > 0;
  const secoesVisiveis = useMemo(
    () => secoesDoPortal({ escolinhas: exibirEscolinhas, estrutura: temFotosEstrutura }),
    [exibirEscolinhas, temFotosEstrutura]
  );

  // ── Estado de seleção ──────────────────────────────────────────────────
  const dias = useMemo(() => gerarDiasDisponiveis(), []);
  const [dataSelecionada, setDataSelecionada] = useState<string>(getHoje());
  const [quadraSelecionada, setQuadraSelecionada] = useState<string | null>(null);
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([]);

  // ── Checkout ────────────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [checkout, setCheckout] = useState<CheckoutAtivo | null>(null);
  const [enviandoCheckout, setEnviandoCheckout] = useState(false);
  const [dadosForm, setDadosForm] = useState<DadosIdentificacao | null>(null);
  const [tipoPagamentoEscolhido, setTipoPagamentoEscolhido] = useState<"sinal" | "integral">("sinal");
  const [isCarrinhoOpen, setIsCarrinhoOpen] = useState(false);
  const [vouchersSelecionadosIds, setVouchersSelecionadosIds] = useState<string[]>([]);
  const finalizadoRef = useRef(false);

  // ── Autenticação de Usuário & Fidelidade ──────────────────────────────────
  const { user, isAutenticado } = useUserAuth();
  const { progresso, recarregarDados: recarregarFidelidade } = useFidelidadeService();
  const [mostrarModalPosCadastro, setMostrarModalPosCadastro] = useState(false);
  const [dadosUltimaReserva, setDadosUltimaReserva] = useState<{
    id: string;
    checkoutToken: string;
    nome: string;
    whatsapp: string;
  } | null>(null);

  // ── Cobrança Pix Transacional ─────────────────────────────────────────────
  const [cobrancaPix, setCobrancaPix] = useState<PixCobranca | null>(null);
  const [carregandoPix, setCarregandoPix] = useState(false);

  // ── Services ────────────────────────────────────────────────────────────
  const { getHorariosOcupados, recarregarReservas } = useReservasService();
  const { getAvisosEscolinha } = useContratosService();
  const { iniciar, gerarPix, aguardarConfirmacao, simularPagamento, cancelar, informarPagamento } =
    useCheckoutReserva();

  // Mantém a grade atualizada com reservas de outras pessoas
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") void recarregarReservas();
    }, INTERVALO_ATUALIZACAO_GRADE_MS);
    return () => clearInterval(intervalo);
  }, [recarregarReservas]);

  // ── Valores calculados dinamicamente (exibição; o servidor recalcula) ───
  const quadraAtual = useMemo(() => {
    return listaQuadras.find((q) => q.id === quadraSelecionada) || null;
  }, [listaQuadras, quadraSelecionada]);

  const precoDinamico = usePrecoCalculado({
    quadra: quadraAtual,
    precos,
    data: dataSelecionada,
    horarios: horariosSelecionados,
    percentualSinal: arena.percentualSinalMinimo,
  });

  const valorTotalBruto = useMemo(() => {
    if (precoDinamico.valorTotal > 0) return precoDinamico.valorTotal;
    return calcularValorTotal(horariosSelecionados);
  }, [precoDinamico.valorTotal, horariosSelecionados]);

  const vouchersDisponiveis = useMemo(
    () => (temFidelidade ? progresso.vouchersDisponiveis : []),
    [temFidelidade, progresso.vouchersDisponiveis]
  );

  const vouchersAtivosParaReserva = useMemo(() => {
    return vouchersDisponiveis.filter((v) => vouchersSelecionadosIds.includes(v.id));
  }, [vouchersSelecionadosIds, vouchersDisponiveis]);

  const resultadoDesconto = useMemo(
    () =>
      vouchersAtivosParaReserva.length > 0
        ? aplicarDescontoVouchers(valorTotalBruto, vouchersAtivosParaReserva)
        : null,
    [vouchersAtivosParaReserva, valorTotalBruto]
  );

  const valorTotal = resultadoDesconto ? resultadoDesconto.valorFinal : valorTotalBruto;
  const valorSinal = useMemo(() => {
    if (valorTotal === 0) return 0;
    if (resultadoDesconto) {
      return Math.round(valorTotal * (arena.percentualSinalMinimo / 100) * 100) / 100;
    }
    return precoDinamico.valorSinal > 0 ? precoDinamico.valorSinal : calcularValorSinal(valorTotal);
  }, [valorTotal, resultadoDesconto, arena.percentualSinalMinimo, precoDinamico.valorSinal]);

  const valorPendente = useMemo(() => {
    return Math.round((valorTotal - valorSinal) * 100) / 100;
  }, [valorTotal, valorSinal]);

  /** Preço por hora de um horário em cada quadra, para os rótulos da grade. */
  const precoDoHorarioPorQuadra = useMemo(() => {
    const mapa = new Map<string, (h: string) => number>();
    for (const quadra of listaQuadras) {
      mapa.set(quadra.id, (horario: string) =>
        calcularPrecoReserva({ quadra, precos, data: dataSelecionada, horarios: [horario] }).valorTotal
      );
    }
    return mapa;
  }, [listaQuadras, precos, dataSelecionada]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleToggleVoucher = useCallback((voucherId: string) => {
    setVouchersSelecionadosIds((prev) =>
      prev.includes(voucherId) ? prev.filter((id) => id !== voucherId) : [...prev, voucherId]
    );
  }, []);

  const handleLimparVouchers = useCallback(() => {
    setVouchersSelecionadosIds([]);
  }, []);

  const handleSelectData = useCallback((data: string) => {
    setDataSelecionada(data);
    setQuadraSelecionada(null);
    setHorariosSelecionados([]);
  }, []);

  /**
   * Chamado por QuadraHorarioItem: alterna um horário na quadra especificada.
   * Se o usuário clicar em uma quadra diferente da atual, altera a seleção para ela.
   * Múltiplos horários na mesma quadra devem ser estritamente consecutivos.
   */
  const handleToggleHorario = useCallback(
    (horario: string, quadraId: string) => {
      if (user?.bloqueado) {
        toast.error("Conta bloqueada para novas reservas", {
          description: "Sua conta está com restrição para novos agendamentos. Por favor, entre em contato para entender o motivo.",
        });
        return;
      }

      // Se clicar em quadra diferente, migra a seleção para a nova quadra
      if (quadraSelecionada !== null && quadraSelecionada !== quadraId) {
        setQuadraSelecionada(quadraId);
        setHorariosSelecionados([horario]);
        const nomeQuadra = listaQuadras.find((q) => q.id === quadraId)?.nome;
        if (nomeQuadra) toast.info(`Selecionada ${nomeQuadra}`);
        return;
      }

      setQuadraSelecionada(quadraId);

      setHorariosSelecionados((prev) => {
        if (prev.includes(horario)) {
          const next = prev.filter((h) => h !== horario);
          if (next.length === 0) setQuadraSelecionada(null);
          return next;
        }
        const next = [...prev, horario];
        if (!saoConsecutivos(next)) return prev;
        return next;
      });
    },
    [quadraSelecionada, user?.bloqueado, listaQuadras]
  );

  const handleLimpar = useCallback(() => {
    setHorariosSelecionados([]);
    setQuadraSelecionada(null);
    setVouchersSelecionadosIds([]);
  }, []);

  /** Carrinho → formulário de identificação (o horário só é travado ao confirmar o formulário). */
  const handleContinuar = useCallback(() => {
    if (!quadraSelecionada || horariosSelecionados.length === 0) return;

    if (user?.bloqueado) {
      toast.error("Conta bloqueada para novas reservas", {
        description: "Sua conta está com restrição para novos agendamentos. Por favor, entre em contato para entender o motivo.",
      });
      return;
    }

    for (const h of horariosSelecionados) {
      if (isHorarioExpirado(dataSelecionada, h, antecedenciaMinutos)) {
        toast.error("Horário indisponível", {
          description: `Reservas online precisam de pelo menos ${antecedenciaMinutos} minutos de antecedência. Escolha outro horário.`,
        });
        return;
      }
    }

    setIsCarrinhoOpen(false);
    setEtapa("formulario");
  }, [quadraSelecionada, horariosSelecionados, dataSelecionada, user?.bloqueado, antecedenciaMinutos]);

  /** Limpa o estado do checkout após sucesso, desistência ou expiração. */
  const resetarCheckout = useCallback(() => {
    setEtapa(null);
    setCheckout(null);
    setDadosForm(null);
    setCobrancaPix(null);
    setCarregandoPix(false);
  }, []);

  /** Encerra o checkout com sucesso (pagamento confirmado ou reserva 100% coberta). */
  const finalizarComSucesso = useCallback(
    (concluido: CheckoutAtivo, dados: DadosIdentificacao | null, mensagem: { titulo: string; descricao: string }) => {
      if (finalizadoRef.current) return;
      finalizadoRef.current = true;

      if (!isAutenticado && dados) {
        setDadosUltimaReserva({
          id: concluido.reservaId,
          checkoutToken: concluido.checkoutToken,
          nome: dados.nome,
          whatsapp: dados.whatsapp,
        });
        setMostrarModalPosCadastro(true);
      }

      setVouchersSelecionadosIds([]);
      setHorariosSelecionados([]);
      setQuadraSelecionada(null);
      resetarCheckout();
      void recarregarFidelidade();
      toast.success(mensagem.titulo, { description: mensagem.descricao, duration: 7000 });
    },
    [isAutenticado, resetarCheckout, recarregarFidelidade]
  );

  /** Formulário confirmado: o servidor cria a reserva, valida o preço e trava o horário. */
  const handleFormConfirmar = useCallback(
    async (dados: DadosIdentificacao, tipoPagamento: "sinal" | "integral") => {
      if (!quadraSelecionada || enviandoCheckout) return;
      setEnviandoCheckout(true);
      setDadosForm(dados);
      setTipoPagamentoEscolhido(tipoPagamento);
      finalizadoRef.current = false;

      const resultado = await iniciar(
        {
          arenaId: arena.id,
          quadraId: quadraSelecionada,
          data: dataSelecionada,
          horarios: horariosSelecionados,
          nomeCliente: dados.nome,
          whatsappCliente: dados.whatsapp,
          esporte: dados.esporte || undefined,
          observacoes: dados.observacoes || undefined,
          tipoPagamento,
          voucherIds: vouchersAtivosParaReserva.map((v) => v.id),
          aceiteTermos: dados.aceiteTermos,
        },
        {
          valorOriginal: valorTotalBruto,
          descontoFidelidade: resultadoDesconto?.valorDesconto ?? 0,
          valorTotal,
          valorSinal,
          valorPendente,
          codigosVouchers: vouchersAtivosParaReserva.map((v) => v.codigo),
        },
        user?.id
      );
      setEnviandoCheckout(false);

      if (!resultado.ok) {
        toast.error("Não foi possível reservar", { description: resultado.erro });
        void recarregarReservas();
        return;
      }

      if (resultado.gratuita) {
        const qtd = vouchersAtivosParaReserva.length;
        finalizarComSucesso(resultado.checkout, dados, {
          titulo: "Reserva Gratuita Confirmada! 🎉",
          descricao: `Sua reserva foi 100% coberta com ${qtd > 1 ? `seus ${qtd} vouchers de fidelidade` : "seu voucher de fidelidade"}! Bom jogo!`,
        });
        return;
      }

      setCheckout(resultado.checkout);
      setEtapa("pix");
      setCarregandoPix(true);
      const pix = await gerarPix(resultado.checkout, arena, tipoPagamento);
      setCarregandoPix(false);

      if (!pix.ok) {
        toast.error("Erro ao gerar cobrança Pix", { description: pix.erro });
        await cancelar(resultado.checkout);
        resetarCheckout();
        return;
      }
      setCobrancaPix(pix.cobranca);
      aguardarConfirmacao(resultado.checkout, () => undefined);
    },
    [
      quadraSelecionada,
      enviandoCheckout,
      iniciar,
      arena,
      dataSelecionada,
      horariosSelecionados,
      vouchersAtivosParaReserva,
      valorTotalBruto,
      resultadoDesconto,
      valorTotal,
      valorSinal,
      valorPendente,
      user?.id,
      recarregarReservas,
      finalizarComSucesso,
      gerarPix,
      cancelar,
      resetarCheckout,
      aguardarConfirmacao,
    ]
  );

  /** Pagamento identificado (webhook acompanhado, simulação ou modo offline). */
  const handlePagamentoConfirmado = useCallback(() => {
    if (!checkout) return;
    finalizarComSucesso(checkout, dadosForm, {
      titulo: "Reserva confirmada! 📱",
      descricao:
        tipoPagamentoEscolhido === "integral"
          ? "Pagamento integral confirmado! ✅"
          : "Sinal confirmado. O restante será pago no local. 👍",
    });
  }, [checkout, dadosForm, tipoPagamentoEscolhido, finalizarComSucesso]);

  /** Simula a liquidação do Pix (somente gateway simulado). */
  const handleSimularPagamento = useCallback(
    async (tipo: "sinal" | "integral") => {
      if (!checkout) return;
      const r = await simularPagamento(checkout, tipo);
      if (!r.ok) {
        toast.error("Não foi possível simular o pagamento", { description: r.erro });
      }
    },
    [checkout, simularPagamento]
  );

  /** Pix manual: o atleta avisa que pagou na chave da arena. */
  const handleInformarPagamento = useCallback(async () => {
    if (!checkout) return { ok: false, erro: "Reserva não encontrada." };
    return informarPagamento(checkout);
  }, [checkout, informarPagamento]);

  /** Pix manual já informado: fecha a tela sem cancelar (a arena confirma depois). */
  const handleFecharAguardandoArena = useCallback(() => {
    toast.success("Pagamento informado à arena", {
      description: "A arena vai conferir o Pix e confirmar. Acompanhe em Minha conta.",
    });
    resetarCheckout();
  }, [resetarCheckout]);

  /** Cancela o checkout e libera o lock. */
  const handleCancelarCheckout = useCallback(() => {
    if (checkout) void cancelar(checkout);
    resetarCheckout();
  }, [checkout, cancelar, resetarCheckout]);

  /** Volta do Pix para o formulário: libera o lock atual (um novo será criado ao confirmar). */
  const handleVoltarParaFormulario = useCallback(() => {
    if (checkout) void cancelar(checkout);
    setCheckout(null);
    setCobrancaPix(null);
    setEtapa("formulario");
  }, [checkout, cancelar]);

  // ── Render ──────────────────────────────────────────────────────────────

  const carrinhoContent = (
    <CarrinhoLateral
      quadraId={quadraSelecionada}
      data={dataSelecionada}
      horariosSelecionados={horariosSelecionados}
      valorTotal={valorTotalBruto}
      valorSinal={valorSinal}
      valorPendente={valorPendente}
      onContinuar={handleContinuar}
      onLimpar={handleLimpar}
      vouchersSelecionadosIds={vouchersSelecionadosIds}
      onToggleVoucher={handleToggleVoucher}
      onLimparVouchers={handleLimparVouchers}
      vouchersDisponiveis={vouchersDisponiveis}
    />
  );

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-slate-950">
        {/* ── Header (navegação da Landing Page) ────────────────────────── */}
        <LandingHeader secoes={secoesVisiveis} />

        {/* ── Seção Início: fluxo de reserva SEMPRE em primeiro lugar ────── */}
        <section
          id={SECAO_IDS.INICIO}
          aria-labelledby={ID_TITULO_RESERVA}
          className="scroll-mt-20"
        >
        {arena.modoPagamento === "simulado" && (
          <div role="note" className="max-w-7xl mx-auto px-4 pt-4">
            <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5">
              <strong>Demonstração.</strong> Este é um ambiente de apresentação do sistema de reservas
              {arena.nome ? ` para a ${arena.nome}` : ""}. Nenhum pagamento é cobrado e as reservas não são reais.
            </p>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-6 md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_360px] md:gap-6 lg:gap-8 md:items-start">
          {/* Coluna esquerda: seleção */}
          <main className="space-y-6 pb-10 md:pb-6">
            {/* Título compacto da reserva (único h1 da página) */}
            <CabecalhoReserva nomeArena={arena.nome} />
            {/* Alerta de conta bloqueada */}
            {user?.bloqueado && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-red-200 shadow-lg">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-lg">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-red-100">
                      Conta Temporariamente Restrita para Reservas
                    </h3>
                    <p className="text-xs text-red-300/90 mt-1 leading-relaxed">
                      Identificamos uma restrição em sua conta para agendamentos online. Para entender o motivo ou solicitar o desbloqueio, entre em contato com a administração.
                    </p>
                  </div>
                </div>
                <a
                  href={`https://wa.me/55${arena.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá, gostaria de entender o motivo do bloqueio da minha conta.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 font-bold text-xs flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                >
                  Falar com a Arena
                </a>
              </div>
            )}

            {/* Calendário horizontal */}
            <section>
              <CalendarioSelector
                dias={dias}
                dataSelecionada={dataSelecionada}
                onSelectData={handleSelectData}
              />
            </section>

            {/* Título da seção */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Quadras disponíveis
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Selecione os horários desejados diretamente na quadra.
              </p>
            </div>

            {!carregandoArena && listaQuadras.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
                Esta arena ainda não liberou quadras para reserva online.
              </div>
            )}

            {/* Quadras sempre expandidas verticalmente */}
            {listaQuadras.map((quadra) => {
              const isAtiva = quadraSelecionada === quadra.id;
              const horariosOcupados = getHorariosOcupados(dataSelecionada, quadra.id);

              return (
                <QuadraHorarioItem
                  key={`${quadra.id}-${dataSelecionada}`}
                  quadra={quadra}
                  dataSelecionada={dataSelecionada}
                  horariosSelecionados={isAtiva ? horariosSelecionados : []}
                  horariosOcupados={horariosOcupados}
                  avisosEscolinha={getAvisosEscolinha(dataSelecionada, quadra.id)}
                  isAtiva={isAtiva}
                  onToggleHorario={handleToggleHorario}
                  antecedenciaMinutos={antecedenciaMinutos}
                  precoDoHorario={precoDoHorarioPorQuadra.get(quadra.id)}
                />
              );
            })}

            {/* Mural de Vagas Abertas (Versão Mobile) */}
            {temVagas && (
              <div className="md:hidden pt-4">
                <MuralVagasAbertas />
              </div>
            )}
          </main>

          {/* Coluna direita: carrinho (desktop / tablet) e Mural de Vagas */}
          <aside className="hidden md:block sticky top-24 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[400px] flex flex-col">
              {carrinhoContent}
            </div>

            {/* Mural de Vagas Abertas posicionado abaixo do carrinho */}
            {temVagas && <MuralVagasAbertas />}
          </aside>
        </div>
        </section>

        {/* ── Seção: O Local e Estrutura (Galeria e Apresentação) ──────── */}
        {temFotosEstrutura && <SecaoEstrutura />}

        {/* ── Seção: Escolinhas e Aulas Esportivas ─────────────────────── */}
        {exibirEscolinhas && <SecaoEscolinhas />}

        {/* ── Seção: Localização e Contato (dados do cadastro da arena) ── */}
        <SecaoContato />

        {/* ── Rodapé ─────────────────────────────────────────────────── */}
        <LandingFooter secoes={secoesVisiveis} />

        {/* Botão flutuante carrinho (mobile) */}
        <BotaoCarrinhoMobile
          count={horariosSelecionados.length}
          valorSinal={valorSinal}
          onClick={() => setIsCarrinhoOpen(true)}
        />

        {/* Botão flutuante para retorno suave ao topo */}
        <BotaoVoltarAoTopo />
      </div>

      {/* Sheet mobile do carrinho */}
      <Sheet open={isCarrinhoOpen} onOpenChange={setIsCarrinhoOpen}>
        <SheetContent
          side="bottom"
          className="bg-slate-900 border-t border-slate-700 text-white rounded-t-3xl max-h-[88dvh] flex flex-col p-6 sm:px-8"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Resumo da Reserva</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{carrinhoContent}</div>
        </SheetContent>
      </Sheet>

      {/* Modal: Formulário de identificação, resumo, fidelidade e escolha de pagamento */}
      <FormularioIdentificacao
        open={etapa === "formulario"}
        quadraId={quadraSelecionada}
        data={dataSelecionada}
        horariosSelecionados={horariosSelecionados}
        valorTotalBruto={valorTotalBruto}
        valorTotal={valorTotal}
        valorSinal={valorSinal}
        valorPendente={valorPendente}
        vouchersDisponiveis={vouchersDisponiveis}
        vouchersSelecionadosIds={vouchersSelecionadosIds}
        onToggleVoucher={handleToggleVoucher}
        onLimparVouchers={handleLimparVouchers}
        onClose={handleCancelarCheckout}
        onConfirmar={handleFormConfirmar}
        enviando={enviandoCheckout}
      />

      {/* Modal: Pix */}
      <ModalPix
        open={etapa === "pix"}
        reservaId={checkout?.reservaId ?? null}
        tipoPagamento={tipoPagamentoEscolhido}
        valorSinal={checkout?.reserva.valorSinal ?? valorSinal}
        valorTotal={checkout?.reserva.valorTotal ?? valorTotal}
        nomeCliente={dadosForm?.nome ?? ""}
        cobrancaPix={cobrancaPix}
        carregando={carregandoPix}
        onSimularPagamento={handleSimularPagamento}
        onPagamentoConfirmado={handlePagamentoConfirmado}
        onVoltar={handleVoltarParaFormulario}
        onCancelar={handleCancelarCheckout}
        onInformarPagamento={handleInformarPagamento}
        onFecharAguardando={handleFecharAguardandoArena}
        nomeRecebedor={arena.pixManual?.nomeRecebedor}
      />

      {/* Modal: Convite de criação de conta pós-reserva para visitantes */}
      {dadosUltimaReserva && (
        <ModalPosReservaCadastro
          open={mostrarModalPosCadastro}
          reservaId={dadosUltimaReserva.id}
          checkoutToken={dadosUltimaReserva.checkoutToken}
          nomeCliente={dadosUltimaReserva.nome}
          whatsappCliente={dadosUltimaReserva.whatsapp}
          onClose={() => setMostrarModalPosCadastro(false)}
          onSucesso={() => setMostrarModalPosCadastro(false)}
        />
      )}
    </SmoothScrollProvider>
  );
}
