/**
 * @file KitPainel.test.tsx
 * @description Componentes base do painel (`components/admin/ui`): abas sem rolagem vertical e com a
 * aba ativa marcada; botões no tamanho de toque da SPEC de ajustes da demonstração.
 *
 * Janelas fecham com Esc e com clique no fundo (item 6).
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §1, §2 e §6
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Abas, Botao, Confirmacao, Janela } from "@/components/admin/ui";

describe("Abas", () => {
  const itens = [
    { id: "dia", rotulo: "Dia" },
    { id: "mes", rotulo: "Mês" },
  ];

  it("não usa margem negativa (causa da barra de rolagem vertical) e esconde a barra no celular", () => {
    render(<Abas rotulo="Visão" itens={itens} ativa="dia" aoTrocar={() => undefined} />);
    const barra = screen.getByRole("navigation", { name: "Visão" });
    expect(barra.className).toContain("overflow-y-hidden");
    expect(barra.className).toContain("scrollbar-hide");
    expect(barra.className).toContain("md:overflow-hidden");
    for (const botao of screen.getAllByRole("button")) {
      expect(botao.className).not.toContain("-mb-px");
    }
  });

  it("marca a aba ativa e avisa a troca", () => {
    const aoTrocar = vi.fn();
    render(<Abas rotulo="Visão" itens={itens} ativa="dia" aoTrocar={aoTrocar} />);
    expect(screen.getByRole("button", { name: "Dia" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(aoTrocar).toHaveBeenCalledWith("mes");
  });

  it("aceita classe extra (ex.: sem margem quando fica ao lado de outros controles)", () => {
    render(<Abas rotulo="Visão" itens={itens} ativa="dia" className="mb-0" />);
    expect(screen.getByRole("navigation", { name: "Visão" }).className).toContain("mb-0");
  });

  it("com href, cada aba vira link e a atual recebe aria-current", () => {
    render(<Abas rotulo="Telas" itens={[{ id: "a", rotulo: "A", href: "/a" }, { id: "b", rotulo: "B", href: "/b" }]} ativa="b" />);
    expect(screen.getByRole("link", { name: "B" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "A" })).not.toHaveAttribute("aria-current");
  });
});

describe("Botao", () => {
  it("botão primário tem 40px de altura (h-10)", () => {
    render(<Botao>Salvar</Botao>);
    expect(screen.getByRole("button", { name: "Salvar" }).className).toContain("h-10");
  });
});

describe("Janela", () => {
  it("fecha com Esc", () => {
    const aoFechar = vi.fn();
    render(
      <Janela aberta titulo="Teste" aoFechar={aoFechar}>
        conteúdo
      </Janela>
    );
    expect(screen.getByRole("dialog", { name: "Teste" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("fecha no clique do fundo, mas não no clique dentro", () => {
    const aoFechar = vi.fn();
    render(
      <Janela aberta titulo="Teste" aoFechar={aoFechar}>
        <p>conteúdo</p>
      </Janela>
    );
    fireEvent.mouseDown(screen.getByText("conteúdo"));
    expect(aoFechar).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!.parentElement!);
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("outras teclas não fecham", () => {
    const aoFechar = vi.fn();
    render(
      <Janela aberta titulo="Teste" aoFechar={aoFechar}>
        conteúdo
      </Janela>
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("Confirmacao também fecha com Esc", () => {
    const aoFechar = vi.fn();
    render(<Confirmacao aberta titulo="Cancelar?" rotuloConfirmar="Sim" aoConfirmar={vi.fn()} aoFechar={aoFechar} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
