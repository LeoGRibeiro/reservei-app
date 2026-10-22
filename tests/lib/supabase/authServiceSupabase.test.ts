/**
 * @file authServiceSupabase.test.ts
 * @description Testes do authService de atletas ancorado no Supabase Auth (WhatsApp mapeado
 * para e-mail sintético). O cliente Supabase é um dublê controlável (sem rede).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  insert: vi.fn(),
  selectEq: vi.fn(),
  tabela: "",
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
    },
    from: (tabela: string) => {
      mocks.tabela = tabela;
      return {
        insert: (linhas: unknown) => ({
          select: () => ({ single: () => mocks.insert(linhas) }),
        }),
        select: () => ({
          eq: () => ({ maybeSingle: () => mocks.selectEq() }),
        }),
      };
    },
  },
}));

import {
  cadastrarUsuarioSupabase,
  loginUsuarioSupabase,
  obterUsuarioAtual,
} from "@/lib/supabase/authService";

const AUTH_USER = { id: "11111111-1111-1111-1111-111111111111", user_metadata: { nome: "Ana Lima" } };
const LINHA_USUARIO = {
  id: AUTH_USER.id,
  nome: "Ana Lima",
  telefone: "91981234567",
  data_nascimento: null,
  criado_em: "2026-10-21T10:00:00Z",
  bloqueado: false,
  motivo_bloqueio: null,
};

describe("authService - Supabase Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({ data: { session: { user: AUTH_USER } } });
    mocks.signUp.mockResolvedValue({ data: { user: AUTH_USER, session: {} }, error: null });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: AUTH_USER, session: {} }, error: null });
    mocks.insert.mockResolvedValue({ data: LINHA_USUARIO, error: null });
    mocks.selectEq.mockResolvedValue({ data: LINHA_USUARIO, error: null });
  });

  describe("cadastro (via servidor)", () => {
    const fetchMock = vi.fn();
    const resposta = (status: number, corpo: unknown) => ({ ok: status < 300, status, json: async () => corpo });

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
      fetchMock.mockResolvedValue(resposta(201, { sucesso: true }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("cria a conta pela rota do servidor (sem signUp público) e entra com o e-mail sintético", async () => {
      const res = await cadastrarUsuarioSupabase("Ana Lima", "(91) 98123-4567", "SenhaSecreta99", "1990-05-10");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/atletas/cadastro");
      expect(JSON.parse(init.body)).toEqual({
        nome: "Ana Lima",
        telefone: "91981234567",
        senha: "SenhaSecreta99",
        dataNascimento: "1990-05-10",
        aceiteTermos: true,
      });
      expect(mocks.signUp).not.toHaveBeenCalled();
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "91981234567@auth.reservei.com.br",
        password: "SenhaSecreta99",
      });
      expect(res.user?.id).toBe(AUTH_USER.id);
      expect(res.user?.telefone).toBe("(91) 98123-4567");
    });

    it("não persiste a senha no localStorage", async () => {
      await cadastrarUsuarioSupabase("Ana Lima", "91981234567", "SenhaSecreta99");

      expect(JSON.stringify({ ...localStorage })).not.toContain("SenhaSecreta99");
    });

    it("retorna erro amigável quando o WhatsApp já tem conta (409)", async () => {
      fetchMock.mockResolvedValue(resposta(409, { sucesso: false, erro: "duplicado" }));

      const res = await cadastrarUsuarioSupabase("Ana", "91981234567", "SenhaSecreta99");

      expect(res.user).toBeNull();
      expect(res.error).toBe("Este número de WhatsApp já possui uma conta cadastrada.");
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    });

    it("repassa a regra de validação violada (400)", async () => {
      fetchMock.mockResolvedValue(resposta(400, { sucesso: false, erro: "A senha deve conter ao menos uma letra maiúscula (A-Z)." }));

      const res = await cadastrarUsuarioSupabase("Ana", "91981234567", "fraca");

      expect(res.user).toBeNull();
      expect(res.error).toMatch(/maiúscula/);
    });

    it("falha de forma segura (sem fallback local) quando o servidor erra", async () => {
      fetchMock.mockResolvedValue(resposta(500, { sucesso: false }));

      const res = await cadastrarUsuarioSupabase("Ana", "91981234567", "SenhaSecreta99");

      expect(res.user).toBeNull();
      expect(localStorage.getItem("reservei_users_db")).toBeNull();
      expect(localStorage.getItem("reservei_current_user")).toBeNull();
    });

    it("trata exceções de rede com mensagem genérica", async () => {
      fetchMock.mockRejectedValue(new Error("network"));

      const res = await cadastrarUsuarioSupabase("Ana", "91981234567", "SenhaSecreta99");

      expect(res.user).toBeNull();
      expect(res.error).toBeTruthy();
    });
  });

  describe("login", () => {
    it("autentica via Supabase Auth com o e-mail sintético e carrega o perfil", async () => {
      const res = await loginUsuarioSupabase("(91) 98123-4567", "SenhaSecreta99");

      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "91981234567@auth.reservei.com.br",
        password: "SenhaSecreta99",
      });
      expect(res.user?.nome).toBe("Ana Lima");
      expect(JSON.parse(localStorage.getItem("reservei_current_user") ?? "{}").id).toBe(AUTH_USER.id);
      expect(JSON.stringify({ ...localStorage })).not.toContain("SenhaSecreta99");
    });

    it("retorna 'WhatsApp ou senha incorretos.' para credenciais inválidas", async () => {
      mocks.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });

      const res = await loginUsuarioSupabase("91981234567", "errada");

      expect(res.user).toBeNull();
      expect(res.error).toBe("WhatsApp ou senha incorretos.");
    });

    it("não cai em autenticação local quando o Supabase está configurado", async () => {
      localStorage.setItem(
        "reservei_users_db",
        JSON.stringify([{ id: "usr_x", nome: "X", telefone: "91981234567", senha: "errada" }])
      );
      mocks.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      });

      const res = await loginUsuarioSupabase("91981234567", "errada");

      expect(res.user).toBeNull();
    });

    it("recria o perfil quando a identidade existe no Auth mas não em usuarios", async () => {
      mocks.selectEq.mockResolvedValue({ data: null, error: null });

      const res = await loginUsuarioSupabase("91981234567", "SenhaSecreta99");

      const linhas = mocks.insert.mock.calls[0][0] as Record<string, unknown>[];
      expect(linhas[0]).toMatchObject({
        id: AUTH_USER.id,
        auth_user_id: AUTH_USER.id,
        nome: "Ana Lima",
        telefone: "91981234567",
      });
      expect(res.user?.id).toBe(AUTH_USER.id);
    });

    it("encerra a sessão se o perfil não puder ser recriado", async () => {
      mocks.selectEq.mockResolvedValue({ data: null, error: null });
      mocks.insert.mockResolvedValue({ data: null, error: { message: "rls" } });

      const res = await loginUsuarioSupabase("91981234567", "SenhaSecreta99");

      expect(res.user).toBeNull();
      expect(mocks.signOut).toHaveBeenCalled();
    });

    it("trata exceções de rede com mensagem genérica", async () => {
      mocks.signInWithPassword.mockRejectedValue(new Error("network"));

      const res = await loginUsuarioSupabase("91981234567", "SenhaSecreta99");

      expect(res.user).toBeNull();
      expect(res.error).toBeTruthy();
    });
  });

  describe("sessão atual", () => {
    it("descarta o cache local quando a sessão do Supabase não existe mais", async () => {
      localStorage.setItem("reservei_current_user", JSON.stringify({ id: AUTH_USER.id, nome: "Ana", telefone: "(91) 98123-4567" }));
      mocks.getSession.mockResolvedValue({ data: { session: null } });

      const usuario = await obterUsuarioAtual();

      expect(usuario).toBeNull();
      expect(localStorage.getItem("reservei_current_user")).toBeNull();
    });

    it("sincroniza o perfil com o banco quando a sessão está ativa", async () => {
      localStorage.setItem("reservei_current_user", JSON.stringify({ id: AUTH_USER.id, nome: "Antigo", telefone: "(91) 98123-4567" }));

      const usuario = await obterUsuarioAtual();

      expect(usuario?.nome).toBe("Ana Lima");
    });
  });
});
