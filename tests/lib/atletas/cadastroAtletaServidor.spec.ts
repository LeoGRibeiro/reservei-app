/**
 * @file cadastroAtletaServidor.spec.ts
 * @description Cadastro de atletas pela API administrativa do Supabase (conta já confirmada).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  insertPerfil: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", () => ({
  isAdminClientConfigured: () => true,
  supabaseAdmin: {
    auth: { admin: { createUser: mocks.createUser, deleteUser: mocks.deleteUser } },
    from: () => ({ insert: (linha: unknown) => mocks.insertPerfil(linha) }),
  },
}));

import { cadastrarAtleta, validarCadastroAtleta } from "@/lib/atletas/cadastroAtletaServidorService";

const DADOS = { nome: "Ana Lima", telefone: "91981234567", senha: "Senha#Forte1", dataNascimento: null };

describe("validarCadastroAtleta", () => {
  it("normaliza telefone e data", () => {
    expect(
      validarCadastroAtleta({ nome: " Ana Lima ", telefone: "(91) 98123-4567", senha: "Senha#Forte1", dataNascimento: "1990-05-10" })
    ).toEqual({ nome: "Ana Lima", telefone: "91981234567", senha: "Senha#Forte1", dataNascimento: "1990-05-10" });
  });

  it.each([
    [{ ...DADOS, nome: "An" }, /nome/],
    [{ ...DADOS, telefone: "123" }, /WhatsApp/],
    [{ ...DADOS, senha: "fraca" }, /senha/i],
    [{ ...DADOS, dataNascimento: "10/05/1990" }, /nascimento/],
  ])("rejeita dados inválidos (%#)", (entrada, mensagem) => {
    expect(() => validarCadastroAtleta(entrada)).toThrow(mensagem);
  });
});

describe("cadastrarAtleta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.insertPerfil.mockResolvedValue({ error: null });
  });

  it("cria a conta confirmada com e-mail sintético e o perfil sem senha", async () => {
    expect(await cadastrarAtleta(DADOS)).toEqual({ userId: "u1" });
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "91981234567@auth.reservei.com.br",
      password: "Senha#Forte1",
      email_confirm: true,
      user_metadata: { nome: "Ana Lima" },
    });
    const perfil = mocks.insertPerfil.mock.calls[0][0];
    expect(perfil).toEqual({ id: "u1", auth_user_id: "u1", nome: "Ana Lima", telefone: "91981234567", data_nascimento: null });
  });

  it("responde 409 quando o WhatsApp já tem conta", async () => {
    mocks.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: "already registered" } });
    await expect(cadastrarAtleta(DADOS)).rejects.toMatchObject({ status: 409 });
  });

  it("desfaz a identidade criada se o perfil não puder ser gravado", async () => {
    mocks.insertPerfil.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });

    await expect(cadastrarAtleta(DADOS)).rejects.toMatchObject({ status: 409 });
    expect(mocks.deleteUser).toHaveBeenCalledWith("u1");
  });
});
