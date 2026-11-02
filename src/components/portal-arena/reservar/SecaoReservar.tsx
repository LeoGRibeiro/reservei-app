/**
 * @file SecaoReservar.tsx
 * @description Seção Reservar (`#reservar`): título, fichas de data, linha do dia com aviso e
 * legenda, cards das quadras e, ao lado, o ticket, os textos de cancelamento e do Clube, o link das
 * regras e o mural de partidas (no celular, o mural vai para depois das quadras).
 *
 * No celular, depois das quadras, a faixa "Também na arena" mostra que a página continua e leva
 * direto às outras seções (a seção de reserva é longa e escondia o resto do site).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { diaLongo } from "@/lib/portal/formatos";
import type { MouseEvent } from "react";

export interface SecaoReservarProps {
  intro?: string;
  fichas: ReactNode;
  dia: string;
  hoje: string;
  aviso: string | null;
  quadras: ReactNode;
  ticket: ReactNode;
  mural: ReactNode | null;
  /** Mural embaixo do ticket (≥1120 px) ou depois das quadras */
  muralNaLateral: boolean;
  /** Clube (fidelidade) da arena, para o texto embaixo do ticket */
  clube: { nome: string; meta: number } | null;
  aoNavegar: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
  /** Outras seções do site (para a faixa "Também na arena" no celular) */
  tambem?: { id: string; rotulo: string }[];
}

/**
 * @example
 * ```tsx
 * <SecaoReservar intro={conteudo.introReserva} fichas={<FichasDatas ... />} ... />
 * ```
 */
export function SecaoReservar(props: SecaoReservarProps) {
  const { intro, fichas, dia, hoje, aviso, quadras, ticket, mural, muralNaLateral, clube, aoNavegar, tambem = [] } = props;
  return (
    <section className="reservar" id="reservar" aria-labelledby="titulo-reserva">
      <div className="wrap">
        <div className="r-intro">
          <h1 id="titulo-reserva">Reserve sua quadra</h1>
          {intro && <p>{intro}</p>}
        </div>

        <div className="r-grid">
          <div className="r-main">
            {fichas}

            <div className="dia-linha">
              <div>
                <h2 id="dia-titulo">{diaLongo(dia, hoje)}</h2>
                <p className="dia-nota" id="dia-nota" hidden={!aviso}>
                  {aviso}
                </p>
              </div>
              <ul className="legenda" aria-label="Legenda dos horários">
                <li>
                  <i className="lg-livre" />
                  Livre
                </li>
                <li>
                  <i className="lg-sel" />
                  Selecionado
                </li>
                <li>
                  <i className="lg-ocup" />
                  Ocupado
                </li>
                <li>
                  <i className="lg-aula" />
                  Aula
                </li>
              </ul>
            </div>

            <div className="quadras" id="quadras">
              {quadras}
            </div>
            {!muralNaLateral && mural}
            {tambem.length > 0 && (
              <nav className="tambem" aria-label="Também na arena">
                <p className="tambem-h">
                  Também na arena, mais abaixo <span aria-hidden="true">↓</span>
                </p>
                <ul>
                  {tambem.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} onClick={(e) => aoNavegar(e, s.id)}>
                        {s.rotulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          <aside className="r-ticket" aria-label="Seu ticket">
            {ticket}
            <p className="t-obs">
              <b>Cancelamento:</b> com mais de 24 horas de antecedência, você recebe o sinal de volta no Pix.
            </p>
            {clube && (
              <p className="t-obs">
                <b>{`${clube.nome}:`}</b>
                {` a cada ${clube.meta} horas reservadas com a sua conta, você ganha 1 hora grátis. `}
                <a className="link" href="#clube" onClick={(e) => aoNavegar(e, "clube")}>
                  Como funciona
                </a>
              </p>
            )}
            <p className="t-obs">
              <Link className="link" href="/regras">
                Regras da arena e dúvidas
              </Link>
            </p>
            {muralNaLateral && mural}
          </aside>
        </div>
      </div>
    </section>
  );
}
