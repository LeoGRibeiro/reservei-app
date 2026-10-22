/**
 * @file checkoutServidor.spec.ts
 * @description Checkout público no servidor: validação da entrada, preço recalculado pela tabela da
 * arena, bloqueio de horários ocupados (inclusive em corrida), telefone bloqueado, vouchers e token.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { VERSAO_TERMOS } from "@/lib/legal/termos";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  arena: null as Record<string, unknown> | null,
  quadra: null as Record<string, unknown> | null,
  precos: [] as Record<string, unknown>[],
  bloqueados: [] as unknown[],
  ocupantes: [] as Record<string, unknown>[],
  ocupantesAposInsert: null as Record<string, unknown>[] | null,
  vouchers: [] as Record<string, unknown>[],
  reservaDoToken: null as Record<string, unknown> | null,
  consultas: [] as ConsultaRegistrada[],
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  let inseriu = false;
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.operacao === "insert" && c.tabela === "reservas") inseriu = true;
    if (c.operacao !== "select") return { data: [{ id: "x" }] };
    switch (c.tabela) {
      case "arenas":
        return { data: mocks.arena };
      case "quadras":
        return { data: mocks.quadra };
      case "quadras_precos":
        return { data: mocks.precos };
      case "usuarios":
        return { data: mocks.bloqueados };
      case "fidelidade_vouchers":
        return { data: mocks.vouchers };
      case "reservas":
        if (c.unica) return { data: mocks.reservaDoToken };
        return { data: inseriu && mocks.ocupantesAposInsert ? mocks.ocupantesAposInsert : mocks.ocupantes };
      default:
        return { data: null };
    }
  });
  mocks.consultas = consultas;
  return {
    isAdminClientConfigured: () => true,
    supabaseAdmin: cliente,
    __resetar: () => {
      inseriu = false;
    },
  };
});

import * as adminClient from "@/lib/supabase/adminClient";
import {
  cancelarLockDoCheckout,
  criarReservaCheckout,
  validarSolicitacaoCheckout,
  vincularReservaAoAtleta,
  type SolicitacaoCheckout,
} from "@/lib/reservas/checkoutServidorService";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";

const AGORA = new Date("2026-10-21T14:00:00Z"); // 11:00 em Belém

const ARENA = {
  id: "arena-1",
  slug: "central",
  nome: "Arena Central",
  ativo: true,
  horario_abertura: "07:00",
  horario_fechamento: "23:00",
  intervalo_minutos: 60,
  percentual_sinal_minimo: 30,
  antecedencia_minima_minutos: 30,
  modulos_ativos: ["agendamento_core", "fidelidade"],
};

const QUADRA = { id: "q-a1", arena_id: "arena-1", numero: 1, nome: "Quadra 1", valor_hora_padrao: 80, ativa: true };

const PEDIDO: SolicitacaoCheckout = {
  arenaId: "arena-1",
  quadraId: "q-a1",
  data: "2026-10-22",
  horarios: ["19:00", "20:00"],
  nomeCliente: "Ana",
  whatsappCliente: "91981234567",
  tipoPagamento: "sinal",
  voucherIds: [],
};

/** Corpo bruto como o navegador envia (inclui o aceite dos termos). */
const ENTRADA = { ...PEDIDO, aceiteTermos: true };

const inserts = () => mocks.consultas.filter((c) => c.tabela === "reservas" && c.operacao === "insert");

async function erroDe(promessa: Promise<unknown>): Promise<ErroHttp> {
  try {
    await promessa;
  } catch (e) {
    return e as ErroHttp;
  }
  throw new Error("era esperado um erro");
}

