/**
 * @file AdminConfiguracoesPage.test.tsx
 * @description Testes unitários para o painel de configurações gerais da arena.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminConfiguracoesPage } from "@/components/admin/AdminConfiguracoesPage";

describe("AdminConfiguracoesPage - Painel de Configurações da Arena", () => {
  it("renderiza o título da página e as seções de configuração", async () => {
    render(<AdminConfiguracoesPage />);

    expect(
      await screen.findByRole("heading", { name: "Configurações da Arena" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Identificação Comercial & Subdomínio/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Contatos & Localização Física/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Horários Operacionais & Sinal Financeiro/i)
    ).toBeInTheDocument();
  });

  it("exibe a URL pública do subdomínio e botão de cópia", async () => {
    render(<AdminConfiguracoesPage />);

    expect(
      await screen.findByText(/Endereço Público Oficial da Arena/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copiar Link/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Acessar Portal/i })
    ).toBeInTheDocument();
  });

  it("renderiza o botão de salvar alterações", async () => {
    render(<AdminConfiguracoesPage />);

    expect(
      await screen.findByRole("button", { name: /Salvar Configurações da Arena/i })
    ).toBeInTheDocument();
  });
});
