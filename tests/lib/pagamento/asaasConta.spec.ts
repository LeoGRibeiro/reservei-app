/**
 * @file asaasConta.spec.ts
 * @description Conexão da conta Asaas da arena: validação da chave, registro automático do webhook,
 * gravação cifrada e bloqueio da desconexão com cobranças em aberto.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  consultas: [] as ConsultaRegistrada[],
  abertas: 0,
  salvar: vi.fn(),
  remover: vi.fn(),
  carregar: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) =>
    c.tabela === "reservas" ? ({ count: mocks.abertas, data: null } as never) : { data: null }
  );
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});
vi.mock("@/lib/pagamento/credenciaisArenaRepository", () => ({
  salvarCredencialAsaas: mocks.salvar,
  removerCredencialAsaas: mocks.remover,
  carregarCredencialAsaas: mocks.carregar,
}));

import {
  chaveAsaasEhSandbox,
  conectarAsaas,
  desconectarAsaas,
  validarChaveAsaas,
} from "@/lib/pagamento/asaasContaService";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";

const DONO: MembroArena = { userId: "dono", email: "dono@arena.com", arenaId: "a1", role: "proprietario" };
const CHAVE = "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjE2";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consultas.length = 0;
  mocks.abertas = 0;
  mocks.carregar.mockResolvedValue(null);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const resposta = (status: number, corpo: unknown) => ({ ok: status < 300, status, json: async () => corpo });

describe("validarChaveAsaas / chaveAsaasEhSandbox", () => {
  it("aceita chaves do Asaas e identifica o sandbox", () => {
    expect(validarChaveAsaas(` ${CHAVE} `)).toBe(CHAVE);
    expect(chaveAsaasEhSandbox(CHAVE)).toBe(true);
    expect(chaveAsaasEhSandbox("$aact_prod_abc")).toBe(false);
  });

  it("recusa textos que não são chave do Asaas", () => {
    expect(() => validarChaveAsaas("minha-senha")).toThrow(/Chave inválida/);
    expect(() => validarChaveAsaas(undefined)).toThrow(/Chave inválida/);
  });
});

describe("conectarAsaas", () => {
  it("valida a conta, registra o webhook da arena e grava a credencial", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { name: "Arena Belém LTDA" }))
      .mockResolvedValueOnce(resposta(200, { id: "wh_1" }));

    const r = await conectarAsaas(DONO, CHAVE, "https://reserveei.vercel.app");

    expect(r).toEqual({ contaNome: "Arena Belém LTDA", sandbox: true });
    const [urlConta] = fetchMock.mock.calls[0];
    expect(urlConta).toBe("https://sandbox.asaas.com/api/v3/myAccount");
    const [urlWebhook, init] = fetchMock.mock.calls[1];
    expect(urlWebhook).toBe("https://sandbox.asaas.com/api/v3/webhooks");
    const corpo = JSON.parse(init.body);
    expect(corpo.url).toBe("https://reserveei.vercel.app/api/webhooks/pagamentos/asaas/a1");
    expect(corpo.events).toContain("PAYMENT_RECEIVED");
    expect(corpo.authToken).toHaveLength(40);

    expect(mocks.salvar).toHaveBeenCalledWith(
      expect.objectContaining({ arenaId: "a1", apiKey: CHAVE, webhookToken: corpo.authToken, webhookId: "wh_1" })
    );
    const modo = mocks.consultas.find((c) => c.tabela === "arenas" && c.operacao === "update");
    expect(modo?.payload).toEqual({ modo_pagamento: "asaas" });
  });

  it("não grava nada se o Asaas recusar a chave", async () => {
    fetchMock.mockResolvedValueOnce(resposta(401, { errors: [{ description: "invalid" }] }));
    await expect(conectarAsaas(DONO, CHAVE, "https://x")).rejects.toMatchObject({ status: 400 });
    expect(mocks.salvar).not.toHaveBeenCalled();
  });

  it("não grava nada se o webhook não puder ser registrado", async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(200, { name: "Arena" }))
      .mockResolvedValueOnce(resposta(400, { errors: [{ description: "URL inválida" }] }));
    await expect(conectarAsaas(DONO, CHAVE, "https://x")).rejects.toThrow(/URL inválida/);
    expect(mocks.salvar).not.toHaveBeenCalled();
  });
});

describe("desconectarAsaas", () => {
  it("é bloqueado enquanto houver cobrança Asaas em aberto", async () => {
    mocks.abertas = 1;
    await expect(desconectarAsaas(DONO)).rejects.toMatchObject({ status: 409 });
    expect(mocks.remover).not.toHaveBeenCalled();
  });

  it("remove o webhook, apaga a credencial e volta ao Pix manual", async () => {
    mocks.carregar.mockResolvedValue({ apiKey: CHAVE, sandbox: true, webhookId: "wh_1" });
    fetchMock.mockResolvedValueOnce(resposta(200, { deleted: true }));

    await desconectarAsaas(DONO);

    expect(fetchMock.mock.calls[0][0]).toBe("https://sandbox.asaas.com/api/v3/webhooks/wh_1");
    expect(mocks.remover).toHaveBeenCalledWith("a1");
    const modo = mocks.consultas.find((c) => c.tabela === "arenas" && c.operacao === "update");
    expect(modo?.payload).toEqual({ modo_pagamento: "manual" });
  });
});
