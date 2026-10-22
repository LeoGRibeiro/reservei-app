/**
 * @file provisionamento.test.ts
 * @description Testes dos casos de uso de provisionamento (primeiro administrador com token de
 * convite e nova arena) com o cliente service role substituído por um dublê controlável.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Resultado = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

const TOKEN = "11111111-2222-3333-4444-555555555555";

const mocks = vi.hoisted(() => ({
  arena: { data: null, error: null } as Resultado,
  operadores: { count: 0, error: null } as Resultado,
  consumo: { data: [{ id: "arena-1" }], error: null } as Resultado,
  insertVinculo: { error: null } as Resultado,
  insertArena: { error: null } as Resultado,
  insertQuadras: { error: null } as Resultado,
  inserts: [] as { tabela: string; linhas: unknown }[],
  updates: [] as { tabela: string; dados: Record<string, unknown> }[],
  deletes: [] as string[],
  createUser: vi.fn(),
  deleteUser: vi.fn(),
}));

function cadeiaSelect(tabela: string) {
  const cadeia = {
    eq: () => cadeia,
    maybeSingle: () => Promise.resolve(mocks.arena),
    then: (resolve: (v: Resultado) => unknown) =>
      Promise.resolve(tabela === "arena_usuarios" ? mocks.operadores : mocks.arena).then(resolve),
  };
  return cadeia;
}

vi.mock("@/lib/supabase/adminClient", () => ({
  isAdminClientConfigured: () => true,
  supabaseAdmin: {
    auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } },
    from: (tabela: string) => ({
      select: () => cadeiaSelect(tabela),
      insert: (linhas: unknown) => {
        mocks.inserts.push({ tabela, linhas });
        const resultado =
          tabela === "arena_usuarios"
            ? mocks.insertVinculo
            : tabela === "arenas"
              ? mocks.insertArena
              : mocks.insertQuadras;
        return Promise.resolve(resultado);
      },
      update: (dados: Record<string, unknown>) => {
        mocks.updates.push({ tabela, dados });
        const cadeia = {
          eq: () => cadeia,
          select: () => Promise.resolve(mocks.consumo),
          then: (resolve: (v: Resultado) => unknown) => Promise.resolve({ error: null }).then(resolve),
        };
        return cadeia;
      },
      delete: () => ({
        eq: (_coluna: string, valor: string) => {
          mocks.deletes.push(`${tabela}:${valor}`);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

import {
  ErroProvisionamento,
  MSG_ARENA_JA_CONFIGURADA,
  MSG_TOKEN_INVALIDO,
  consultarEstadoSetup,
  criarArena,
  criarPrimeiroAdministrador,
  montarUrlConvite,
  validarNovaArena,
  validarSetupAdmin,
} from "@/lib/admin/provisionamento";

const SETUP_VALIDO = {
  arenaSlug: "central",
  token: TOKEN,
  nome: "Maria Dona",
  email: "maria@arena.com",
  senha: "senhaForte1",
};

describe("validarSetupAdmin", () => {
  it("normaliza slug, token e e-mail e mantém a senha intacta", () => {
    const r = validarSetupAdmin({
      ...SETUP_VALIDO,
      arenaSlug: " Central ",
      token: ` ${TOKEN} `,
      email: " Maria@Arena.com ",
    });
    expect(r).toEqual({ ...SETUP_VALIDO });
  });

  it("aceita token ausente na validação (a rejeição 403 ocorre no caso de uso)", () => {
    const { token: _t, ...semToken } = SETUP_VALIDO;
    void _t;
    expect(validarSetupAdmin(semToken).token).toBe("");
  });

  it("rejeita campos ausentes, e-mail inválido e senha curta com HTTP 400", () => {
    const casos: unknown[] = [
      null,
      {},
      { ...SETUP_VALIDO, nome: "  " },
      { ...SETUP_VALIDO, email: "sem-arroba" },
      { ...SETUP_VALIDO, senha: "12345" },
    ];
    for (const caso of casos) {
      try {
        validarSetupAdmin(caso);
        throw new Error("deveria ter lançado");
      } catch (err) {
        expect(err).toBeInstanceOf(ErroProvisionamento);
        expect((err as ErroProvisionamento).status).toBe(400);
      }
    }
  });
});

describe("consultarEstadoSetup / criarPrimeiroAdministrador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.arena = { data: { id: "arena-1", token_convite: TOKEN }, error: null };
    mocks.operadores = { count: 0, error: null };
    mocks.consumo = { data: [{ id: "arena-1" }], error: null };
    mocks.insertVinculo = { error: null };
    mocks.inserts = [];
    mocks.updates = [];
    mocks.createUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
  });

  it("precisa de setup e token válido quando o token confere", async () => {
    expect(await consultarEstadoSetup("central", TOKEN)).toEqual({ precisaSetup: true, tokenValido: true });
  });

  it("precisa de setup mas token inválido quando o token é ausente ou diferente", async () => {
    expect(await consultarEstadoSetup("central")).toEqual({ precisaSetup: true, tokenValido: false });
    expect(await consultarEstadoSetup("central", "outro-token")).toEqual({
      precisaSetup: true,
      tokenValido: false,
    });
  });

  it("considera token inválido quando a arena não tem convite pendente", async () => {
    mocks.arena = { data: { id: "arena-1", token_convite: null }, error: null };
    expect(await consultarEstadoSetup("central", TOKEN)).toEqual({ precisaSetup: true, tokenValido: false });
  });

  it("não precisa de setup quando já há operador ativo (mesmo com token correto)", async () => {
    mocks.operadores = { count: 1, error: null };
    expect(await consultarEstadoSetup("central", TOKEN)).toEqual({ precisaSetup: false, tokenValido: false });
  });

  it("não precisa de setup quando a arena não existe", async () => {
    mocks.arena = { data: null, error: null };
    expect(await consultarEstadoSetup("fantasma", TOKEN)).toEqual({ precisaSetup: false, tokenValido: false });
  });

  it("propaga erro de banco na consulta", async () => {
    mocks.operadores = { count: null, error: { message: "falha" } };
    await expect(consultarEstadoSetup("central", TOKEN)).rejects.toThrow("falha");
  });

  it("consome o token, cria o usuário confirmado e o vínculo de proprietário", async () => {
    const r = await criarPrimeiroAdministrador(SETUP_VALIDO);

    expect(r).toEqual({ userId: "user-1" });
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "maria@arena.com",
      password: "senhaForte1",
      email_confirm: true,
      user_metadata: { nome: "Maria Dona" },
    });
    expect(mocks.inserts).toEqual([
      {
        tabela: "arena_usuarios",
        linhas: { arena_id: "arena-1", user_id: "user-1", role: "proprietario", ativo: true },
      },
    ]);
    // O convite é invalidado (token nulo) e a conclusão registrada
    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].tabela).toBe("arenas");
    expect(mocks.updates[0].dados.token_convite).toBeNull();
    expect(typeof mocks.updates[0].dados.setup_concluido_em).toBe("string");
  });

  it("rejeita com 403 e não cria usuário quando o token está ausente", async () => {
    await expect(criarPrimeiroAdministrador({ ...SETUP_VALIDO, token: "" })).rejects.toMatchObject({
      status: 403,
      message: MSG_TOKEN_INVALIDO,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejeita com 403 e não cria usuário quando o token está incorreto", async () => {
    await expect(criarPrimeiroAdministrador({ ...SETUP_VALIDO, token: "errado" })).rejects.toMatchObject({
      status: 403,
      message: MSG_TOKEN_INVALIDO,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.updates).toHaveLength(0);
  });

  it("rejeita com 403 quando o convite já foi consumido (arena sem token pendente)", async () => {
    mocks.arena = { data: { id: "arena-1", token_convite: null }, error: null };

    await expect(criarPrimeiroAdministrador(SETUP_VALIDO)).rejects.toMatchObject({
      status: 403,
      message: MSG_TOKEN_INVALIDO,
    });
  });

  it("rejeita com 403 quando outra requisição consumiu o token primeiro (corrida)", async () => {
    mocks.consumo = { data: [], error: null };

    await expect(criarPrimeiroAdministrador(SETUP_VALIDO)).rejects.toMatchObject({
      status: 403,
      message: MSG_TOKEN_INVALIDO,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejeita com 403 quando a arena já possui administrador, mesmo com token correto", async () => {
    mocks.operadores = { count: 2, error: null };

    await expect(criarPrimeiroAdministrador(SETUP_VALIDO)).rejects.toMatchObject({
      status: 403,
      message: MSG_ARENA_JA_CONFIGURADA,
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.updates).toHaveLength(0);
  });

  it("rejeita com 404 quando a arena não existe", async () => {
    mocks.arena = { data: null, error: null };

    await expect(criarPrimeiroAdministrador(SETUP_VALIDO)).rejects.toMatchObject({ status: 404 });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("rejeita com 409 e devolve o token quando o e-mail já está em uso", async () => {
    mocks.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    await expect(criarPrimeiroAdministrador(SETUP_VALIDO)).rejects.toMatchObject({ status: 409 });
    const restauracao = mocks.updates[mocks.updates.length - 1];
    expect(restauracao.dados).toEqual({ token_convite: TOKEN, setup_concluido_em: null });
  });

  it("desfaz o usuário e devolve o token se o vínculo falhar", async () => {
    mocks.insertVinculo = { error: { message: "fk violation" } };

    await expect(criarPrimeiroAdministrador(SETUP_VALIDO)).rejects.toThrow("fk violation");
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1");
    const restauracao = mocks.updates[mocks.updates.length - 1];
    expect(restauracao.dados).toEqual({ token_convite: TOKEN, setup_concluido_em: null });
  });
});

describe("montarUrlConvite", () => {
  it("monta o link de ativação no subdomínio da arena", () => {
    expect(montarUrlConvite("central", TOKEN)).toBe(`https://central.reservei.com/admin?token=${TOKEN}`);
  });
});

describe("validarNovaArena", () => {
  const VALIDA = {
    nome: "Arena Central",
    slug: "Central",
    cidade: "Belém",
    estado: "pa",
    whatsapp: "(91) 98123-4567",
    modulos: ["fidelidade", "xyz"],
    quantidadeQuadras: 3,
  };

  it("normaliza slug/estado e sempre inclui o core, descartando módulos desconhecidos", () => {
    const r = validarNovaArena(VALIDA);

    expect(r.slug).toBe("central");
    expect(r.estado).toBe("PA");
    expect(r.modulos).toEqual(["agendamento_core", "fidelidade"]);
    expect(r.quantidadeQuadras).toBe(3);
  });

  it("usa o pacote padrão e 3 quadras quando módulos e quantidade são omitidos", () => {
    const { modulos: _m, quantidadeQuadras: _q, ...semOpcionais } = VALIDA;
    void _m;
    void _q;
    const r = validarNovaArena(semOpcionais);

    expect(r.modulos).toContain("contratos");
    expect(r.quantidadeQuadras).toBe(3);
  });

  it("rejeita slug inválido ou reservado, estado inválido e quantidade fora do limite", () => {
    const invalidos = [
      { ...VALIDA, slug: "com espaço" },
      { ...VALIDA, slug: "admin" },
      { ...VALIDA, slug: "super-admin" },
      { ...VALIDA, estado: "Pará" },
      { ...VALIDA, quantidadeQuadras: -1 },
      { ...VALIDA, quantidadeQuadras: 21 },
      { ...VALIDA, quantidadeQuadras: 1.5 },
      { ...VALIDA, nome: "" },
    ];
    for (const caso of invalidos) {
      expect(() => validarNovaArena(caso)).toThrow(ErroProvisionamento);
    }
  });
});

describe("criarArena", () => {
  const INPUT = {
    nome: "Arena Central",
    slug: "central",
    cidade: "Belém",
    estado: "PA",
    whatsapp: "91981234567",
    modulos: ["agendamento_core", "fidelidade"] as ("agendamento_core" | "fidelidade")[],
    quantidadeQuadras: 2,
  };

  beforeEach(() => {
    mocks.insertArena = { error: null };
    mocks.insertQuadras = { error: null };
    mocks.inserts = [];
    mocks.deletes = [];
  });

  it("cria a arena com módulos, token de convite e as quadras iniciais", async () => {
    const r = await criarArena(INPUT);

    expect(r.slug).toBe("central");
    expect(r.quadrasCriadas).toBe(2);
    expect(r.tokenConvite).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.urlConvite).toBe(`https://central.reservei.com/admin?token=${r.tokenConvite}`);

    const arena = mocks.inserts.find((i) => i.tabela === "arenas")?.linhas as Record<string, unknown>;
    expect(arena).toMatchObject({
      slug: "central",
      modulos_ativos: ["agendamento_core", "fidelidade"],
      ativo: true,
      token_convite: r.tokenConvite,
    });
    const quadras = mocks.inserts.find((i) => i.tabela === "quadras")?.linhas as Record<string, unknown>[];
    expect(quadras).toHaveLength(2);
    expect(quadras[0]).toMatchObject({ arena_id: r.arenaId, numero: 1, nome: "Quadra 1" });
  });

  it("gera um token diferente a cada arena", async () => {
    const a = await criarArena(INPUT);
    const b = await criarArena({ ...INPUT, slug: "outra" });
    expect(a.tokenConvite).not.toBe(b.tokenConvite);
  });

  it("não insere quadras quando a quantidade é zero", async () => {
    await criarArena({ ...INPUT, quantidadeQuadras: 0 });
    expect(mocks.inserts.some((i) => i.tabela === "quadras")).toBe(false);
  });

  it("rejeita com 409 quando o slug já existe", async () => {
    mocks.insertArena = { error: { message: "duplicate", code: "23505" } };
    await expect(criarArena(INPUT)).rejects.toMatchObject({ status: 409 });
  });

  it("remove a arena se a criação das quadras falhar", async () => {
    mocks.insertQuadras = { error: { message: "falha quadras" } };

    await expect(criarArena(INPUT)).rejects.toThrow("falha quadras");
    expect(mocks.deletes.some((d) => d.startsWith("arenas:"))).toBe(true);
  });
});
