/**
 * @file SecaoEscolinhas.tsx
 * @description Escolinhas (`#escolinhas`, fundo azul): foto do professor, esporte, professor,
 * descrição, turmas (dia, horas, categoria) e "Quero uma vaga" (WhatsApp com mensagem pronta ou link,
 * conforme o painel). Sem preço.
 */

import { mensagemPadraoEscolinha } from "@/lib/institucional/escolinhasSite";
import type { EscolinhaPortal } from "@/lib/portal/types";

export interface SecaoEscolinhasProps {
  intro?: string;
  escolinhas: EscolinhaPortal[];
}

/** Mensagem padrão do "Quero uma vaga" (o painel pode trocar por outra). */
export function mensagemVagaEscolinha(e: Pick<EscolinhaPortal, "esporte" | "professor">): string {
  return mensagemPadraoEscolinha(e.esporte, e.professor);
}

/** Id do card da escolinha (usado pelo horário de aula para levar até a turma). */
export const idEscolinha = (id: string): string => `esc-${id}`;

/**
 * @example
 * ```tsx
 * <SecaoEscolinhas intro={conteudo.introEscolinhas} escolinhas={dados.escolinhas} />
 * ```
 */
export function SecaoEscolinhas({ intro, escolinhas }: SecaoEscolinhasProps) {
  return (
    <section className="secao escolinhas" id="escolinhas" aria-labelledby="esc-titulo">
      <div className="wrap esc-grid">
        <div>
          <div className="sec-topo">
            <h2 id="esc-titulo">Escolinhas</h2>
            {intro && <p>{intro}</p>}
          </div>
          {escolinhas.map((e) => (
            <article key={e.id} className="esc" id={idEscolinha(e.id)} aria-labelledby={`${idEscolinha(e.id)}-t`}>
              <div className="esc-cab">
                {/* eslint-disable-next-line @next/next/no-img-element -- recorte do professor, tamanho fixo pelo CSS */}
                <img className="esc-rosto" src={e.fotoProfessorUrl} alt="" width={220} height={275} loading="lazy" />
                <h3 id={`${idEscolinha(e.id)}-t`}>{e.titulo}</h3>
                <p className="esc-prof">{`Prof. ${e.professor}`}</p>
                {e.descricao && <p className="esc-desc">{e.descricao}</p>}
              </div>
              <a className="btn-amarelo esc-cta" href={e.hrefBotao} target="_blank" rel="noopener">
                Quero uma vaga
              </a>
              <dl className="turmas">
                {e.turmas.map((t, i) => (
                  <div key={i} className="turma">
                    <dt>{t.dias}</dt>
                    <dd className="horas">{t.horas}</dd>
                    <dd className="nivel">{t.nivel}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
