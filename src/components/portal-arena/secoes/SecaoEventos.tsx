/**
 * @file SecaoEventos.tsx
 * @description Campeonatos e eventos (`#eventos`): "Rolando agora" com a chave, "Inscrições abertas"
 * em ingressos com o canhoto da data e "Já aconteceu" com foto, campeões e placar (faixa rolável no
 * celular). Cada bloco some sem dados.
 */

import { MES, MES_CURTO, SEM_CURTA, dataLonga, linkWhatsApp, maiuscula, paraData } from "@/lib/portal/formatos";
import type { EventoArena } from "@/lib/portal/types";
import { CanhotoData } from "../base/CanhotoData";
import { Icone } from "../Icone";

export interface SecaoEventosProps {
  intro?: string;
  eventos: EventoArena[];
  whatsappArena: string;
  /** Perfil do Instagram (link "Mais fotos no Instagram") */
  linkInstagram?: string;
}

/** Até quantos eventos aparecem em "Já aconteceu". */
export const MAX_PASSADOS = 3;

/** Mensagem padrão de inscrição pelo WhatsApp. */
export function mensagemInscricao(ev: EventoArena): string {
  return ev.mensagemWhatsapp ?? `Olá! Vim pelo site e quero me inscrever no ${ev.titulo}. Como faço?`;
}

/** "27 de setembro · Futebol society". */
function quandoPassado(ev: EventoArena): string {
  return [dataLonga(ev.dataInicio), ev.modalidade ? maiuscula(ev.modalidade.toLowerCase()) : null].filter(Boolean).join(" · ");
}

function botaoInscricao(ev: EventoArena, whatsapp: string) {
  if (ev.inscricaoTipo === "confirmar_presenca") {
    return (
      <a className="btn-borda" href={linkWhatsApp(whatsapp, mensagemInscricao(ev))} target="_blank" rel="noopener">
        Confirmar presença
      </a>
    );
  }
  // Formulário só quando há link; sem ele, a inscrição segue pelo WhatsApp com a mensagem pronta
  const href = ev.inscricaoTipo === "formulario" && ev.inscricaoUrl ? ev.inscricaoUrl : linkWhatsApp(whatsapp, mensagemInscricao(ev));
  return (
    <a className="btn-amarelo" href={href} target="_blank" rel="noopener">
      Inscrever-se
    </a>
  );
}

/**
 * @example
 * ```tsx
 * <SecaoEventos intro={conteudo.introEventos} eventos={dados.eventos} whatsappArena={arena.whatsappDigitos} />
 * ```
 */
export function SecaoEventos({ intro, eventos, whatsappArena, linkInstagram }: SecaoEventosProps) {
  const agora = eventos.find((e) => e.status === "em_andamento" && e.chave.length > 0) ?? eventos.find((e) => e.status === "em_andamento");
  const abertos = eventos.filter((e) => e.status === "inscricoes");
  const passados = eventos
    .filter((e) => e.status === "encerrado")
    .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))
    .slice(0, MAX_PASSADOS);

  return (
    <section className="secao eventos" id="eventos" aria-labelledby="ev-titulo">
      <div className="wrap">
        <div className="sec-topo">
          <h2 id="ev-titulo">Campeonatos e eventos</h2>
          {intro && <p>{intro}</p>}
        </div>

        {agora && (
          <article className="ev-agora" aria-labelledby="ev-agora-t">
            <div>
              <p className="ev-vivo">
                <i aria-hidden="true" />
                Rolando agora
              </p>
              <h3 id="ev-agora-t">{agora.titulo}</h3>
              {agora.descricao && <p className="ev-agora-txt">{agora.descricao}</p>}
              {agora.linkUrl && (
                <a className="btn-borda-claro" href={agora.linkUrl} target="_blank" rel="noopener">
                  {agora.linkUrl.includes("instagram.com") && <Icone nome="instagram" />}
                  {agora.linkRotulo ?? "Acompanhe"}
                </a>
              )}
            </div>
            {agora.chave.length > 0 && (
              <div className="chave" role="group" aria-label={`Chave: ${agora.chave.map((f) => f.rotulo.split(" · ")[0].toLowerCase()).join(" e ")}`}>
                {agora.chave.map((fase) => (
                  <div key={fase.rotulo} className={fase.final ? "ch-col ch-final" : "ch-col"}>
                    <p className="ch-rot">{fase.rotulo}</p>
                    {fase.jogos.map((jogo, i) => (
                      <div key={i} className="ch-jogo">
                        <p className="ch-hora num">{jogo.hora}</p>
                        <ul>
                          {jogo.lados.map((lado) => (
                            <li key={lado}>{lado}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {abertos.length > 0 && (
          <>
            <div className="sub-topo">
              <h3>Inscrições abertas</h3>
            </div>
            <ul className="ev-lista">
              {abertos.map((ev) => {
                const d = paraData(ev.dataInicio);
                return (
                  <li key={ev.id} className="ev">
                    <CanhotoData
                      className="ev-data"
                      semana={SEM_CURTA[d.getDay()]}
                      dia={d.getDate()}
                      mes={maiuscula(MES_CURTO[d.getMonth()])}
                    />
                    <div className="ev-corpo">
                      <h4>{ev.titulo}</h4>
                      {ev.descricaoCurta && <p className="ev-tipo">{ev.descricaoCurta}</p>}
                      {ev.dados.length > 0 && (
                        <dl className="ev-dados">
                          {ev.dados.map((dado) => (
                            <div key={dado.rotulo}>
                              <dt>{dado.rotulo}</dt>
                              <dd className={dado.numerico ? "num" : undefined}>{dado.valor}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <div className="ev-acao">{botaoInscricao(ev, whatsappArena)}</div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {passados.length > 0 && (
          <>
            <div className="sub-topo">
              <h3>Já aconteceu</h3>
              {linkInstagram && (
                <a className="link" href={linkInstagram} target="_blank" rel="noopener">
                  Mais fotos no Instagram
                </a>
              )}
            </div>
            <ul className="ev-passados">
              {passados.map((ev) => (
                <li key={ev.id} className="ev-p">
                  {ev.fotoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- foto em object-fit com enquadramento do banco
                    <img
                      src={ev.fotoUrl}
                      alt={ev.fotoDescricao ?? ev.titulo}
                      width={680}
                      height={510}
                      loading="lazy"
                      style={ev.fotoPosicao ? { objectPosition: ev.fotoPosicao } : undefined}
                    />
                  )}
                  <p className="ev-p-quando">{quandoPassado(ev)}</p>
                  <h4>{ev.titulo}</h4>
                  <dl>
                    {ev.campeoes && (
                      <div>
                        <dt>
                          <Icone nome="trophy" />
                          {ev.rotuloCampeoes ?? "Campeões"}
                        </dt>
                        <dd>{ev.campeoes}</dd>
                      </div>
                    )}
                    {ev.placarFinal && (
                      <div>
                        <dt>Final</dt>
                        <dd className="num">{ev.placarFinal}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/** Rótulo de mês por extenso (usado em testes e no leitor de tela). */
export const mesPorExtenso = (iso: string): string => MES[paraData(iso).getMonth()];
