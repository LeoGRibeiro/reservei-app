/**
 * @file reservasAtletaServidor.spec.ts
 * @description Ações do atleta sobre as próprias reservas no servidor: titularidade, estado, horário
 * e módulo de vagas.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  reserva: null as Record<string, unknown> | null,
  modulos: ["agendamento_core", "vagas"] as string[],
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.operacao !== "select") return { data: null, error: null };
    if (c.tabela === "arenas") return { data: { modulos_ativos: mocks.modulos } };
    return { data: mocks.reserva };
  });
  mocks.consultas = consultas;
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});

import {
  atualizarVagasDoAtleta,
  cancelarReservaDoAtleta,
} from "@/lib/reservas/reservasAtletaServidorService";

const AGORA = new Date("2026-10-21T14:00:00Z"); // 11:00 em Belém
const RESERVA = { id: "r1", arena_id: "a1", user_id: "u1", status: "pendente", data: "2026-10-22", hora_inicio: "19:00" };
const updates = () => mocks.consultas.filter((c) => c.operacao === "update");

describe("cancelarReservaDoAtleta", () => {
  beforeEach(() => {
    mocks.consultas.length = 0;
    mocks.reserva = { ...RESERVA };
  });

  it("cancela a própria reserva antes do início e fecha as vagas", async () => {
    await cancelarReservaDoAtleta("r1", "u1", AGORA);
    expect(updates()[0].payload).toEqual({ status: "cancelada", permite_vagas: false, vagas_abertas: 0 });
  });

  it("não revela nem altera reserva de outra pessoa (404)", async () => {
    await expect(cancelarReservaDoAtleta("r1", "intruso", AGORA)).rejects.toMatchObject({ status: 404 });
    expect(updates()).toHaveLength(0);
  });

  it("recusa reserva já cancelada ou partida já iniciada (409)", async () => {
    mocks.reserva = { ...RESERVA, status: "cancelada" };
    await expect(cancelarReservaDoAtleta("r1", "u1", AGORA)).rejects.toMatchObject({ status: 409 });

    mocks.reserva = { ...RESERVA, data: "2026-10-21", hora_inicio: "10:00" };
    await expect(cancelarReservaDoAtleta("r1", "u1", AGORA)).rejects.toMatchObject({ status: 409 });
  });
});

describe("atualizarVagasDoAtleta", () => {
  beforeEach(() => {
    mocks.consultas.length = 0;
    mocks.reserva = { ...RESERVA };
    mocks.modulos = ["agendamento_core", "vagas"];
  });

  it("abre e fecha vagas da própria reserva paga", async () => {
    expect(await atualizarVagasDoAtleta("r1", "u1", 3, AGORA)).toEqual({ permiteVagas: true, vagasAbertas: 3 });
    expect(await atualizarVagasDoAtleta("r1", "u1", 0, AGORA)).toEqual({ permiteVagas: false, vagasAbertas: 0 });
    expect(updates().map((u) => u.payload)).toEqual([
      { permite_vagas: true, vagas_abertas: 3 },
      { permite_vagas: false, vagas_abertas: 0 },
    ]);
  });

  it("valida quantidade, titularidade, pagamento e módulo contratado", async () => {
    await expect(atualizarVagasDoAtleta("r1", "u1", 31, AGORA)).rejects.toMatchObject({ status: 400 });
    await expect(atualizarVagasDoAtleta("r1", "u1", 1.5, AGORA)).rejects.toMatchObject({ status: 400 });
    await expect(atualizarVagasDoAtleta("r1", "outro", 2, AGORA)).rejects.toMatchObject({ status: 404 });

    mocks.reserva = { ...RESERVA, status: "em_processamento" };
    await expect(atualizarVagasDoAtleta("r1", "u1", 2, AGORA)).rejects.toMatchObject({ status: 409 });

    mocks.reserva = { ...RESERVA };
    mocks.modulos = ["agendamento_core"];
    await expect(atualizarVagasDoAtleta("r1", "u1", 2, AGORA)).rejects.toMatchObject({ status: 409 });
    expect(updates()).toHaveLength(0);
  });
});
