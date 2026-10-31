/**
 * @file DialogosConta.tsx
 * @description Corpo dos diálogos simples da conta: cancelar reserva (consequência certa pela janela de
 * 24 horas), procurar jogadores (publicar no mural, pedidos com Chamar e Combinado, partida completa) e
 * excluir conta (o que se perde e o aviso dos jogos marcados).
 */

"use client";

import { useState } from "react";
import type { PedidoVaga, ReservaAtleta } from "@/lib/portal/contaAtleta";
import { diaCurto, diaLongo, esporteNaFrase, haQuantoTempo, hh, linkWhatsApp, lista, plural, reais, rotuloEsporte } from "@/lib/portal/formatos";
import { Icone } from "../Icone";

const faixa = (r: Pick<ReservaAtleta, "horas">) => `${hh(r.horas[0])} às ${hh(r.horas[r.horas.length - 1] + 1)}`;

/** Janela do reembolso: mais de 24 horas antes do jogo (regra de 30/10/2026). */
export const HORAS_REEMBOLSO = 24;

export interface CancelarReservaProps {
  reserva: ReservaAtleta;
  quadraNome: string;
  hoje: string;
  /** Horas até o início do jogo */
  horasAte: number;
  /** Já cancelou (mostra a confirmação) */
  cancelada: boolean;
  enviando: boolean;
  aoManter: () => void;
  aoConfirmar: () => void;
}

/**
 * Cancelar reserva: resumo e consequência; depois de confirmar, o que acontece com o valor pago.
 */
