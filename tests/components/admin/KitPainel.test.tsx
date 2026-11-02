/**
 * @file KitPainel.test.tsx
 * @description Componentes base do painel (`components/admin/ui`): abas sem rolagem vertical e com a
 * aba ativa marcada; botões no tamanho de toque da SPEC de ajustes da demonstração.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §1 e §2
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Abas, Botao } from "@/components/admin/ui";

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
