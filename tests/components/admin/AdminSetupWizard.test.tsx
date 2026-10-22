/**
 * @file AdminSetupWizard.test.tsx
 * @description Testes do Setup Wizard (criação do primeiro administrador via token de convite).
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useArena", () => ({
  useArena: () => ({ arena: { slug: "central", nome: "Arena Central" } }),
}));

import { AdminSetupWizard } from "@/components/admin/AdminSetupWizard";

function renderizar(
  onSetupConcluido = vi.fn(),
  { token = "tok-1" as string | null, tokenValido = true } = {}
) {
  return render(
    <AdminSetupWizard
      arenaSlug="central"
      onSetupConcluido={onSetupConcluido}
      token={token}
      tokenValido={tokenValido}
    />
  );
}

function preencher(senha = "senhaForte1", confirmacao = "senhaForte1") {
  fireEvent.change(screen.getByLabelText("Nome Completo"), { target: { value: "Maria Dona" } });
  fireEvent.change(screen.getByLabelText("E-mail Profissional"), { target: { value: "maria@arena.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
  fireEvent.change(screen.getByLabelText("Confirmar Senha"), { target: { value: confirmacao } });
}

const enviar = () =>
  fireEvent.click(screen.getByRole("button", { name: "Criar Administrador e Acessar Painel" }));

describe("AdminSetupWizard", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("sem convite válido", () => {
    it("bloqueia o formulário e exibe Acesso Restrito quando não há token na URL", () => {
      renderizar(vi.fn(), { token: null, tokenValido: false });

      expect(screen.getByRole("heading")).toHaveTextContent("Acesso Restrito · Arena Central");
      expect(screen.getByText(/link de convite exclusivo/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Nome Completo")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Criar Administrador/ })).not.toBeInTheDocument();
    });

    it("bloqueia o formulário quando o servidor considera o token inválido", () => {
      renderizar(vi.fn(), { token: "token-vencido", tokenValido: false });

      expect(screen.getByRole("heading")).toHaveTextContent("Acesso Restrito");
      expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    });

    it("não aceita token apenas presente: exige a validação do servidor", () => {
      renderizar(vi.fn(), { token: "tok-1", tokenValido: false });

      expect(screen.queryByLabelText("Nome Completo")).not.toBeInTheDocument();
    });
  });

  describe("com convite válido", () => {
    it("exibe cabeçalho com o nome da arena, texto auxiliar e os quatro campos", () => {
      renderizar();

      expect(screen.getByRole("heading")).toHaveTextContent(
        "Configuração Inicial do Administrador · Arena Central"
      );
      expect(screen.getByText(/ainda não possui uma conta de proprietário/)).toBeInTheDocument();
      for (const rotulo of ["Nome Completo", "E-mail Profissional", "Senha", "Confirmar Senha"]) {
        expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
      }
    });

    it("cria o administrador enviando o token e autentica automaticamente em seguida", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
      const onSetupConcluido = vi.fn().mockResolvedValue({ success: true });
      renderizar(onSetupConcluido);

      preencher();
      enviar();

      await waitFor(() =>
        expect(onSetupConcluido).toHaveBeenCalledWith("maria@arena.com", "senhaForte1")
      );
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/admin/setup");
      expect(JSON.parse(init.body)).toEqual({
        arenaSlug: "central",
        token: "tok-1",
        nome: "Maria Dona",
        email: "maria@arena.com",
        senha: "senhaForte1",
      });
    });

    it("bloqueia o envio quando as senhas não conferem", async () => {
      renderizar();

      preencher("senhaForte1", "outraSenha1");
      enviar();

      expect(await screen.findByRole("alert")).toHaveTextContent("As senhas não conferem.");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("bloqueia o envio de senha curta", async () => {
      renderizar();

      preencher("123", "123");
      enviar();

      expect(await screen.findByRole("alert")).toHaveTextContent(/ao menos 6 caracteres/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("exibe o erro do servidor (ex.: token já utilizado) e não tenta logar", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Token de convite inválido ou expirado" }),
      });
      const onSetupConcluido = vi.fn();
      renderizar(onSetupConcluido);

      preencher();
      enviar();

      expect(await screen.findByRole("alert")).toHaveTextContent("Token de convite inválido ou expirado");
      expect(onSetupConcluido).not.toHaveBeenCalled();
    });

    it("exibe mensagem quando o login automático falha após a criação", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
      const onSetupConcluido = vi.fn().mockResolvedValue({ success: false, error: "Falha ao entrar." });
      renderizar(onSetupConcluido);

      preencher();
      enviar();

      expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao entrar.");
    });

    it("exibe mensagem de falha de conexão", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      renderizar();

      preencher();
      enviar();

      expect(await screen.findByRole("alert")).toHaveTextContent(/Falha de conexão/);
    });
  });
});
