// @vitest-environment node
/**
 * @file balcaoServidor.test.ts
 * @description Ações do balcão: quitar com forma de pagamento (e desconto com motivo), cancelar
 * registrando o destino do sinal, remarcar recalculando o preço, comparecimento e devolução, sempre
 * com evento no histórico e só na arena do operador.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const estado = vi.hoisted(() => ({
  reserva: null as Record<string, unknown> | null,
  erroUpdate: null as { message: string; code?: string } | null,
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.tabela === "reservas" && c.operacao === "update") {
      if (estado.erroUpdate) return { data: null, error: estado.erroUpdate };
      if (estado.reserva) Object.assign(estado.reserva, c.payload as Record<string, unknown>);
      return { data: null };
    }
    if (c.tabela === "reservas" && c.operacao === "select") {
      const arena = c.filtros.find((f) => f[0] === "eq" && f[1] === "arena_id")?.[2];
      if (arena && estado.reserva && arena !== estado.reserva.arena_id) return { data: null };
      return { data: estado.reserva };
    }
    if (c.tabela === "arenas") {
      return { data: { id: "a1", slug: "a1", nome: "Arena", horario_abertura: "07:00", horario_fechamento: "23:00", intervalo_minutos: 60, percentual_sinal_minimo: 50, ativo: true } };
    }
    if (c.tabela === "quadras") return { data: { id: "q2", arena_id: "a1", numero: 2, nome: "Areia 2", valor_hora_padrao: 80, ativa: true, esportes: [] } };
    if (c.tabela === "quadras_precos") return { data: [] };
    return { data: null };
  });
  estado.consultas = consultas;
  return { supabaseAdmin: cliente, isAdminClientConfigured: () => true };
});

import { executarAcaoBalcao, horaFim, validarAcaoBalcao } from "@/lib/reservas/balcaoServidorService";

const MEMBRO = { userId: "u-op", email: "ana@arena.com", arenaId: "a1", role: "operador" as const };
const AGORA = new Date("2026-11-02T15:00:00Z");

const reservaBase = (extra: Record<string, unknown> = {}) => ({
  id: "r1",
  arena_id: "a1",
  quadra_id: "q1",
  data: "2026-11-02",
  horarios: ["19:00"],
  hora_inicio: "19:00",
  hora_fim: "20:00",
  nome_cliente: "Fernanda",
  whatsapp_cliente: "91900000663",
  valor_total: 100,
  valor_sinal: 50,
  valor_pendente: 50,
  status: "pendente",
  tipo_reserva: "avulsa",
  ...extra,
});

const eventos = () => estado.consultas.filter((c) => c.tabela === "reservas_eventos" && c.operacao === "insert").map((c) => c.payload as Record<string, unknown>);
const updates = () => estado.consultas.filter((c) => c.tabela === "reservas" && c.operacao === "update").map((c) => c.payload as Record<string, unknown>);

beforeEach(() => {
  estado.reserva = reservaBase();
  estado.erroUpdate = null;
  estado.consultas.length = 0;
});

describe("validarAcaoBalcao", () => {
  it.each([
    [{ acao: "quitar", forma: "cheque", valorRecebido: 50 }, /dinheiro, Pix ou cartão/],
    [{ acao: "cancelar", motivo: "x", destinoSinal: "devolvido" }, /motivo/],
    [{ acao: "cancelar", motivo: "Chuva forte", destinoSinal: "talvez" }, /sinal/],
    [{ acao: "remarcar", data: "2026-11-05", horarios: ["19:00", "21:00"], quadraId: "q1" }, /seguidos/],
    [{ acao: "voar" }, /Ação inválida/],
  ])("recusa %j", (corpo, mensagem) => {
    expect(() => validarAcaoBalcao(corpo)).toThrow(mensagem);
  });

  it("ordena e tira horários repetidos na remarcação", () => {
    expect(validarAcaoBalcao({ acao: "remarcar", data: "2026-11-05", horarios: ["20:00", "19:00", "19:00"], quadraId: "q1" })).toEqual({
      acao: "remarcar",
      data: "2026-11-05",
      horarios: ["19:00", "20:00"],
      quadraId: "q1",
    });
  });

  it("hora de término passa da meia-noite sem virar 24h", () => {
    expect(horaFim(["22:00", "23:00"], 60)).toBe("00:00");
  });
});

describe("executarAcaoBalcao", () => {
  it("quita o restante registrando forma, quem recebeu e o evento", async () => {
    const r = await executarAcaoBalcao(MEMBRO, "r1", { acao: "quitar", forma: "dinheiro", valorRecebido: 50 }, AGORA);

    expect(updates()[0]).toMatchObject({ status: "confirmada", valor_total: 100, valor_pendente: 0, forma_pagamento_restante: "dinheiro", quitada_por: "u-op" });
    expect(eventos()[0]).toMatchObject({ arena_id: "a1", reserva_id: "r1", tipo: "quitada", autor_id: "u-op", autor_nome: "ana@arena.com", detalhes: { forma: "dinheiro", valor: 50 } });
    expect(r).toMatchObject({ status: "confirmada", formaPagamentoRestante: "dinheiro" });
  });

  it("desconto no balcão exige motivo e reduz o total", async () => {
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "quitar", forma: "pix", valorRecebido: 40 }, AGORA)).rejects.toMatchObject({ status: 400 });
    await executarAcaoBalcao(MEMBRO, "r1", { acao: "quitar", forma: "pix", valorRecebido: 40, motivoDesconto: "Cliente fiel" }, AGORA);
    expect(updates()[0]).toMatchObject({ valor_total: 90, valor_sinal: 90, valor_pendente: 0 });
    expect(eventos()[0].detalhes).toMatchObject({ desconto: 10, motivo: "Cliente fiel" });
  });

  it("não quita reserva já quitada nem de outra arena", async () => {
    estado.reserva = reservaBase({ status: "confirmada", valor_pendente: 0 });
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "quitar", forma: "pix", valorRecebido: 0 }, AGORA)).rejects.toMatchObject({ status: 409 });
    estado.reserva = reservaBase({ arena_id: "outra" });
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "quitar", forma: "pix", valorRecebido: 50 }, AGORA)).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ["devolvido", { reembolso_status: "reembolsado", reembolso_valor: 50 }],
    ["devolver_depois", { reembolso_status: "pendente", reembolso_valor: 50 }],
    ["retido", { reembolso_status: "retido" }],
  ] as const)("cancela com o sinal %s", async (destinoSinal, esperado) => {
    await executarAcaoBalcao(MEMBRO, "r1", { acao: "cancelar", motivo: "Cliente desistiu", destinoSinal }, AGORA);
    expect(updates()[0]).toMatchObject({ status: "cancelada", cancelada_por: "u-op", motivo_cancelamento: "Cliente desistiu", ...esperado });
    expect(eventos()[0]).toMatchObject({ tipo: "cancelada", detalhes: { sinal: destinoSinal, valorPago: 50 } });
  });

  it("sessões de escolinha e bloqueios não são canceladas por aqui", async () => {
    estado.reserva = reservaBase({ tipo_reserva: "escolinha" });
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "cancelar", motivo: "Chuva", destinoSinal: "retido" }, AGORA)).rejects.toMatchObject({ status: 422 });
  });

  it("remarca recalculando o preço da nova quadra e cobra a diferença", async () => {
    await executarAcaoBalcao(MEMBRO, "r1", { acao: "remarcar", data: "2026-11-05", horarios: ["19:00", "20:00"], quadraId: "q2" }, AGORA);
    // 2h × R$ 80 = 160; já pagou 50 → falta 110
    expect(updates()[0]).toMatchObject({ quadra_id: "q2", data: "2026-11-05", hora_inicio: "19:00", hora_fim: "21:00", valor_total: 160, valor_pendente: 110, status: "pendente" });
    expect(eventos()[0]).toMatchObject({ tipo: "remarcada", detalhes: { de: { data: "2026-11-02", quadraId: "q1" }, para: { data: "2026-11-05", quadraId: "q2" }, diferenca: 60 } });
  });

  it("remarcar para horário ocupado vira 409 com mensagem clara", async () => {
    estado.erroUpdate = { code: "23P01", message: "Horário já ocupado nesta quadra (reserva r9)." };
    await expect(
      executarAcaoBalcao(MEMBRO, "r1", { acao: "remarcar", data: "2026-11-05", horarios: ["19:00"], quadraId: "q2" }, AGORA)
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/já está ocupado/) });
  });

  it("não remarca para o passado nem fora do funcionamento", async () => {
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "remarcar", data: "2026-11-01", horarios: ["19:00"], quadraId: "q2" }, AGORA)).rejects.toMatchObject({ status: 422 });
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "remarcar", data: "2026-11-05", horarios: ["05:00"], quadraId: "q2" }, AGORA)).rejects.toMatchObject({ status: 422 });
  });

  it("'não compareceu' só a partir do dia do jogo", async () => {
    estado.reserva = reservaBase({ data: "2026-11-09" });
    await expect(executarAcaoBalcao(MEMBRO, "r1", { acao: "comparecimento", compareceu: false }, AGORA)).rejects.toMatchObject({ status: 422 });
    estado.reserva = reservaBase();
    await executarAcaoBalcao(MEMBRO, "r1", { acao: "comparecimento", compareceu: false }, AGORA);
    expect(updates()[0]).toEqual({ nao_compareceu: true });
    expect(eventos()[0]).toMatchObject({ tipo: "nao_compareceu" });
  });

  it("registra a devolução pendente como feita", async () => {
    estado.reserva = reservaBase({ status: "cancelada", reembolso_status: "pendente", reembolso_valor: 50 });
    await executarAcaoBalcao(MEMBRO, "r1", { acao: "registrar_devolucao" }, AGORA);
    expect(updates()[0]).toMatchObject({ reembolso_status: "reembolsado" });
    expect(eventos()[0]).toMatchObject({ tipo: "devolucao_registrada", detalhes: { valor: 50 } });
  });
});
