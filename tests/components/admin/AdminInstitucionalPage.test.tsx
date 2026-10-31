import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminInstitucionalPage } from "@/components/admin/AdminInstitucionalPage";

describe("AdminInstitucionalPage - Painel de Gestão", () => {
  it("renderiza o título, a galeria e avisa que as escolinhas ficam no menu Escolinhas", async () => {
    render(<AdminInstitucionalPage />);
    expect(await screen.findByRole("heading", { name: "Conteúdo Institucional" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Galeria do Complexo/i })).toBeInTheDocument();
    expect(screen.getByText(/As escolinhas ficam no menu Escolinhas/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Escolinhas do site/i })).not.toBeInTheDocument();
  });

  it("abre o modal de nova foto ao clicar em Adicionar Foto", async () => {
    render(<AdminInstitucionalPage />);
    const btnNovaFoto = await screen.findByRole("button", { name: /Adicionar Foto/i });
    fireEvent.click(btnNovaFoto);

    expect(screen.getByRole("heading", { name: "Nova Foto da Estrutura" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Nossas Quadras de Saibro")).toBeInTheDocument();
  });
});
