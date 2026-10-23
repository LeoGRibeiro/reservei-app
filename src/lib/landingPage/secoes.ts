/**
 * @module landingPage/secoes
 *
 * Catálogo central (fonte única da verdade) das seções da Landing Page.
 *
 * A ORDEM deste array define a ordem de renderização na página e a ordem dos
 * links de navegação. A seção `inicio` (fluxo de reserva) deve permanecer
 * sempre na primeira posição — Regra de Ouro da spec de navegação.
 *
 * @see SPEC/2026-10-06-lp-base-navegacao.md
 */

import type { PlaceholderSecao, SecaoLandingId, SecaoLandingPage } from "./types";

/** Caminhos das specs responsáveis por cada grupo de seções. */
export const SPECS_LANDING_PAGE = {
  BASE_NAVEGACAO: "SPEC/2026-10-06-lp-base-navegacao.md",
  CONTEUDO_INSTITUCIONAL: "SPEC/2026-10-06-lp-conteudo-institucional.md",
  PROVA_SOCIAL_REDES: "SPEC/2026-10-06-lp-prova-social-redes.md",
  EVENTOS_FIDELIDADE: "SPEC/2026-10-06-lp-eventos-fidelidade.md",
  SUPORTE_CONTATO: "SPEC/2026-10-06-lp-suporte-contato.md",
} as const;

/**
 * Constantes nomeadas para os IDs das seções — evita "strings mágicas"
 * espalhadas pelos componentes.
 *
 * @example
 * <section id={SECAO_IDS.INICIO}>...</section>
 */
export const SECAO_IDS = {
  INICIO: "inicio",
  ESTRUTURA: "estrutura",
  ESCOLINHAS: "escolinhas",
  FIDELIDADE: "fidelidade",
  EVENTOS: "eventos",
  AVALIACOES: "avaliacoes",
  INSTAGRAM: "instagram",
  FAQ: "faq",
  CONTATO: "contato",
} as const satisfies Record<string, SecaoLandingId>;

/**
 * Lista ordenada de todas as seções da Landing Page.
 *
 * Links do menu principal (conforme spec): Início, Estrutura, Escolinhas,
 * Eventos e Contato. As demais seções existem na página mas não ocupam espaço
 * no cabeçalho — basta alterar `exibirNoMenu` para promovê-las.
 */
export const SECOES_LANDING_PAGE: readonly SecaoLandingPage[] = [
  {
    id: SECAO_IDS.INICIO,
    rotuloMenu: "Início",
    titulo: "Agende sua quadra agora",
    subtitulo: "Escolha o dia, toque nos horários livres e garanta seu jogo em poucos segundos.",
    exibirNoMenu: true,
    specReferencia: SPECS_LANDING_PAGE.BASE_NAVEGACAO,
  },
  {
    id: SECAO_IDS.ESTRUTURA,
    rotuloMenu: "Estrutura",
    titulo: "O Local e Estrutura",
    subtitulo: "Conheça nossas quadras, vestiários, bar e área de lazer.",
    exibirNoMenu: true,
    specReferencia: SPECS_LANDING_PAGE.CONTEUDO_INSTITUCIONAL,
  },
  {
    id: SECAO_IDS.ESCOLINHAS,
    rotuloMenu: "Escolinhas",
    titulo: "Escolinhas e Aulas",
    subtitulo: "Modalidades, professores e horários para todas as idades.",
    exibirNoMenu: true,
    specReferencia: SPECS_LANDING_PAGE.CONTEUDO_INSTITUCIONAL,
  },
  {
    id: SECAO_IDS.FIDELIDADE,
    rotuloMenu: "Fidelidade",
    titulo: "Programa de Fidelidade",
    subtitulo: "Jogue, acumule pontos e troque por reservas grátis e descontos.",
    exibirNoMenu: false,
    specReferencia: SPECS_LANDING_PAGE.EVENTOS_FIDELIDADE,
  },
  {
    id: SECAO_IDS.EVENTOS,
    rotuloMenu: "Eventos",
    titulo: "Campeonatos e Eventos",
    subtitulo: "Torneios, ligas e eventos sociais que movimentam o complexo.",
    exibirNoMenu: true,
    specReferencia: SPECS_LANDING_PAGE.EVENTOS_FIDELIDADE,
  },
  {
    id: SECAO_IDS.AVALIACOES,
    rotuloMenu: "Avaliações",
    titulo: "O que dizem nossos clientes",
    subtitulo: "Avaliações reais publicadas no Google.",
    exibirNoMenu: false,
    specReferencia: SPECS_LANDING_PAGE.PROVA_SOCIAL_REDES,
  },
  {
    id: SECAO_IDS.INSTAGRAM,
    rotuloMenu: "Instagram",
    titulo: "Siga a gente no Instagram",
    subtitulo: "Os posts e reels mais recentes do complexo.",
    exibirNoMenu: false,
    specReferencia: SPECS_LANDING_PAGE.PROVA_SOCIAL_REDES,
  },
  {
    id: SECAO_IDS.FAQ,
    rotuloMenu: "Dúvidas",
    titulo: "Termos, Regras e Perguntas Frequentes",
    subtitulo: "Política de chuva, cancelamento e regras de uso das quadras.",
    exibirNoMenu: false,
    specReferencia: SPECS_LANDING_PAGE.SUPORTE_CONTATO,
  },
  {
    id: SECAO_IDS.CONTATO,
    rotuloMenu: "Contato",
    titulo: "Localização e Contato",
    subtitulo: "Como chegar, horários de funcionamento e canais de atendimento.",
    exibirNoMenu: true,
    specReferencia: SPECS_LANDING_PAGE.SUPORTE_CONTATO,
  },
];

