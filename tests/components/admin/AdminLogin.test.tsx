/**
 * @file AdminLogin.test.tsx
 * @description Testes da tela de login administrativo (e-mail + senha, arena acessada, erros).
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useArena", () => ({
  useArena: (slug: string) => ({
    arena: {
      slug: slug === "Central" ? "Central" : "arena-demo",
      nome: slug === "Central" ? "Arena Central" : "Arena Reservei Demo",
    },
  }),
}));

import { AdminLogin } from "@/components/admin/AdminLogin";

function preencher(email: string, senha: string) {
  fireEvent.change(screen.getByLabelText("E-mail corporativo"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
}

describe("AdminLogin", () => {
  it("exibe campos de e-mail corporativo e senha e o nome da arena acessada", () => {
    render(<AdminLogin onLogin={vi.fn()} arenaSlug="Central" />);

    expect(screen.getByLabelText("E-mail corporativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByText(/Arena Central/)).toBeInTheDocument();
  });

  it("exibe o slug quando a arena do subdomínio não foi encontrada", () => {
    render(<AdminLogin onLogin={vi.fn()} arenaSlug="inexistente" />);

    expect(screen.getByText(/inexistente/)).toBeInTheDocument();
  });

  it("mantém o botão desabilitado até e-mail e senha serem preenchidos", () => {
    render(<AdminLogin onLogin={vi.fn()} arenaSlug="Central" />);
    const botao = screen.getByRole("button", { name: "Entrar" });

    expect(botao).toBeDisabled();
    preencher("dono@arena.com", "");
    expect(botao).toBeDisabled();
    preencher("dono@arena.com", "segredo");
    expect(botao).toBeEnabled();
  });

  it("envia e-mail e senha para onLogin", async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: true });
    render(<AdminLogin onLogin={onLogin} arenaSlug="Central" />);

    preencher("dono@arena.com", "segredo");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith("dono@arena.com", "segredo"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exibe a mensagem de erro retornada e limpa a senha", async () => {
    const onLogin = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Acesso não autorizado para esta arena." });
    render(<AdminLogin onLogin={onLogin} arenaSlug="Central" />);

    preencher("dono@arena.com", "segredo");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Acesso não autorizado para esta arena."
    );
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("E-mail corporativo")).toHaveValue("dono@arena.com");
  });

  it("usa mensagem padrão quando o login falha sem detalhe", async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: false });
    render(<AdminLogin onLogin={onLogin} arenaSlug="Central" />);

    preencher("dono@arena.com", "segredo");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível autenticar/);
  });

  it("remove o erro ao editar os campos", async () => {
    const onLogin = vi.fn().mockResolvedValue({ success: false, error: "E-mail ou senha incorretos." });
    render(<AdminLogin onLogin={onLogin} arenaSlug="Central" />);

    preencher("dono@arena.com", "segredo");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("alert");

    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "outra" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("alterna a visibilidade da senha", () => {
    render(<AdminLogin onLogin={vi.fn()} arenaSlug="Central" />);
    const campo = screen.getByLabelText("Senha");

    expect(campo).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(campo).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(campo).toHaveAttribute("type", "password");
  });
});
