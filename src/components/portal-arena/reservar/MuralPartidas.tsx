/**
 * @file MuralPartidas.tsx
 * @description Mural recolhido "Partidas procurando jogadores". Nunca mostra quantas vagas faltam.
 * A partida do próprio atleta aparece como "sua partida", com "Ver pedidos (N)".
 */

import { SEM, diaMes, hh, maiuscula, paraData, relativo, rotuloEsporte } from "@/lib/portal/formatos";
import { Icone } from "../Icone";

/** Partida no mural. */
export interface PartidaMural {
  /** Id da reserva */
  id: string;
  data: string;
  inicio: number;
  fim: number;
  esporte: string;
  quadraNome: string;
  organizador: string;
  /** A partida é do atleta logado */
  propria: boolean;
  /** Pedidos ainda não combinados (só nas próprias) */
  pedidos: number;
  /** O atleta logado já pediu para entrar */
  pedido: boolean;
}

export interface MuralPartidasProps {
  partidas: PartidaMural[];
  hoje: string;
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  aoPedir: (partida: PartidaMural) => void;
  aoVerPedidos: (reservaId: string) => void;
  /** Id do item destacado (veio do "Ver no mural") */
  destaque?: string | null;
}

/**
 * @example
 * ```tsx
 * <MuralPartidas partidas={partidas} hoje={hoje} aberto={aberto} aoAlternar={setAberto} aoPedir={pedir} aoVerPedidos={ver} />
 * ```
 */
export function MuralPartidas({ partidas, hoje, aberto, aoAlternar, aoPedir, aoVerPedidos, destaque }: MuralPartidasProps) {
  return (
    <details
      className="mural-box"
      id="partidas"
      open={aberto}
      onToggle={(e) => aoAlternar((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <Icone nome="users" />
        <span>Partidas procurando jogadores</span>
        <Icone nome="chevron-down" className="seta-d" />
      </summary>
      <p className="mural-sub">Peça para entrar e o organizador confirma com você pelo WhatsApp.</p>
      <ul className="mural" id="mural">
        {partidas.map((p) => {
          const rel = relativo(p.data, hoje);
          const d = paraData(p.data);
          return (
            <li key={p.id} className={destaque === `vaga-${p.id}` ? "partida destaque" : "partida"} id={`vaga-${p.id}`}>
              <p className="v-quando">
                <b>{rel ?? maiuscula(SEM[d.getDay()])}</b>{" "}
                <span className="num">{`${hh(p.inicio)} às ${hh(p.fim)}${rel ? "" : ` · ${diaMes(p.data)}`}`}</span>
              </p>
              <div className="v-oque">
                <h3>{rotuloEsporte(p.esporte)}</h3>
                <p>{`${p.quadraNome} · ${p.propria ? "sua partida" : `com ${p.organizador}`}`}</p>
              </div>
              <div className="v-acao">
                {p.propria ? (
                  <button type="button" className="btn-borda" onClick={() => aoVerPedidos(p.id)}>
                    <Icone nome="users" />
                    {`Ver pedidos${p.pedidos ? ` (${p.pedidos})` : ""}`}
                  </button>
                ) : p.pedido ? (
                  <p className="v-ok">
                    <Icone nome="check" />
                    Pedido enviado
                  </p>
                ) : (
                  <button type="button" className="btn-borda" onClick={() => aoPedir(p)}>
                    <Icone nome="users" />
                    Quero jogar
                  </button>
                )}
                <p className="v-msg" id={`msg-${p.id}`} aria-live="polite">
                  {p.pedido && !p.propria ? `${p.organizador} recebe seu pedido no WhatsApp e confirma com você.` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
