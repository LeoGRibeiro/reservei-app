import { describe, expect, it } from "vitest";
import {
  PLACEHOLDERS_SECOES,
  SECAO_IDS,
  SECOES_LANDING_PAGE,
  SPECS_LANDING_PAGE,
  secoesDoPortal,
} from "@/lib/landingPage/secoes";
import { SITE_CONFIG } from "@/lib/landingPage/siteConfig";

describe("landingPage/secoes - integridade do catálogo", () => {
  it("mantém o fluxo de reserva como PRIMEIRA seção (Regra de Ouro)", () => {
    expect(SECOES_LANDING_PAGE[0].id).toBe(SECAO_IDS.INICIO);
    expect(SECOES_LANDING_PAGE[0].specReferencia).toBe(SPECS_LANDING_PAGE.BASE_NAVEGACAO);
  });

  it("termina com a seção de contato", () => {
    expect(SECOES_LANDING_PAGE[SECOES_LANDING_PAGE.length - 1].id).toBe(SECAO_IDS.CONTATO);
  });

  it("não possui ids duplicados", () => {
    const ids = SECOES_LANDING_PAGE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre todas as constantes de SECAO_IDS", () => {
    const ids = SECOES_LANDING_PAGE.map((s) => s.id).sort();
    expect(ids).toEqual(Object.values(SECAO_IDS).sort());
  });

  it("possui rótulo, título, subtítulo e spec preenchidos em todas as seções", () => {
    for (const secao of SECOES_LANDING_PAGE) {
      expect(secao.rotuloMenu.trim()).not.toBe("");
      expect(secao.titulo.trim()).not.toBe("");
      expect(secao.subtitulo.trim()).not.toBe("");
      expect(Object.values(SPECS_LANDING_PAGE)).toContain(secao.specReferencia);
    }
  });

  it("inclui a seção de Fidelidade na página", () => {
    expect(SECOES_LANDING_PAGE.some((s) => s.id === SECAO_IDS.FIDELIDADE)).toBe(true);
  });

  it("usa ids compatíveis com âncoras HTML (minúsculas, sem espaços)", () => {
    for (const secao of SECOES_LANDING_PAGE) {
      expect(secao.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe("landingPage/secoes - placeholders", () => {
  it("mantém placeholders apenas para as seções ainda pendentes de implementação", () => {
    const comPlaceholder = PLACEHOLDERS_SECOES.map((p) => p.secaoId);
    expect(comPlaceholder).not.toContain(SECAO_IDS.INICIO);
    expect(comPlaceholder).not.toContain(SECAO_IDS.ESTRUTURA);
    expect(comPlaceholder).not.toContain(SECAO_IDS.ESCOLINHAS);
    expect(comPlaceholder).toContain(SECAO_IDS.FIDELIDADE);
    expect(comPlaceholder).toContain(SECAO_IDS.EVENTOS);
  });

  it("cada placeholder lista ao menos um item planejado, sem duplicidades", () => {
    for (const placeholder of PLACEHOLDERS_SECOES) {
      expect(placeholder.itensPlanejados.length).toBeGreaterThan(0);
      expect(new Set(placeholder.itensPlanejados).size).toBe(placeholder.itensPlanejados.length);
    }
  });
});

describe("landingPage/siteConfig", () => {
  it("define marca e descrição do estabelecimento", () => {
    expect(SITE_CONFIG.nomePlataforma).toBe("Reservei");
    expect(SITE_CONFIG.descricaoEstabelecimento.trim()).not.toBe("");
  });

  it("usa apenas URLs https nas redes sociais, sem redes duplicadas", () => {
    const redes = SITE_CONFIG.redesSociais.map((r) => r.rede);
    expect(new Set(redes).size).toBe(redes.length);
    for (const link of SITE_CONFIG.redesSociais) {
      expect(link.url.startsWith("https://")).toBe(true);
      expect(link.rotulo.trim()).not.toBe("");
    }
  });

  it("armazena o WhatsApp apenas com dígitos", () => {
    expect(SITE_CONFIG.whatsappNumero).toMatch(/^\d{10,15}$/);
  });
});

describe("secoesDoPortal", () => {
  it("nunca inclui seções sem conteúdo real (fidelidade, eventos, avaliações, Instagram e FAQ)", () => {
    const ids = secoesDoPortal({ escolinhas: true, estrutura: true }).map((s) => s.id);
    expect(ids).toEqual(["inicio", "estrutura", "escolinhas", "contato"]);
  });

  it("oculta Escolinhas sem o módulo e Estrutura sem fotos", () => {
    expect(secoesDoPortal({ escolinhas: false, estrutura: false }).map((s) => s.id)).toEqual(["inicio", "contato"]);
    expect(secoesDoPortal({ escolinhas: false, estrutura: true }).map((s) => s.id)).toEqual([
      "inicio",
      "estrutura",
      "contato",
    ]);
  });
});
