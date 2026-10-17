/**
 * @file AdminQuadrasPage.test.tsx
 * @description Testes unitários para o painel de gestão de quadras e tarifas no admin.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminQuadrasPage } from "@/components/admin/AdminQuadrasPage";

describe("AdminQuadrasPage - Painel de Gestão de Quadras e Tarifas", () => {
  it("renderiza o cabeçalho da página e o botão de Nova Quadra", async () => {
    render(<AdminQuadrasPage />);

    expect(
      await screen.findByRole("heading", { name: /Gestão de Quadras & Tarifas/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Nova Quadra/i })
    ).toBeInTheDocument();
  });

  it("renderiza os cards das quadras padrão", async () => {
    render(<AdminQuadrasPage />);

    expect(await screen.findByText("Quadra 1 - Poliesportiva")).toBeInTheDocument();
    expect(screen.getByText("Quadra 2 - Poliesportiva")).toBeInTheDocument();
    expect(screen.getByText("Quadra 3 - Poliesportiva")).toBeInTheDocument();
  });

  it("abre o modal de nova quadra ao clicar em Nova Quadra", async () => {
    render(<AdminQuadrasPage />);

    const btnNovaQuadra = await screen.findByRole("button", { name: /Nova Quadra/i });
    fireEvent.click(btnNovaQuadra);

    expect(screen.getByRole("heading", { name: "Cadastrar Nova Quadra" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Quadra 1 (Areia Central)")).toBeInTheDocument();
  });

  it("abre o modal de tarifa especial ao clicar em Adicionar Tarifa em uma quadra", async () => {
    render(<AdminQuadrasPage />);

    const botoesAddTarifa = await screen.findAllByRole("button", { name: /Adicionar Tarifa/i });
    expect(botoesAddTarifa.length).toBeGreaterThan(0);

    fireEvent.click(botoesAddTarifa[0]);
    expect(screen.getByRole("heading", { name: "Adicionar Tarifa Especial" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Tarifa Noturna com Luz")).toBeInTheDocument();
  });
});
