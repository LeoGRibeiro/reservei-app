import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminInstitucionalPage } from "@/components/admin/AdminInstitucionalPage";

describe("AdminInstitucionalPage - Painel de Gestão", () => {
  it("renderiza o título da página e as abas Galeria e Escolinhas", async () => {
    render(<AdminInstitucionalPage />);
    const heading = await screen.findByRole("heading", { name: "Conteúdo Institucional" });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Galeria do Complexo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Escolinhas do site/i })).toBeInTheDocument();
  });

  it("abre a aba de escolinhas ao clicar no botão correspondente", async () => {
    render(<AdminInstitucionalPage />);
    const abaEscolinhas = await screen.findByRole("button", { name: /Escolinhas do site/i });
    fireEvent.click(abaEscolinhas);

    expect(screen.getByText(/aparecem na seção/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nova escolinha/i })).toBeInTheDocument();
  });

  it("abre o modal de nova foto ao clicar em Adicionar Foto", async () => {
    render(<AdminInstitucionalPage />);
    const btnNovaFoto = await screen.findByRole("button", { name: /Adicionar Foto/i });
    fireEvent.click(btnNovaFoto);

    expect(screen.getByRole("heading", { name: "Nova Foto da Estrutura" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Nossas Quadras de Saibro")).toBeInTheDocument();
  });

  it("abre o formulário de nova escolinha com as explicações do botão", async () => {
    render(<AdminInstitucionalPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Escolinhas do site/i }));
    fireEvent.click(screen.getByRole("button", { name: /Nova escolinha/i }));

    expect(screen.getByRole("heading", { name: "Nova escolinha" })).toBeInTheDocument();
    expect(screen.getByLabelText("Esporte *")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Abrir o WhatsApp/ })).toBeChecked();
    expect((screen.getByLabelText("Mensagem pronta") as HTMLTextAreaElement).value).toContain("Vim pelo site e quero uma vaga");
  });
});
