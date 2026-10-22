/**
 * @file useAdminAuth.test.ts
 * @description Testes do hook de autenticação administrativa com Supabase Auth e RBAC multi-tenant.
 * O cliente Supabase é substituído por um dublê controlável (sem rede).
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configurado: true,
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  vinculos: { data: [] as unknown[], error: null as { message: string } | null },
  authCallback: null as ((evento: string) => void) | null,
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => mocks.configurado,
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve(mocks.vinculos),
        }),
      }),
    })),
  },
}));

import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  MSG_ACESSO_NAO_AUTORIZADO,
  MSG_CREDENCIAIS_INVALIDAS,
  MSG_FALHA_GENERICA,
  MSG_SUPABASE_INDISPONIVEL,
} from "@/lib/supabase/adminAuthService";

const USUARIO = { id: "uuid-operador-1", email: "dono@arena.com" };

function vinculo(slug: string, role = "proprietario", arenaId = `arena-${slug}`) {
  return { role, ativo: true, arena_id: arenaId, arenas: { slug } };
}

describe("useAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.configurado = true;
    mocks.vinculos = { data: [], error: null };
    mocks.authCallback = null;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: USUARIO, session: {} },
      error: null,
    });
    mocks.onAuthStateChange.mockImplementation((cb: (evento: string) => void) => {
      mocks.authCallback = cb;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
  });

  describe("restauração de sessão", () => {
    it("inicia em estado de carregamento (null) e resolve para não autenticado sem sessão", async () => {
      const { result } = renderHook(() => useAdminAuth("Central"));

      expect(result.current.autenticado).toBeNull();
      await waitFor(() => expect(result.current.autenticado).toBe(false));
      expect(result.current.user).toBeNull();
      expect(result.current.role).toBeNull();
    });

    it("restaura a sessão quando o usuário possui vínculo ativo com a arena atual", async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });
      mocks.vinculos = { data: [vinculo("Central", "gerente", "arena-1")], error: null };

      const { result } = renderHook(() => useAdminAuth("Central"));

      await waitFor(() => expect(result.current.autenticado).toBe(true));
      expect(result.current.role).toBe("gerente");
      expect(result.current.arenaId).toBe("arena-1");
      expect(result.current.user).toEqual(USUARIO);
    });

    it("não autentica sessão de usuário sem vínculo com a arena (ex.: atleta) e não encerra a sessão", async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });
      mocks.vinculos = { data: [], error: null };

      const { result } = renderHook(() => useAdminAuth("Central"));

      await waitFor(() => expect(result.current.autenticado).toBe(false));
      expect(mocks.signOut).not.toHaveBeenCalled();
    });

    it("trata falha na consulta de vínculos como não autenticado", async () => {
      vi.spyOn(console, "error").mockImplementation(() => { });
      mocks.getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });
      mocks.vinculos = { data: [], error: { message: "permission denied" } };

      const { result } = renderHook(() => useAdminAuth("Central"));

      await waitFor(() => expect(result.current.autenticado).toBe(false));
    });

    it("usa a arena padrão quando o host não possui subdomínio", async () => {
      const { result } = renderHook(() => useAdminAuth());

      expect(result.current.arenaSlug).toBe("arena-demo");
      await waitFor(() => expect(result.current.autenticado).toBe(false));
    });

    it("volta a não autenticado quando o Supabase notifica SIGNED_OUT", async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });
      mocks.vinculos = { data: [vinculo("Central")], error: null };

      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(true));

      act(() => {
        mocks.authCallback?.("SIGNED_OUT");
      });

      expect(result.current.autenticado).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("cancela a inscrição de eventos de autenticação ao desmontar", async () => {
      const { result, unmount } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      unmount();

      expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("login", () => {
    it("autentica com e-mail e senha válidos vinculados à arena atual", async () => {
      mocks.vinculos = { data: [vinculo("Central", "proprietario", "arena-1")], error: null };
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      let resposta: { success: boolean; error?: string } | undefined;
      await act(async () => {
        resposta = await result.current.login("  dono@arena.com ", "senhaForte1");
      });

      expect(resposta).toEqual({ success: true });
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "dono@arena.com",
        password: "senhaForte1",
      });
      expect(result.current.autenticado).toBe(true);
      expect(result.current.role).toBe("proprietario");
      expect(result.current.arenaId).toBe("arena-1");
      expect(result.current.user).toEqual(USUARIO);
    });

    it("rejeita a senha estática legada admin123 sem sequer aceitar o formato antigo", async () => {
      mocks.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials", status: 400 },
      });
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      let resposta: { success: boolean; error?: string } | undefined;
      await act(async () => {
        resposta = await result.current.login("dono@arena.com", "admin123");
      });

      expect(resposta).toEqual({ success: false, error: MSG_CREDENCIAIS_INVALIDAS });
      expect(result.current.autenticado).toBe(false);
    });

    it("nega acesso e encerra a sessão quando o usuário pertence a outra arena", async () => {
      mocks.vinculos = { data: [vinculo("arena-a")], error: null };
      const { result } = renderHook(() => useAdminAuth("arena-b"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      let resposta: { success: boolean; error?: string } | undefined;
      await act(async () => {
        resposta = await result.current.login("dono@arena.com", "senhaForte1");
      });

      expect(resposta).toEqual({ success: false, error: MSG_ACESSO_NAO_AUTORIZADO });
      expect(MSG_ACESSO_NAO_AUTORIZADO).toBe("Acesso não autorizado para esta arena.");
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
      expect(result.current.autenticado).toBe(false);
      expect(result.current.role).toBeNull();
    });

    it("escolhe o vínculo correto quando o usuário opera várias arenas", async () => {
      mocks.vinculos = {
        data: [vinculo("arena-a", "operador", "id-a"), vinculo("arena-b", "gerente", "id-b")],
        error: null,
      };
      const { result } = renderHook(() => useAdminAuth("arena-b"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      await act(async () => {
        await result.current.login("dono@arena.com", "senhaForte1");
      });

      expect(result.current.role).toBe("gerente");
      expect(result.current.arenaId).toBe("id-b");
    });

    it("aceita o relacionamento arenas devolvido como array pelo PostgREST", async () => {
      mocks.vinculos = {
        data: [{ role: "operador", ativo: true, arena_id: "id-a", arenas: [{ slug: "arena-a" }] }],
        error: null,
      };
      const { result } = renderHook(() => useAdminAuth("arena-a"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      await act(async () => {
        await result.current.login("op@arena.com", "senhaForte1");
      });

      expect(result.current.autenticado).toBe(true);
      expect(result.current.role).toBe("operador");
    });

    it("ignora vínculos inativos", async () => {
      mocks.vinculos = {
        data: [{ role: "operador", ativo: false, arena_id: "id-a", arenas: { slug: "arena-a" } }],
        error: null,
      };
      const { result } = renderHook(() => useAdminAuth("arena-a"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      let resposta: { success: boolean; error?: string } | undefined;
      await act(async () => {
        resposta = await result.current.login("op@arena.com", "senhaForte1");
      });

      expect(resposta?.success).toBe(false);
      expect(resposta?.error).toBe(MSG_ACESSO_NAO_AUTORIZADO);
    });

    it("retorna mensagem genérica e encerra a sessão se a consulta de vínculo falhar", async () => {
      vi.spyOn(console, "error").mockImplementation(() => { });
      mocks.vinculos = { data: [], error: { message: "falha de rede" } };
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      let resposta: { success: boolean; error?: string } | undefined;
      await act(async () => {
        resposta = await result.current.login("dono@arena.com", "senhaForte1");
      });

      expect(resposta).toEqual({ success: false, error: MSG_FALHA_GENERICA });
      expect(mocks.signOut).toHaveBeenCalled();
      expect(result.current.autenticado).toBe(false);
    });

    it("traduz erros específicos do Supabase Auth", async () => {
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      mocks.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Email not confirmed", status: 400 },
      });
      let r1: { success: boolean; error?: string } | undefined;
      await act(async () => {
        r1 = await result.current.login("a@a.com", "x");
      });
      expect(r1?.error).toBe("E-mail ainda não confirmado.");

      mocks.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "too many", status: 429 },
      });
      let r2: { success: boolean; error?: string } | undefined;
      await act(async () => {
        r2 = await result.current.login("a@a.com", "x");
      });
      expect(r2?.error).toMatch(/Muitas tentativas/);

      mocks.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "boom", status: 500 },
      });
      let r3: { success: boolean; error?: string } | undefined;
      await act(async () => {
        r3 = await result.current.login("a@a.com", "x");
      });
      expect(r3?.error).toBe(MSG_FALHA_GENERICA);
    });

    it("informa indisponibilidade quando o Supabase não está configurado", async () => {
      mocks.configurado = false;
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      let resposta: { success: boolean; error?: string } | undefined;
      await act(async () => {
        resposta = await result.current.login("dono@arena.com", "senhaForte1");
      });

      expect(resposta).toEqual({ success: false, error: MSG_SUPABASE_INDISPONIVEL });
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    });

    it("nunca grava senha ou flag de autenticação no localStorage", async () => {
      mocks.vinculos = { data: [vinculo("Central")], error: null };
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(false));

      await act(async () => {
        await result.current.login("dono@arena.com", "senhaForte1");
      });

      expect(result.current.autenticado).toBe(true);
      expect(localStorage.length).toBe(0);
      expect(localStorage.getItem("reservei_admin_auth")).toBeNull();
    });
  });

  describe("logout", () => {
    it("encerra a sessão no Supabase e reseta o estado", async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });
      mocks.vinculos = { data: [vinculo("Central")], error: null };
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(true));

      await act(async () => {
        await result.current.logout();
      });

      expect(mocks.signOut).toHaveBeenCalledTimes(1);
      expect(result.current.autenticado).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.arenaId).toBeNull();
    });

    it("reseta o estado mesmo se o signOut do Supabase falhar", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => { });
      mocks.getSession.mockResolvedValue({ data: { session: { user: USUARIO } } });
      mocks.vinculos = { data: [vinculo("Central")], error: null };
      mocks.signOut.mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useAdminAuth("Central"));
      await waitFor(() => expect(result.current.autenticado).toBe(true));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.autenticado).toBe(false);
    });
  });
});
