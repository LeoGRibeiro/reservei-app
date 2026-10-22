/**
 * @file confirmacaoServidor.spec.ts
 * @description Confirmação de Pix (webhook) e liberação de locks no servidor: gravação via service
 * role, decisão pelo valor pago (quitada x sinal), idempotência, conflito após o fim do lock e
 * consumo dos vouchers de fidelidade.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada, ResultadoMock } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  configurado: true,
  reserva: null as Record<string, unknown> | null,
  ocupantes: [] as Record<string, unknown>[],
  resultadoUpdate: { data: [{ id: "rsv_1" }], error: null } as ResultadoMock,
  locksExpirados: [{ id: "rsv_exp" }] as { id: string }[],
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.tabela === "reservas" && c.operacao === "select") {
      return c.unica ? { data: mocks.reserva } : { data: mocks.ocupantes };
    }
    if (c.tabela === "reservas" && c.operacao === "update") {
      return c.filtros.some((f) => f[0] === "lt") ? { data: mocks.locksExpirados } : mocks.resultadoUpdate;
    }
    return { data: null, error: null };
  });
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => mocks.configurado, supabaseAdmin: cliente };
});

import {
  liberarLocksExpirados,
  processarConfirmacaoPagamento,
} from "@/lib/pagamento/confirmacaoServidorService";

const futuro = () => new Date(Date.now() + 5 * 60_000).toISOString();

const RESERVA = {
  id: "rsv_1",
  arena_id: "arena-1",
  quadra_id: "q1",
  data: "2026-10-30",
  horarios: ["20:00"],
  hora_inicio: "20:00",
  hora_fim: "21:00",
  valor_total: 120,
  valor_sinal: 60,
  valor_pendente: 60,
  status: "em_processamento",
  pix_txid: "tx_1",
  vouchers_utilizados: [] as string[],
};

const updatesReservas = () =>
  mocks.consultas.filter((c) => c.tabela === "reservas" && c.operacao === "update");

describe("processarConfirmacaoPagamento (servidor)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.configurado = true;
    mocks.reserva = { ...RESERVA, expira_em: futuro() };
    mocks.ocupantes = [];
    mocks.resultadoUpdate = { data: [{ id: "rsv_1" }], error: null };
    mocks.consultas.length = 0;
  });

  it("quita a reserva (confirmada) quando o valor pago cobre o total", async () => {
    const r = await processarConfirmacaoPagamento("tx_1", 120, "2026-10-30T10:00:00Z");

    expect(r).toEqual({ sucesso: true, reservaId: "rsv_1" });
    expect(updatesReservas()[0].payload).toMatchObject({
      status: "confirmada",
      valor_sinal: 120,
      valor_pendente: 0,
      status_whatsapp: "enviado",
      pago_em: "2026-10-30T10:00:00Z",
    });
  });

  it("registra o sinal (pendente) quando o valor pago é parcial", async () => {
    await processarConfirmacaoPagamento("tx_1", 60);

    expect(updatesReservas()[0].payload).toMatchObject({ status: "pendente", valor_sinal: 60, valor_pendente: 60 });
  });

  it("é idempotente para reservas já confirmadas ou com sinal pago", async () => {
    for (const status of ["confirmada", "pendente"]) {
      mocks.reserva = { ...RESERVA, status };
      expect(await processarConfirmacaoPagamento("tx_1", 120)).toEqual({ sucesso: true, reservaId: "rsv_1" });
    }
    expect(updatesReservas()).toHaveLength(0);
  });

  it("não confirma quando o lock expirou e o horário já foi ocupado por outra reserva", async () => {
    mocks.reserva = { ...RESERVA, status: "cancelada" };
    mocks.ocupantes = [{ ...RESERVA, id: "rsv_outra", status: "confirmada" }];

    const r = await processarConfirmacaoPagamento("tx_1", 120);

    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/ocupado/);
    expect(updatesReservas()).toHaveLength(0);
  });

  it("confirma pagamento tardio quando o horário continua livre", async () => {
    mocks.reserva = { ...RESERVA, status: "cancelada" };

    const r = await processarConfirmacaoPagamento("tx_1", 120);

    expect(r.sucesso).toBe(true);
    expect(updatesReservas()[0].payload).toMatchObject({ status: "confirmada" });
  });

  it("consome os vouchers anotados na reserva ao confirmar", async () => {
    mocks.reserva = { ...RESERVA, expira_em: futuro(), vouchers_utilizados: ["FID-AAAA-2026"] };

    await processarConfirmacaoPagamento("tx_1", 120);

    const consumo = mocks.consultas.find((c) => c.tabela === "fidelidade_vouchers" && c.operacao === "update");
    expect(consumo?.payload).toMatchObject({ status: "utilizado", reserva_utilizada_id: "rsv_1" });
    expect(consumo?.filtros).toContainEqual(["in", "codigo", ["FID-AAAA-2026"]]);
  });

  it("falha explicitamente quando o banco não atualiza nenhuma linha ou retorna erro", async () => {
    mocks.resultadoUpdate = { data: [], error: null };
    expect((await processarConfirmacaoPagamento("tx_1", 120)).erro).toMatch(/confirmar a reserva/);

    mocks.resultadoUpdate = { data: null, error: { message: "boom" } };
    expect((await processarConfirmacaoPagamento("tx_1", 120)).sucesso).toBe(false);
  });

  it("valida o txid e a configuração do servidor antes de consultar o banco", async () => {
    expect((await processarConfirmacaoPagamento("", 50)).erro).toMatch(/txid não informado/);
    expect((await processarConfirmacaoPagamento("tx,1;drop", 50)).erro).toMatch(/inválido/);

    mocks.configurado = false;
    expect((await processarConfirmacaoPagamento("tx_1", 50)).sucesso).toBe(false);
    expect(mocks.consultas).toHaveLength(0);
  });

  it("retorna erro amigável quando nenhuma reserva corresponde ao txid", async () => {
    mocks.reserva = null;

    const r = await processarConfirmacaoPagamento("tx_inexistente", 100);

    expect(r).toEqual({ sucesso: false, erro: "Reserva não encontrada para esta transação." });
  });
});

describe("liberarLocksExpirados (servidor)", () => {
  beforeEach(() => {
    mocks.configurado = true;
    mocks.consultas.length = 0;
  });

  it("cancela no banco somente checkouts em processamento com lock vencido", async () => {
    const agora = new Date("2026-10-25T15:00:00Z");

    expect(await liberarLocksExpirados(agora)).toEqual(["rsv_exp"]);

    const [update] = updatesReservas();
    expect(update.payload).toEqual({ status: "cancelada" });
    expect(update.filtros).toContainEqual(["eq", "status", "em_processamento"]);
    expect(update.filtros).toContainEqual(["lt", "expira_em", agora.toISOString()]);
  });

  it("não toca no banco sem a chave service role", async () => {
    mocks.configurado = false;

    expect(await liberarLocksExpirados()).toEqual([]);
    expect(mocks.consultas).toHaveLength(0);
  });
});
