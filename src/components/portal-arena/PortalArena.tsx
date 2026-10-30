/**
 * @file PortalArena.tsx
 * @description Portal público da arena (template multiarena). Recebe do servidor tudo o que é
 * público (`DadosPortal`) e cuida, no navegador, do relógio, da grade atualizada, da sessão do
 * atleta, da seleção de horários, do checkout e dos menus. Visual e comportamento portados do
 * protótipo aprovado (SPEC/2026-10-30-implementacao-template-portal.md).
 */

"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
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
  horasGratisValidas,
  proximasReservas,
  totalCarimbos,
  type AtletaPortal,
} from "@/lib/portal/contaAtleta";
import { pedirVaga } from "@/lib/portal/contaRepository";
import { baixarIcs, montarIcs } from "@/lib/portal/ics";
import { destacar, rolarAte, rolarParaTopo } from "@/lib/portal/rolagem";
import { itensDoMenu, secoesVisiveis } from "@/lib/portal/visibilidade";
import type { DadosPortal } from "@/lib/portal/types";
import { FUSO_PADRAO_ARENA } from "@/lib/datas/fusoHorario";
import { useCheckoutPortal } from "@/hooks/portal/useCheckoutPortal";
import { useGradePortal, useSessaoPortal } from "@/hooks/portal/useContaPortal";
import { useMidia, useRelogio, useRolagemDaPagina, useSecaoVisivel } from "@/hooks/portal/usePortalBasico";
import { useAviso } from "./base/Aviso";
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
}

/**
 * @example
 * ```tsx
 * const dados = await carregarDadosPortal(slug);
 * return <PortalArena dados={dados} />;
 * ```
 */
export function PortalArena({ dados }: PortalArenaProps) {
  return (
    <RaizPortal tema={dados.tema}>
      <ConteudoPortal dados={dados} />
    </RaizPortal>
  );
}

function ConteudoPortal({ dados }: PortalArenaProps) {
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

  // ── Seções e menu ──────────────────────────────────────────────────────
  const secoes = useMemo(() => secoesVisiveis(dados), [dados]);
  const itens = useMemo(() => itensDoMenu(secoes), [secoes]);
  const ativa = useSecaoVisivel(itens.map((i) => i.id));
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

  // O corpo ganha espaço para a barra do celular enquanto há seleção (igual ao protótipo)
  useEffect(() => {
    document.querySelector(".pa")?.classList.toggle("tem-barra", Boolean(resumo));
  }, [resumo]);

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
  const navegar = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      fecharMenus();
      if (checkoutAberto) setCheckoutAberto(false);
      rolarAte(id);
      history.replaceState(null, "", `#${id}`);
    },
    [checkoutAberto, fecharMenus]
  );

  const entrar = useCallback(() => {
    window.location.href = "/login";
  }, []);
  const criarConta = useCallback(() => {
    window.location.href = "/cadastro";
  }, []);
  const abrirConta = useCallback(() => {
    window.location.href = "/minha-conta";
  }, []);
  const sair = useCallback(async () => {
    fecharMenus();
    await sessao.sair();
    aviso("Você saiu da conta.");
  }, [aviso, fecharMenus, sessao]);

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
      if (!atleta) {
        entrar();
        return;
      }
      if (await pedirVaga(p.id, atleta)) {
        await sessao.recarregarConta();
        aviso(`Pedido enviado. ${p.organizador} recebe no WhatsApp e confirma com você.`);
      } else {
        aviso("Não foi possível enviar o pedido. Tente de novo.");
      }
    },
    [atleta, aviso, entrar, sessao]
  );

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
        aoAbrirConta={abrirConta}
        aoNavegar={navegar}
      />

      <main id="portal">
        <SecaoReservar
          intro={conteudo.introReserva}
          dia={dia}
          hoje={hoje}
          aviso={avisoDoDia({ dia, hoje, agoraMin, antecedenciaMin: arena.antecedenciaMinimaMinutos, periodos })}
          muralNaLateral={muralNaLateral}
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
                situacaoDoHorario({ quadraId: q.id, dia, h, hoje, agoraMin, antecedenciaMin: arena.antecedenciaMinimaMinutos, indice, minhas })
              }
              preco={(h) => precoDaHora(q, precos, dia, h)}
              selecionadas={selecao.quadraId === q.id ? selecao.horas : []}
              aoAlternar={(h) => setSelecao((s) => alternarHora(s, q.id, h))}
              aoVerAula={(escolinhaId) => destacar(escolinhaId ? idEscolinha(escolinhaId) : "escolinhas")}
              aoVerReserva={() => abrirConta()}
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
                aoVerPedidos={() => abrirConta()}
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
            aoUsarHoraGratis={() => {
              setUsarHoraGratis(true);
              rolarAte("reservar");
              aviso("A hora grátis entra no ticket assim que você escolher um horário.");
            }}
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
        aoEntrar={entrar}
        aoVerReservas={() => abrirConta()}
        aoCriarConta={criarConta}
        aoBaixarAgenda={baixarAgenda}
      />
    </>
  );
}
