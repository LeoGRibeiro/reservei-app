// @vitest-environment node
/**
 * @file vinculoReservas.test.ts
 * @description Ligação das reservas feitas sem conta à conta nova do atleta (no servidor, no cadastro).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  filtros: [] as string[],
  payload: null as Record<string, unknown> | null,
  resultado: { data: [{ id: "r1" }, { id: "r2" }], error: null } as { data: unknown[] | null; error: { message: string } | null },
}));

vi.mock("@/lib/supabase/adminClient", () => ({
  supabaseAdmin: {
    from: () => {
      const c = {
        update: (p: Record<string, unknown>) => ((estado.payload = p), c),
        is: (col: string, v: unknown) => (estado.filtros.push(`is:${col}:${v}`), c),
        in: (col: string, vs: string[]) => (estado.filtros.push(`in:${col}:${vs.join("|")}`), c),
        select: () => Promise.resolve(estado.resultado),
      };
      return c;
    },
  },
}));

import { variacoesDoTelefone, vincularReservasAoAtleta } from "@/lib/atletas/vinculoReservas";

beforeEach(() => {
  estado.filtros = [];
  estado.payload = null;
  estado.resultado = { data: [{ id: "r1" }, { id: "r2" }], error: null };
});

describe("variacoesDoTelefone", () => {
  it("cobre só dígitos, com 55 e com máscara", () => {
    expect(variacoesDoTelefone("5591984982865")).toEqual(["91984982865", "5591984982865", "(91) 98498-2865"]);
    expect(variacoesDoTelefone("(91) 3222-1234")).toEqual(["9132221234", "559132221234", "(91) 3222-1234"]);
  });

  it("número curto não gera nada", () => {
    expect(variacoesDoTelefone("12345")).toEqual([]);
  });
});

describe("vincularReservasAoAtleta", () => {
  it("liga só reservas sem dono com o mesmo WhatsApp", async () => {
    expect(await vincularReservasAoAtleta("u1", "(91) 98498-2865")).toBe(2);
    expect(estado.payload).toEqual({ user_id: "u1" });
    expect(estado.filtros).toEqual(["is:user_id:null", "in:whatsapp_cliente:91984982865|5591984982865|(91) 98498-2865"]);
  });

  it("nunca lança: falha do banco vira 0", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    estado.resultado = { data: null, error: { message: "erro" } };
    expect(await vincularReservasAoAtleta("u1", "91984982865")).toBe(0);
  });
});
