/**
 * @file configuracaoPagamento.spec.ts
 * @description Configuração de recebimento: validação da chave Pix, pré-requisitos de cada modo e a fila do
 * balcão com os Pix manuais informados.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  arena: {} as Record<string, unknown>,
  asaas: null as Record<string, unknown> | null,
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) =>
    c.tabela === "arenas" && c.operacao === "select" ? { data: mocks.arena } : { data: null }
  );
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});
vi.mock("@/lib/pagamento/credenciaisArenaRepository", () => ({ resumirCredencialAsaas: async () => mocks.asaas }));

import {
  definirModoPagamento,
  obterResumoPagamentos,
  salvarPixManual,
  validarPixManual,
} from "@/lib/pagamento/configuracaoPagamentoServidorService";
import { filtrarPagamentosAConfirmar } from "@/components/admin/PainelPagamentosAConfirmar";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";
import type { Reserva } from "@/store/useReservasStore";

const DONO: MembroArena = { userId: "dono", email: null, arenaId: "a1", role: "proprietario" };
const ARENA_BASE = { id: "a1", slug: "arena-belem", nome: "Arena Belém", cidade: "Belém", modo_pagamento: "manual" };

beforeEach(() => {
  mocks.consultas.length = 0;
  mocks.arena = { ...ARENA_BASE };
  mocks.asaas = null;
});

describe("validarPixManual", () => {
  it("normaliza a chave conforme o tipo", () => {
    expect(
      validarPixManual({ tipoChave: "telefone", chave: "(91) 98498-2865", nomeRecebedor: "Arena Belém", cidadeRecebedor: "Belém" })
    ).toEqual({ tipoChave: "telefone", chave: "+5591984982865", nomeRecebedor: "Arena Belém", cidadeRecebedor: "Belém" });
  });

  it("recusa tipo, chave, titular ou cidade inválidos", () => {
    const ok = { tipoChave: "cnpj", chave: "12.345.678/0001-90", nomeRecebedor: "Arena", cidadeRecebedor: "Belém" };
    expect(() => validarPixManual({ ...ok, tipoChave: "boleto" })).toThrow(/tipo/);
    expect(() => validarPixManual({ ...ok, chave: "123" })).toThrow(/14 dígitos/);
    expect(() => validarPixManual({ ...ok, nomeRecebedor: "A" })).toThrow(/titular/);
    expect(() => validarPixManual({ ...ok, cidadeRecebedor: "" })).toThrow(/cidade/);
  });
});

describe("obterResumoPagamentos", () => {
  it("avisa quando o banco ainda não tem a migração da Fase 8", async () => {
    mocks.arena = { id: "a1", nome: "Arena" }; // sem modo_pagamento
    await expect(obterResumoPagamentos("a1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("definirModoPagamento", () => {
  it("exige o pré-requisito de cada modo", async () => {
    await expect(definirModoPagamento(DONO, "manual")).rejects.toThrow(/chave Pix/);
    await expect(definirModoPagamento(DONO, "asaas")).rejects.toThrow(/Asaas/);
    await expect(definirModoPagamento(DONO, "pix")).rejects.toMatchObject({ status: 400 });
  });

  it("troca o modo quando o pré-requisito existe", async () => {
    mocks.asaas = { contaNome: "Arena", sandbox: false, validadaEm: null };
    await definirModoPagamento(DONO, "asaas");
    const update = mocks.consultas.find((c) => c.tabela === "arenas" && c.operacao === "update");
    expect(update?.payload).toEqual({ modo_pagamento: "asaas" });
  });
});

describe("salvarPixManual", () => {
  it("grava a chave e mantém o modo manual", async () => {
    await salvarPixManual(DONO, { chave: "12345678000190", tipoChave: "cnpj", nomeRecebedor: "Arena", cidadeRecebedor: "Belém" });
    const update = mocks.consultas.find((c) => c.tabela === "arenas" && c.operacao === "update");
    expect(update?.payload).toMatchObject({ pix_chave: "12345678000190", pix_tipo_chave: "cnpj", modo_pagamento: "manual" });
  });

  it("não tira a arena do Asaas ao atualizar a chave reserva", async () => {
    mocks.arena = { ...ARENA_BASE, modo_pagamento: "asaas" };
    mocks.asaas = { contaNome: "Arena", sandbox: false, validadaEm: null };
    await salvarPixManual(DONO, { chave: "12345678000190", tipoChave: "cnpj", nomeRecebedor: "Arena", cidadeRecebedor: "Belém" });
    const update = mocks.consultas.find((c) => c.tabela === "arenas" && c.operacao === "update");
    expect(update?.payload).not.toHaveProperty("modo_pagamento");
  });
});

describe("filtrarPagamentosAConfirmar", () => {
  const r = (id: string, extra: Partial<Reserva>) => ({ id, status: "em_processamento", ...extra }) as Reserva;

  it("lista só Pix manuais informados e ainda não decididos, do mais antigo ao mais novo", () => {
    const fila = filtrarPagamentosAConfirmar([
      r("novo", { gatewayProvedor: "manual", pagamentoInformadoEm: "2026-10-22T20:00:00Z" }),
      r("antigo", { gatewayProvedor: "manual", pagamentoInformadoEm: "2026-10-22T19:00:00Z" }),
      r("sem-aviso", { gatewayProvedor: "manual" }),
      r("asaas", { gatewayProvedor: "asaas", pagamentoInformadoEm: "2026-10-22T19:00:00Z" }),
      r("pago", { status: "pendente", gatewayProvedor: "manual", pagamentoInformadoEm: "2026-10-22T18:00:00Z" }),
    ]);
    expect(fila.map((x) => x.id)).toEqual(["antigo", "novo"]);
  });
});