/**
 * Funcionalidades previstas para cada seção ainda não implementada.
 * Exibidas nos placeholders para dar noção do layout final.
 *
 * À medida que cada spec for implementada (ex: Estrutura e Escolinhas),
 * a seção é removida daqui e renderizada como componente completo.
 */
export const PLACEHOLDERS_SECOES: readonly PlaceholderSecao[] = [
  {
    secaoId: SECAO_IDS.FIDELIDADE,
    itensPlanejados: [
      "Passo a passo de \"Como Funciona\" o acúmulo de pontos",
      "Exemplos de recompensas reais disponíveis",
      "CTA \"Crie sua Conta e Comece a Pontuar\"",
    ],
  },
  {
    secaoId: SECAO_IDS.EVENTOS,
    itensPlanejados: [
      "Cards de torneios, ligas e eventos sociais",
      "Data, horário, valor de inscrição e regras",
      "Cadastro de eventos e banners pelo Painel Admin",
    ],
  },
  {
    secaoId: SECAO_IDS.AVALIACOES,
    itensPlanejados: [
      "Nota geral do Google com estrelas",
      "Carrossel com os depoimentos mais recentes",
      "Botão \"Avalie-nos no Google\"",
    ],
  },
  {
    secaoId: SECAO_IDS.INSTAGRAM,
    itensPlanejados: [
      "Grid com os posts e reels mais recentes",
      "Clique leva à postagem original",
      "Botão \"Siga nosso Instagram\"",
    ],
  },
  {
    secaoId: SECAO_IDS.FAQ,
    itensPlanejados: [
      "Perguntas em formato sanfona (accordion)",
      "Política de chuva e de cancelamento",
      "Regras de vestimenta e calçados",
      "Gestão das perguntas pelo Painel Admin",
    ],
  },
  {
    secaoId: SECAO_IDS.CONTATO,
    itensPlanejados: [
      "Mapa interativo do Google Maps",
      "Horários de funcionamento sincronizados com o sistema",
      "Atalhos para WhatsApp, telefone e e-mail",
    ],
  },
];

/**
 * Seções da Landing Page que ainda não têm conteúdo real e, portanto, nunca devem aparecer no portal do
 * atleta (nem como bloco "Em construção", nem como link do menu).
 */
export const SECOES_SEM_CONTEUDO: ReadonlySet<SecaoLandingId> = new Set<SecaoLandingId>([
  SECAO_IDS.FIDELIDADE,
  SECAO_IDS.EVENTOS,
  SECAO_IDS.AVALIACOES,
  SECAO_IDS.INSTAGRAM,
  SECAO_IDS.FAQ,
]);

/** Condições do portal que decidem quais seções existem. */
export interface CondicoesSecoesPortal {
  /** A arena contratou o módulo Escolinhas */
  escolinhas: boolean;
  /** A arena já cadastrou ao menos uma foto da estrutura */
  estrutura: boolean;
}

/**
 * Seções (e links de menu) realmente exibidas no portal do atleta: só as que têm conteúdo real e, quando
 * dependem de módulo ou de cadastro, só se a arena os tem.
 *
 * @param condicoes Módulos e cadastros da arena
 * @param secoes Catálogo completo (padrão: {@link SECOES_LANDING_PAGE})
 * @returns Seções visíveis, na ordem do catálogo
 *
 * @example
 * ```ts
 * secoesDoPortal({ escolinhas: false, estrutura: false }).map((s) => s.id); // ["inicio", "contato"]
 * ```
 */
export function secoesDoPortal(
  condicoes: CondicoesSecoesPortal,
  secoes: readonly SecaoLandingPage[] = SECOES_LANDING_PAGE
): SecaoLandingPage[] {
  return secoes.filter((secao) => {
    if (SECOES_SEM_CONTEUDO.has(secao.id)) return false;
    if (secao.id === SECAO_IDS.ESCOLINHAS) return condicoes.escolinhas;
    if (secao.id === SECAO_IDS.ESTRUTURA) return condicoes.estrutura;
    return true;
  });
}

