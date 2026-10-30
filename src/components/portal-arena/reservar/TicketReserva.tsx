/**
 * @file TicketReserva.tsx
 * @description Ticket de papel da seleção (lateral no computador): dia, quadra, horário, itens, hora
 * grátis do Clube, total e sinal no canhoto. Vazio, convida a tocar num horário livre.
 */

import { diaCurto, hh, plural, reais } from "@/lib/portal/formatos";
import type { ResumoSelecao } from "@/lib/portal/agenda";
import { TicketPapel } from "../base/TicketPapel";
import { Icone } from "../Icone";

export interface TicketReservaProps {
  resumo: ResumoSelecao | null;
  dia: string;
  hoje: string;
  nomeArena: string;
  logoUrl: string;
  percentualSinal: number;
  /** Nome do Clube (só para atleta logado, na frase de carimbos) */
  nomeClube: string | null;
  logado: boolean;
  /** Mostra a opção da hora grátis (atleta tem hora grátis) */
  temHoraGratis: boolean;
  usarHoraGratis: boolean;
  tetoHoraGratis: number;
  aoUsarHoraGratis: (usar: boolean) => void;
  aoContinuar: () => void;
  aoLimpar: () => void;
}

/** Itens do ticket (horas e desconto), também usados no resumo do checkout. */
export function ItensTicket({ resumo }: { resumo: ResumoSelecao }) {
  return (
    <ul className="t-itens">
      {resumo.itens.map((i) => (
        <li key={i.h}>
          <span className="num">{`${hh(i.h)} às ${hh(i.h + 1)}`}</span>
          <span className="num">{reais(i.valor)}</span>
        </li>
      ))}
      {resumo.desconto > 0 && (
        <li className="t-desc">
          <span>Hora grátis do Clube</span>
          <span className="num">{`−${reais(resumo.desconto)}`}</span>
        </li>
      )}
    </ul>
  );
}

/**
 * @example
 * ```tsx
 * <TicketReserva resumo={resumo} dia={dia} hoje={hoje} nomeArena="Minha Arena" ... />
 * ```
 */
export function TicketReserva(props: TicketReservaProps) {
  const { resumo, dia, hoje, nomeArena, logoUrl, percentualSinal, nomeClube, logado } = props;
  const cabecalho = (
    <div className="t-cab">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
      <img src={logoUrl} alt="" width={388} height={374} />
      <div>
        <b>Seu ticket</b>
        <span>{nomeArena}</span>
      </div>
    </div>
  );
  const rotuloSinal = `Sinal no Pix agora (${percentualSinal}%)`;

  if (!resumo) {
    return (
      <TicketPapel
        id="ticket"
        topo={
          <>
            {cabecalho}
            <dl className="t-linhas">
              <div>
                <dt>Dia</dt>
                <dd>{diaCurto(dia, hoje)}</dd>
              </div>
              <div>
                <dt>Quadra</dt>
                <dd className="t-traco">a escolher</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd className="t-traco">a escolher</dd>
              </div>
            </dl>
            <p className="t-vazio">Toque num horário livre para começar. Dá para juntar horas seguidas na mesma quadra.</p>
          </>
        }
        canhoto={
          <>
            <p className="t-rot">{rotuloSinal}</p>
            <p className="t-sinal num">R$ 0</p>
            <p className="t-resto">O restante você paga na arena.</p>
            <button type="button" className="btn-amarelo" disabled>
              Escolha um horário
            </button>
          </>
        }
      />
    );
  }

  const n = resumo.horas.length;
  const resto = resumo.total - resumo.sinal;
  return (
    <TicketPapel
      id="ticket"
      topo={
        <>
          {cabecalho}
          <dl className="t-linhas">
            <div>
              <dt>Quadra</dt>
              <dd>{resumo.quadra.nome}</dd>
            </div>
            <div>
              <dt>Dia</dt>
              <dd>{diaCurto(dia, hoje)}</dd>
            </div>
            <div>
              <dt>Horário</dt>
              <dd className="num">{`${resumo.inicio} às ${resumo.fim}`}</dd>
            </div>
          </dl>
          <ItensTicket resumo={resumo} />
          {logado && props.temHoraGratis && (
            <label className="t-voucher">
              <input type="checkbox" checked={props.usarHoraGratis} onChange={(e) => props.aoUsarHoraGratis(e.target.checked)} />
              <span>
                Usar minha hora grátis do Clube<small>{`1 hora grátis, até ${reais(props.tetoHoraGratis)}`}</small>
              </span>
            </label>
          )}
          <div className="t-total">
            <span>{`Total · ${plural(n, "hora", "horas")}`}</span>
            <b className="num">{reais(resumo.total)}</b>
          </div>
        </>
      }
      canhoto={
        <>
          <p className="t-rot">{rotuloSinal}</p>
          <p className="t-sinal num">{reais(resumo.sinal)}</p>
          <p className="t-resto">
            {resto > 0 ? (
              <>
                Os outros <span className="num">{reais(resto)}</span> você paga na arena.
              </>
            ) : (
              "Nada a pagar na arena."
            )}
          </p>
          <button type="button" className="btn-amarelo" onClick={props.aoContinuar}>
            Continuar para o Pix
            <Icone nome="arrow-right" />
          </button>
          {logado && nomeClube && <p className="t-clube">{`Esta reserva soma ${plural(n, "hora", "horas")} no ${nomeClube}.`}</p>}
          <button type="button" className="link t-limpar" onClick={props.aoLimpar}>
            Limpar seleção
          </button>
        </>
      }
    />
  );
}
