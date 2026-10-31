/**
 * @file tema.test.ts
 * @description Cores do portal por arena: normalização do `arenas.tema` e variáveis CSS.
 */

import { describe, expect, it } from "vitest";
import { TEMA_NEUTRO, normalizarTema, variaveisDoTema } from "@/lib/portal/tema";

const BELEM = {
  marca: "#1e2d6b",
  marca_escura: "#131d47",
  marca_clara: "#e7eaf5",
  destaque: "#f4b41a",
  destaque_hover: "#e3a20c",
  fundo_suave: "#f4f1ea",
  papel: "#fffdf8",
};

describe("normalizarTema", () => {
  it("lê as 7 cores do jsonb em snake_case", () => {
    expect(normalizarTema(BELEM)).toEqual({
      marca: "#1e2d6b",
      marcaEscura: "#131d47",
      marcaClara: "#e7eaf5",
      destaque: "#f4b41a",
      destaqueHover: "#e3a20c",
      fundoSuave: "#f4f1ea",
      papel: "#fffdf8",
    });
  });

  it("aceita também camelCase e string JSON", () => {
    expect(normalizarTema(JSON.stringify({ marcaEscura: "#000" })).marcaEscura).toBe("#000");
  });

  it("usa o tema neutro quando não há tema", () => {
    expect(normalizarTema(null)).toEqual(TEMA_NEUTRO);
    expect(normalizarTema(undefined)).toEqual(TEMA_NEUTRO);
    expect(normalizarTema("não é json")).toEqual(TEMA_NEUTRO);
  });

  it("descarta valores que não são cor hexadecimal (o valor vai para um atributo style)", () => {
    const tema = normalizarTema({ marca: "red;background:url(https://x)", destaque: "#zzzzzz", papel: 12 });
    expect(tema.marca).toBe(TEMA_NEUTRO.marca);
    expect(tema.destaque).toBe(TEMA_NEUTRO.destaque);
    expect(tema.papel).toBe(TEMA_NEUTRO.papel);
  });

  it("completa cores ausentes com o tema neutro", () => {
    const tema = normalizarTema({ marca: "#123456" });
    expect(tema.marca).toBe("#123456");
    expect(tema.fundoSuave).toBe(TEMA_NEUTRO.fundoSuave);
  });
});

describe("variaveisDoTema", () => {
  it("gera as variáveis --pa-* usadas pelo portal-arena.css", () => {
    expect(variaveisDoTema(normalizarTema(BELEM))).toEqual({
      "--pa-marca": "#1e2d6b",
      "--pa-marca-escura": "#131d47",
      "--pa-marca-clara": "#e7eaf5",
      "--pa-destaque": "#f4b41a",
      "--pa-destaque-hover": "#e3a20c",
      "--pa-fundo-suave": "#f4f1ea",
      "--pa-papel": "#fffdf8",
    });
  });
});
