/**
 * @file pagamentos.test.ts
 * @description Testes da API Route de Webhooks de Pagamento: healthcheck, encaminhamento da
 * liquidação para a confirmação no servidor e bloqueio do gateway simulado em produção.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  processar: vi.fn(),
}));

vi.mock("@/lib/pagamento/confirmacaoServidorService", () => ({
  processarConfirmacaoPagamento: mocks.processar,
}));

import { GET, POST } from "@/app/api/webhooks/pagamentos/route";

function req(corpo: unknown) {
  return new NextRequest("http://localhost:3000/api/webhooks/pagamentos", {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "Content-Type": "application/json" },
  });
}

describe("API Route - Webhook de Pagamentos (/api/webhooks/pagamentos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processar.mockResolvedValue({ sucesso: true, reservaId: "rsv_1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("GET deve responder com status online e identificar o provedor ativo", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("online");
    expect(data.servico).toBe("Reservei Payment Webhook Handler");
    expect(data.provedorAtivo).toBe("mock");
  });

  it("POST encaminha a liquidação Pix para a confirmação no servidor", async () => {
    const response = await POST(req({ txid: "tx_1", valor: 48 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ status: "success", processado: true, reservaId: "rsv_1" });
    expect(mocks.processar).toHaveBeenCalledWith("tx_1", 48, expect.any(String));
  });

  it("POST recusa confirmações do gateway simulado em produção (sem flag de demonstração)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAGAMENTO_SIMULADO_HABILITADO", "");

    const response = await POST(req({ txid: "tx_1", valor: 48 }));

    expect(response.status).toBe(403);
    expect(mocks.processar).not.toHaveBeenCalled();
  });

  it("POST aceita o gateway simulado em produção quando a demonstração está habilitada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAGAMENTO_SIMULADO_HABILITADO", "true");

    const response = await POST(req({ txid: "tx_1", valor: 48 }));

    expect(response.status).toBe(200);
    expect(mocks.processar).toHaveBeenCalled();
  });

  it("POST responde 500 sem quebrar quando o corpo não é JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/webhooks/pagamentos", { method: "POST", body: "{quebrado" })
    );

    expect(response.status).toBe(500);
  });
});
