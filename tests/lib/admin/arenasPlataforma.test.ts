// @vitest-environment node
/**
 * @file arenasPlataforma.test.ts
 * @description Gestão das arenas pelo Super Admin: validação do PATCH, troca de endereço (guarda o
 * anterior), endereço em uso por outra arena e liga/desliga do modo demonstração.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, unknown>;

const estado = vi.hoisted(() => ({
  arenas: [] as Linha[],
  credenciais: [] as Linha[],
  updates: [] as Linha[],
  auditoria: [] as Linha[],
  simulado: true,
}));

/** Dublê mínimo do cliente service role (filtros eq / or / in sobre listas em memória). */
function consulta(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let atualizacao: Linha | null = null;
  const base = () => (tabela === "arenas" ? estado.arenas : tabela === "arena_credenciais_pagamento" ? estado.credenciais : []);
  const linhas = () => base().filter((l) => filtros.every((f) => f(l)));
  const cadeia = {
    select: () => cadeia,
    order: () => cadeia,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), cadeia),
    in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), cadeia),
    or: (expr: string) => {
      const partes = expr.split(",").map((p) => p.split(".eq."));
      filtros.push((l) => partes.some(([c, v]) => l[c] === v));
      return cadeia;
    },
    update: (dados: Linha) => ((atualizacao = dados), cadeia),
    maybeSingle: () => Promise.resolve({ data: linhas()[0] ?? null, error: null }),
    single: () => {
      const alvo = linhas()[0];
      if (atualizacao && alvo) {
        estado.updates.push(atualizacao);
        Object.assign(alvo, atualizacao);
      }
      return Promise.resolve({ data: alvo ?? null, error: alvo ? null : { message: "não achou" } });
    },
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: linhas(), error: null }).then(resolve),
  };
  return cadeia;
}

vi.mock("@/lib/supabase/adminClient", () => ({
  supabaseAdmin: {
    from: (tabela: string) => consulta(tabela),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "dono@arena.com" } } }) } },
  },
}));
vi.mock("@/lib/servidor/auditoria", () => ({
  registrarAuditoria: async (e: Linha) => void estado.auditoria.push(e),
}));
vi.mock("@/lib/pagamento/simulacao", () => ({ pagamentoSimuladoHabilitado: () => estado.simulado }));

import { alterarArenaPlataforma, garantirSlugLivre, validarAlteracaoArena } from "@/lib/admin/arenasPlataforma";

beforeEach(() => {
  estado.arenas = [
    { id: "a1", slug: "arena-belem", slug_anterior: null, nome: "Arena Belém", ativo: true, modulos_ativos: ["agendamento_core"], modo_pagamento: "manual" },
    { id: "a2", slug: "central", slug_anterior: "velha", nome: "Central", ativo: true, modulos_ativos: ["agendamento_core"], modo_pagamento: "simulado" },
  ];
  estado.credenciais = [];
  estado.updates = [];
  estado.auditoria = [];
  estado.simulado = true;
});

describe("validarAlteracaoArena", () => {
  it("normaliza o endereço e sempre mantém o agendamento nos módulos", () => {
    expect(validarAlteracaoArena({ slug: " Belem-Arena ", modulos: ["escolinhas", "escolinhas"] })).toEqual({
      slug: "belem-arena",
      modulos: ["agendamento_core", "escolinhas"],
    });
  });

  it.each([
    [{ slug: "com espaço" }, /Slug inválido/],
    [{ slug: "admin" }, /reservado/],
    [{ modulos: ["nao-existe"] }, /Módulo desconhecido/],
    [{ ativo: "sim" }, /Status inválido/],
    [{}, /Nada para alterar/],
  ])("recusa %j", (corpo, mensagem) => {
    expect(() => validarAlteracaoArena(corpo)).toThrow(mensagem);
  });
});

describe("garantirSlugLivre", () => {
  it("recusa endereço atual ou antigo de outra arena, mas aceita o da própria", async () => {
    await expect(garantirSlugLivre("central", "a1")).rejects.toMatchObject({ status: 409 });
    await expect(garantirSlugLivre("velha", "a1")).rejects.toMatchObject({ status: 409 });
    await expect(garantirSlugLivre("velha", "a2")).resolves.toBeUndefined();
    await expect(garantirSlugLivre("livre")).resolves.toBeUndefined();
  });
});

describe("alterarArenaPlataforma", () => {
  it("troca o endereço guardando o anterior e registra na auditoria", async () => {
    const arena = await alterarArenaPlataforma("a1", { slug: "belem-arena" });
    expect(arena).toMatchObject({ slug: "belem-arena", slugAnterior: "arena-belem", emailDono: null });
    expect(estado.updates[0]).toMatchObject({ slug: "belem-arena", slug_anterior: "arena-belem" });
    expect(estado.auditoria[0]).toMatchObject({ arenaId: "a1", acao: "superadmin.alterar_arena", autorId: null });
  });

  it("não mexe no endereço quando ele é o mesmo", async () => {
    await alterarArenaPlataforma("a1", { slug: "arena-belem", ativo: false });
    expect(estado.updates[0]).not.toHaveProperty("slug");
    expect(estado.updates[0]).toMatchObject({ ativo: false });
  });

  it("liga a demonstração só se o servidor permitir", async () => {
    estado.simulado = false;
    await expect(alterarArenaPlataforma("a1", { modoDemonstracao: true })).rejects.toMatchObject({ status: 409 });
    estado.simulado = true;
    await alterarArenaPlataforma("a1", { modoDemonstracao: true });
    expect(estado.updates[0]).toMatchObject({ modo_pagamento: "simulado" });
  });

  it("ao desligar a demonstração volta para o Asaas, se conectado, ou para o Pix direto", async () => {
    await alterarArenaPlataforma("a2", { modoDemonstracao: false });
    expect(estado.updates[0]).toMatchObject({ modo_pagamento: "manual" });

    estado.arenas[1].modo_pagamento = "simulado";
    estado.credenciais = [{ arena_id: "a2", provedor: "asaas" }];
    await alterarArenaPlataforma("a2", { modoDemonstracao: false });
    expect(estado.updates[1]).toMatchObject({ modo_pagamento: "asaas" });
  });

  it("arena inexistente responde 404", async () => {
    await expect(alterarArenaPlataforma("nao-existe", { ativo: true })).rejects.toMatchObject({ status: 404 });
  });
});
