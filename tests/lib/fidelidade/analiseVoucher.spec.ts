/**
 * @file analiseVoucher.spec.ts
 * @description Hora grátis com aprovação do dono (SPEC/2026-11-02-admin-ajustes-demo.md §10): validação
 * da decisão, nova validade ao liberar e a troca de status atômica no servidor (só sai de
 * "em_analise"; quem analisou fica registrado; pedido já analisado vira 409).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  atual: null as Record<string, unknown> | null,
  atualizadas: [] as Record<string, unknown>[],
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.tabela !== "fidelidade_vouchers") return { data: null };
    if (c.operacao === "select") return { data: mocks.atual };
    if (c.operacao === "update") return { data: mocks.atualizadas };
    return { data: null };
  });
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});

import { analisarVoucher, validadeAoLiberar, validarDecisaoVoucher } from "@/lib/fidelidade/fidelidadeServidorService";

const MEMBRO = { userId: "dono-1", email: "dono@arena.com", arenaId: "a1" };
const voucher = (extra: Record<string, unknown> = {}) => ({
  id: "v1",
  arena_id: "a1",
  codigo: "CLUBE-1",
  usuario_id: "u1",
  valor_teto: 100,
  status: "em_analise",
  criado_em: "2026-11-01T10:00:00Z",
  expira_em: "2026-12-31",
  ...extra,
});
const update = () => mocks.consultas.find((c) => c.tabela === "fidelidade_vouchers" && c.operacao === "update");

describe("validarDecisaoVoucher", () => {
  it("aceita liberar e recusar com motivo; recusa sem motivo ou decisão estranha", () => {
    expect(validarDecisaoVoucher({ decisao: "liberar" })).toEqual({ decisao: "liberar" });
    expect(validarDecisaoVoucher({ decisao: "recusar", motivo: "  Horas de reservas canceladas " })).toEqual({ decisao: "recusar", motivo: "Horas de reservas canceladas" });
    expect(() => validarDecisaoVoucher({ decisao: "recusar", motivo: "x" })).toThrow(/motivo/);
    expect(() => validarDecisaoVoucher({ decisao: "recusar", motivo: "x".repeat(201) })).toThrow(/200/);
    expect(() => validarDecisaoVoucher({ decisao: "aprovar" })).toThrow(/inválida/);
  });
});

describe("validadeAoLiberar", () => {
  it("o prazo passa a contar da liberação", () => {
    expect(validadeAoLiberar("2026-11-01T10:00:00Z", "2026-12-31", "2026-11-05")).toBe("2027-01-04");
    expect(validadeAoLiberar("2026-11-01", "2026-11-01", "2026-11-05")).toBe("2026-11-06");
  });
});

describe("analisarVoucher", () => {
  beforeEach(() => {
    mocks.consultas.length = 0;
    mocks.atual = voucher();
    mocks.atualizadas = [voucher({ status: "disponivel", analisado_por_nome: "Dono Teste" })];
  });

  it("liberar: só troca quem está em análise, registra quem liberou e renova a validade", async () => {
    const r = await analisarVoucher(MEMBRO, "v1", { decisao: "liberar" });
    expect(r.status).toBe("disponivel");
    const u = update()!;
    expect(u.payload).toMatchObject({ status: "disponivel", analisado_por: "dono-1", analisado_por_nome: "Dono Teste", motivo_analise: null });
    expect(u.filtros).toContainEqual(["eq", "status", "em_analise"]);
    expect(u.filtros).toContainEqual(["eq", "arena_id", "a1"]);
  });

  it("recusar grava o motivo", async () => {
    mocks.atualizadas = [voucher({ status: "recusado", motivo_analise: "Reservas não jogadas" })];
    const r = await analisarVoucher(MEMBRO, "v1", { decisao: "recusar", motivo: "Reservas não jogadas" });
    expect(r).toMatchObject({ status: "recusado", motivoAnalise: "Reservas não jogadas" });
    expect(update()!.payload).toMatchObject({ status: "recusado", motivo_analise: "Reservas não jogadas" });
  });

  it("pedido de outra arena ou inexistente: 404", async () => {
    mocks.atual = null;
    await expect(analisarVoucher(MEMBRO, "v1", { decisao: "liberar" })).rejects.toMatchObject({ status: 404 });
  });

  it("pedido já analisado (ou analisado por outra pessoa no mesmo segundo): 409", async () => {
    mocks.atual = voucher({ status: "disponivel" });
    await expect(analisarVoucher(MEMBRO, "v1", { decisao: "liberar" })).rejects.toMatchObject({ status: 409 });
    mocks.atual = voucher();
    mocks.atualizadas = [];
    await expect(analisarVoucher(MEMBRO, "v1", { decisao: "liberar" })).rejects.toMatchObject({ status: 409 });
  });
});
