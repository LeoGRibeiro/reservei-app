/**
 * @file useReservasService.test.ts
 * @description O painel carrega só uma janela de datas (nunca o histórico inteiro) e as mutações só
 * mudam a tela depois que o banco confirma.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reserva } from "@/store/useReservasStore";

const banco = vi.hoisted(() => ({
  periodos: [] as Array<[string, string]>,
  dados: [] as unknown[],
  atualizarOk: true,
  inserir: { ok: true } as { ok: true } | { ok: false; erro: string },
}));

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true, supabase: {} }));
vi.mock("@/lib/supabase/reservasService", () => ({
  fetchReservasPeriodoSupabase: async (inicio: string, fim: string) => {
    banco.periodos.push([inicio, fim]);
    return banco.dados;
  },
  fetchReservasPorMesSupabase: async () => [],
  inserirReservaSupabase: async () => banco.inserir,
  atualizarReservaSupabase: async () => banco.atualizarOk,
  removerReservaSupabase: async () => true,
  subscreverReservasSupabase: () => () => {},
}));
vi.mock("@/lib/constants", async (original) => ({
  ...(await original<typeof import("@/lib/constants")>()),
  getHoje: () => "2026-11-02",
}));

import { janelaInicial, useReservasService } from "@/hooks/useReservasService";
import { useReservasStore } from "@/store/useReservasStore";

const reserva = (extra: Partial<Reserva> = {}): Reserva => ({
  id: "r1",
  quadraId: "q1",
  nomeCliente: "Ana",
  whatsappCliente: "91999990000",
  cpfCliente: "",
  data: "2026-11-02",
  horarios: ["19:00"],
  horaInicio: "19:00",
  horaFim: "20:00",
  valorTotal: 100,
  valorSinal: 50,
  valorPendente: 50,
  status: "pendente",
  statusWhatsApp: "nao_enviado",
  criadaEm: "2026-11-01T10:00:00Z",
  ...extra,
});

beforeEach(() => {
  banco.periodos = [];
  banco.dados = [];
  banco.atualizarOk = true;
  banco.inserir = { ok: true };
  useReservasStore.setState({ reservas: [], isLoadedFromDb: false });
});

describe("useReservasService", () => {
  it("carrega só a janela em volta de hoje (35 dias antes, 90 depois)", async () => {
    expect(janelaInicial("2026-11-02")).toEqual({ inicio: "2026-09-28", fim: "2027-01-31" });
    renderHook(() => useReservasService());
    await waitFor(() => expect(banco.periodos).toEqual([["2026-09-28", "2027-01-31"]]));
  });

  it("quitar só muda a tela se o banco confirmar", async () => {
    useReservasStore.setState({ reservas: [reserva()], isLoadedFromDb: true });
    banco.atualizarOk = false;
    const { result } = renderHook(() => useReservasService());

    let resultado: Awaited<ReturnType<typeof result.current.confirmarPagamentoRestante>> | undefined;
    await act(async () => {
      resultado = await result.current.confirmarPagamentoRestante("r1");
    });
    expect(resultado?.ok).toBe(false);
    expect(useReservasStore.getState().reservas[0]).toMatchObject({ status: "pendente", valorPendente: 50 });

    banco.atualizarOk = true;
    await act(async () => {
      resultado = await result.current.confirmarPagamentoRestante("r1");
    });
    expect(resultado).toEqual({ ok: true });
    expect(useReservasStore.getState().reservas[0]).toMatchObject({ status: "confirmada", valorPendente: 0, valorSinal: 100 });
  });

  it("bloqueio recusado pelo banco (horário ocupado) não aparece na agenda", async () => {
    useReservasStore.setState({ reservas: [], isLoadedFromDb: true });
    banco.inserir = { ok: false, erro: "Esse horário já está ocupado nesta quadra. Atualize a agenda e escolha outro." };
    const { result } = renderHook(() => useReservasService());

    let resultado: Awaited<ReturnType<typeof result.current.criarBloqueio>> | undefined;
    await act(async () => {
      resultado = await result.current.criarBloqueio({ quadraId: "q1", data: "2026-11-03", horarios: ["19:00"], motivo: "Manutenção" });
    });
    expect(resultado).toMatchObject({ ok: false, motivo: expect.stringMatching(/já está ocupado/) });
    expect(useReservasStore.getState().reservas).toHaveLength(0);
  });
});