export function CorpoCancelar({ reserva: r, quadraNome, hoje, horasAte, cancelada, enviando, aoManter, aoConfirmar }: CancelarReservaProps) {
  const reembolso = horasAte >= HORAS_REEMBOLSO;
  if (cancelada) {
    return (
      <>
        <p className="dlg-txt">
          <b>Reserva cancelada.</b> O horário foi liberado para outras pessoas.
        </p>
        {reembolso && r.pago > 0 && (
          <p className="dlg-txt">
            {"O reembolso de "}
            <span className="num">{reais(r.pago)}</span>
            {" volta para o Pix que você usou."}
          </p>
        )}
        <div className="dlg-acoes">
          <button type="button" className="btn-navy" onClick={aoManter}>
            Fechar
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <dl className="au-dados">
        <div>
          <dt>Quadra</dt>
          <dd>{quadraNome}</dd>
        </div>
        <div>
          <dt>Dia</dt>
          <dd>{diaLongo(r.data, hoje)}</dd>
        </div>
        <div>
          <dt>Horário</dt>
          <dd className="num">{faixa(r)}</dd>
        </div>
        <div>
          <dt>Pago no Pix</dt>
          <dd className="num">{reais(r.pago)}</dd>
        </div>
      </dl>
      <div className={reembolso ? "caso" : "caso perde"}>
        <b>{reembolso ? "Faltam mais de 24 horas" : "Faltam menos de 24 horas"}</b>
        <p>
          {reembolso ? "Você recebe de volta os " : "Pelas regras da arena, os "}
          <span className="num">{reais(r.pago)}</span>
          {reembolso ? " pagos, no mesmo Pix." : " pagos não são devolvidos."}
        </p>
      </div>
      <div className="dlg-acoes">
        <button type="button" className="btn-borda" onClick={aoManter}>
          Manter reserva
        </button>
        <button type="button" className="btn-perigo" onClick={aoConfirmar} disabled={enviando} aria-busy={enviando || undefined}>
          Cancelar reserva
        </button>
      </div>
    </>
  );
}

export interface ProcurarJogadoresProps {
  reserva: ReservaAtleta;
  quadraNome: string;
  nomeArena: string;
  hoje: string;
  pedidos: PedidoVaga[];
  agora: Date;
  enviando: boolean;
  aoPublicar: (faltam: number) => void;
  aoTirar: () => void;
  aoChamar: (pedido: PedidoVaga) => void;
  aoCombinar: (pedido: PedidoVaga) => void;
  aoFechar: () => void;
  /** Avisa o diálogo que o conteúdo trocou de etapa (foco volta para o título) */
  aoTrocarEtapa: () => void;
}

/**
 * Procurar jogadores: publicar (quantos faltam e termo), pedidos (Chamar e Combinado) ou partida completa.
 */
export function CorpoProcurarJogadores(props: ProcurarJogadoresProps) {
  const { reserva: r, pedidos } = props;
  const [faltam, setFaltam] = useState(Math.max(1, r.vagasAbertas || 2));
  const [termo, setTermo] = useState(false);
  const [erroTermo, setErroTermo] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  if (r.vagasCompleta && !reabrindo) {
    return (
      <>
        <p className="dlg-txt">
          <b>Partida completa.</b> Ela saiu do mural e ninguém mais pode pedir para entrar.
        </p>
        <div className="dlg-acoes">
          <button
            type="button"
            className="btn-borda"
            onClick={() => {
              setFaltam(1);
              setReabrindo(true);
              props.aoTrocarEtapa();
            }}
          >
            Procurar mais gente
          </button>
          <button type="button" className="btn-navy" onClick={props.aoFechar}>
            Pronto
          </button>
        </div>
      </>
    );
  }

  if (!r.permiteVagas) {
    return (
      <>
        <p className="dlg-txt">
          {"Sua partida entra no mural "}
          <b>Partidas procurando jogadores</b>
          {". Quem quiser jogar pede para entrar, e você combina tudo pelo WhatsApp."}
        </p>
        <div className="campo">
          <p className="campo-rot" id="rot-faltam">
            Quantos jogadores faltam?
          </p>
          <div className="passo-num" role="group" aria-labelledby="rot-faltam">
            <button type="button" aria-label="Um a menos" disabled={faltam <= 1} onClick={() => setFaltam((n) => Math.max(1, n - 1))}>
              −
            </button>
            <b aria-live="polite">{plural(faltam, "jogador", "jogadores")}</b>
            <button type="button" aria-label="Um a mais" disabled={faltam >= 20} onClick={() => setFaltam((n) => Math.min(20, n + 1))}>
              +
            </button>
          </div>
          <p className="dica">O número não aparece no mural. A partida sai de lá sozinha quando completar.</p>
        </div>
        <label className="aceite" data-campo="vg-termo" data-erro={erroTermo ? "" : undefined}>
          <input type="checkbox" id="vg-termo" aria-describedby="e-vg-termo" checked={termo} aria-invalid={erroTermo ? true : undefined}
            onChange={(e) => {
              setTermo(e.target.checked);
              setErroTermo(false);
            }} />
          <span>Entendo que a arena só divulga a partida. O combinado e a divisão do valor ficam entre mim e os jogadores.</span>
        </label>
        <p className="erro" id="e-vg-termo" hidden={!erroTermo}>
          Marque a caixa para publicar a partida.
        </p>
        <div className="dlg-acoes">
          <button type="button" className="btn-borda" onClick={props.aoFechar}>
            Agora não
          </button>
          <button
            type="button"
            className="btn-amarelo"
            disabled={props.enviando}
            aria-busy={props.enviando || undefined}
            onClick={() => {
              if (!termo) {
                setErroTermo(true);
                document.getElementById("vg-termo")?.focus();
                return;
              }
              setReabrindo(false);
              props.aoPublicar(faltam);
            }}
          >
            Publicar no mural
          </button>
        </div>
      </>
    );
  }

  const esporte = esporteNaFrase(rotuloEsporte(r.esporte));
  return (
    <>
      <p className="dlg-status">
        <Icone nome="users" />
        <span>
          <b>No mural</b>
          {` · faltam ${plural(r.vagasAbertas, "jogador", "jogadores")}`}
        </span>
      </p>
      <h3 className="dlg-h3">Pedidos para jogar</h3>
      {pedidos.length ? (
        <ul className="peds">
          {pedidos.map((p) => {
            const combinado = p.status === "combinado";
            const primeiro = p.nome.split(" ")[0];
            const msg = `Oi, ${primeiro}! Vi seu pedido para jogar ${esporte} comigo na ${props.nomeArena}, ${diaCurto(r.data, props.hoje).toLowerCase()} às ${hh(r.horas[0])}, na ${props.quadraNome}. Bora?`;
            return (
              <li key={p.id} className={combinado ? "ped ok" : "ped"}>
                <span className="avatar" aria-hidden="true">
                  {p.nome.charAt(0)}
                </span>
                <div className="ped-quem">
                  <b>{p.nome}</b>
                  {p.status === "pendente" && (
                    <>
                      {" "}
                      <span className="novo">novo</span>
                    </>
                  )}
                  <span className="sub">{combinado ? "Combinado" : `Pediu ${haQuantoTempo(p.criadoEm, props.agora)}`}</span>
                </div>
                {!combinado && (
                  <div className="ped-acoes">
                    <a className="btn-navy" href={linkWhatsApp(p.whatsappDigitos, msg)} target="_blank" rel="noopener" onClick={() => props.aoChamar(p)}>
                      <Icone nome="message-circle" />
                      Chamar
                    </a>
                    <button type="button" className="btn-borda" onClick={() => props.aoCombinar(p)}>
                      Combinado
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cc-nada">Ainda ninguém pediu. Quando alguém pedir, aparece aqui e chega no seu WhatsApp.</p>
      )}
      <div className="dlg-acoes">
        <button type="button" className="link-perigo" onClick={props.aoTirar}>
          Tirar do mural
        </button>
        <button type="button" className="btn-navy" onClick={props.aoFechar}>
          Pronto
        </button>
      </div>
    </>
  );
}

export interface ExcluirContaProps {
  carimbos: number;
  horasGratis: number;
  jogosMarcados: number;
  enviando: boolean;
  aoManter: () => void;
  aoConfirmar: () => void;
}

/**
 * Excluir conta: o que se perde e o aviso dos jogos marcados.
 */
export function CorpoExcluirConta({ carimbos, horasGratis, jogosMarcados, enviando, aoManter, aoConfirmar }: ExcluirContaProps) {
  const perde = [
    carimbos ? `${plural(carimbos, "carimbo", "carimbos")} do Clube` : "",
    horasGratis ? plural(horasGratis, "hora grátis", "horas grátis") : "",
  ].filter(Boolean);
  return (
    <>
      <p className="dlg-txt">
        {`Isso apaga seu nome, seu WhatsApp e o histórico da sua conta${perde.length ? `, além de ${lista(perde)}` : ""}. Não dá para desfazer.`}
      </p>
      {jogosMarcados > 0 && (
        <div className="caso perde">
          <b>{`Você tem ${plural(jogosMarcados, "jogo marcado", "jogos marcados")}`}</b>
          <p>As reservas continuam valendo na arena. Se quiser cancelar alguma, faça isso antes de excluir a conta.</p>
        </div>
      )}
      <div className="dlg-acoes">
        <button type="button" className="btn-borda" onClick={aoManter}>
          Manter conta
        </button>
        <button type="button" className="btn-perigo" onClick={aoConfirmar} disabled={enviando} aria-busy={enviando || undefined}>
          Excluir conta
        </button>
      </div>
    </>
  );
}
