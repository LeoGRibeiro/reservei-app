/**
 * @file TopoArena.tsx
 * @description Topo azul fixo do portal: logo e nome, menu centralizado (≥1100 px) com scroll spy,
 * conta do visitante (Entrar, Criar conta) ou do atleta (Minhas reservas e menu do perfil) e o botão
 * de três linhas com o menu do celular.
 */

"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { plural } from "@/lib/portal/formatos";
import type { ItemMenu } from "@/lib/portal/visibilidade";
import { CarimbosMini } from "./base/Carimbos";
import { Icone } from "./Icone";

/** Resumo do Clube no menu do perfil. */
export interface ClubeNoMenu {
  nome: string;
  carimbos: number;
  meta: number;
  horasGratis: number;
}

/** Atleta no topo. */
export interface AtletaNoTopo {
  nome: string;
  primeiro: string;
  whatsapp: string;
  proximas: number;
  clube: ClubeNoMenu | null;
}

export interface TopoArenaProps {
  nomeArena: string;
  logoUrl: string;
  itens: ItemMenu[];
  /** Seção marcada pelo scroll spy */
  ativa: string | null;
  atleta: AtletaNoTopo | null;
  rolado: boolean;
  menuPerfilAberto: boolean;
  menuCelularAberto: boolean;
  aoAlternarPerfil: () => void;
  aoAlternarCelular: () => void;
  aoFecharMenus: () => void;
  aoEntrar: () => void;
  aoCriar: () => void;
  aoSair: () => void;
  /** Abre a conta numa aba (`reservas`, `clube`, `dados`) */
  aoAbrirConta: (aba: "reservas" | "clube" | "dados") => void;
  aoNavegar: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
}

const ROTA_ABA = { reservas: "/minha-conta", clube: "/minha-conta/clube", dados: "/minha-conta/dados" } as const;

/**
 * @example
 * ```tsx
 * <TopoArena nomeArena="Minha Arena" logoUrl="/logo.png" itens={itens} ativa="reservar" atleta={null} ... />
 * ```
 */
