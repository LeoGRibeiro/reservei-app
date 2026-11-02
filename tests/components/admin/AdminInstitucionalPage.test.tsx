/**
 * @file AdminInstitucionalPage.test.tsx
 * @description Tela Site (SPEC/2026-11-02-admin-ajustes-demo.md §9): dois blocos (Fotos da estrutura e
 * "Na arena"), sem categoria nem descrição; quais fotos aparecem no site; tópicos editáveis com prévia;
 * janela de foto fecha com Esc; erro de envio aparece na janela.
 */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminInstitucionalPage } from "@/components/admin/AdminInstitucionalPage";
import { FOTOS_ESTRUTURA, FotosEstrutura, fotosNoSite, validarLegenda } from "@/components/admin/site/FotosEstrutura";
import { NaArena } from "@/components/admin/site/NaArena";
import { FOTOS_ESTRUTURA as FOTOS_NO_PORTAL } from "@/lib/portal/portalRepository";
import type { GaleriaItem } from "@/lib/institucional/types";

const foto = (id: string, ordem: number, ativa = true): GaleriaItem => ({
  id,
  imageUrl: `https://cdn/${id}.jpg`,
  title: `Foto ${id}`,
  description: `Foto ${id}`,
  categoria: "quadras",
  displayOrder: ordem,
  isActive: ativa,
  createdAt: "",
});

