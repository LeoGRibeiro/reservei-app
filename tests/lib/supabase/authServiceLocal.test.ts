/**
 * @file authServiceLocal.test.ts
 * @description Testes do fallback local do authService (Supabase não configurado):
 * garante que a senha nunca é persistida em texto puro no localStorage.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  cadastrarUsuarioSupabase,
  emailSinteticoDoTelefone,
  loginUsuarioSupabase,
} from "@/lib/supabase/authService";

const CHAVE_USUARIOS = "reservei_users_db";

describe("emailSinteticoDoTelefone", () => {
  it("mapeia o WhatsApp (somente dígitos) para o e-mail sintético do Supabase Auth", () => {
    expect(emailSinteticoDoTelefone("(91) 98123-4567")).toBe("91981234567@auth.reservei.com.br");
    expect(emailSinteticoDoTelefone("91981234567")).toBe("91981234567@auth.reservei.com.br");
  });
});

describe("authService - fallback local seguro", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("não grava a senha em texto puro no localStorage ao cadastrar", async () => {
    const res = await cadastrarUsuarioSupabase("Ana Lima", "(91) 98123-4567", "SenhaSecreta99");

    expect(res.user).not.toBeNull();
    const todoOStorage = JSON.stringify({ ...localStorage });
    expect(todoOStorage).not.toContain("SenhaSecreta99");

    const [registro] = JSON.parse(localStorage.getItem(CHAVE_USUARIOS) ?? "[]");
    expect(registro.senha).toBeUndefined();
    expect(registro.senha_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(registro.senha_salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("gera salts distintos, produzindo hashes diferentes para a mesma senha", async () => {
    await cadastrarUsuarioSupabase("Ana", "91981234567", "mesmaSenha1");
    await cadastrarUsuarioSupabase("Bia", "91981230000", "mesmaSenha1");

    const [a, b] = JSON.parse(localStorage.getItem(CHAVE_USUARIOS) ?? "[]");
    expect(a.senha_salt).not.toBe(b.senha_salt);
    expect(a.senha_hash).not.toBe(b.senha_hash);
  });

  it("autentica com a senha correta, aceitando o WhatsApp com ou sem máscara", async () => {
    await cadastrarUsuarioSupabase("Ana Lima", "91981234567", "SenhaSecreta99");

    const comMascara = await loginUsuarioSupabase("(91) 98123-4567", "SenhaSecreta99");
    const semMascara = await loginUsuarioSupabase("91981234567", "SenhaSecreta99");

    expect(comMascara.user?.nome).toBe("Ana Lima");
    expect(semMascara.user?.nome).toBe("Ana Lima");
  });

  it("rejeita senha incorreta e telefone não cadastrado com a mesma mensagem", async () => {
    await cadastrarUsuarioSupabase("Ana Lima", "91981234567", "SenhaSecreta99");

    const senhaErrada = await loginUsuarioSupabase("91981234567", "errada");
    const naoCadastrado = await loginUsuarioSupabase("91900000000", "SenhaSecreta99");

    expect(senhaErrada.user).toBeNull();
    expect(senhaErrada.error).toBe("WhatsApp ou senha incorretos.");
    expect(naoCadastrado.user).toBeNull();
    expect(naoCadastrado.error).toBe("WhatsApp ou senha incorretos.");
  });

  it("impede cadastro duplicado do mesmo WhatsApp", async () => {
    await cadastrarUsuarioSupabase("Ana Lima", "91981234567", "SenhaSecreta99");

    const duplicado = await cadastrarUsuarioSupabase("Outra Ana", "(91) 98123-4567", "outraSenha1");

    expect(duplicado.user).toBeNull();
    expect(duplicado.error).toBe("Este número de WhatsApp já possui uma conta cadastrada.");
  });

  it("migra registros legados com senha em texto puro para hash no primeiro login", async () => {
    localStorage.setItem(
      CHAVE_USUARIOS,
      JSON.stringify([
        { id: "usr_legado", nome: "Legado", telefone: "91981234567", senha: "senhaAntiga" },
      ])
    );

    const falha = await loginUsuarioSupabase("91981234567", "outra");
    expect(falha.user).toBeNull();
    // Falha de login não migra nem apaga o registro legado
    expect(JSON.parse(localStorage.getItem(CHAVE_USUARIOS) ?? "[]")[0].senha).toBe("senhaAntiga");

    const sucesso = await loginUsuarioSupabase("91981234567", "senhaAntiga");
    expect(sucesso.user?.id).toBe("usr_legado");

    const [migrado] = JSON.parse(localStorage.getItem(CHAVE_USUARIOS) ?? "[]");
    expect(migrado.senha).toBeUndefined();
    expect(migrado.senha_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify({ ...localStorage })).not.toContain("senhaAntiga");

    const novamente = await loginUsuarioSupabase("91981234567", "senhaAntiga");
    expect(novamente.user?.id).toBe("usr_legado");
  });
});
