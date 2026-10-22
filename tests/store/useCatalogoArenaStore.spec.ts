/**
 * @file useCatalogoArenaStore.spec.ts
 * @description Catálogo da arena ativa (quadras, horários, antecedência) e marca white-label.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  descreverQuadra,
  obterHorariosCatalogo,
  obterQuadrasCatalogo,
  useCatalogoArenaStore,
} from "@/store/useCatalogoArenaStore";
import { configuracaoDaArena, enderecoDaArena, whatsappInternacional } from "@/hooks/useConfiguracaoSiteArena";
import { SITE_CONFIG } from "@/lib/landingPage/siteConfig";
import { ARENA_PADRAO, QUADRAS_PADRAO } from "@/lib/arena/defaultArena";
import type { Arena } from "@/lib/arena/types";

const ARENA: Arena = {
  ...ARENA_PADRAO,
  id: "a1",
  nome: "Arena Central",
  whatsapp: "(91) 98888-7777",
  cidade: "Belém",
  estado: "PA",
  endereco: "Rua A, 10",
  horarioAbertura: "07:00",
  horarioFechamento: "10:00",
  antecedenciaMinimaMinutos: 45,
};

describe("useCatalogoArenaStore", () => {
  afterEach(() => useCatalogoArenaStore.getState().redefinir());

  it("começa com o catálogo legado da demo", () => {
    expect(obterQuadrasCatalogo().map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
    expect(obterHorariosCatalogo()[0]).toBe("08:00");
  });

  it("adota quadras ativas ordenadas, horários de funcionamento e antecedência da arena", () => {
    const quadras = [
      { ...QUADRAS_PADRAO[1], id: "a1-q2", nome: "Society", ordem: 2 },
      { ...QUADRAS_PADRAO[0], id: "a1-q1", nome: "Areia", ordem: 1 },
      { ...QUADRAS_PADRAO[2], id: "a1-q3", ativa: false },
    ];

    useCatalogoArenaStore.getState().definirCatalogo(ARENA, quadras);

    expect(obterQuadrasCatalogo().map((q) => q.id)).toEqual(["a1-q1", "a1-q2"]);
    expect(descreverQuadra("a1-q2")).toBe("Society");
    expect(obterHorariosCatalogo()).toEqual(["07:00", "08:00", "09:00"]);
    expect(useCatalogoArenaStore.getState().antecedenciaMinutos).toBe(45);
    expect(useCatalogoArenaStore.getState().arena?.id).toBe("a1");
  });
});

describe("marca white-label da arena", () => {
  it("usa nome, local e WhatsApp da arena, sem redes sociais genéricas", () => {
    const config = configuracaoDaArena(ARENA);
    expect(config).toMatchObject({ nomePlataforma: "Arena Central", descricaoEstabelecimento: "Belém/PA", whatsappNumero: "5591988887777" });
    expect(config.redesSociais).toEqual([{ rede: "whatsapp", rotulo: "WhatsApp", url: "https://wa.me/5591988887777" }]);
  });

  it("mantém a configuração padrão enquanto a arena não carrega", () => {
    expect(configuracaoDaArena(null)).toBe(SITE_CONFIG);
  });

  it("formata endereço e WhatsApp internacional", () => {
    expect(enderecoDaArena(ARENA, "padrão")).toBe("Rua A, 10 – Belém/PA");
    expect(enderecoDaArena(null, "padrão")).toBe("padrão");
    expect(whatsappInternacional("5591988887777")).toBe("5591988887777");
    expect(whatsappInternacional("")).toBe("");
  });
});
