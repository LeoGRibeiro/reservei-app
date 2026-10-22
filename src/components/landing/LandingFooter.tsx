"use client";

import { MessageCircle } from "lucide-react";
import { getAnoCopyright, getSecoesDoMenu, montarLinkWhatsApp, rolarParaSecao } from "@/lib/landingPage/navegacao";
import { SECOES_LANDING_PAGE } from "@/lib/landingPage/secoes";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";
import type { ConfiguracaoSite, SecaoLandingPage } from "@/lib/landingPage/types";
import { IconeRedeSocial } from "./IconeRedeSocial";
import { ListaLinksNavegacao } from "./ListaLinksNavegacao";
import { LogoReservei } from "./LogoReservei";

/** Mensagem padrão enviada pelo atalho de WhatsApp do rodapé. */
export const MENSAGEM_WHATSAPP_RODAPE = "Olá! Vim pelo site e gostaria de mais informações.";

/** Props do {@link LandingFooter}. */
export interface LandingFooterProps {
  /** Configuração institucional (injeção para testes). */
  config?: ConfiguracaoSite;
  /** Catálogo de seções (injeção para testes). */
  secoes?: readonly SecaoLandingPage[];
  /** Data de referência do copyright (injeção para testes). */
  agora?: Date;
}

/**
 * Rodapé da Landing Page (SPEC/2026-10-06-lp-base-navegacao.md §2.3).
 *
 * - Marca + slogan.
 * - Links rápidos de navegação (mesmas seções do menu).
 * - Links para redes sociais (abrem em nova aba com `noopener`).
 * - Atalho de atendimento pelo WhatsApp.
 * - Assinatura da plataforma Reservei e copyright.
 *
 * Possui espaçamento inferior extra no mobile para não ficar coberto pelo
 * botão flutuante do carrinho.
 *
 * @example
 * <LandingFooter />
 */
export function LandingFooter({
  config: configInformada,
  secoes = SECOES_LANDING_PAGE,
  agora,
}: LandingFooterProps) {
  const configArena = useConfiguracaoSiteArena();
  const config = configInformada ?? configArena;
  const secoesMenu = getSecoesDoMenu(secoes);
  const linkWhatsApp = montarLinkWhatsApp(config.whatsappNumero, MENSAGEM_WHATSAPP_RODAPE);
  const ano = getAnoCopyright(agora);

  return (
    <footer className="border-t border-slate-800 bg-slate-950 pb-28 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-3">
        <div className="space-y-4">
          <LogoReservei exibirDescricao={false} />
          <p className="text-sm text-slate-400 max-w-xs">{config.slogan}</p>
          <ul className="flex items-center gap-2" aria-label="Redes sociais">
            {config.redesSociais.map((link) => (
              <li key={link.rede}>
                <a
                  id={`rodape-social-${link.rede}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.rotulo}
                  className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 flex items-center justify-center transition-colors"
                >
                  <IconeRedeSocial rede={link.rede} className="w-4 h-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Navegação
          </h2>
          <ListaLinksNavegacao
            secoes={secoesMenu}
            secaoAtiva={null}
            onNavegar={(id) => rolarParaSecao(id)}
            idPrefixo="nav-rodape"
            ariaLabel="Navegação do rodapé"
            orientacao="vertical"
            className="-mx-3"
          />
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Atendimento
          </h2>
          {linkWhatsApp ? (
            <a
              id="rodape-whatsapp"
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Fale conosco no WhatsApp
            </a>
          ) : (
            <p className="text-sm text-slate-500">Canais de atendimento em breve.</p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800/70">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            © {ano} {config.descricaoEstabelecimento}. Todos os direitos reservados.
          </p>
          <p>
            Reservas online por{" "}
            <span className="font-bold text-slate-300">{config.nomePlataforma}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
