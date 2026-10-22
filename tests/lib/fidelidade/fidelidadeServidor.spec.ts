/**
 * @file fidelidadeServidor.spec.ts
 * @description Emissão de selos/vouchers e validação de vouchers no servidor (antifraude).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  modulos: ["agendamento_core", "fidelidade"] as string[],
  campanha: { id: "c1", arena_id: "a1", nome: "Camp", horas_necessarias: 2, meses_validade: 6, dias_validade_voucher: 60, ativo: true } as Record<string, unknown> | null,
  reservas: [] as Record<string, unknown>[],
  selos: [] as Record<string, unknown>[],
  vouchers: [] as Record<string, unknown>[],
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.operacao !== "select") return { data: null, error: null };
    if (c.tabela === "arenas") return { data: { modulos_ativos: mocks.modulos } };
    if (c.tabela === "fidelidade_campanha") return { data: mocks.campanha };
    if (c.tabela === "usuarios") return { data: { telefone: "91981234567" } };
    if (c.tabela === "reservas") return { data: mocks.reservas };
    if (c.tabela === "fidelidade_selos") return { data: mocks.selos };
    if (c.tabela === "fidelidade_vouchers") return { data: mocks.vouchers };
    return { data: null };
  });
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});

import {
  sincronizarFidelidadeServidor,
  validarVouchersParaCheckout,
} from "@/lib/fidelidade/fidelidadeServidorService";

const partida = (id: string, horas: string[], valor: number) => ({
  id,
  arena_id: "a1",
  user_id: "u1",
  quadra_id: "q1",
  data: "2026-10-01",
  horarios: horas,
  hora_inicio: horas[0],
  hora_fim: "23:00",
  valor_total: valor,
  status: "confirmada",
  tipo_reserva: "avulsa",
});

const escritas = (tabela: string, operacao: string) =>
  mocks.consultas.filter((c) => c.tabela === tabela && c.operacao === operacao);

describe("sincronizarFidelidadeServidor", () => {
  beforeEach(() => {
    mocks.consultas.length = 0;
    mocks.modulos = ["agendamento_core", "fidelidade"];
    mocks.reservas = [];
    mocks.selos = [];
    mocks.vouchers = [];
  });

  it("gera selos das partidas concluídas e emite o voucher ao atingir a meta", async () => {
    mocks.reservas = [partida("r1", ["19:00", "20:00"], 200)];

    const r = await sincronizarFidelidadeServidor("u1", "a1");

    expect(r.novosSelos).toBe(1);
    expect(r.voucherGerado).toMatchObject({ usuarioId: "u1", valorTeto: 100, status: "disponivel" });
    const [upsertSelos] = escritas("fidelidade_selos", "upsert");
    expect((upsertSelos.payload as Record<string, unknown>[])[0]).toMatchObject({ arena_id: "a1", reserva_id: "r1", usuario_id: "u1" });
    expect((escritas("fidelidade_vouchers", "insert")[0].payload as Record<string, unknown>).arena_id).toBe("a1");
    expect(escritas("fidelidade_selos", "update")[0].payload).toMatchObject({ resgatado: true });
  });

  it("não emite nada quando a meta não foi atingida, nem para partidas futuras ou canceladas", async () => {
    mocks.reservas = [
      partida("r1", ["19:00"], 100),
      { ...partida("r2", ["19:00"], 100), data: "2099-01-01" },
      { ...partida("r3", ["19:00"], 100), status: "cancelada" },
    ];

    const r = await sincronizarFidelidadeServidor("u1", "a1");

    expect(r).toEqual({ voucherGerado: null, novosSelos: 1 });
    expect(escritas("fidelidade_vouchers", "insert")).toHaveLength(0);
  });

  it("é idempotente: reserva já contabilizada não gera novo selo", async () => {
    mocks.reservas = [partida("r1", ["19:00"], 100)];
    mocks.selos = [{ id: "s1", usuario_id: "u1", reserva_id: "r1", horas_contabilizadas: 1, valor_por_hora: 100, expira_em: "2099-01-01", resgatado: false }];

    const r = await sincronizarFidelidadeServidor("u1", "a1");

    expect(r.novosSelos).toBe(0);
    expect(escritas("fidelidade_selos", "upsert")).toHaveLength(0);
  });

  it("não faz nada em arena sem o módulo de fidelidade ou com campanha inativa", async () => {
    mocks.reservas = [partida("r1", ["19:00", "20:00"], 200)];
    mocks.modulos = ["agendamento_core"];
    expect(await sincronizarFidelidadeServidor("u1", "a1")).toEqual({ voucherGerado: null, novosSelos: 0 });

    mocks.modulos = ["fidelidade"];
    mocks.campanha = { ...mocks.campanha, ativo: false };
    expect(await sincronizarFidelidadeServidor("u1", "a1")).toEqual({ voucherGerado: null, novosSelos: 0 });
    mocks.campanha = { ...mocks.campanha, ativo: true };
  });
});

describe("validarVouchersParaCheckout", () => {
  beforeEach(() => {
    mocks.consultas.length = 0;
  });

  it("aceita apenas vouchers disponíveis, válidos, do atleta e da arena", async () => {
    mocks.vouchers = [{ id: "v1", codigo: "FID-A", usuario_id: "u1", valor_teto: 90, status: "disponivel", expira_em: "2099-01-01" }];

    const validos = await validarVouchersParaCheckout("u1", "a1", ["v1", "v1"]);

    expect(validos.map((v) => v.codigo)).toEqual(["FID-A"]);
    const [consulta] = mocks.consultas;
    expect(consulta.filtros).toContainEqual(["eq", "arena_id", "a1"]);
    expect(consulta.filtros).toContainEqual(["eq", "usuario_id", "u1"]);
  });

  it("rejeita visitante, voucher usado ou vencido e excesso de vouchers", async () => {
    await expect(validarVouchersParaCheckout(null, "a1", ["v1"])).rejects.toMatchObject({ status: 401 });

    mocks.vouchers = [{ id: "v1", usuario_id: "u1", status: "utilizado", expira_em: "2099-01-01" }];
    await expect(validarVouchersParaCheckout("u1", "a1", ["v1"])).rejects.toMatchObject({ status: 422 });

    mocks.vouchers = [{ id: "v1", usuario_id: "u1", status: "disponivel", expira_em: "2020-01-01" }];
    await expect(validarVouchersParaCheckout("u1", "a1", ["v1"])).rejects.toMatchObject({ status: 422 });

    const muitos = Array.from({ length: 11 }, (_, i) => `v${i}`);
    await expect(validarVouchersParaCheckout("u1", "a1", muitos)).rejects.toMatchObject({ status: 422 });
  });

  it("retorna lista vazia sem consultar o banco quando nenhum voucher foi escolhido", async () => {
    expect(await validarVouchersParaCheckout(null, "a1", [])).toEqual([]);
    expect(mocks.consultas).toHaveLength(0);
  });
});
