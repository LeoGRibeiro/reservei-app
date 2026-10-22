/**
 * @file solicitarPixApi.spec.ts
 * @description Garante que, com Supabase configurado, o cliente emite o Pix via API do servidor
 * (sem gerar no navegador nem escrever em `reservas` com a chave anônima).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gerarPix: vi.fn(),
  anonFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.anonFrom },
}));

vi.mock("@/lib/pagamento/paymentGateway", () => ({
  obterPaymentGateway: () => ({ gerarPix: mocks.gerarPix }),
}));

import { solicitarPixParaReserva } from "@/lib/pagamento/pagamentoService";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";
import { ARENA_PADRAO } from "@/lib/arena/defaultArena";

const reserva: Reserva = {
  id: "rsv_1",
  quadraId: "q1",
  data: "2026-10-30",
  horarios: ["20:00"],
  horaInicio: "20:00",
  horaFim: "21:00",
  nomeCliente: "Ana",
  whatsappCliente: "91981234567",
  cpfCliente: "",
  valorTotal: 100,
  valorSinal: 40,
  valorPendente: 60,
  status: "em_processamento",
  statusWhatsApp: "nao_enviado",
  criadaEm: new Date().toISOString(),
};

const COBRANCA = {
  txid: "tx_1",
  copiaECola: "000201...",
  qrCodeUrl: "qr",
  valor: 40,
  expiraEm: "2099-01-01T00:00:00.000Z",
  provedor: "mock",
  transacaoId: "tr_1",
};

describe("solicitarPixParaReserva (Supabase configurado)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    useReservasStore.setState({ reservas: [{ ...reserva, status: "pendente" }], isLoadedFromDb: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama POST /api/pagamentos/pix e não usa o gateway local nem o cliente anônimo", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sucesso: true, cobranca: COBRANCA }),
    });

    const r = await solicitarPixParaReserva({
      reserva,
      arena: ARENA_PADRAO,
      checkoutToken: "tok_1",
      tipoPagamento: "integral",
    });

    expect(r).toEqual({ sucesso: true, cobranca: COBRANCA });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pagamentos/pix");
    expect(JSON.parse(init.body)).toEqual({
      reservaId: "rsv_1",
      checkoutToken: "tok_1",
      tipoPagamento: "integral",
      expiracaoMinutos: 10,
    });
    expect(mocks.gerarPix).not.toHaveBeenCalled();
    expect(mocks.anonFrom).not.toHaveBeenCalled();
  });

  it("não envia valores monetários ao servidor", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sucesso: true, cobranca: COBRANCA }) });

    await solicitarPixParaReserva({ reserva, arena: ARENA_PADRAO });

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo).not.toHaveProperty("valor");
    expect(corpo).not.toHaveProperty("valorTotal");
    expect(corpo).not.toHaveProperty("valorSinal");
  });

  it("atualiza a store local para em_processamento após o sucesso", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sucesso: true, cobranca: COBRANCA }) });

    await solicitarPixParaReserva({ reserva, arena: ARENA_PADRAO });

    expect(useReservasStore.getState().getReservaById("rsv_1")?.status).toBe("em_processamento");
  });

  it("repassa a mensagem de erro do servidor sem alterar a store", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ sucesso: false, erro: "Esta reserva não está disponível para pagamento." }),
    });

    const r = await solicitarPixParaReserva({ reserva, arena: ARENA_PADRAO });

    expect(r).toEqual({ sucesso: false, erro: "Esta reserva não está disponível para pagamento." });
    expect(useReservasStore.getState().getReservaById("rsv_1")?.status).toBe("pendente");
  });

  it("retorna erro amigável em falha de conexão", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const r = await solicitarPixParaReserva({ reserva, arena: ARENA_PADRAO });

    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/conexão/);
  });

  it("continua validando valor zero localmente, sem chamar a API", async () => {
    const r = await solicitarPixParaReserva({
      reserva: { ...reserva, valorTotal: 0, valorSinal: 0 },
      arena: ARENA_PADRAO,
    });

    expect(r.sucesso).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
