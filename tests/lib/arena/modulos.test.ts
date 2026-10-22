/**
 * @file modulos.test.ts
 * @description Testes unitários dos helpers de Feature Flags (módulos contratáveis por arena).
 */

import { describe, expect, it } from "vitest";
import {
  MODULOS_DISPONIVEIS,
  MODULOS_PADRAO,
  isModuloArena,
  normalizarModulosAtivos,
  temModuloAtivo,
  type ModuloArena,
} from "@/lib/arena/modulos";

describe("temModuloAtivo", () => {
  it("retorna true para módulo presente na lista da arena", () => {
    expect(temModuloAtivo(["fidelidade", "vagas"], "fidelidade")).toBe(true);
    expect(temModuloAtivo(["fidelidade", "vagas"], "vagas")).toBe(true);
  });

  it("retorna false para módulo ausente na lista da arena", () => {
    expect(temModuloAtivo(["vagas"], "fidelidade")).toBe(false);
    expect(temModuloAtivo(["vagas"], "whatsapp_ia")).toBe(false);
  });

  it("considera o core de agendamento sempre ativo, mesmo com lista vazia, nula ou indefinida", () => {
    expect(temModuloAtivo([], "agendamento_core")).toBe(true);
    expect(temModuloAtivo(null, "agendamento_core")).toBe(true);
    expect(temModuloAtivo(undefined, "agendamento_core")).toBe(true);
  });

  it("retorna false para módulos opcionais quando a lista é nula ou indefinida", () => {
    expect(temModuloAtivo(null, "contratos")).toBe(false);
    expect(temModuloAtivo(undefined, "escolinhas")).toBe(false);
  });

  it("retorna false quando nenhum módulo é informado", () => {
    expect(temModuloAtivo(["fidelidade"], undefined)).toBe(false);
  });

  it("retorna false quando a lista não é um array", () => {
    expect(temModuloAtivo("fidelidade" as unknown as string[], "fidelidade")).toBe(false);
  });
});

describe("isModuloArena", () => {
  it("reconhece todos os módulos do catálogo", () => {
    for (const id of Object.keys(MODULOS_DISPONIVEIS)) {
      expect(isModuloArena(id)).toBe(true);
    }
  });

  it("rejeita valores desconhecidos ou de outro tipo", () => {
    expect(isModuloArena("inexistente")).toBe(false);
    expect(isModuloArena("toString")).toBe(false);
    expect(isModuloArena(42)).toBe(false);
    expect(isModuloArena(null)).toBe(false);
  });
});

describe("normalizarModulosAtivos", () => {
  it("mantém arrays válidos e descarta identificadores desconhecidos e duplicados", () => {
    expect(normalizarModulosAtivos(["fidelidade", "xyz", "fidelidade", "vagas"])).toEqual([
      "fidelidade",
      "vagas",
    ]);
  });

  it("interpreta o formato literal de array do PostgreSQL", () => {
    expect(normalizarModulosAtivos("{vagas,contratos}")).toEqual(["vagas", "contratos"]);
  });

  it("interpreta strings JSON", () => {
    expect(normalizarModulosAtivos('["escolinhas","whatsapp_ia"]')).toEqual([
      "escolinhas",
      "whatsapp_ia",
    ]);
  });

  it("retorna o pacote padrão (cópia) quando o valor é nulo ou indefinido", () => {
    const resultado = normalizarModulosAtivos(undefined);
    expect(resultado).toEqual(MODULOS_PADRAO);
    expect(resultado).not.toBe(MODULOS_PADRAO);
    expect(normalizarModulosAtivos(null)).toEqual(MODULOS_PADRAO);
  });

  it("retorna lista vazia para tipos não suportados", () => {
    expect(normalizarModulosAtivos(123)).toEqual([]);
    expect(normalizarModulosAtivos({})).toEqual([]);
  });
});

describe("catálogo de módulos", () => {
  it("marca apenas o core de agendamento como obrigatório", () => {
    const obrigatorios = (Object.values(MODULOS_DISPONIVEIS) as {
      id: ModuloArena;
      obrigatorio?: boolean;
    }[])
      .filter((m) => m.obrigatorio)
      .map((m) => m.id);
    expect(obrigatorios).toEqual(["agendamento_core"]);
  });

  it("não inclui o add-on whatsapp_ia no pacote padrão", () => {
    expect(MODULOS_PADRAO).not.toContain("whatsapp_ia");
    expect(MODULOS_PADRAO).toContain("agendamento_core");
  });
});
