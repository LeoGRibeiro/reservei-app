/**
 * @file SecaoEstrutura.tsx
 * @description Estrutura (`#estrutura`): bento com as 4 primeiras fotos ativas da galeria e a caixa
 * "Na arena" com checks amarelos e a parte principal em negrito.
 */

import type { DestaqueEstrutura, FotoEstrutura } from "@/lib/portal/types";
import { Icone } from "../Icone";

export interface SecaoEstruturaProps {
  intro?: string;
  fotos: FotoEstrutura[];
  destaques: DestaqueEstrutura[];
}

const POSICOES = ["f-a", "f-b", "f-c", "f-d"];

/**
 * @example
 * ```tsx
 * <SecaoEstrutura intro={conteudo.introEstrutura} fotos={dados.galeria} destaques={conteudo.destaquesEstrutura} />
 * ```
 */
export function SecaoEstrutura({ intro, fotos, destaques }: SecaoEstruturaProps) {
  return (
    <section className="secao estrutura" id="estrutura" aria-labelledby="estrutura-titulo">
      <div className="wrap">
        <div className="sec-topo">
          <h2 id="estrutura-titulo">Estrutura</h2>
          {intro && <p>{intro}</p>}
        </div>
        <div className="bento">
          {fotos.slice(0, POSICOES.length).map((f, i) => (
            <figure key={f.id} className={`foto ${POSICOES[i]}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto em object-fit cobrindo a célula do bento */}
              <img src={f.imagemUrl} alt={f.descricao} width={680} height={510} loading="lazy" />
              <figcaption>{f.legenda}</figcaption>
            </figure>
          ))}
          {destaques.length > 0 && (
            <div className="na-arena">
              <h3>Na arena</h3>
              <ul>
                {destaques.map((d) => (
                  <li key={d.destaque}>
                    <Icone nome="check" />
                    <span>
                      <b>{d.destaque}</b>
                      {` ${d.resto}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
