/**
 * @file pagamentoManualServidor.spec.ts
 * @description Pix manual: o atleta informa o pagamento (horário segurado até o fim da partida) e o balcão
 * confirma ou recusa, sempre dentro da própria arena.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  reserva: null as Record<string, unknown> | null,
  ocupantes: [] as Record<string, unknown>[],
  linhasAtualizadas: [{ id: "r1" }] as unknown[],
  consultas: [] as ConsultaRegistrada[],
  confirmar: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.tabela !== "reservas") return { data: null };
    if (c.operacao === "update") return { data: mocks.linhasAtualizadas };
    if (c.operacao === "select") return { data: c.unica ? mocks.reserva : mocks.ocupantes };
    return { data: null };
  });
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});

vi.mock("@/lib/pagamento/confirmacaoServidorService", () => ({
  processarConfirmacaoPagamento: mocks.confirmar,
}));

import {
  calcularValidadeAposInformar,
  confirmarPagamentoManual,
  informarPagamentoManual,
  recusarPagamentoManual,
} from "@/lib/pagamento/pagamentoManualServidorService";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";

const OPERADOR: MembroArena = { userId: "op1", email: "op@arena.com", arenaId: "a1", role: "operador" };
const futuro = (min: number) => new Date(Date.now() + min * 60000).toISOString();
const passado = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const reservaManual = (extra: Record<string, unknown> = {}) => ({
  id: "r1",
  arena_id: "a1",
  quadra_id: "q1",
  data: "2099-12-31",
  horarios: ["19:00"],
  hora_inicio: "19:00",
  hora_fim: "20:00",
  status: "em_processamento",
  checkout_token: "tok",
  gateway_provedor: "manual",
  expira_em: futuro(5),
  valor_total: 120,
  valor_sinal: 60,
  pix_valor: 60,
  criado_em: new Date().toISOString(),
  ...extra,
});

const atualizacoes = () => mocks.consultas.filter((c) => c.tabela === "reservas" && c.operacao === "update");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consultas.length = 0;
  mocks.reserva = reservaManual();
  mocks.ocupantes = [];
  mocks.linhasAtualizadas = [{ id: "r1" }];
  mocks.confirmar.mockResolvedValue({ sucesso: true, reservaId: "r1" });
});

describe("calcularValidadeAposInformar", () => {
  it("segura o horário até o fim da partida", () => {
    const agora = new Date("2026-10-22T12:00:00Z");
    const validade = calcularValidadeAposInformar({ data: "2026-10-22", hora_inicio: "19:00", hora_fim: "20:00" }, agora);
    expect(validade).toBe("2026-10-22T23:00:00.000Z"); // 20:00 em Belém (UTC-3)
  });

  it("garante folga mínima de 30 minutos para partidas iminentes ou passadas", () => {
    const agora = new Date("2026-10-22T23:30:00Z");
    const validade = calcularValidadeAposInformar({ data: "2026-10-22", hora_inicio: "19:00", hora_fim: "20:00" }, agora);
    expect(validade).toBe("2026-10-23T00:00:00.000Z");
  });

  it("trata partidas que terminam à meia-noite", () => {
    const agora = new Date("2026-10-22T12:00:00Z");
    const validade = calcularValidadeAposInformar({ data: "2026-10-22", hora_inicio: "23:00", hora_fim: "00:00" }, agora);
    expect(validade).toBe("2026-10-23T03:00:00.000Z");
  });
});

describe("informarPagamentoManual", () => {
  it("registra o aviso e estende o lock", async () => {
    const { expiraEm } = await informarPagamentoManual("r1", "tok");

    const update = atualizacoes()[0];
    expect(update.payload).toMatchObject({ expira_em: expiraEm });
    expect((update.payload as Record<string, unknown>).pagamento_informado_em).toEqual(expect.any(String));
    expect(update.filtros).toContainEqual(["eq", "status", "em_processamento"]);
  });

  it("recusa token errado como reserva inexistente", async () => {
    await expect(informarPagamentoManual("r1", "outro")).rejects.toMatchObject({ status: 404 });
  });

  it("recusa reservas que não são de Pix manual ou já decididas", async () => {
    mocks.reserva = reservaManual({ gateway_provedor: "asaas" });
    await expect(informarPagamentoManual("r1", "tok")).rejects.toMatchObject({ status: 409 });
    mocks.reserva = reservaManual({ status: "pendente" });
    await expect(informarPagamentoManual("r1", "tok")).rejects.toMatchObject({ status: 409 });
  });

  it("com lock vencido, só segura de novo se o horário continua livre", async () => {
    mocks.reserva = reservaManual({ expira_em: passado(5) });
    await expect(informarPagamentoManual("r1", "tok")).resolves.toHaveProperty("expiraEm");

    mocks.ocupantes = [
      { ...reservaManual({ id: "r2", status: "confirmada", gateway_provedor: null }) },
    ];
    await expect(informarPagamentoManual("r1", "tok")).rejects.toMatchObject({ status: 409 });
  });
});

describe("confirmarPagamentoManual", () => {
  it("confirma pelo mesmo caminho do webhook, no escopo da arena e com autoria", async () => {
    await confirmarPagamentoManual(OPERADOR, "r1");

    expect(mocks.confirmar).toHaveBeenCalledWith("r1", 60, expect.any(String), { arenaId: "a1", confirmadoPor: "op1" });
    const busca = mocks.consultas.find((c) => c.tabela === "reservas" && c.operacao === "select");
    expect(busca?.filtros).toContainEqual(["eq", "arena_id", "a1"]);
    const auditoria = mocks.consultas.find((c) => c.tabela === "auditoria_admin");
    expect(auditoria?.payload).toMatchObject({ acao: "pagamento.confirmacao_manual", alvo_id: "r1" });
  });

  it("é idempotente para reservas já pagas", async () => {
    mocks.reserva = reservaManual({ status: "pendente" });
    await confirmarPagamentoManual(OPERADOR, "r1");
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });

  it("propaga o conflito quando o horário foi ocupado", async () => {
    mocks.confirmar.mockResolvedValue({ sucesso: false, erro: "Horário ocupado após o fim do prazo de pagamento." });
    await expect(confirmarPagamentoManual(OPERADOR, "r1")).rejects.toMatchObject({ status: 409 });
  });

  it("404 para reserva de outra arena", async () => {
    mocks.reserva = null;
    await expect(confirmarPagamentoManual(OPERADOR, "r1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("recusarPagamentoManual", () => {
  it("cancela a reserva da arena e registra o motivo", async () => {
    await recusarPagamentoManual(OPERADOR, "r1", "Pix não caiu");

    const update = atualizacoes()[0];
    expect(update.payload).toEqual({ status: "cancelada" });
    expect(update.filtros).toContainEqual(["eq", "arena_id", "a1"]);
    const auditoria = mocks.consultas.find((c) => c.tabela === "auditoria_admin");
    expect(auditoria?.payload).toMatchObject({ acao: "pagamento.recusa_manual", detalhes: { motivo: "Pix não caiu" } });
  });

  it("não recusa reserva já confirmada", async () => {
    mocks.reserva = reservaManual({ status: "confirmada" });
    await expect(recusarPagamentoManual(OPERADOR, "r1", "x y z")).rejects.toMatchObject({ status: 409 });
  });
});
