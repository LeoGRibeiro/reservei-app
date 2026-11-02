/**
 * @file PortalArena.tsx
 * @description Portal público da arena (template multiarena). Recebe do servidor tudo o que é
 * público (`DadosPortal`) e cuida, no navegador, do relógio, da grade atualizada, da sessão do
 * atleta, da seleção de horários, do checkout e dos menus. Visual e comportamento portados do
 * protótipo aprovado (SPEC/2026-10-30-implementacao-template-portal.md).
 */

"use client";

import { motivoFechamentoParaAtleta, quadraFechadaEm } from "@/lib/arena/bloqueioQuadra";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  SELECAO_VAZIA,
  alternarHora,
  avisoDoDia,
  chaveHorario,
  diasDaGrade,
  hojeNoFusoArena,
  indexarGrade,
  minutosNoFusoArena,
  periodosDoDia,
  precoDaHora,
  resumirSelecao,
  situacaoDoHorario,
  type Selecao,
} from "@/lib/portal/agenda";
import {
  carimbosValidos,
  horasAteOJogo,
  horasGratisValidas,
  proximasReservas,
  totalCarimbos,
  type AtletaPortal,
  type PedidoVaga,
  type ReservaAtleta,
} from "@/lib/portal/contaAtleta";
import { pedirVaga } from "@/lib/portal/contaRepository";
import { excluirMinhaConta, marcarPedido, salvarPerfil, type ModoAcesso } from "@/lib/portal/contaApi";
import { cancelarReservaDoAtleta, atualizarVagasDoAtleta } from "@/lib/reservas/reservasApi";
import { diaCurto, esporteNaFrase, hh, plural, primeiroNome, rotuloEsporte } from "@/lib/portal/formatos";
import { supabase } from "@/lib/supabase/client";
import { baixarIcs, montarIcs } from "@/lib/portal/ics";
import { destacar, remedirRolagem, rolarAte, rolarParaTopo } from "@/lib/portal/rolagem";
import { itensDoMenu, secoesVisiveis } from "@/lib/portal/visibilidade";
import type { DadosPortal } from "@/lib/portal/types";
import { FUSO_PADRAO_ARENA } from "@/lib/datas/fusoHorario";
import { useCheckoutPortal } from "@/hooks/portal/useCheckoutPortal";
import { useGradePortal, useSessaoPortal } from "@/hooks/portal/useContaPortal";
import { useMidia, useRelogio, useRolagemDaPagina, useSecaoVisivel } from "@/hooks/portal/usePortalBasico";
import { useAviso } from "./base/Aviso";
import { DialogoSimples } from "./base/DialogoSimples";
import { AreaAtleta, type AbaConta } from "./conta/AreaAtleta";
import { DialogoConta, type ReservaSemConta } from "./conta/DialogoConta";
import { CorpoCancelar, CorpoExcluirConta, CorpoProcurarJogadores } from "./conta/DialogosConta";
import { DialogoCheckout } from "./checkout/DialogoCheckout";
import { BarraTicket } from "./reservar/BarraTicket";
import { CardQuadra } from "./reservar/CardQuadra";
import { FichasDatas } from "./reservar/FichasDatas";
import { MuralPartidas, type PartidaMural } from "./reservar/MuralPartidas";
import { SecaoReservar } from "./reservar/SecaoReservar";
import { TicketReserva } from "./reservar/TicketReserva";
import { RaizPortal } from "./RaizPortal";
import { RodapeArena } from "./RodapeArena";
import { SecaoClube } from "./secoes/SecaoClube";
import { SecaoContato } from "./secoes/SecaoContato";
import { SecaoEscolinhas, idEscolinha } from "./secoes/SecaoEscolinhas";
import { SecaoEstrutura } from "./secoes/SecaoEstrutura";
import { SecaoEventos } from "./secoes/SecaoEventos";
import { SecaoInstagram } from "./secoes/SecaoInstagram";
import { TopoArena } from "./TopoArena";
import { Icone } from "./Icone";

export interface PortalArenaProps {
  dados: DadosPortal;
  /** Abre direto na Minha conta (rota /minha-conta) */
  visaoInicial?: "portal" | "conta";
  abaInicial?: AbaConta;
  /** Abre o diálogo de conta ao carregar (/login e /cadastro redirecionam com ?conta=) */
  contaInicial?: "entrar" | "criar";
}

/** Diálogo simples aberto. */
type DialogoAberto =
  | { tipo: "cancelar"; reserva: ReservaAtleta; cancelada: boolean }
  | { tipo: "vagas"; reservaId: string; etapa: number }
  | { tipo: "excluir" };

/** O que rolar depois que a visão (portal ou conta) trocar. */
type RolagemPendente = { alvo: string; folga?: number } | { topo: true; foco?: string };

