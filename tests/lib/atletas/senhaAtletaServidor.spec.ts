/**
 * @file senhaAtletaServidor.spec.ts
 * @description Redefinição assistida da senha do atleta (só para quem reservou na arena) e do proprietário
 * (Super Admin), com troca obrigatória e auditoria sem segredos.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultaRegistrada } from "../../helpers/supabaseMock";

const mocks = vi.hoisted(() => ({
  perfil: { id: "u1", auth_user_id: "auth-u1", nome: "Ana", telefone: "(91) 98888-7777" } as Record<string, unknown> | null,
  reservasNaArena: 1,
  arena: { id: "a1" } as Record<string, unknown> | null,
  proprietario: { user_id: "dono" } as Record<string, unknown> | null,
  consultas: [] as ConsultaRegistrada[],
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente, consultas } = criarSupabaseMock((c) => {
    if (c.tabela === "usuarios") return { data: mocks.perfil };
    if (c.tabela === "reservas") return { count: mocks.reservasNaArena, data: null } as never;
    if (c.tabela === "arenas") return { data: mocks.arena };
    if (c.tabela === "arena_usuarios") return { data: mocks.proprietario };
    return { data: null };
  });
  mocks.consultas = consultas;
  const auth = { ...cliente.auth, admin: { getUserById: mocks.getUserById, updateUserById: mocks.updateUserById } };
  return { isAdminClientConfigured: () => true, supabaseAdmin: { ...cliente, auth } };
});

import { redefinirSenhaAtleta } from "@/lib/atletas/senhaAtletaServidorService";
import { redefinirSenhaProprietario } from "@/lib/admin/acessoProprietarioService";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";

const GERENTE: MembroArena = { userId: "g1", email: null, arenaId: "a1", role: "gerente" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consultas.length = 0;
  mocks.perfil = { id: "u1", auth_user_id: "auth-u1", nome: "Ana", telefone: "(91) 98888-7777" };
  mocks.reservasNaArena = 1;
  mocks.arena = { id: "a1" };
  mocks.proprietario = { user_id: "dono" };
  mocks.getUserById.mockResolvedValue({ data: { user: { email: "dono@arena.com", user_metadata: { nome: "Dono" } } }, error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
});

describe("redefinirSenhaAtleta", () => {
  it("gera senha temporária com troca obrigatória e audita sem expor a senha", async () => {
    const acesso = await redefinirSenhaAtleta(GERENTE, "u1");

    expect(acesso).toMatchObject({ nome: "Ana", telefone: "91988887777" });
    expect(mocks.updateUserById).toHaveBeenCalledWith("auth-u1", {
      password: acesso.senhaTemporaria,
      user_metadata: { nome: "Dono", trocar_senha: true },
    });
    const busca = mocks.consultas.find((c) => c.tabela === "reservas");
    expect(busca?.filtros).toContainEqual(["eq", "arena_id", "a1"]);
    expect(busca?.filtros).toContainEqual(["or", "user_id.eq.u1,whatsapp_cliente.eq.91988887777"]);
    const auditoria = mocks.consultas.find((c) => c.tabela === "auditoria_admin");
    expect(auditoria?.payload).toMatchObject({ acao: "atleta.redefinir_senha", alvo_id: "u1", autor_id: "g1" });
    expect(JSON.stringify(auditoria?.payload)).not.toContain(acesso.senhaTemporaria);
  });

  it("recusa atletas que nunca reservaram nesta arena", async () => {
    mocks.reservasNaArena = 0;
    await expect(redefinirSenhaAtleta(GERENTE, "u1")).rejects.toMatchObject({ status: 403 });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("recusa perfis sem conta e ids malformados", async () => {
    mocks.perfil = { id: "u1", auth_user_id: null };
    await expect(redefinirSenhaAtleta(GERENTE, "u1")).rejects.toMatchObject({ status: 404 });
    await expect(redefinirSenhaAtleta(GERENTE, "u1,id.eq.x")).rejects.toMatchObject({ status: 400 });
  });
});

describe("redefinirSenhaProprietario", () => {
  it("redefine a senha do proprietário ativo da arena", async () => {
    const acesso = await redefinirSenhaProprietario("arena-belem");

    expect(acesso.email).toBe("dono@arena.com");
    expect(mocks.updateUserById).toHaveBeenCalledWith("dono", {
      password: acesso.senhaTemporaria,
      user_metadata: { nome: "Dono", trocar_senha: true },
    });
    const vinculo = mocks.consultas.find((c) => c.tabela === "arena_usuarios");
    expect(vinculo?.filtros).toContainEqual(["eq", "role", "proprietario"]);
    const auditoria = mocks.consultas.find((c) => c.tabela === "auditoria_admin");
    expect(auditoria?.payload).toMatchObject({ autor_id: null, acao: "superadmin.redefinir_senha_proprietario" });
  });

  it("404 sem proprietário (arena ainda no convite) ou arena inexistente", async () => {
    mocks.proprietario = null;
    await expect(redefinirSenhaProprietario("arena-belem")).rejects.toMatchObject({ status: 404 });
    mocks.arena = null;
    await expect(redefinirSenhaProprietario("fantasma")).rejects.toMatchObject({ status: 404 });
  });
});