describe("validarSolicitacaoCheckout", () => {
  it("normaliza horários, telefone e campos opcionais", () => {
    const r = validarSolicitacaoCheckout({
      arenaId: "arena-1",
      quadraId: "q-a1",
      data: "2026-10-22",
      horarios: ["20:00", "19:00"],
      nomeCliente: "  Ana  ",
      whatsappCliente: "(91) 98123-4567",
      esporte: "Vôlei",
      tipoPagamento: "integral",
      voucherIds: ["v1", 3],
      valorTotal: 0.01,
      aceiteTermos: true,
    });

    expect(r).toMatchObject({
      horarios: ["19:00", "20:00"],
      nomeCliente: "Ana",
      whatsappCliente: "91981234567",
      esporte: "Vôlei",
      tipoPagamento: "integral",
      voucherIds: ["v1"],
    });
    expect(r).not.toHaveProperty("valorTotal");
  });

  it.each([
    [{ ...ENTRADA, quadraId: "" }, /quadra/],
    [{ ...ENTRADA, data: "22/10/2026" }, /Data inválida/],
    [{ ...ENTRADA, horarios: [] }, /horários válidos/],
    [{ ...ENTRADA, horarios: ["19:00", "x"] }, /horários válidos/],
    [{ ...ENTRADA, horarios: ["18:00", "20:00"] }, /consecutivos/],
    [{ ...ENTRADA, horarios: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"] }, /no máximo/],
    [{ ...ENTRADA, nomeCliente: "A" }, /nome/],
    [{ ...ENTRADA, whatsappCliente: "1234" }, /WhatsApp/],
    [{ ...PEDIDO }, /Termos de Uso/],
    [{ ...ENTRADA, aceiteTermos: "sim" }, /Termos de Uso/],
  ])("rejeita entrada inválida (%#)", (entrada, mensagem) => {
    expect(() => validarSolicitacaoCheckout(entrada)).toThrow(mensagem);
  });
});

describe("criarReservaCheckout", () => {
  beforeEach(() => {
    (adminClient as unknown as { __resetar: () => void }).__resetar();
    mocks.consultas.length = 0;
    mocks.arena = { ...ARENA };
    mocks.quadra = { ...QUADRA };
    mocks.precos = [
      { id: "p1", arena_id: "arena-1", quadra_id: "q-a1", dias_semana: [0, 1, 2, 3, 4, 5, 6], hora_inicio: "18:00", hora_fim: "23:00", valor_hora: 120, ativo: true },
    ];
    mocks.bloqueados = [];
    mocks.ocupantes = [];
    mocks.ocupantesAposInsert = null;
    mocks.vouchers = [];
    mocks.reservaDoToken = null;
  });

  it("recalcula o preço pela tabela da quadra e grava o lock com token secreto", async () => {
    const { reserva, checkoutToken } = await criarReservaCheckout(PEDIDO, null, AGORA);

    expect(reserva).toMatchObject({
      status: "em_processamento",
      valorOriginal: 240,
      valorTotal: 240,
      valorSinal: 72,
      valorPendente: 168,
      reservaGratuitaFidelidade: false,
    });
    expect(reserva.expiraEm).toBe("2026-10-21T14:10:00.000Z");
    expect(checkoutToken).toMatch(/^[0-9a-f-]{36}$/);

    const linha = inserts()[0].payload as Record<string, unknown>;
    expect(linha).toMatchObject({
      arena_id: "arena-1",
      user_id: null,
      hora_inicio: "19:00",
      hora_fim: "21:00",
      status: "em_processamento",
      checkout_token: checkoutToken,
      valor_total: 240,
    });
  });

  it("registra o aceite dos termos com a versão vigente (bancos com a Fase 8)", async () => {
    mocks.arena = { ...ARENA, modo_pagamento: "manual" };
    await criarReservaCheckout(PEDIDO, null, AGORA);
    expect(inserts()[0].payload).toMatchObject({
      termos_aceitos_em: AGORA.toISOString(),
      termos_versao: VERSAO_TERMOS,
    });
  });

  it("não grava colunas da Fase 8 em bancos sem a migração", async () => {
    await criarReservaCheckout(PEDIDO, null, AGORA);
    expect(inserts()[0].payload).not.toHaveProperty("termos_versao");
  });

  it("vincula a reserva ao atleta autenticado pelo token", async () => {
    await criarReservaCheckout(PEDIDO, "user-1", AGORA);
    expect((inserts()[0].payload as Record<string, unknown>).user_id).toBe("user-1");
  });

  it("recusa arena ou quadra inexistente (404)", async () => {
    mocks.quadra = null;
    expect((await erroDe(criarReservaCheckout(PEDIDO, null, AGORA))).status).toBe(404);

    mocks.arena = null;
    expect((await erroDe(criarReservaCheckout(PEDIDO, null, AGORA))).status).toBe(404);
    expect(inserts()).toHaveLength(0);
  });

  it("recusa horário fora do funcionamento, data fora da janela e antecedência insuficiente (422)", async () => {
    const casos: SolicitacaoCheckout[] = [
      { ...PEDIDO, horarios: ["06:00"] },
      { ...PEDIDO, data: "2026-10-20" },
      { ...PEDIDO, data: "2026-11-30" },
      { ...PEDIDO, data: "2026-10-21", horarios: ["11:00"] },
    ];
    for (const caso of casos) {
      expect((await erroDe(criarReservaCheckout(caso, null, AGORA))).status).toBe(422);
    }
    expect(inserts()).toHaveLength(0);
  });

  it("recusa telefone bloqueado (403)", async () => {
    mocks.bloqueados = [{ id: "u-bloq" }];
    expect((await erroDe(criarReservaCheckout(PEDIDO, null, AGORA))).status).toBe(403);
  });

  it("recusa horário ocupado por reserva paga ou lock vigente (409), mas ignora lock vencido", async () => {
    mocks.ocupantes = [{ id: "r-x", status: "pendente", horarios: ["20:00"], data: "2026-10-22", quadra_id: "q-a1" }];
    expect((await erroDe(criarReservaCheckout(PEDIDO, null, AGORA))).status).toBe(409);

    mocks.ocupantes = [
      { id: "r-y", status: "em_processamento", horarios: ["19:00"], data: "2026-10-22", quadra_id: "q-a1", expira_em: "2026-10-21T13:00:00Z" },
    ];
    await expect(criarReservaCheckout(PEDIDO, null, AGORA)).resolves.toBeDefined();
  });

  it("desfaz a própria reserva quando perde a corrida para um checkout simultâneo mais antigo", async () => {
    mocks.ocupantesAposInsert = [
      { id: "rsv_outro", status: "em_processamento", horarios: ["19:00"], criada_em: "2026-10-21T13:59:59Z", expira_em: "2026-10-21T14:09:00Z" },
    ];

    const erro = await erroDe(criarReservaCheckout(PEDIDO, null, AGORA));

    expect(erro.status).toBe(409);
    const cancelamento = mocks.consultas.find((c) => c.tabela === "reservas" && c.operacao === "update");
    expect(cancelamento?.payload).toEqual({ status: "cancelada" });
  });

  it("aplica vouchers validados no banco e confirma de imediato a reserva 100% coberta", async () => {
    mocks.vouchers = [
      { id: "v1", codigo: "FID-AAAA-2026", usuario_id: "user-1", arena_id: "arena-1", valor_teto: 300, status: "disponivel", expira_em: "2099-01-01" },
    ];

    const { reserva } = await criarReservaCheckout({ ...PEDIDO, voucherIds: ["v1"] }, "user-1", AGORA);

    expect(reserva).toMatchObject({ status: "confirmada", valorTotal: 0, valorSinal: 0, descontoFidelidade: 240, reservaGratuitaFidelidade: true, expiraEm: null });
    const consumo = mocks.consultas.find((c) => c.tabela === "fidelidade_vouchers" && c.operacao === "update");
    expect(consumo?.filtros).toContainEqual(["in", "codigo", ["FID-AAAA-2026"]]);
  });

  it("recusa vouchers de visitante (401), inválidos (422) e em arena sem o módulo de fidelidade (422)", async () => {
    expect((await erroDe(criarReservaCheckout({ ...PEDIDO, voucherIds: ["v1"] }, null, AGORA))).status).toBe(401);

    mocks.vouchers = [];
    expect((await erroDe(criarReservaCheckout({ ...PEDIDO, voucherIds: ["v1"] }, "user-1", AGORA))).status).toBe(422);

    mocks.arena = { ...ARENA, modulos_ativos: ["agendamento_core"] };
    const erro = await erroDe(criarReservaCheckout({ ...PEDIDO, voucherIds: ["v1"] }, "user-1", AGORA));
    expect(erro.message).toMatch(/fidelidade/);
  });

  it("recusa quadra sem preço configurado (422)", async () => {
    mocks.quadra = { ...QUADRA, valor_hora_padrao: 0 };
    mocks.precos = [];
    expect((await erroDe(criarReservaCheckout(PEDIDO, null, AGORA))).status).toBe(422);
  });
});

describe("token do checkout", () => {
  beforeEach(() => {
    mocks.consultas.length = 0;
  });

  it("só libera o lock com o token correto e apenas se ainda estiver em processamento", async () => {
    mocks.reservaDoToken = { id: "r1", status: "em_processamento", checkout_token: "tok" };
    expect((await erroDe(cancelarLockDoCheckout("r1", "errado"))).status).toBe(404);
    expect(await cancelarLockDoCheckout("r1", "tok")).toBe(true);

    mocks.reservaDoToken = { id: "r1", status: "pendente", checkout_token: "tok" };
    expect(await cancelarLockDoCheckout("r1", "tok")).toBe(false);
  });

  it("vincula a reserva ao atleta só com o token e se ela não tiver outro dono", async () => {
    mocks.reservaDoToken = { id: "r1", status: "pendente", checkout_token: "tok", user_id: null };
    await expect(vincularReservaAoAtleta("r1", "tok", "user-1")).resolves.toBeUndefined();

    mocks.reservaDoToken = { id: "r1", status: "pendente", checkout_token: "tok", user_id: "outro" };
    expect((await erroDe(vincularReservaAoAtleta("r1", "tok", "user-1"))).status).toBe(409);
    expect((await erroDe(vincularReservaAoAtleta("r1", "", "user-1"))).status).toBe(404);
  });
});
