/**
 * @file PaginaRegras.tsx
 * @description Página de Regras e dúvidas da arena (`/regras`): topo azul com "Voltar ao site",
 * índice de âncoras, regras numeradas, Cancelamento e chuva, perguntas frequentes em `<details>` e a
 * caixa "Ficou alguma dúvida?". Sem termos de uso (decisão de 30/10/2026). Mesmo Lenis do portal.
 */

import Link from "next/link";
import "lenis/dist/lenis.css";
import "../portal-regras.css";
import { SmoothScrollProvider } from "@/components/landing/SmoothScrollProvider";
import { horaCurta, linkWhatsApp } from "@/lib/portal/formatos";
import { variaveisDoTema } from "@/lib/portal/tema";
import type { DadosPortal } from "@/lib/portal/types";
import { archivo } from "../fonte";
import { Icone } from "../Icone";
import { AncorasRegras } from "./AncorasRegras";

/** Casos de cancelamento (regra da plataforma: 24 horas; chuva forte, a arena remarca). */
export const CASOS_CANCELAMENTO = [
  { titulo: "Mais de 24 horas antes do jogo", texto: "Você recebe o sinal de volta no Pix." },
  { titulo: "Menos de 24 horas antes do jogo", texto: "O sinal não é devolvido." },
  { titulo: "Chuva forte", texto: "A arena remarca sem custo." },
];

export interface PaginaRegrasProps {
  dados: DadosPortal;
  ano: number;
}

/**
 * @example
 * ```tsx
 * <PaginaRegras dados={dados} ano={2026} />
 * ```
 */
export function PaginaRegras({ dados, ano }: PaginaRegrasProps) {
  const { arena, conteudo } = dados;
  const temRegras = conteudo.regras.length > 0;
  const temPerguntas = conteudo.faq.length > 0;
  const endereco = [arena.endereco, arena.bairro, `${arena.cidade}/${arena.estado}`].filter(Boolean).join(" · ");
  return (
    <div className={`pa-regras ${archivo.variable}`} style={variaveisDoTema(dados.tema)}>
      <SmoothScrollProvider>
        <AncorasRegras />
        <header className="topo">
          <div className="wrap topo-in">
            <Link className="marca" href="/" aria-label={`${arena.nome}, voltar ao site`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
              <img src={arena.logoUrl} alt="" width={388} height={374} />
              <b>{arena.nome}</b>
            </Link>
            <Link className="btn-borda-claro" href="/">
              <Icone nome="arrow-left" />
              <span>Voltar ao site</span>
            </Link>
          </div>
        </header>

        <main className="estreito">
          <div className="cab">
            <h1>Regras e dúvidas</h1>
            <p>{`O que vale saber antes de jogar na ${arena.nome}.`}</p>
            <nav className="indice" aria-label="Nesta página">
              {temRegras && <a href="#regras">Regras da arena</a>}
              <a href="#cancelamento">Cancelamento e chuva</a>
              {temPerguntas && <a href="#perguntas">Perguntas frequentes</a>}
            </nav>
          </div>

          {temRegras && (
            <section className="bloco" id="regras" aria-labelledby="regras-t">
              <h2 id="regras-t">Regras da arena</h2>
              <ol className="regras">
                {conteudo.regras.map((r) => (
                  <li key={r.titulo}>
                    <div>
                      <b>{r.titulo}</b>
                      <span>{r.texto}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="bloco" id="cancelamento" aria-labelledby="cancelamento-t">
            <h2 id="cancelamento-t">Cancelamento e chuva</h2>
            <p>Para cancelar, use Minhas reservas ou chame a arena no WhatsApp.</p>
            <ul className="casos">
              {CASOS_CANCELAMENTO.map((c) => (
                <li key={c.titulo}>
                  <b>{c.titulo}</b>
                  <span>{c.texto}</span>
                </li>
              ))}
            </ul>
          </section>

          {temPerguntas && (
            <section className="bloco" id="perguntas" aria-labelledby="perguntas-t">
              <h2 id="perguntas-t">Perguntas frequentes</h2>
              <div className="faq">
                {conteudo.faq.map((f) => (
                  <details key={f.pergunta}>
                    <summary>
                      {f.pergunta}
                      <Icone nome="chevron-down" />
                    </summary>
                    <p>{f.resposta}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <div className="duvida">
            <div>
              <b>Ficou alguma dúvida?</b>
              <span>{`A arena responde no WhatsApp, das ${horaCurta(arena.horarioAbertura)} às ${horaCurta(arena.horarioFechamento)}.`}</span>
            </div>
            <a className="btn-amarelo" href={linkWhatsApp(arena.whatsappDigitos, "Olá! Vim pelo site e tenho uma dúvida.")} target="_blank" rel="noopener">
              <Icone nome="message-circle" />
              Chamar no WhatsApp
            </a>
          </div>
        </main>

        <footer className="rodape">
          <div className="wrap">
            <span>{`© ${ano} ${arena.nome} · ${endereco}`}</span>
            <Link href="/">Voltar ao site</Link>
          </div>
        </footer>
      </SmoothScrollProvider>
    </div>
  );
}
