/**
 * @file quadrasSite.test.ts
 * @description Regras da tela Quadras (SPEC/2026-11-02-admin-ajustes-demo.md §8): fechamento da quadra
 * inteira, preços "de dia / à noite" como o site mostra, efeito de cada tarifa e gravação dos campos
 * novos (foto, fechamento) no banco.
 */

import { describe, expect, it } from "vitest";
import { motivoFechamentoParaAtleta, quadraFechadaEm, textoPeriodoFechamento, validarFechamento } from "@/lib/arena/bloqueioQuadra";
import { efeitoDaTarifa, resumoPrecosNoSite } from "@/lib/arena/precosNoSite";
import { mapearLinhaParaQuadra, quadraParaPayload } from "@/lib/arena/arenaRepository";
import type { Quadra, QuadraPreco } from "@/lib/arena/types";

const quadra: Quadra = {
  id: "q1",
  arenaId: "a",
  numero: 1,
  nome: "Areia 1",
  tipoPiso: "areia",
  esportes: ["Beach Tennis"],
  coberta: false,
  iluminacao: true,
  valorHoraPadrao: 80,
  ordem: 1,
  ativa: true,
  criadaEm: "",
};
const tarifa = (extra: Partial<QuadraPreco>): QuadraPreco => ({
  id: "p",
  arenaId: "a",
  quadraId: "q1",
  diasSemana: [0, 1, 2, 3, 4, 5, 6],
  horaInicio: "18:00",
  horaFim: "23:00",
  valorHora: 100,
  ativo: true,
  criadaEm: "",
  ...extra,
});

describe("fechamento da quadra", () => {
  it("fecha só no período (inclusive) e 'até liberar' não tem fim", () => {
    const periodo = { bloqueioInicio: "2026-11-10", bloqueioFim: "2026-11-12" };
    expect(quadraFechadaEm(periodo, "2026-11-09")).toBe(false);
    expect(quadraFechadaEm(periodo, "2026-11-10")).toBe(true);
    expect(quadraFechadaEm(periodo, "2026-11-12")).toBe(true);
    expect(quadraFechadaEm(periodo, "2026-11-13")).toBe(false);
    expect(quadraFechadaEm({ bloqueioInicio: "2026-11-10" }, "2030-01-01")).toBe(true);
    expect(quadraFechadaEm({}, "2026-11-10")).toBe(false);
    expect(quadraFechadaEm(null, "2026-11-10")).toBe(false);
  });

  it("textos do período e do motivo", () => {
    expect(textoPeriodoFechamento({ bloqueioInicio: "2026-11-10", bloqueioFim: "2026-11-12" })).toBe("de 10/11 a 12/11");
    expect(textoPeriodoFechamento({ bloqueioInicio: "2026-11-10", bloqueioFim: "2026-11-10" })).toBe("em 10/11");
    expect(textoPeriodoFechamento({ bloqueioInicio: "2026-11-10" })).toBe("a partir de 10/11 (até liberar)");
    expect(motivoFechamentoParaAtleta({ bloqueioMotivo: "Reforma" })).toBe("Quadra fechada nesta data: Reforma.");
    expect(motivoFechamentoParaAtleta({})).toBe("Quadra fechada nesta data.");
  });

  it("valida início no passado, fim antes do início e motivo vazio ou longo", () => {
    const hoje = "2026-11-02";
    expect(validarFechamento({ inicio: "2026-11-02", fim: "", motivo: "Reforma" }, hoje)).toEqual({});
    expect(validarFechamento({ inicio: "2026-11-01", fim: "", motivo: "Reforma" }, hoje).inicio).toBeDefined();
    expect(validarFechamento({ inicio: "2026-11-05", fim: "2026-11-04", motivo: "Reforma" }, hoje).fim).toBeDefined();
    expect(validarFechamento({ inicio: "2026-11-05", fim: "", motivo: "  " }, hoje).motivo).toBeDefined();
    expect(validarFechamento({ inicio: "2026-11-05", fim: "", motivo: "x".repeat(121) }, hoje).motivo).toBeDefined();
  });
});

describe("preços como o site mostra", () => {
  it("sem tarifa: um preço só", () => {
    expect(resumoPrecosNoSite(quadra, [])).toEqual(["R$ 80 a hora"]);
  });

  it("tarifa da noite em todos os dias: uma linha 'de dia · à noite'", () => {
    expect(resumoPrecosNoSite(quadra, [tarifa({})])).toEqual(["R$ 80 de dia · R$ 100 à noite"]);
  });

  it("fim de semana diferente: duas linhas", () => {
    const precos = [tarifa({}), tarifa({ id: "fds", diasSemana: [0, 6], horaInicio: "07:00", horaFim: "18:00", valorHora: 90 })];
    expect(resumoPrecosNoSite(quadra, precos)).toEqual(["Seg a sex: R$ 80 de dia · R$ 100 à noite", "Sáb e dom: R$ 90 de dia · R$ 100 à noite"]);
  });

  it("efeito de cada tarifa no card do site", () => {
    expect(efeitoDaTarifa({ horaInicio: "18:00", horaFim: "23:00" })).toBe("vira o preço “à noite” do site");
    expect(efeitoDaTarifa({ horaInicio: "07:00", horaFim: "18:00" })).toBe("vira o preço “de dia” do site");
    expect(efeitoDaTarifa({ horaInicio: "07:00", horaFim: "23:00" })).toBe("vira os dois preços do site (de dia e à noite)");
    expect(efeitoDaTarifa({ horaInicio: "06:00", horaFim: "08:00" })).toBe("não aparece no card do site, mas vale na hora de reservar");
    // 19:00 é o fim exclusivo: não cobre as 19h
    expect(efeitoDaTarifa({ horaInicio: "12:00", horaFim: "19:00" })).toBe("não aparece no card do site, mas vale na hora de reservar");
  });
});

describe("gravação da quadra", () => {
  it("lê foto e fechamento do banco", () => {
    const q = mapearLinhaParaQuadra({
      id: "q1",
      foto_url: "https://x/f.jpg",
      foto_posicao: "50% 40%",
      foto_descricao: "Quadra de areia",
      bloqueio_inicio: "2026-11-10",
      bloqueio_fim: null,
      bloqueio_motivo: "Reforma",
    });
    expect(q).toMatchObject({ fotoUrl: "https://x/f.jpg", fotoPosicao: "50% 40%", fotoDescricao: "Quadra de areia", bloqueioInicio: "2026-11-10", bloqueioMotivo: "Reforma" });
    expect(q.bloqueioFim).toBeUndefined();
  });

  it("só grava os campos informados; informado vazio limpa a coluna (reabrir, tirar foto)", () => {
    expect(quadraParaPayload({ nome: "Areia 1" })).toEqual({ nome: "Areia 1" });
    expect(quadraParaPayload({ bloqueioInicio: undefined, bloqueioFim: undefined, bloqueioMotivo: undefined })).toEqual({
      bloqueio_inicio: null,
      bloqueio_fim: null,
      bloqueio_motivo: null,
    });
    expect(quadraParaPayload({ fotoUrl: "", fotoPosicao: "10% 20%" })).toEqual({ foto_url: null, foto_posicao: "10% 20%" });
  });
});
