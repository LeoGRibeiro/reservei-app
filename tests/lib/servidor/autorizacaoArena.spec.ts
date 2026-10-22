/**
 * @file autorizacaoArena.spec.ts
 * @description Autorização das rotas administrativas: sessão, vínculo ativo com a arena e papel mínimo.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usuario: { id: "u1", email: "u1@arena.com" } as { id: string; email: string } | null,
  arena: { id: "a1" } as Record<string, unknown> | null,
  vinculo: { role: "gerente" } as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase/adminClient", async () => {
  const { criarSupabaseMock } = await import("../../helpers/supabaseMock");
  const { cliente } = criarSupabaseMock((c) => {
    if (c.tabela === "arenas") return { data: mocks.arena };
    if (c.tabela === "arena_usuarios") return { data: mocks.vinculo };
    return { data: null };
  });
  cliente.auth.getUser = async () => ({ data: { user: mocks.usuario }, error: null });
  return { isAdminClientConfigured: () => true, supabaseAdmin: cliente };
});

import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";

const requisicao = (token = "tk") =>
  new Request("http://localhost/api/x", { headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeEach(() => {
  mocks.usuario = { id: "u1", email: "u1@arena.com" };
  mocks.arena = { id: "a1" };
  mocks.vinculo = { role: "gerente" };
});

describe("exigirMembroArena", () => {
  it("devolve o membro com o papel na arena", async () => {
    await expect(exigirMembroArena(requisicao(), "arena-belem")).resolves.toEqual({
      userId: "u1",
      email: "u1@arena.com",
      arenaId: "a1",
      role: "gerente",
    });
  });

  it("401 sem sessão", async () => {
    await expect(exigirMembroArena(requisicao(""), "arena-belem")).rejects.toMatchObject({ status: 401 });
  });

  it("404 para arena inexistente e 400 sem arena", async () => {
    mocks.arena = null;
    await expect(exigirMembroArena(requisicao(), "fantasma")).rejects.toMatchObject({ status: 404 });
    await expect(exigirMembroArena(requisicao(), "  ")).rejects.toMatchObject({ status: 400 });
  });

  it("403 para quem não é membro ativo da arena", async () => {
    mocks.vinculo = null;
    await expect(exigirMembroArena(requisicao(), "arena-belem")).rejects.toMatchObject({ status: 403 });
  });

  it("403 quando o papel não permite a ação", async () => {
    await expect(exigirMembroArena(requisicao(), "arena-belem", "gerenciar_equipe")).rejects.toMatchObject({
      status: 403,
    });
    mocks.vinculo = { role: "proprietario" };
    await expect(exigirMembroArena(requisicao(), "arena-belem", "gerenciar_equipe")).resolves.toMatchObject({
      role: "proprietario",
    });
  });
});
