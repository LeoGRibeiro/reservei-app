/**
 * @file SecaoClube.tsx
 * @description Clube da arena (`#clube`): 3 passos e a cartela no estilo do ticket. Visitante vê as
 * casas vazias e "Criar conta e começar a juntar"; atleta vê os carimbos, os últimos carimbos e a
 * hora grátis com "Usar na próxima reserva".
 */

import type { MouseEvent } from "react";
import { dataLonga, diaCurto, plural, reais } from "@/lib/portal/formatos";
import type { ClubeArena } from "@/lib/portal/types";
import { CasasCartela } from "../base/Carimbos";

/** Último carimbo mostrado na cartela. */
export interface CarimboNaCartela {
  data: string;
  quadraNome: string;
  horas: number;
}

export interface CartelaClubeProps {
  clube: ClubeArena;
  nomeArena: string;
  logoUrl: string;
  hoje: string;
  /** Atleta logado (null = visitante) */
  atleta: {
    nome: string;
    carimbos: number;
    ultimos: CarimboNaCartela[];
    horasGratis: { expiraEm: string }[];
  } | null;
  /** Mostra "Últimos carimbos" (só na seção da página) */
  mostrarUltimos?: boolean;
  /** Id da cartela (`cartela` na seção da página) */
  id?: string;
  aoCriarConta: () => void;
  aoUsarHoraGratis: () => void;
  aoNavegar: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
}

/** "1 hora grátis" / "2 horas grátis". */
const horasGratisTexto = (n: number) => (n === 1 ? "1 hora grátis" : `${n} horas grátis`);

/**
 * Cartela do Clube (seção da página e aba Clube da conta).
 */
export function CartelaClube(props: CartelaClubeProps) {
  const { clube, nomeArena, logoUrl, hoje, atleta, mostrarUltimos = true } = props;
  const cheias = atleta ? atleta.carimbos : 0;
  const faltam = clube.meta - cheias;
  let canhoto;
  if (!atleta) {
    canhoto = (
      <>
        <b className="ca-grande">Comece a juntar hoje</b>
        <p>Crie a conta com o seu WhatsApp em menos de um minuto. A próxima reserva já vira carimbo.</p>
        <button type="button" className="btn-amarelo" onClick={props.aoCriarConta}>
          Criar conta e começar a juntar
        </button>
      </>
    );
  } else if (atleta.horasGratis.length > 0) {
    canhoto = (
      <>
        <b className="ca-grande">{`Você tem ${horasGratisTexto(atleta.horasGratis.length)}`}</b>
        <p>
          {clube.valorTeto !== null ? (
            <>
              {"Vale em qualquer quadra, até "}
              <span className="num">{reais(clube.valorTeto)}</span>
              {`, até ${dataLonga(atleta.horasGratis[0].expiraEm)}. Faltam ${plural(faltam, "carimbo", "carimbos")} para a próxima.`}
            </>
          ) : (
            `Vale em qualquer quadra, até ${dataLonga(atleta.horasGratis[0].expiraEm)}. Faltam ${plural(faltam, "carimbo", "carimbos")} para a próxima.`
          )}
        </p>
        <button type="button" className="btn-amarelo" onClick={props.aoUsarHoraGratis}>
          Usar na próxima reserva
        </button>
      </>
    );
  } else {
    canhoto = (
      <>
        <b className="ca-grande">{`Faltam ${plural(faltam, "carimbo", "carimbos")}`}</b>
        <p>{`Mais ${plural(faltam, "hora", "horas")} de jogo e você ganha 1 hora grátis.`}</p>
        <a className="btn-amarelo" href="#reservar" onClick={(e) => props.aoNavegar(e, "reservar")}>
          Reservar um horário
        </a>
      </>
    );
  }

  return (
    <div className="cartela" id={props.id} aria-live={props.id ? "polite" : undefined}>
      <div className="ca-topo">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
        <img src={logoUrl} alt="" width={388} height={374} />
        <div>
          <b>{atleta ? "Sua cartela" : "Cartela do Clube"}</b>
          <span>{atleta ? atleta.nome : nomeArena}</span>
        </div>
        <p className="ca-cont num">
          <b>{cheias}</b>
          {` de ${clube.meta}`}
        </p>
      </div>
      <div className="ca-papel">
        <CasasCartela cheias={cheias} logoUrl={logoUrl} total={clube.meta} />
        {mostrarUltimos && atleta && atleta.ultimos.length > 0 && (
          <div className="ca-hist">
            <p className="ca-hist-t">Últimos carimbos</p>
            <ul>
              {atleta.ultimos.slice(0, 3).map((c, i) => (
                <li key={i}>
                  <span>{`${diaCurto(c.data, hoje)} · ${c.quadraNome}`}</span>
                  <b className="num">{`+${plural(c.horas, "hora", "horas")}`}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="ca-stub">{canhoto}</div>
    </div>
  );
}

export type SecaoClubeProps = Omit<CartelaClubeProps, "id" | "mostrarUltimos">;

/**
 * @example
 * ```tsx
 * <SecaoClube clube={dados.clube} nomeArena={arena.nome} logoUrl={arena.logoUrl} hoje={hoje} atleta={null} ... />
 * ```
 */
export function SecaoClube(props: SecaoClubeProps) {
  const { clube } = props;
  const teto = clube.valorTeto !== null ? `, até ${reais(clube.valorTeto)}` : "";
  return (
    <section className="secao clube" id="clube" aria-labelledby="cl-titulo">
      <div className="wrap cl-grid">
        <div>
          <div className="sec-topo">
            <h2 id="cl-titulo">{clube.nome}</h2>
            <p>Quem joga sempre, joga de graça. Cada hora reservada com a sua conta vira um carimbo na cartela.</p>
          </div>
          <ol className="cl-passos">
            <li>
              <div>
                <b>Reserve com a sua conta</b>
                <p>Cada hora reservada vale um carimbo, em qualquer quadra e em qualquer horário.</p>
              </div>
            </li>
            <li>
              <div>
                <b>{`Junte ${clube.meta} carimbos`}</b>
                <p>{`Cada carimbo vale por ${plural(clube.mesesValidade, "mês", "meses")}, contados a partir do dia do jogo.`}</p>
              </div>
            </li>
            <li>
              <div>
                <b>Ganhe 1 hora grátis</b>
                <p>{`A hora grátis aparece no seu ticket na próxima reserva. Vale por ${clube.diasValidadeVoucher} dias${teto}.`}</p>
              </div>
            </li>
          </ol>
        </div>
        <CartelaClube {...props} id="cartela" />
      </div>
    </section>
  );
}