const ROTA_ABA: Record<AbaConta, string> = { reservas: "/minha-conta", clube: "/minha-conta/clube", dados: "/minha-conta/dados" };

/**
 * @example
 * ```tsx
 * const dados = await carregarDadosPortal(slug);
 * return <PortalArena dados={dados} />;
 * ```
 */
export function PortalArena(props: PortalArenaProps) {
  return (
    <RaizPortal tema={props.dados.tema}>
      <ConteudoPortal {...props} />
    </RaizPortal>
  );
}

function ConteudoPortal({ dados, visaoInicial = "portal", abaInicial = "reservas", contaInicial }: PortalArenaProps) {
  const { arena, quadras, precos, conteudo, clube } = dados;
  const aviso = useAviso();

  // ── Relógio e dia ──────────────────────────────────────────────────────
  const agora = useRelogio(dados.agoraIso);
  const hoje = hojeNoFusoArena(agora, FUSO_PADRAO_ARENA);
  const agoraMin = minutosNoFusoArena(agora, FUSO_PADRAO_ARENA);
  const dias = useMemo(() => diasDaGrade(hoje), [hoje]);
  const [dia, setDia] = useState(hoje);
  const periodos = useMemo(() => periodosDoDia(arena.horarioAbertura, arena.horarioFechamento), [arena]);

  // ── Dados vivos: grade e conta ─────────────────────────────────────────
  const { grade, recarregarGrade } = useGradePortal(arena.id, dados.grade, hoje);
  const sessao = useSessaoPortal(arena.id, hoje, agoraMin);
  const atleta: AtletaPortal | null = sessao.atleta;
  const indice = useMemo(() => indexarGrade(grade, agora), [grade, agora]);
  const minhas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of sessao.conta.reservas) {
      if (r.situacao !== "ativa") continue;
      for (const h of r.horas) mapa.set(chaveHorario(r.data, r.quadraId, h), r.id);
    }
    return mapa;
  }, [sessao.conta.reservas]);

  // ── Visão (portal ou Minha conta) e diálogos da conta ─────────────────
  const [visao, setVisao] = useState<"portal" | "conta">(visaoInicial);
  const [aba, setAba] = useState<AbaConta>(abaInicial);
  const [editando, setEditando] = useState(false);
  const [dialogoConta, setDialogoConta] = useState<{ aberto: boolean; modo: ModoAcesso; motivo?: string }>({
    aberto: Boolean(contaInicial),
    modo: contaInicial ?? "entrar",
  });
  const [reservaSemConta, setReservaSemConta] = useState<ReservaSemConta | null>(null);
  const [dlg, setDlg] = useState<DialogoAberto | null>(null);
  const [dlgEnviando, setDlgEnviando] = useState(false);
  const rolarDepois = useRef<RolagemPendente | null>(null);
  /** Ação pedida por visitante que continua sozinha depois de entrar (ex.: pedir vaga) */
  const depoisDeEntrar = useRef<((conta: { id: string; nome: string; whatsappDigitos: string }) => Promise<void>) | null>(null);

  // ── Seções e menu ──────────────────────────────────────────────────────
  const secoes = useMemo(() => secoesVisiveis(dados), [dados]);
  const itens = useMemo(() => itensDoMenu(secoes), [secoes]);
  const ativa = useSecaoVisivel(itens.map((i) => i.id), visao === "portal");
  const { rolado, mostrarSubir } = useRolagemDaPagina();
  const muralNaLateral = useMidia("(min-width: 1120px)", true);
  const [menuPerfil, setMenuPerfil] = useState(false);
  const [menuCelular, setMenuCelular] = useState(false);
  const [muralAberto, setMuralAberto] = useState(false);

  // ── Clube do atleta ────────────────────────────────────────────────────
  const meta = clube?.meta ?? 10;
  const carimbos = atleta ? totalCarimbos(sessao.conta.carimbos, hoje, meta) : 0;
  const horasGratis = atleta ? horasGratisValidas(sessao.conta.horasGratis, hoje) : [];
  const tetoHoraGratis = clube?.valorTeto ?? horasGratis[0]?.teto ?? 0;

  // ── Seleção e valores ──────────────────────────────────────────────────
  const [selecao, setSelecao] = useState<Selecao>(SELECAO_VAZIA);
  const [integral, setIntegral] = useState(false);
  const [usarHoraGratis, setUsarHoraGratis] = useState(false);
  const quadraSelecionada = quadras.find((q) => q.id === selecao.quadraId) ?? null;
  const resumo = useMemo(
    () =>
      quadraSelecionada && selecao.horas.length
        ? resumirSelecao({
            quadra: quadraSelecionada,
            horas: selecao.horas,
            dia,
            precos,
            percentualSinal: arena.percentualSinal,
            integral,
            tetoHoraGratis: atleta && usarHoraGratis && horasGratis.length ? tetoHoraGratis : null,
          })
        : null,
    [quadraSelecionada, selecao.horas, dia, precos, arena.percentualSinal, integral, atleta, usarHoraGratis, horasGratis.length, tetoHoraGratis]
  );

  // O corpo ganha espaço para a barra do celular enquanto há seleção; na conta, a barra some
  useEffect(() => {
    document.querySelector(".pa")?.classList.toggle("tem-barra", Boolean(resumo));
  }, [resumo]);
  useEffect(() => {
    document.querySelector(".pa")?.classList.toggle("em-conta", visao === "conta");
  }, [visao]);

  // Depois de trocar entre portal e conta (ou de aba), rola para onde a ação pediu
  useEffect(() => {
    const pendente = rolarDepois.current;
    if (!pendente) return;
    rolarDepois.current = null;
    remedirRolagem();
    if ("topo" in pendente) {
      rolarParaTopo(true);
      if (pendente.foco) {
        const foco = pendente.foco;
        requestAnimationFrame(() => destacar(foco));
      }
    } else {
      rolarAte(pendente.alvo, pendente.folga);
    }
  }, [visao, aba, sessao.carregando]);

  // /login e /cadastro chegam com ?conta=: o endereço volta a ser o do portal
  useEffect(() => {
    if (contaInicial) history.replaceState(null, "", "/");
  }, [contaInicial]);

  // ── Checkout ───────────────────────────────────────────────────────────
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  // Grade e conta só se atualizam quando o checkout fecha (atrás do diálogo, a seleção continua como estava)
  const checkout = useCheckoutPortal(aviso);

  const fecharMenus = useCallback(() => {
    setMenuPerfil(false);
    setMenuCelular(false);
  }, []);

  const abrirCheckout = useCallback(() => {
    if (!resumo) return;
    fecharMenus();
    setCheckoutAberto(true);
  }, [fecharMenus, resumo]);

  const fecharCheckout = useCallback(() => {
    setCheckoutAberto(false);
    if (checkout.etapa === "ok") {
      setSelecao(SELECAO_VAZIA);
      setUsarHoraGratis(false);
      void recarregarGrade();
      void sessao.recarregarConta();
    }
    checkout.encerrar();
  }, [checkout, recarregarGrade, sessao]);

  // ── Navegação ──────────────────────────────────────────────────────────

  const abrirDialogoConta = useCallback(
    (modo: ModoAcesso, motivo?: string) => {
      fecharMenus();
      setDialogoConta({ aberto: true, modo, motivo });
    },
    [fecharMenus]
  );
  const entrar = useCallback(() => abrirDialogoConta("entrar"), [abrirDialogoConta]);
  const criarConta = useCallback(() => abrirDialogoConta("criar"), [abrirDialogoConta]);

  /** Mostra a Minha conta numa aba (e destaca uma reserva, se pedido). */
  const abrirConta = useCallback(
    (novaAba: AbaConta = "reservas", codigoReserva?: string) => {
      fecharMenus();
      setCheckoutAberto(false);
      setEditando(false);
      setVisao("conta");
      setAba(novaAba);
      history.replaceState(null, "", ROTA_ABA[novaAba]);
      rolarDepois.current = { topo: true, foco: codigoReserva ? `rsv-${codigoReserva}` : undefined };
    },
    [fecharMenus]
  );

  /** Volta para o portal (se estava na conta) e rola até a seção. */
  const irParaSecao = useCallback(
    (id: string, folga?: number) => {
      fecharMenus();
      setCheckoutAberto(false);
      if (visao === "conta") {
        setVisao("portal");
        history.replaceState(null, "", `/#${id}`);
        rolarDepois.current = { alvo: id, folga };
      } else {
        rolarAte(id, folga);
        history.replaceState(null, "", `#${id}`);
      }
    },
    [fecharMenus, visao]
  );

  const sair = useCallback(async () => {
    fecharMenus();
    await sessao.sair();
    if (visao === "conta") {
      setVisao("portal");
      history.replaceState(null, "", "/");
      rolarDepois.current = { topo: true };
    }
    aviso("Você saiu da conta.");
  }, [aviso, fecharMenus, sessao, visao]);

  /** Entrou pelo diálogo de conta. */
  const aoEntrarNaConta = useCallback(
    async (nome: string, modo: ModoAcesso) => {
      setDialogoConta((c) => ({ ...c, aberto: false }));
      const primeiro = primeiroNome(nome);
      if (modo === "concluir") {
        const codigo = reservaSemConta ? reservaSemConta.reservaId : undefined;
        setReservaSemConta(null);
        aviso("Conta criada. Sua reserva já está em Minhas reservas.");
        abrirConta("reservas", codigo ? codigo.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() : undefined);
        return;
      }
      aviso(modo === "entrar" ? `Que bom te ver de novo, ${primeiro}!` : `Conta criada. Bem-vindo, ${primeiro}!`);
      const acao = depoisDeEntrar.current;
      depoisDeEntrar.current = null;
      if (acao) {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user.id;
        const digitos = (data.session?.user.email ?? "").split("@")[0];
        if (id) await acao({ id, nome, whatsappDigitos: digitos });
      }
    },
    [abrirConta, aviso, reservaSemConta]
  );

  const navegar = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      irParaSecao(id);
    },
    [irParaSecao]
  );

  // Fecha o menu do perfil ao tocar fora dele; Esc fecha os menus e devolve o foco
  useEffect(() => {
    if (!menuPerfil) return;
    const fora = (e: globalThis.MouseEvent) => {
      if (!(e.target as Element).closest(".conta-log")) setMenuPerfil(false);
    };
    document.addEventListener("click", fora);
    return () => document.removeEventListener("click", fora);
  }, [menuPerfil]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      const alvo = menuPerfil ? ".perfil" : menuCelular ? ".burger" : null;
      fecharMenus();
      if (alvo) document.querySelector<HTMLElement>(alvo)?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fecharMenus, menuCelular, menuPerfil]);

  // ── Mural ──────────────────────────────────────────────────────────────
  const partidas: PartidaMural[] = useMemo(() => {
    const pedidosFeitos = new Set(sessao.conta.pedidosFeitos.map((p) => p.reservaId));
    return grade
      .filter((g) => g.permiteVagas && g.vagasAbertas > 0 && g.horas.length > 0)
      .filter((g) => g.data > hoje || (g.data === hoje && g.horas[0] * 60 >= agoraMin))
      .map((g) => {
        const propria = Boolean(atleta && g.userId === atleta.id);
        return {
          id: g.id,
          data: g.data,
          inicio: g.horas[0],
          fim: g.horas[g.horas.length - 1] + 1,
          esporte: g.esporte ?? "",
          quadraNome: quadras.find((q) => q.id === g.quadraId)?.nome ?? "",
          organizador: g.organizador ?? "",
          propria,
          pedidos: propria ? sessao.conta.pedidosRecebidos.filter((p) => p.reservaId === g.id && p.status !== "combinado").length : 0,
          pedido: pedidosFeitos.has(g.id),
        };
      })
      .sort((a, b) => (a.data + String(a.inicio).padStart(2, "0")).localeCompare(b.data + String(b.inicio).padStart(2, "0")));
  }, [agoraMin, atleta, grade, hoje, quadras, sessao.conta.pedidosFeitos, sessao.conta.pedidosRecebidos]);

  const pedir = useCallback(
    async (p: PartidaMural) => {
      const enviarPedido = async (conta: { id: string; nome: string; whatsappDigitos: string }) => {
        const atual = grade.find((g) => g.id === p.id);
        if (atual?.userId === conta.id) {
          aviso("Essa partida é sua. Os pedidos aparecem em Minhas reservas.");
          return;
        }
        if (await pedirVaga(p.id, conta)) {
          await sessao.recarregarConta();
          aviso(`Pedido enviado. ${p.organizador} recebe no WhatsApp e confirma com você.`);
        } else {
          aviso("Não foi possível enviar o pedido. Tente de novo.");
        }
      };
      if (!atleta) {
        depoisDeEntrar.current = enviarPedido;
        abrirDialogoConta("entrar", `Entre para pedir vaga na partida de ${esporteNaFrase(rotuloEsporte(p.esporte))} com ${p.organizador}.`);
        return;
      }
      await enviarPedido(atleta);
    },
    [abrirDialogoConta, atleta, aviso, grade, sessao]
  );

  // ── Ações dos diálogos da conta ────────────────────────────────────────
  const nomeQuadra = useCallback((id: string) => quadras.find((q) => q.id === id)?.nome ?? "", [quadras]);
  const linhaReserva = (r: ReservaAtleta) =>
    `${nomeQuadra(r.quadraId)} · ${diaCurto(r.data, hoje)} · ${hh(r.horas[0])} às ${hh(r.horas[r.horas.length - 1] + 1)}`;
  const recarregarTudo = useCallback(async () => {
    await Promise.all([sessao.recarregarConta(), recarregarGrade()]);
  }, [recarregarGrade, sessao]);

  const confirmarCancelamento = useCallback(async () => {
    if (dlg?.tipo !== "cancelar") return;
    setDlgEnviando(true);
    const r = await cancelarReservaDoAtleta(dlg.reserva.id);
    setDlgEnviando(false);
    if (!r.ok) {
      aviso(r.erro ?? "Não foi possível cancelar. Fale com a arena.");
      return;
    }
    setDlg({ ...dlg, cancelada: true });
    await recarregarTudo();
  }, [aviso, dlg, recarregarTudo]);

  const mudarVagas = useCallback(
    async (reservaId: string, vagas: number, completa: boolean, mensagem: string) => {
      setDlgEnviando(true);
      const r = await atualizarVagasDoAtleta(reservaId, vagas, completa);
      setDlgEnviando(false);
      if (!r.ok) {
        aviso(r.erro ?? "Não foi possível atualizar o mural.");
        return;
      }
      await recarregarTudo();
      setDlg((d) => (d?.tipo === "vagas" ? { ...d, etapa: d.etapa + 1 } : d));
      aviso(mensagem);
    },
    [aviso, recarregarTudo]
  );

  const combinar = useCallback(
    async (reserva: ReservaAtleta, pedido: PedidoVaga) => {
      if (!(await marcarPedido(pedido.id, "combinado"))) {
        aviso("Não foi possível marcar o combinado.");
        return;
      }
      const faltam = reserva.vagasAbertas - 1;
      const primeiro = pedido.nome.split(" ")[0];
      if (faltam <= 0) await mudarVagas(reserva.id, 0, true, "Partida completa! Ela saiu do mural.");
      else await mudarVagas(reserva.id, faltam, false, `Combinado com ${primeiro}. Falta${faltam > 1 ? "m" : ""} ${plural(faltam, "jogador", "jogadores")}.`);
    },
    [aviso, mudarVagas]
  );

  const confirmarExclusao = useCallback(async () => {
    setDlgEnviando(true);
    const r = await excluirMinhaConta();
    setDlgEnviando(false);
    if (!r.ok) {
      aviso(r.erro ?? "Não foi possível excluir a conta.");
      return;
    }
    setDlg(null);
    await sessao.sair();
    setVisao("portal");
    history.replaceState(null, "", "/");
    rolarDepois.current = { topo: true };
    aviso("Sua conta foi excluída.");
  }, [aviso, sessao]);

  const salvarDados = useCallback(
    async (dadosPerfil: { nome: string; telefone: string; nascimento: string }) => {
      const r = await salvarPerfil(dadosPerfil);
      if (!r.ok) return r.erro ?? "Não foi possível salvar.";
      setEditando(false);
      await sessao.recarregarConta();
      aviso("Dados salvos.");
      return null;
    },
    [aviso, sessao]
  );

  const usarHoraGratisAgora = useCallback(() => {
    setUsarHoraGratis(true);
    irParaSecao("reservar");
    aviso("A hora grátis entra no ticket assim que você escolher um horário.");
  }, [aviso, irParaSecao]);

  const verMural = useCallback(() => {
    setMuralAberto(true);
    irParaSecao("partidas", 20);
  }, [irParaSecao]);

  const reservaPorId = (id: string) => sessao.conta.reservas.find((r) => r.id === id);
  const abrirVagas = (reservaId: string) => setDlg({ tipo: "vagas", reservaId, etapa: 0 });

  // ── Agenda (.ics) ──────────────────────────────────────────────────────
  const baixarAgenda = useCallback(() => {
    const c = checkout.confirmada;
    if (!c) return;
    const endereco = [arena.endereco, arena.bairro, `${arena.cidade} - ${arena.estado}`].filter(Boolean).join(" - ");
    baixarIcs(
      montarIcs({ id: c.reservaId, data: c.dia, horas: c.resumo.horas, quadra: c.resumo.quadra.nome, arena: arena.nome, endereco, fuso: FUSO_PADRAO_ARENA }),
      `reserva-${arena.slug}.ics`
    );
  }, [arena, checkout.confirmada]);

  const proximas = atleta ? proximasReservas(sessao.conta.reservas).length : 0;
  const ultimosCarimbos = carimbosValidos(sessao.conta.carimbos, hoje).map((c) => {
    const reserva = sessao.conta.reservas.find((r) => r.id === c.reservaId);
    return { data: c.data, horas: c.horas, quadraNome: quadras.find((q) => q.id === reserva?.quadraId)?.nome ?? "" };
  });
  const ddd = arena.whatsappDigitos.replace(/^55/, "").slice(0, 2) || "11";
  const linkInstagram = arena.instagram ? `https://www.instagram.com/${arena.instagram}/` : undefined;

  return (
    <>
      <TopoArena
        nomeArena={arena.nome}
        logoUrl={arena.logoUrl}
        itens={itens}
        ativa={ativa}
        atleta={
          atleta
            ? {
                nome: atleta.nome,
                primeiro: atleta.primeiro,
                whatsapp: atleta.whatsapp,
                proximas,
                clube: secoes.clube && clube ? { nome: clube.nome, carimbos, meta, horasGratis: horasGratis.length } : null,
              }
            : null
        }
        rolado={rolado}
        menuPerfilAberto={menuPerfil}
        menuCelularAberto={menuCelular}
        aoAlternarPerfil={() => {
          setMenuCelular(false);
          setMenuPerfil((v) => !v);
        }}
        aoAlternarCelular={() => {
          setMenuPerfil(false);
          setMenuCelular((v) => !v);
        }}
        aoFecharMenus={fecharMenus}
        aoEntrar={entrar}
        aoCriar={criarConta}
        aoSair={() => void sair()}
        aoAbrirConta={(novaAba) => abrirConta(novaAba)}
        aoNavegar={navegar}
      />

      <main id="portal" hidden={visao === "conta"}>
        <SecaoReservar
          intro={conteudo.introReserva}
          dia={dia}
          hoje={hoje}
          aviso={avisoDoDia({ dia, hoje, agoraMin, antecedenciaMin: arena.antecedenciaMinimaMinutos, periodos })}
          muralNaLateral={muralNaLateral}
          tambem={[
            ...(secoes.escolinhas ? [{ id: "escolinhas", rotulo: "Escolinhas" }] : []),
            ...(secoes.eventos ? [{ id: "eventos", rotulo: "Campeonatos" }] : []),
            ...(secoes.clube && clube ? [{ id: "clube", rotulo: clube.nome }] : []),
            ...(secoes.estrutura ? [{ id: "estrutura", rotulo: "Estrutura" }] : []),
            { id: "contato", rotulo: "Contato e endereço" },
          ]}
          clube={secoes.clube && clube ? { nome: clube.nome, meta } : null}
          aoNavegar={navegar}
          fichas={
            <FichasDatas
              dias={dias}
              selecionado={dia}
              hoje={hoje}
              aoEscolher={(d) => {
                setDia(d);
                setSelecao(SELECAO_VAZIA);
              }}
            />
          }
          quadras={quadras.map((q, i) => (
            <CardQuadra
              key={q.id}
              quadra={q}
              indice={i}
              periodos={periodos}
              situacao={(h) =>
                situacaoDoHorario({
                  quadraId: q.id,
                  dia,
                  h,
                  hoje,
                  agoraMin,
                  antecedenciaMin: arena.antecedenciaMinimaMinutos,
                  indice,
                  minhas,
                  fechada: quadraFechadaEm(q, dia) ? motivoFechamentoParaAtleta(q) : null,
                })
              }
              preco={(h) => precoDaHora(q, precos, dia, h)}
              selecionadas={selecao.quadraId === q.id ? selecao.horas : []}
              aoAlternar={(h) => setSelecao((s) => alternarHora(s, q.id, h))}
              aoVerAula={(escolinhaId) => destacar(escolinhaId ? idEscolinha(escolinhaId) : "escolinhas")}
              aoVerReserva={(reservaId) => abrirConta("reservas", reservaPorId(reservaId)?.codigo)}
            />
          ))}
          ticket={
            <TicketReserva
              resumo={resumo}
              dia={dia}
              hoje={hoje}
              nomeArena={arena.nome}
              logoUrl={arena.logoUrl}
              percentualSinal={arena.percentualSinal}
              nomeClube={secoes.clube && clube ? clube.nome : null}
              logado={Boolean(atleta)}
              temHoraGratis={horasGratis.length > 0}
              usarHoraGratis={usarHoraGratis}
              tetoHoraGratis={tetoHoraGratis}
              aoUsarHoraGratis={setUsarHoraGratis}
              aoContinuar={abrirCheckout}
              aoLimpar={() => setSelecao(SELECAO_VAZIA)}
            />
          }
          mural={
            secoes.partidas && partidas.length > 0 ? (
              <MuralPartidas
                partidas={partidas}
                hoje={hoje}
                aberto={muralAberto}
                aoAlternar={setMuralAberto}
                aoPedir={(p) => void pedir(p)}
                aoVerPedidos={abrirVagas}
              />
            ) : null
          }
        />

        {secoes.escolinhas && <SecaoEscolinhas intro={conteudo.introEscolinhas} escolinhas={dados.escolinhas} />}
        {secoes.eventos && (
          <SecaoEventos intro={conteudo.introEventos} eventos={dados.eventos} whatsappArena={arena.whatsappDigitos} linkInstagram={linkInstagram} />
        )}
        {secoes.clube && clube && (
          <SecaoClube
            clube={clube}
            nomeArena={arena.nome}
            logoUrl={arena.logoUrl}
            hoje={hoje}
            atleta={atleta ? { nome: atleta.nome, carimbos, ultimos: ultimosCarimbos, horasGratis } : null}
            aoCriarConta={criarConta}
            aoUsarHoraGratis={usarHoraGratisAgora}
            aoNavegar={navegar}
          />
        )}
        {secoes.estrutura && <SecaoEstrutura intro={conteudo.introEstrutura} fotos={dados.galeria} destaques={conteudo.destaquesEstrutura} />}
        {secoes.instagram && arena.instagram && (
          <SecaoInstagram
            usuario={arena.instagram}
            nomeArena={arena.nome}
            logoUrl={arena.logoUrl}
            perfil={dados.instagram.perfil}
            posts={dados.instagram.posts}
            hoje={hoje}
            fuso={FUSO_PADRAO_ARENA}
          />
        )}
        <SecaoContato arena={arena} />
      </main>

      <main className="mc" id="conta" aria-labelledby="cc-titulo" hidden={visao !== "conta"}>
        {visao === "conta" && (
          <AreaAtleta
            carregando={sessao.carregando}
            atleta={atleta}
            conta={sessao.conta}
            aba={aba === "clube" && !(secoes.clube && clube) ? "reservas" : aba}
            hoje={hoje}
            quadras={quadras}
            clube={secoes.clube ? clube : null}
            arena={arena}
            temMural={secoes.partidas}
            pedidosFeitos={partidas
              .filter((p) => p.pedido && !p.propria)
              .map((p) => ({ id: p.id, esporte: p.esporte, data: p.data, hora: p.inicio, quadraNome: p.quadraNome, organizador: p.organizador }))}
            editando={editando}
            aoEditar={setEditando}
            aoSalvarDados={salvarDados}
            aoTrocarAba={(novaAba) => {
              setAba(novaAba);
              setEditando(false);
              history.replaceState(null, "", ROTA_ABA[novaAba]);
              requestAnimationFrame(() => document.getElementById(`aba-${novaAba}`)?.focus());
            }}
            aoNavegar={navegar}
            aoEntrar={entrar}
            aoCriar={criarConta}
            aoSair={() => void sair()}
            aoExcluir={() => setDlg({ tipo: "excluir" })}
            aoCancelar={(id) => {
              const r = reservaPorId(id);
              if (r) setDlg({ tipo: "cancelar", reserva: r, cancelada: false });
            }}
            aoVagas={abrirVagas}
            aoAgenda={(r) => {
              const endereco = [arena.endereco, arena.bairro, `${arena.cidade} - ${arena.estado}`].filter(Boolean).join(" - ");
              baixarIcs(
                montarIcs({ id: r.id, data: r.data, horas: r.horas, quadra: nomeQuadra(r.quadraId), arena: arena.nome, endereco, fuso: FUSO_PADRAO_ARENA }),
                `reserva-${arena.slug}.ics`
              );
            }}
            aoVerMural={verMural}
            aoUsarHoraGratis={usarHoraGratisAgora}
          />
        )}
      </main>

      <RodapeArena arena={arena} itens={itens} ano={Number(hoje.slice(0, 4))} temPerguntas={conteudo.faq.length > 0} aoNavegar={navegar} />

      <BarraTicket resumo={resumo} aoContinuar={abrirCheckout} />
      <button type="button" className="subir" id="subir" aria-label="Voltar ao topo" hidden={!mostrarSubir} onClick={() => rolarParaTopo()}>
        <Icone nome="arrow-up" />
      </button>

      <DialogoCheckout
        aberto={checkoutAberto}
        aoFechar={fecharCheckout}
        etapa={checkout.etapa}
        resumo={resumo}
        confirmada={checkout.confirmada}
        dia={dia}
        hoje={hoje}
        arena={{
          nome: arena.nome,
          logoUrl: arena.logoUrl,
          percentualSinal: arena.percentualSinal,
          modoPagamento: arena.modoPagamento,
          recebedor: arena.nomeRecebedorPix,
          politica: arena.politicaCancelamento,
          dddWhatsapp: ddd,
        }}
        atleta={atleta ? { nome: atleta.nome, primeiro: atleta.primeiro, whatsapp: atleta.whatsapp } : null}
        clube={secoes.clube && clube ? { nome: clube.nome, meta, teto: clube.valorTeto ?? horasGratis[0]?.teto ?? null } : null}
        temHoraGratis={horasGratis.length > 0}
        usarHoraGratis={usarHoraGratis}
        aoUsarHoraGratis={setUsarHoraGratis}
        integral={integral}
        aoEscolherIntegral={setIntegral}
        pix={checkout.pix}
        enviando={checkout.enviando}
        aoEnviar={(d) =>
          resumo &&
          void checkout.enviarDados({
            arenaId: arena.id,
            resumo,
            dia,
            nome: d.nome,
            whatsapp: d.whatsapp,
            esporte: d.esporte,
            integral,
            horaGratisId: atleta && usarHoraGratis && horasGratis[0] ? horasGratis[0].id : null,
            carimbosAntes: carimbos,
          })
        }
        aoSimular={() => void checkout.simular()}
        aoInformarPagamento={() => void checkout.informarPagamento()}
        aoExpirar={checkout.expirar}
        aoVoltar={checkout.voltar}
        aoEntrar={() => abrirDialogoConta("entrar", "Entre para esta reserva virar carimbo no Clube.")}
        aoVerReservas={(reservaId) => abrirConta("reservas", reservaId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase())}
        aoCriarConta={() => {
          const c = checkout.confirmada;
          if (c) {
            setReservaSemConta({ nome: c.nome, whatsapp: c.whatsapp, horas: c.resumo.horas.length, reservaId: c.reservaId, checkoutToken: c.checkoutToken });
          }
          fecharCheckout();
          abrirDialogoConta("concluir");
        }}
        aoBaixarAgenda={baixarAgenda}
      />

      <DialogoConta
        aberto={dialogoConta.aberto}
        aoFechar={() => {
          depoisDeEntrar.current = null;
          setDialogoConta((c) => ({ ...c, aberto: false }));
        }}
        modoInicial={dialogoConta.modo}
        motivo={dialogoConta.motivo}
        arena={{ id: arena.id, nome: arena.nome, logoUrl: arena.logoUrl, ddd }}
        metaClube={secoes.clube && clube ? clube.meta : null}
        reservaSemConta={reservaSemConta}
        aoEntrar={(nome, modo) => void aoEntrarNaConta(nome, modo)}
      />

      <DialogoSimples
        aberto={Boolean(dlg)}
        aoFechar={() => setDlg(null)}
        titulo={dlg?.tipo === "cancelar" ? "Cancelar reserva" : dlg?.tipo === "vagas" ? "Procurar jogadores" : dlg?.tipo === "excluir" ? "Excluir conta" : ""}
        subtitulo={
          dlg?.tipo === "cancelar"
            ? linhaReserva(dlg.reserva)
            : dlg?.tipo === "vagas" && reservaPorId(dlg.reservaId)
              ? linhaReserva(reservaPorId(dlg.reservaId) as ReservaAtleta)
              : dlg?.tipo === "excluir"
                ? (atleta?.nome ?? "")
                : ""
        }
        chaveFoco={dlg?.tipo === "cancelar" ? String(dlg.cancelada) : dlg?.tipo === "vagas" ? String(dlg.etapa) : dlg?.tipo}
      >
        {dlg?.tipo === "cancelar" && (
          <CorpoCancelar
            reserva={dlg.reserva}
            quadraNome={nomeQuadra(dlg.reserva.quadraId)}
            hoje={hoje}
            horasAte={horasAteOJogo(dlg.reserva, hoje, agoraMin)}
            cancelada={dlg.cancelada}
            enviando={dlgEnviando}
            aoManter={() => setDlg(null)}
            aoConfirmar={() => void confirmarCancelamento()}
          />
        )}
        {dlg?.tipo === "vagas" && reservaPorId(dlg.reservaId) && (
          <CorpoProcurarJogadores
            key={dlg.reservaId}
            reserva={reservaPorId(dlg.reservaId) as ReservaAtleta}
            quadraNome={nomeQuadra((reservaPorId(dlg.reservaId) as ReservaAtleta).quadraId)}
            nomeArena={arena.nome}
            hoje={hoje}
            pedidos={sessao.conta.pedidosRecebidos.filter((p) => p.reservaId === dlg.reservaId && p.status !== "rejeitado")}
            agora={agora}
            enviando={dlgEnviando}
            aoPublicar={(faltam) => void mudarVagas(dlg.reservaId, faltam, false, "Sua partida está no mural.")}
            aoTirar={() => void mudarVagas(dlg.reservaId, 0, false, "Sua partida saiu do mural.")}
            aoChamar={(p) => {
              if (p.status === "pendente") void marcarPedido(p.id, "contatado").then(() => sessao.recarregarConta());
            }}
            aoCombinar={(p) => void combinar(reservaPorId(dlg.reservaId) as ReservaAtleta, p)}
            aoFechar={() => setDlg(null)}
            aoTrocarEtapa={() => setDlg({ ...dlg, etapa: dlg.etapa + 1 })}
          />
        )}
        {dlg?.tipo === "excluir" && (
          <CorpoExcluirConta
            carimbos={carimbos}
            horasGratis={horasGratis.length}
            jogosMarcados={proximas}
            enviando={dlgEnviando}
            aoManter={() => setDlg(null)}
            aoConfirmar={() => void confirmarExclusao()}
          />
        )}
      </DialogoSimples>
    </>
  );
}
