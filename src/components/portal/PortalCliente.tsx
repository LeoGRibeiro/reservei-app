"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { User, Sparkles, Gift } from "lucide-react";

import { CalendarioSelector } from "./CalendarioSelector";
import { QuadraHorarioItem } from "./QuadraHorarioItem";
import { CarrinhoLateral, BotaoCarrinhoMobile } from "./CarrinhoLateral";
import { FormularioIdentificacao, type DadosIdentificacao } from "./FormularioIdentificacao";
import { ModalPix } from "./ModalPix";
import { ModalPosReservaCadastro } from "./ModalPosReservaCadastro";
import { MuralVagasAbertas } from "@/components/vagas/MuralVagasAbertas";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingSecoesPlaceholder } from "@/components/landing/LandingSecoesPlaceholder";
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
import type { VoucherFidelidade } from "@/lib/fidelidade/types";
import { aplicarDescontoVouchers } from "@/lib/fidelidade/fidelidadeService";
import { isTelefoneBloqueado } from "@/lib/supabase/authService";
import {
  gerarDiasDisponiveis,
  getHoje,
  calcularValorTotal,
  calcularValorSinal,
  calcularValorPendente,
  saoConsecutivos,
  isHorarioExpirado,
} from "@/lib/constants";
import { QUADRAS_PADRAO } from "@/lib/arena/defaultArena";
import { useArena } from "@/hooks/useArena";
import { usePrecoCalculado } from "@/hooks/usePrecoCalculado";
import { solicitarPixParaReserva } from "@/lib/pagamento/pagamentoService";
import type { PixCobranca } from "@/lib/pagamento/types";

type Etapa = "formulario" | "pix";

export interface PortalClienteProps {
  /** Slug da arena para carregar dados multi-tenant (ex: subdomínio) */
  arenaSlug?: string;
}