export function TopoArena(props: TopoArenaProps) {
  const { nomeArena, logoUrl, itens, ativa, atleta, rolado, menuPerfilAberto, menuCelularAberto } = props;
  const topo = useRef<HTMLElement>(null);
  const menuPerfil = useRef<HTMLDivElement>(null);

  // No celular o menu do perfil é fixo na tela: começa logo abaixo do topo azul, onde a página estiver
  useEffect(() => {
    if (menuPerfilAberto && topo.current && menuPerfil.current) {
      menuPerfil.current.style.setProperty("--menu-top", `${Math.round(topo.current.getBoundingClientRect().bottom) + 8}px`);
    }
  }, [menuPerfilAberto]);

  const irParaConta = (e: MouseEvent<HTMLAnchorElement>, aba: "reservas" | "clube" | "dados") => {
    e.preventDefault();
    props.aoAbrirConta(aba);
  };
  const links = () =>
    itens.map((item) => (
      <a key={item.id} href={`#${item.id}`} aria-current={ativa === item.id ? "location" : undefined} onClick={(e) => props.aoNavegar(e, item.id)}>
        {item.rotulo}
      </a>
    ));

  return (
    <header className="topo" id="topo" data-rolado={String(rolado)} ref={topo}>
      <div className="wrap topo-in">
        <a className="marca" href="#reservar" aria-label={`${nomeArena}, voltar ao início`} onClick={(e) => props.aoNavegar(e, "reservar")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
          <img src={logoUrl} alt="" width={388} height={374} />
          <b>{nomeArena}</b>
        </a>
        <nav className="nav" aria-label="Seções da página">
          {links()}
        </nav>
        <div className="conta">
          {!atleta ? (
            <div className="conta-vis">
              <button type="button" className="entrar" onClick={props.aoEntrar}>
                Entrar
              </button>
              <button type="button" className="criar" onClick={props.aoCriar}>
                Criar conta
              </button>
            </div>
          ) : (
            <div className="conta-log">
              <a className="minhas" href={ROTA_ABA.reservas} onClick={(e) => irParaConta(e, "reservas")}>
                <Icone nome="ticket" />
                <span>Minhas reservas</span>
              </a>
              <button
                type="button"
                className="perfil"
                aria-expanded={menuPerfilAberto}
                aria-controls="menu-perfil"
                aria-label={`Abrir menu da conta de ${atleta.primeiro}`}
                onClick={props.aoAlternarPerfil}
              >
                <span className="avatar" aria-hidden="true">
                  {atleta.primeiro.charAt(0)}
                </span>
                <span className="perfil-nome">{atleta.primeiro}</span>
                <Icone nome="chevron-down" />
              </button>
              <div className="menu-perfil" id="menu-perfil" hidden={!menuPerfilAberto} ref={menuPerfil}>
                <div className="mp-quem">
                  <span className="avatar avatar-g" id="mp-avatar" aria-hidden="true">
                    {atleta.primeiro.charAt(0)}
                  </span>
                  <div>
                    <b id="mp-nome">{atleta.nome}</b>
                    <span className="num" id="mp-whats">
                      {atleta.whatsapp}
                    </span>
                  </div>
                </div>
                {atleta.clube && (
                  <div className="mp-clube" id="mp-clube">
                    <p className="mp-clube-tit">
                      <b>{atleta.clube.nome}</b>
                      <span className="num">{`${atleta.clube.carimbos} de ${atleta.clube.meta} carimbos`}</span>
                    </p>
                    <CarimbosMini cheias={atleta.clube.carimbos} total={atleta.clube.meta} />
                    <p className="mp-nota">
                      {`Faltam ${plural(atleta.clube.meta - atleta.clube.carimbos, "carimbo", "carimbos")} para ganhar 1 hora grátis.${
                        atleta.clube.horasGratis
                          ? ` Você tem ${atleta.clube.horasGratis === 1 ? "1 hora grátis" : `${atleta.clube.horasGratis} horas grátis`} para usar.`
                          : ""
                      }`}
                    </p>
                  </div>
                )}
                <nav className="mp-links" aria-label="Sua conta">
                  <a href={ROTA_ABA.reservas} onClick={(e) => irParaConta(e, "reservas")}>
                    <Icone nome="ticket" />
                    Minhas reservas
                    <span className="mp-cont" id="mp-prox">
                      {atleta.proximas ? plural(atleta.proximas, "próxima", "próximas") : ""}
                    </span>
                  </a>
                  <a href={ROTA_ABA.clube} onClick={(e) => irParaConta(e, "clube")}>
                    <Icone nome="gift" />
                    Meu Clube
                  </a>
                  <a href={ROTA_ABA.dados} onClick={(e) => irParaConta(e, "dados")}>
                    <Icone nome="user" />
                    Meus dados
                  </a>
                  <button type="button" onClick={props.aoSair}>
                    <Icone nome="log-out" />
                    Sair
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="burger"
          aria-expanded={menuCelularAberto}
          aria-controls="menu-mobile"
          aria-label="Abrir menu"
          onClick={props.aoAlternarCelular}
        >
          <Icone nome="menu" />
        </button>
      </div>
      <div className="menu-mobile" id="menu-mobile" hidden={!menuCelularAberto}>
        <nav className="wrap mm-nav" aria-label="Seções da página no celular">
          {links()}
        </nav>
        {!atleta ? (
          <div className="wrap mm-conta">
            <button type="button" className="btn-amarelo" onClick={props.aoCriar}>
              Criar conta
            </button>
            <button type="button" className="btn-borda-claro" onClick={props.aoEntrar}>
              Entrar
            </button>
          </div>
        ) : (
          <div className="wrap mm-conta">
            <a className="btn-borda-claro" href={ROTA_ABA.reservas} onClick={(e) => irParaConta(e, "reservas")}>
              Minhas reservas
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