describe("AdminInstitucionalPage", () => {
  it("tem só os dois blocos do site, sem categoria", async () => {
    render(<AdminInstitucionalPage />);
    expect(await screen.findByRole("heading", { name: "Site", level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Fotos da estrutura" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Na arena" })).toBeInTheDocument();
    expect(screen.queryByText(/Categoria/i)).not.toBeInTheDocument();
  });

  it("a janela de nova foto não pede categoria nem descrição e fecha com Esc", async () => {
    render(<AdminInstitucionalPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Adicionar foto/i }));
    const janela = screen.getByRole("dialog", { name: "Nova foto da estrutura" });
    expect(within(janela).getByLabelText("Legenda no site")).toBeInTheDocument();
    expect(within(janela).queryByLabelText(/Categoria|Descrição/)).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("FotosEstrutura", () => {
  it("o site mostra as 4 primeiras visíveis, na ordem (mesmo número do portal)", () => {
    expect(FOTOS_ESTRUTURA).toBe(FOTOS_NO_PORTAL);
    const fotos = [foto("a", 5), foto("b", 1), foto("c", 2, false), foto("d", 3), foto("e", 4), foto("f", 6)];
    expect([...fotosNoSite(fotos)]).toEqual(["b", "d", "e", "a"]);
  });

  it("marca No site, Fora do site e Oculta", () => {
    const fotos = [foto("a", 1), foto("b", 2), foto("c", 3), foto("d", 4), foto("e", 5), foto("f", 6, false)];
    render(<FotosEstrutura fotos={fotos} aoEnviarImagem={vi.fn()} aoCriar={vi.fn()} aoAtualizar={vi.fn()} aoExcluir={vi.fn()} />);
    expect(within(screen.getByRole("listitem", { name: "Foto a" })).getByText("No site")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Foto e" })).getByText("Fora do site")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Foto f" })).getByText("Oculta")).toBeInTheDocument();
  });

  it("ocultar e reordenar gravam pela ação certa", async () => {
    const aoAtualizar = vi.fn().mockResolvedValue(undefined);
    render(<FotosEstrutura fotos={[foto("a", 1), foto("b", 2)]} aoEnviarImagem={vi.fn()} aoCriar={vi.fn()} aoAtualizar={aoAtualizar} aoExcluir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar Foto a" }));
    await vi.waitFor(() => expect(aoAtualizar).toHaveBeenCalledWith("a", { visivel: false }));
    fireEvent.click(screen.getByRole("button", { name: "Mover Foto b para antes" }));
    await vi.waitFor(() => expect(aoAtualizar).toHaveBeenCalledWith("b", { ordem: 1 }));
    expect(aoAtualizar).toHaveBeenCalledWith("a", { ordem: 2 });
  });

  it("envia a foto, pede legenda e cria", async () => {
    const aoCriar = vi.fn().mockResolvedValue(undefined);
    const aoEnviarImagem = vi.fn().mockResolvedValue({ success: true, url: "https://cdn/nova.jpg" });
    render(<FotosEstrutura fotos={[foto("a", 3)]} aoEnviarImagem={aoEnviarImagem} aoCriar={aoCriar} aoAtualizar={vi.fn()} aoExcluir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar foto/ }));
    fireEvent.change(screen.getByLabelText("Escolher foto da estrutura"), { target: { files: [new File(["x"], "f.jpg", { type: "image/jpeg" })] } });
    await screen.findByRole("img", { name: "Prévia" });
    fireEvent.click(screen.getByRole("button", { name: "Salvar foto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escreva uma legenda curta");
    fireEvent.change(screen.getByLabelText("Legenda no site"), { target: { value: "Bar e lanchonete" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar foto" }));
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith({ imageUrl: "https://cdn/nova.jpg", legenda: "Bar e lanchonete", ordem: 4 }));
  });

  it("erro no envio aparece na janela com a orientação", async () => {
    const aoEnviarImagem = vi.fn().mockResolvedValue({ success: false, error: "Formato não aceito. Envie JPG, PNG ou WebP." });
    render(<FotosEstrutura fotos={[]} aoEnviarImagem={aoEnviarImagem} aoCriar={vi.fn()} aoAtualizar={vi.fn()} aoExcluir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar foto/ }));
    fireEvent.change(screen.getByLabelText("Escolher foto da estrutura"), { target: { files: [new File(["x"], "f.heic", { type: "image/heic" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Formato não aceito");
  });

  it("legenda curta obrigatória", () => {
    expect(validarLegenda(" ")).not.toBeNull();
    expect(validarLegenda("x".repeat(41))).not.toBeNull();
    expect(validarLegenda("Quadras de areia")).toBeNull();
  });
});

describe("NaArena", () => {
  const inicial = [
    { destaque: "3 quadras de areia", resto: "tratada" },
    { destaque: "Iluminação de LED", resto: "em todas as quadras" },
  ];

  it("edita, reordena, adiciona e salva; a prévia mostra como no site", async () => {
    const aoSalvar = vi.fn().mockResolvedValue(undefined);
    render(<NaArena inicial={inicial} aoSalvar={aoSalvar} />);
    expect(screen.getByRole("button", { name: "Salvar tópicos" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tópico 1: complemento"), { target: { value: "tratada e peneirada" } });
    fireEvent.click(screen.getByRole("button", { name: "Descer tópico 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tópico" }));
    fireEvent.change(screen.getByLabelText("Tópico 3: parte em negrito"), { target: { value: "Estacionamento" } });
    expect(screen.getByLabelText("Prévia no site")).toHaveTextContent("Estacionamento");
    fireEvent.click(screen.getByRole("button", { name: "Salvar tópicos" }));
    await vi.waitFor(() =>
      expect(aoSalvar).toHaveBeenCalledWith([
        { destaque: "Iluminação de LED", resto: "em todas as quadras" },
        { destaque: "3 quadras de areia", resto: "tratada e peneirada" },
        { destaque: "Estacionamento", resto: "" },
      ])
    );
  });

  it("não salva tópico sem a parte em negrito", () => {
    const aoSalvar = vi.fn();
    render(<NaArena inicial={inicial} aoSalvar={aoSalvar} />);
    fireEvent.change(screen.getByLabelText("Tópico 2: parte em negrito"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tópicos" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tópico 2: escreva a parte em negrito.");
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("excluir tópico", async () => {
    const aoSalvar = vi.fn().mockResolvedValue(undefined);
    render(<NaArena inicial={inicial} aoSalvar={aoSalvar} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir tópico 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar tópicos" }));
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith([{ destaque: "Iluminação de LED", resto: "em todas as quadras" }]));
  });
});