export function PortalCliente({ arenaSlug }: PortalClienteProps = {}) {
  // ── Contexto da Arena Multi-Tenant ─────────────────────────────────────
  const { arena, quadras, precos } = useArena(arenaSlug);
  const listaQuadras = useMemo(() => {
    return quadras && quadras.length > 0 ? quadras : QUADRAS_PADRAO;
  }, [quadras]);
  // ── Estado de seleção ──────────────────────────────────────────────────
  const dias = useMemo(() => gerarDiasDisponiveis(), []);
  const [dataSelecionada, setDataSelecionada] = useState<string>(getHoje());
  const [quadraSelecionada, setQuadraSelecionada] = useState<string | null>(null);
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([]);

  // ── Checkout ────────────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [reservaIdAtual, setReservaIdAtual] = useState<string | null>(null);
  const [dadosForm, setDadosForm] = useState<DadosIdentificacao | null>(null);
  const [tipoPagamentoEscolhido, setTipoPagamentoEscolhido] = useState<"sinal" | "integral">("sinal");
  const [isCarrinhoOpen, setIsCarrinhoOpen] = useState(false);
  const [vouchersSelecionadosIds, setVouchersSelecionadosIds] = useState<string[]>([]);

  // ── Autenticação de Usuário & Fidelidade ──────────────────────────────────
  const { user, isAutenticado } = useUserAuth();
  const { progresso, consumirVouchersNoCheckout } = useFidelidadeService();
  const [mostrarModalPosCadastro, setMostrarModalPosCadastro] = useState(false);
  const [dadosUltimaReserva, setDadosUltimaReserva] = useState<{
    id: string;
    nome: string;
    whatsapp: string;
  } | null>(null);

  // ── Cobrança Pix Transacional ─────────────────────────────────────────────
  const [cobrancaPix, setCobrancaPix] = useState<PixCobranca | null>(null);
  const [carregandoPix, setCarregandoPix] = useState(false);

  // ── Service ─────────────────────────────────────────────────────────────
  const {
    reservas,
    getReservaById,
    getHorariosOcupados,
    criarReservaEmProcessamento,
    atualizarIdentificacao,
    atualizarDadosCheckout,
    confirmarPagamento,
    liberarLock,
  } = useReservasService();
  const { getAvisosEscolinha } = useContratosService();

  // ── Valores calculados dinamicamente ────────────────────────────────────
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

  const vouchersAtivosParaReserva = useMemo(() => {
    return progresso.vouchersDisponiveis.filter((v) =>
      vouchersSelecionadosIds.includes(v.id)
    );
  }, [vouchersSelecionadosIds, progresso.vouchersDisponiveis]);

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
    return precoDinamico.valorSinal > 0
      ? precoDinamico.valorSinal
      : calcularValorSinal(valorTotal);
  }, [valorTotal, resultadoDesconto, arena.percentualSinalMinimo, precoDinamico.valorSinal]);

  const valorPendente = useMemo(() => {
    return Math.round((valorTotal - valorSinal) * 100) / 100;
  }, [valorTotal, valorSinal]);

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
        const nomeQuadra = listaQuadras.find((q) => q.id === quadraId)?.numero;
        toast.info(`Selecionada Quadra ${nomeQuadra}`);
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
    [quadraSelecionada, user?.bloqueado]
  );

  const handleLimpar = useCallback(() => {
    setHorariosSelecionados([]);
    setQuadraSelecionada(null);
    setVouchersSelecionadosIds([]);
  }, []);

  const handleContinuar = useCallback(async () => {
    if (!quadraSelecionada || horariosSelecionados.length === 0) return;

    const tel = user?.telefone ? user.telefone.replace(/\D/g, "") : "";
    const estaBloqueado = Boolean(user?.bloqueado) || (tel ? await isTelefoneBloqueado(tel) : false);

    if (estaBloqueado) {
      toast.error("Conta bloqueada para novas reservas", {
        description: "Sua conta está com restrição para novos agendamentos. Por favor, entre em contato para entender o motivo.",
      });
      return;
    }

    for (const h of horariosSelecionados) {
      if (isHorarioExpirado(dataSelecionada, h, 10)) {
        toast.error("Horário expirado", {
          description: "O horário escolhido já passou ou está muito próximo (menos de 10 min). Por favor, escolha outro.",
        });
        return;
      }
    }

    const id = criarReservaEmProcessamento({
      arenaId: arena.id,
      quadraId: quadraSelecionada,
      data: dataSelecionada,
      horarios: horariosSelecionados,
      userId: user?.id,
      valorTotal: valorTotalBruto,
      valorSinal,
      valorPendente,
    });
    setReservaIdAtual(id);
    setIsCarrinhoOpen(false);
    setEtapa("formulario");
  }, [
    arena.id,
    quadraSelecionada,
    horariosSelecionados,
    dataSelecionada,
    user?.id,
    user?.bloqueado,
    user?.telefone,
    valorTotalBruto,
    valorSinal,
    valorPendente,
    criarReservaEmProcessamento,
  ]);

  /** Formulário de dados e escolha de pagamento confirmados */
  const handleFormConfirmar = useCallback(
    (dados: DadosIdentificacao, tipoPagamento: "sinal" | "integral") => {
      if (!reservaIdAtual) return;
      setDadosForm(dados);
      setTipoPagamentoEscolhido(tipoPagamento);
      atualizarIdentificacao(reservaIdAtual, {
        nomeCliente: dados.nome,
        whatsappCliente: dados.whatsapp,
        cpfCliente: "",
        esporte: dados.esporte || undefined,
        observacoes: dados.observacoes || undefined,
      });

      const descontoVal = resultadoDesconto ? resultadoDesconto.valorDesconto : 0;
      const isGratis = valorTotal === 0 && vouchersAtivosParaReserva.length > 0;
      const codigosVouchers = vouchersAtivosParaReserva.map((v) => v.codigo);

      atualizarDadosCheckout(reservaIdAtual, {
        valorTotal,
        valorSinal: isGratis ? 0 : (tipoPagamento === "integral" ? valorTotal : valorSinal),
        valorPendente: isGratis ? 0 : (tipoPagamento === "integral" ? 0 : valorPendente),
        valorOriginal: valorTotalBruto,
        descontoFidelidade: descontoVal,
        vouchersUtilizados: codigosVouchers,
        reservaGratuitaFidelidade: isGratis,
        metodoPagamento: isGratis
          ? "fidelidade"
          : vouchersAtivosParaReserva.length > 0
          ? "misto"
          : "pix",
      });

      // Se a reserva for 100% coberta pelos vouchers de fidelidade (valorTotal === 0)
      if (isGratis) {
        confirmarPagamento(reservaIdAtual, "integral");

        // Consome os vouchers selecionados utilizados nesta reserva
        void consumirVouchersNoCheckout(
          vouchersAtivosParaReserva.map((v) => v.id),
          reservaIdAtual
        );
        setVouchersSelecionadosIds([]);

        // Se visitante sem conta, salva dados para convidar a criar senha
        if (!isAutenticado && dados) {
          setDadosUltimaReserva({
            id: reservaIdAtual,
            nome: dados.nome,
            whatsapp: dados.whatsapp,
          });
          setMostrarModalPosCadastro(true);
        }

        // Reseta estado local
        setEtapa(null);
        setReservaIdAtual(null);
        setDadosForm(null);
        setHorariosSelecionados([]);
        setQuadraSelecionada(null);

        const qtdVch = vouchersAtivosParaReserva.length;
        toast.success("Reserva Gratuita Confirmada! 🎉", {
          description: `Sua reserva foi 100% coberta com ${
            qtdVch > 1
              ? `seus ${qtdVch} vouchers de fidelidade`
              : "seu voucher de fidelidade"
          }! Bom jogo!`,
          duration: 7000,
        });
        return;
      }

      setEtapa("pix");
      setCarregandoPix(true);
      const reserva = getReservaById(reservaIdAtual);
      if (reserva) {
        void solicitarPixParaReserva({
          reserva: {
            ...reserva,
            nomeCliente: dados.nome,
            whatsappCliente: dados.whatsapp,
            valorTotal,
            valorSinal: tipoPagamento === "integral" ? valorTotal : valorSinal,
            valorPendente: tipoPagamento === "integral" ? 0 : valorPendente,
          },
          arena,
          tipoPagamento,
        })
          .then((resultado) => {
            if (resultado.sucesso && resultado.cobranca) {
              setCobrancaPix(resultado.cobranca);
            } else {
              toast.error("Erro ao gerar cobrança Pix", {
                description: resultado.erro || "Tente novamente ou fale com a arena.",
              });
            }
          })
          .finally(() => {
            setCarregandoPix(false);
          });
      } else {
        setCarregandoPix(false);
      }
    },
    [
      reservaIdAtual,
      getReservaById,
      arena,
      atualizarIdentificacao,
      atualizarDadosCheckout,
      valorTotal,
      valorTotalBruto,
      valorSinal,
      valorPendente,
      resultadoDesconto,
      vouchersAtivosParaReserva,
      confirmarPagamento,
      consumirVouchersNoCheckout,
      isAutenticado,
    ]
  );

  /**
   * Simula pagamento Pix — confirmação com o tipo escolhido previamente.
   */
  const handleSimularPagamento = useCallback(
    (tipo: "sinal" | "integral") => {
      if (!reservaIdAtual) return;

      // Validação de 1 minuto antes do início do primeiro horário
      if (horariosSelecionados.length > 0) {
        const primeiroHorario = [...horariosSelecionados].sort()[0];
        if (isHorarioExpirado(dataSelecionada, primeiroHorario, 1)) {
           toast.error("Tempo esgotado para pagamento", {
             description: "O pagamento deve ser feito até 1 minuto antes do início do horário.",
           });
           return;
        }
      }

      confirmarPagamento(reservaIdAtual, tipo);

      // Consome os vouchers de fidelidade selecionados se foram aplicados nesta reserva
      if (vouchersAtivosParaReserva.length > 0 && reservaIdAtual) {
        void consumirVouchersNoCheckout(
          vouchersAtivosParaReserva.map((v) => v.id),
          reservaIdAtual
        );
        setVouchersSelecionadosIds([]);
      }

      // Se visitante sem conta, salva dados para convidar a criar senha
      if (!isAutenticado && dadosForm) {
        setDadosUltimaReserva({
          id: reservaIdAtual,
          nome: dadosForm.nome,
          whatsapp: dadosForm.whatsapp,
        });
        setMostrarModalPosCadastro(true);
      }

      // Reseta estado local
      setEtapa(null);
      setReservaIdAtual(null);
      setDadosForm(null);
      setCobrancaPix(null);
      setCarregandoPix(false);
      setHorariosSelecionados([]);
      setQuadraSelecionada(null);

      const descricao =
        tipo === "integral"
          ? "Pagamento integral confirmado! ✅"
          : "Sinal confirmado. O restante será pago no local. 👍";

      toast.success("Mensagem enviada no WhatsApp 📱", {
        description: descricao,
        duration: 6000,
      });
    },
    [
      reservaIdAtual,
      confirmarPagamento,
      isAutenticado,
      dadosForm,
      dataSelecionada,
      horariosSelecionados,
      vouchersAtivosParaReserva,
      consumirVouchersNoCheckout,
    ]
  );

  /** Cancela checkout e libera o lock */
  const handleCancelarCheckout = useCallback(() => {
    if (reservaIdAtual) liberarLock(reservaIdAtual);
    setEtapa(null);
    setReservaIdAtual(null);
    setDadosForm(null);
    setCobrancaPix(null);
    setCarregandoPix(false);
  }, [reservaIdAtual, liberarLock]);

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
      vouchersDisponiveis={progresso.vouchersDisponiveis}
    />
  );

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-slate-950">
        {/* ── Header (navegação da Landing Page) ────────────────────────── */}
        <LandingHeader />

        {/* ── Seção Início: fluxo de reserva SEMPRE em primeiro lugar ────── */}
        <section
          id={SECAO_IDS.INICIO}
          aria-labelledby={ID_TITULO_RESERVA}
          className="scroll-mt-20"
        >
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
                  href={`https://wa.me/5500000000000?text=${encodeURIComponent("Olá, gostaria de entender o motivo do bloqueio da minha conta no Reservei.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 font-bold text-xs flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                >
                  Falar com Suporte
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

            {/* Quadras sempre expandidas verticalmente */}
            {listaQuadras.map((quadra) => {
              const isAtiva = quadraSelecionada === quadra.id;
              const horariosOcupados = getHorariosOcupados(
                dataSelecionada,
                quadra.id
              );

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
                />
              );
            })}

            {/* Mural de Vagas Abertas (Versão Mobile) */}
            <div className="md:hidden pt-4">
              <MuralVagasAbertas />
            </div>
          </main>

          {/* Coluna direita: carrinho (desktop / tablet) e Mural de Vagas */}
          <aside className="hidden md:block sticky top-24 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[400px] flex flex-col">
              {carrinhoContent}
            </div>

            {/* Mural de Vagas Abertas posicionado abaixo do carrinho */}
            <MuralVagasAbertas />
          </aside>
        </div>
        </section>

        {/* ── Seção: O Local e Estrutura (Galeria e Apresentação) ──────── */}
        <SecaoEstrutura />

        {/* ── Seção: Escolinhas e Aulas Esportivas ─────────────────────── */}
        <SecaoEscolinhas />

        {/* ── Seções institucionais futuras (placeholders das próximas specs) ── */}
        <LandingSecoesPlaceholder />

        {/* ── Rodapé ─────────────────────────────────────────────────── */}
        <LandingFooter />

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
        vouchersDisponiveis={progresso.vouchersDisponiveis}
        vouchersSelecionadosIds={vouchersSelecionadosIds}
        onToggleVoucher={handleToggleVoucher}
        onLimparVouchers={handleLimparVouchers}
        onClose={handleCancelarCheckout}
        onConfirmar={handleFormConfirmar}
      />

      {/* Modal: Pix */}
      <ModalPix
        open={etapa === "pix"}
        reservaId={reservaIdAtual}
        tipoPagamento={tipoPagamentoEscolhido}
        valorSinal={valorSinal}
        valorTotal={valorTotal}
        nomeCliente={dadosForm?.nome ?? ""}
        cobrancaPix={cobrancaPix}
        carregando={carregandoPix}
        onSimularPagamento={handleSimularPagamento}
        onVoltar={() => setEtapa("formulario")}
        onCancelar={handleCancelarCheckout}
      />

      {/* Modal: Convite de criação de conta pós-reserva para visitantes */}
      {dadosUltimaReserva && (
        <ModalPosReservaCadastro
          open={mostrarModalPosCadastro}
          reservaId={dadosUltimaReserva.id}
          nomeCliente={dadosUltimaReserva.nome}
          whatsappCliente={dadosUltimaReserva.whatsapp}
          onClose={() => setMostrarModalPosCadastro(false)}
          onSucesso={() => setMostrarModalPosCadastro(false)}
        />
      )}
    </SmoothScrollProvider>
  );
}
