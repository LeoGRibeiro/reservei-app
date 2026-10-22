/**
 * @file pix.test.ts
 * @description Testes da emissão segura de Pix no servidor (POST /api/pagamentos/pix):
 * validação da reserva, valores lidos do banco, idempotência e gravação via service role.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Resultado = { data?: unknown; error?: { message: string } | null };

const mocks = vi.hoisted(() => ({
  configurado: true,
  reserva: { data: null, error: null } as Resultado,
  arena: { data: null, error: null } as Resultado,
  update: { data: [{ id: "rsv_1" }], error: null } as Resultado,
  updates: [] as Record<string, unknown>[],
  gerarPix: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", () => ({
  isAdminClientConfigured: () => mocks.configurado,
  supabaseAdmin: {
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(tabela === "reservas" ? mocks.reserva : mocks.arena),
        }),
      }),
      update: (dados: Record<string, unknown>) => {
        mocks.updates.push(dados);
        return { eq: () => ({ select: () => Promise.resolve(mocks.update) }) };
      },
    }),
  },
}));

vi.mock("@/lib/pagamento/paymentGateway", () => ({
  obterPaymentGateway: () => ({ gerarPix: mocks.gerarPix }),
}));

import { POST } from "@/app/api/pagamentos/pix/route";
import { validarSolicitacaoPix } from "@/lib/pagamento/pixServidorService";

const COBRANCA = {
  txid: "tx_1",
  copiaECola: "000201...",
  qrCodeUrl: "data:image/png;base64,AAA",
  valor: 40,
  expiraEm: "2099-01-01T00:00:00.000Z",
  provedor: "mock",
  transacaoId: "tr_1",
};

const RESERVA = {
  id: "rsv_1",
  arena_id: "arena-1",
  quadra_id: "q1",
  data: "2026-10-30",
  status: "em_processamento",
  valor_total: 100,
  valor_sinal: 40,
  nome_cliente: "",
  whatsapp_cliente: "",
  cpf_cliente: "",
  pix_txid: null,
  checkout_token: "tok_1",
};

function req(corpo: unknown) {
  const comToken =
    corpo && typeof corpo === "object" && "reservaId" in corpo && !("checkoutToken" in corpo)
      ? { checkoutToken: "tok_1", ...corpo }
      : corpo;
  return new NextRequest("http://localhost:3000/api/pagamentos/pix", {
    method: "POST",
    body: typeof comToken === "string" ? comToken : JSON.stringify(comToken),
    headers: { "Content-Type": "application/json" },
  });
}

describe("validarSolicitacaoPix", () => {
  it("normaliza tipo, expiração e identificação", () => {
    const r = validarSolicitacaoPix({
      reservaId: " rsv_1 ",
      checkoutToken: " tok_1 ",
      tipoPagamento: "integral",
      expiracaoMinutos: 999,
      nomeCliente: " Ana ",
      whatsappCliente: "(91) 98123-4567",
    });

    expect(r).toEqual({
      reservaId: "rsv_1",
      checkoutToken: "tok_1",
      tipoPagamento: "integral",
      expiracaoMinutos: 60,
      nomeCliente: "Ana",
      whatsappCliente: "91981234567",
    });
  });

  it("usa sinal e 10 minutos como padrão", () => {
    const r = validarSolicitacaoPix({ reservaId: "x" });
    expect(r.tipoPagamento).toBe("sinal");
    expect(r.expiracaoMinutos).toBe(10);
  });

  it("rejeita reservaId ausente e tipoPagamento inválido", () => {
    expect(() => validarSolicitacaoPix({})).toThrow();
    expect(() => validarSolicitacaoPix({ reservaId: "x", tipoPagamento: "boleto" })).toThrow();
  });
});

describe("POST /api/pagamentos/pix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configurado = true;
    mocks.reserva = { data: { ...RESERVA }, error: null };
    mocks.arena = {
      data: { id: "arena-1", slug: "central", nome: "Arena Central", ativo: true },
      error: null,
    };
    mocks.update = { data: [{ id: "rsv_1" }], error: null };
    mocks.updates = [];
    mocks.gerarPix.mockResolvedValue({ sucesso: true, cobranca: COBRANCA });
  });

  it("gera o Pix com o valor do SINAL lido do banco e grava os metadados via service role", async () => {
    const res = await POST(req({ reservaId: "rsv_1", tipoPagamento: "sinal" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sucesso: true, cobranca: COBRANCA });
    expect(mocks.gerarPix).toHaveBeenCalledWith(
      expect.objectContaining({ reservaId: "rsv_1", valor: 40, expiracaoMinutos: 10 })
    );
    expect(mocks.updates[0]).toMatchObject({
      status: "em_processamento",
      pix_txid: "tx_1",
      pix_copia_cola: "000201...",
      pix_qr_code_url: "data:image/png;base64,AAA",
      expira_em: COBRANCA.expiraEm,
      gateway_provedor: "mock",
      gateway_transacao_id: "tr_1",
    });
  });

  it("usa o valor TOTAL do banco para pagamento integral", async () => {
    await POST(req({ reservaId: "rsv_1", tipoPagamento: "integral" }));

    expect(mocks.gerarPix).toHaveBeenCalledWith(expect.objectContaining({ valor: 100 }));
  });

  it("ignora qualquer valor enviado pelo cliente (anti-fraude)", async () => {
    await POST(req({ reservaId: "rsv_1", valor: 0.01, valorSinal: 0.01, valorTotal: 0.01 }));

    expect(mocks.gerarPix).toHaveBeenCalledWith(expect.objectContaining({ valor: 40 }));
  });

  it("preenche nome/WhatsApp informados apenas quando a reserva ainda não os tem", async () => {
    await POST(req({ reservaId: "rsv_1", nomeCliente: "Ana", whatsappCliente: "91981234567" }));
    expect(mocks.updates[0]).toMatchObject({ nome_cliente: "Ana", whatsapp_cliente: "91981234567" });

    mocks.updates = [];
    mocks.reserva = {
      data: { ...RESERVA, nome_cliente: "Titular", whatsapp_cliente: "91900000000" },
      error: null,
    };
    await POST(req({ reservaId: "rsv_1", nomeCliente: "Invasor", whatsappCliente: "91911111111" }));

    expect(mocks.updates[0]).not.toHaveProperty("nome_cliente");
    expect(mocks.updates[0]).not.toHaveProperty("whatsapp_cliente");
    expect(mocks.gerarPix).toHaveBeenLastCalledWith(
      expect.objectContaining({ nomeCliente: "Titular", whatsappCliente: "91900000000" })
    );
  });

  it("reaproveita o Pix vigente sem chamar o gateway nem gravar de novo", async () => {
    mocks.reserva = {
      data: {
        ...RESERVA,
        pix_txid: "tx_antigo",
        pix_copia_cola: "copia-antiga",
        pix_qr_code_url: "qr-antigo",
        expira_em: new Date(Date.now() + 5 * 60_000).toISOString(),
        gateway_provedor: "asaas",
        gateway_transacao_id: "tr_antigo",
      },
      error: null,
    };

    const res = await POST(req({ reservaId: "rsv_1" }));
    const corpo = await res.json();

    expect(res.status).toBe(200);
    expect(corpo.cobranca).toMatchObject({ txid: "tx_antigo", copiaECola: "copia-antiga", valor: 40 });
    expect(mocks.gerarPix).not.toHaveBeenCalled();
    expect(mocks.updates).toHaveLength(0);
  });

  it("recusa (409) emitir Pix quando o lock do checkout já expirou", async () => {
    mocks.reserva = {
      data: {
        ...RESERVA,
        pix_txid: "tx_antigo",
        pix_copia_cola: "copia-antiga",
        expira_em: new Date(Date.now() - 60_000).toISOString(),
      },
      error: null,
    };

    const res = await POST(req({ reservaId: "rsv_1" }));

    expect(res.status).toBe(409);
    expect(mocks.gerarPix).not.toHaveBeenCalled();
  });

  it("responde 404 quando a reserva não existe", async () => {
    mocks.reserva = { data: null, error: null };

    const res = await POST(req({ reservaId: "inexistente" }));

    expect(res.status).toBe(404);
    expect(mocks.gerarPix).not.toHaveBeenCalled();
  });

  it("responde 404 (sem revelar a reserva) quando o token do checkout não confere", async () => {
    const semToken = await POST(req({ reservaId: "rsv_1", checkoutToken: "" }));
    const tokenErrado = await POST(req({ reservaId: "rsv_1", checkoutToken: "outro" }));
    mocks.reserva = { data: { ...RESERVA, checkout_token: null }, error: null };
    const reservaDoBalcao = await POST(req({ reservaId: "rsv_1" }));

    expect([semToken.status, tokenErrado.status, reservaDoBalcao.status]).toEqual([404, 404, 404]);
    expect(mocks.gerarPix).not.toHaveBeenCalled();
  });

  it("responde 409 para reservas já pagas ou canceladas (não rebaixa o status)", async () => {
    for (const status of ["confirmada", "pendente", "cancelada"]) {
      mocks.reserva = { data: { ...RESERVA, status }, error: null };
      const res = await POST(req({ reservaId: "rsv_1" }));
      expect(res.status).toBe(409);
    }
    expect(mocks.gerarPix).not.toHaveBeenCalled();
    expect(mocks.updates).toHaveLength(0);
  });

  it("responde 422 quando o valor no banco é zero", async () => {
    mocks.reserva = { data: { ...RESERVA, valor_total: 0, valor_sinal: 0 }, error: null };

    const res = await POST(req({ reservaId: "rsv_1" }));

    expect(res.status).toBe(422);
  });

  it("responde 404 quando a arena da reserva não existe", async () => {
    mocks.arena = { data: null, error: null };

    const res = await POST(req({ reservaId: "rsv_1" }));

    expect(res.status).toBe(404);
  });

  it("responde 502 quando o gateway falha", async () => {
    mocks.gerarPix.mockResolvedValue({ sucesso: false, erro: "gateway fora do ar" });

    const res = await POST(req({ reservaId: "rsv_1" }));

    expect(res.status).toBe(502);
    expect((await res.json()).erro).toBe("gateway fora do ar");
    expect(mocks.updates).toHaveLength(0);
  });

  it("responde 500 sem vazar detalhes quando a gravação no banco falha", async () => {
    mocks.update = { data: null, error: { message: "detalhe interno secreto" } };

    const res = await POST(req({ reservaId: "rsv_1" }));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secreto");
  });

  it("responde 400 para corpo inválido e 503 sem service role", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req("{quebrado"))).status).toBe(400);

    mocks.configurado = false;
    expect((await POST(req({ reservaId: "rsv_1" }))).status).toBe(503);
  });
});
