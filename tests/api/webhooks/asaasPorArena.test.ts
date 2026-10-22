/**
 * @file asaasPorArena.test.ts
 * @description Webhook do Asaas por arena: só aceita o token desta arena e só confirma reservas desta arena.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  credencial: { apiKey: "$aact_a1", sandbox: true, webhookToken: "token-da-arena-a1" } as Record<string, unknown> | null,
  confirmar: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", () => ({ isAdminClientConfigured: () => true, supabaseAdmin: {} }));
vi.mock("@/lib/pagamento/credenciaisArenaRepository", () => ({
  carregarCredencialAsaas: async () => mocks.credencial,
}));
vi.mock("@/lib/pagamento/confirmacaoServidorService", () => ({ processarConfirmacaoPagamento: mocks.confirmar }));

import { POST } from "@/app/api/webhooks/pagamentos/asaas/[arenaId]/route";

const evento = { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", value: 60, paymentDate: "2026-10-22" } };

function chamar(token: string, corpo: unknown = evento, arenaId = "a1") {
  const req = new NextRequest(`http://localhost/api/webhooks/pagamentos/asaas/${arenaId}`, {
    method: "POST",
    headers: { "asaas-access-token": token, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return POST(req, { params: Promise.resolve({ arenaId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.credencial = { apiKey: "$aact_a1", sandbox: true, webhookToken: "token-da-arena-a1" };
  mocks.confirmar.mockResolvedValue({ sucesso: true, reservaId: "r1" });
});

describe("POST /api/webhooks/pagamentos/asaas/[arenaId]", () => {
  it("confirma o pagamento restrito à arena do webhook", async () => {
    const res = await chamar("token-da-arena-a1");
    expect(res.status).toBe(200);
    expect(mocks.confirmar).toHaveBeenCalledWith("pay_1", 60, "2026-10-22", { arenaId: "a1" });
  });

  it("ignora (sem confirmar) token de outra arena ou ausente", async () => {
    expect(await (await chamar("token-de-outra-arena")).json()).toMatchObject({ status: "ignored" });
    expect(await (await chamar("")).json()).toMatchObject({ status: "ignored" });
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });

  it("404 para arena sem Asaas conectado", async () => {
    mocks.credencial = null;
    expect((await chamar("qualquer")).status).toBe(404);
  });

  it("não confirma eventos que não são de pagamento recebido", async () => {
    const res = await chamar("token-da-arena-a1", { ...evento, event: "PAYMENT_REFUNDED" });
    expect(await res.json()).toMatchObject({ status: "processed" });
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });
});
