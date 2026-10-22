/**
 * @file permissoes.test.ts
 * @description Matriz de acesso do painel por papel (SPEC/2026-10-22-mvp-go-live.md §4.1).
 */

import { describe, expect, it } from "vitest";
import { isPapelArena, podeAcessarView, podeExecutar, type AdminView } from "@/lib/admin/permissoes";

const VIEWS_OPERADOR: AdminView[] = ["dashboard", "agenda", "usuarios", "grupos", "escolinhas"];
const VIEWS_GERENTE: AdminView[] = ["quadras", "institucional", "fidelidade", "financeiro"];
const VIEWS_PROPRIETARIO: AdminView[] = ["pagamentos", "equipe", "configuracoes"];

describe("podeAcessarView", () => {
  it("operador acessa só a operação do dia a dia", () => {
    for (const v of VIEWS_OPERADOR) expect(podeAcessarView("operador", v)).toBe(true);
    for (const v of [...VIEWS_GERENTE, ...VIEWS_PROPRIETARIO]) expect(podeAcessarView("operador", v)).toBe(false);
  });

  it("gerente acessa a operação e o financeiro, mas não pagamentos, equipe e configurações", () => {
    for (const v of [...VIEWS_OPERADOR, ...VIEWS_GERENTE]) expect(podeAcessarView("gerente", v)).toBe(true);
    for (const v of VIEWS_PROPRIETARIO) expect(podeAcessarView("gerente", v)).toBe(false);
  });

  it("proprietário acessa tudo", () => {
    for (const v of [...VIEWS_OPERADOR, ...VIEWS_GERENTE, ...VIEWS_PROPRIETARIO]) {
      expect(podeAcessarView("proprietario", v)).toBe(true);
    }
  });

  it("sem papel (ou papel desconhecido) não acessa nada", () => {
    expect(podeAcessarView(null, "dashboard")).toBe(false);
    expect(podeAcessarView(undefined, "agenda")).toBe(false);
    expect(podeAcessarView("dono" as never, "agenda")).toBe(false);
  });
});

describe("podeExecutar", () => {
  it("aplica a hierarquia nas ações sensíveis", () => {
    expect(podeExecutar("operador", "ver_receita")).toBe(false);
    expect(podeExecutar("gerente", "ver_receita")).toBe(true);
    expect(podeExecutar("gerente", "redefinir_senha_atleta")).toBe(true);
    expect(podeExecutar("gerente", "gerenciar_equipe")).toBe(false);
    expect(podeExecutar("gerente", "configurar_pagamentos")).toBe(false);
    expect(podeExecutar("proprietario", "gerenciar_equipe")).toBe(true);
    expect(podeExecutar("proprietario", "configurar_pagamentos")).toBe(true);
  });
});

describe("isPapelArena", () => {
  it("reconhece apenas os três papéis", () => {
    expect(isPapelArena("operador")).toBe(true);
    expect(isPapelArena("gerente")).toBe(true);
    expect(isPapelArena("proprietario")).toBe(true);
    expect(isPapelArena("admin")).toBe(false);
    expect(isPapelArena(undefined)).toBe(false);
  });
});
