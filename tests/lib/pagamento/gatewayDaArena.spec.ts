/**
 * @file gatewayDaArena.spec.ts
 * @description O Pix sempre é emitido na conta da arena: Asaas da arena, chave Pix da arena ou simulação.
 * Sem fallback silencioso para outra conta.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ credencial: null as Record<string, unknown> | null }));

vi.mock("@/lib/pagamento/credenciaisArenaRepository", () => ({
  carregarCredencialAsaas: async () => mocks.credencial,
}));

import {
  arenaAceitaPagamentoOnline,
  ErroPagamentoIndisponivel,
  obterGatewayDaArena,
} from "@/lib/pagamento/gatewayDaArena";
import { ARENA_PADRAO } from "@/lib/arena/defaultArena";
import type { Arena } from "@/lib/arena/types";

const PIX = { chave: "12345678000190", tipoChave: "cnpj" as const, nomeRecebedor: "Arena Belém", cidadeRecebedor: "Belém" };
const arena = (extra: Partial<Arena>): Arena => ({ ...ARENA_PADRAO, id: "a1", ...extra });

beforeEach(() => {
  mocks.credencial = null;
  vi.stubEnv("PAGAMENTO_SIMULADO_HABILITADO", "");
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

describe("obterGatewayDaArena", () => {
  it("usa a conta Asaas da própria arena", async () => {
    mocks.credencial = { apiKey: "$aact_arena", sandbox: true, webhookToken: "wt" };
    const gateway = await obterGatewayDaArena(arena({ modoPagamento: "asaas" }));
    expect(gateway.provedor).toBe("asaas");
  });

  it("falha (sem cobrar em outra conta) se a arena escolheu Asaas e não há credencial", async () => {
    await expect(obterGatewayDaArena(arena({ modoPagamento: "asaas" }))).rejects.toBeInstanceOf(ErroPagamentoIndisponivel);
  });

  it("gera Pix na chave da arena no modo manual", async () => {
    const gateway = await obterGatewayDaArena(arena({ modoPagamento: "manual", pixManual: PIX }));
    const r = await gateway.gerarPix({
      reservaId: "abc-123",
      arena: arena({}),
      nomeCliente: "Ana",
      whatsappCliente: "91999999999",
      valor: 60,
      descricao: "Reserva",
    });
    expect(gateway.provedor).toBe("manual");
    expect(r.cobranca?.copiaECola).toContain("br.gov.bcb.pix011412345678000190");
    expect(r.cobranca?.copiaECola).toContain("540560.00");
    expect(r.cobranca?.transacaoId).toBe("abc-123");
  });

  it("modo manual sem chave cadastrada fica indisponível", async () => {
    await expect(obterGatewayDaArena(arena({ modoPagamento: "manual" }))).rejects.toBeInstanceOf(ErroPagamentoIndisponivel);
  });

  it("modo simulado só funciona com a simulação liberada no ambiente", async () => {
    await expect(obterGatewayDaArena(arena({ modoPagamento: "simulado" }))).rejects.toBeInstanceOf(ErroPagamentoIndisponivel);
    vi.stubEnv("PAGAMENTO_SIMULADO_HABILITADO", "true");
    expect((await obterGatewayDaArena(arena({ modoPagamento: "simulado" }))).provedor).toBe("mock");
  });
});

describe("arenaAceitaPagamentoOnline", () => {
  it("reflete o pré-requisito de cada modo", () => {
    expect(arenaAceitaPagamentoOnline({ modoPagamento: "manual" })).toBe(false);
    expect(arenaAceitaPagamentoOnline({ modoPagamento: "manual", pixManual: PIX })).toBe(true);
    expect(arenaAceitaPagamentoOnline({ modoPagamento: "simulado" })).toBe(false);
    expect(arenaAceitaPagamentoOnline({ modoPagamento: "asaas" })).toBe(true);
    expect(arenaAceitaPagamentoOnline({ modoPagamento: "legado" })).toBe(true);
  });
});
