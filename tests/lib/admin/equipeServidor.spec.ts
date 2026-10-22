/**
 * @file equipeServidor.spec.ts
 * @description Gestão de equipe no servidor: convite, alteração de vínculo, redefinição de senha e regras
 * de proteção (proprietário intocável, ninguém altera o próprio acesso).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  vinculo: { role: "operador" } as Record<string, unknown> | null,
  vinculos: [] as Record<string, unknown>[],
  erroInsert: null as { message: string } | null,
  consultas: [] as ConsultaRegistrada[],
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.tabela === "arena_usuarios" && c.operacao === "insert") return { error: mocks.erroInsert };
    if (c.tabela === "arena_usuarios" && c.operacao === "select") {
      return { data: c.unica ? mocks.vinculo : mocks.vinculos };
    }
    return { data: null, error: null };
  });
  mocks.consultas = consultas;
  const auth = {
    ...cliente.auth,
    admin: {
      createUser: mocks.createUser,
      deleteUser: mocks.deleteUser,
      getUserById: mocks.getUserById,
      updateUserById: mocks.updateUserById,
    },
  };
  return { isAdminClientConfigured: () => true, supabaseAdmin: { ...cliente, auth } };
});

import {
  alterarMembro,
  convidarMembro,
  listarEquipe,
  redefinirSenhaMembro,
  validarAlteracao,
  validarConvite,
} from "@/lib/admin/equipeServidorService";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";

const DONO: MembroArena = { userId: "dono", email: "dono@arena.com", arenaId: "a1", role: "proprietario" };

const consultasDe = (tabela: string, operacao: ConsultaRegistrada["operacao"]) =>
  mocks.consultas.filter((c) => c.tabela === tabela && c.operacao === operacao);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consultas.length = 0;
  mocks.vinculo = { role: "operador" };
  mocks.vinculos = [];
  mocks.erroInsert = null;
  mocks.createUser.mockResolvedValue({ data: { user: { id: "novo" } }, error: null });
  mocks.getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "ana@arena.com", user_metadata: { nome: "Ana" } } }, error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
});

describe("validarConvite", () => {
  it("normaliza nome e e-mail", () => {
    expect(validarConvite({ nome: "  Ana  ", email: " ANA@Arena.com ", role: "operador" })).toEqual({
      nome: "Ana",
      email: "ana@arena.com",
      role: "operador",
    });
  });

  it.each([
    [{ nome: "A", email: "a@a.com", role: "operador" }, /nome/],
    [{ nome: "Ana", email: "sem-arroba", role: "operador" }, /e-mail/],
    [{ nome: "Ana", email: "a@a.com", role: "proprietario" }, /perfil/i],
    [{ nome: "Ana", email: "a@a.com", role: "admin" }, /perfil/i],
  ])("rejeita convite inválido (%#)", (entrada, msg) => {
    expect(() => validarConvite(entrada)).toThrow(msg);
  });
});

describe("validarAlteracao", () => {
  it("exige ao menos um campo e valida os tipos", () => {
    expect(() => validarAlteracao({ userId: "u2" })).toThrow(/Nada/);
    expect(() => validarAlteracao({ userId: "u2", role: "proprietario" })).toThrow(/Perfil/);
    expect(() => validarAlteracao({ userId: "u2", ativo: "sim" })).toThrow(/Situação/);
    expect(validarAlteracao({ userId: "u2", ativo: false })).toEqual({ userId: "u2", ativo: false });
  });
});

describe("convidarMembro", () => {
  it("cria conta com senha temporária, troca obrigatória e vínculo na arena do autor", async () => {
    const credencial = await convidarMembro(DONO, { nome: "Ana", email: "ana@arena.com", role: "gerente" });

    expect(credencial.userId).toBe("novo");
    expect(credencial.senhaTemporaria).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@arena.com",
        email_confirm: true,
        user_metadata: { nome: "Ana", trocar_senha: true },
      })
    );
    expect(consultasDe("arena_usuarios", "insert")[0].payload).toEqual({
      arena_id: "a1",
      user_id: "novo",
      role: "gerente",
      ativo: true,
    });
    const auditoria = consultasDe("auditoria_admin", "insert")[0].payload as Record<string, unknown>;
    expect(auditoria).toMatchObject({ arena_id: "a1", autor_id: "dono", acao: "equipe.convite", alvo_id: "novo" });
    expect(JSON.stringify(auditoria)).not.toContain(credencial.senhaTemporaria);
  });

  it("responde 409 quando o e-mail já tem conta", async () => {
    mocks.createUser.mockResolvedValue({ data: { user: null }, error: { message: "User already registered" } });
    await expect(convidarMembro(DONO, { nome: "Ana", email: "ana@arena.com", role: "operador" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("desfaz a conta criada se o vínculo falhar", async () => {
    mocks.erroInsert = { message: "falha" };
    await expect(convidarMembro(DONO, { nome: "Ana", email: "ana@arena.com", role: "operador" })).rejects.toThrow();
    expect(mocks.deleteUser).toHaveBeenCalledWith("novo");
  });
});

describe("alterarMembro", () => {
  it("altera papel e situação do vínculo da própria arena", async () => {
    await alterarMembro(DONO, { userId: "u2", role: "gerente", ativo: false });

    const update = consultasDe("arena_usuarios", "update")[0];
    expect(update.payload).toEqual({ role: "gerente", ativo: false });
    expect(update.filtros).toContainEqual(["eq", "arena_id", "a1"]);
    expect(update.filtros).toContainEqual(["eq", "user_id", "u2"]);
  });

  it("impede alterar o próprio acesso", async () => {
    await expect(alterarMembro(DONO, { userId: "dono", ativo: false })).rejects.toMatchObject({ status: 403 });
  });

  it("impede alterar o proprietário", async () => {
    mocks.vinculo = { role: "proprietario" };
    await expect(alterarMembro(DONO, { userId: "outro", role: "operador" })).rejects.toMatchObject({ status: 403 });
    expect(consultasDe("arena_usuarios", "update")).toHaveLength(0);
  });

  it("responde 404 para quem não é da arena", async () => {
    mocks.vinculo = null;
    await expect(alterarMembro(DONO, { userId: "estranho", ativo: false })).rejects.toMatchObject({ status: 404 });
  });
});

describe("redefinirSenhaMembro", () => {
  it("gera nova senha temporária preservando os metadados", async () => {
    const credencial = await redefinirSenhaMembro(DONO, "u2");

    expect(credencial.email).toBe("ana@arena.com");
    expect(mocks.updateUserById).toHaveBeenCalledWith("u2", {
      password: credencial.senhaTemporaria,
      user_metadata: { nome: "Ana", trocar_senha: true },
    });
  });

  it("não redefine a senha do proprietário", async () => {
    mocks.vinculo = { role: "proprietario" };
    await expect(redefinirSenhaMembro(DONO, "outro")).rejects.toMatchObject({ status: 403 });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });
});

describe("listarEquipe", () => {
  it("ordena por papel e marca quem ainda usa senha temporária", async () => {
    mocks.vinculos = [
      { user_id: "op", role: "operador", ativo: true, criado_em: "2026-10-01" },
      { user_id: "dono", role: "proprietario", ativo: true, criado_em: "2026-09-01" },
    ];
    mocks.getUserById.mockImplementation(async (id: string) => ({
      data: {
        user: {
          id,
          email: `${id}@arena.com`,
          user_metadata: id === "op" ? { nome: "Operador", trocar_senha: true } : { nome: "Dono" },
        },
      },
    }));

    const equipe = await listarEquipe("a1");
    expect(equipe.map((m) => m.userId)).toEqual(["dono", "op"]);
    expect(equipe[1]).toMatchObject({ nome: "Operador", senhaPendente: true, role: "operador" });
  });
});
