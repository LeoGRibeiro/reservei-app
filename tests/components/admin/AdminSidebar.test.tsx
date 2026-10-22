/**
 * @file AdminSidebar.test.tsx
 * @description Testes da modularidade (Feature Flags) na navegação do painel administrativo.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AdminSidebar,
  moduloDaView,
  viewDisponivel,
  type AdminView,
} from "@/components/admin/AdminSidebar";

function renderizar(modulosAtivos?: string[] | null, viewAtual: AdminView = "dashboard") {
  return render(
    <AdminSidebar
      viewAtual={viewAtual}
      onChangeView={vi.fn()}
      onLogout={vi.fn()}
      modulosAtivos={modulosAtivos}
    />
  );
}

// A sidebar renderiza o conteúdo duas vezes (desktop e drawer mobile); basta que exista ao menos um.
const temAba = (id: string) => document.querySelectorAll(`#admin-nav-${id}`).length > 0;

describe("AdminSidebar - módulos ativos", () => {
  it("exibe todas as abas quando a arena contratou todos os módulos", () => {
    renderizar(["fidelidade", "vagas", "escolinhas", "contratos"]);

    expect(temAba("fidelidade")).toBe(true);
    expect(temAba("escolinhas")).toBe(true);
    expect(temAba("grupos")).toBe(true);
  });

  it("oculta a aba de Fidelidade quando o módulo não está ativo", () => {
    renderizar(["escolinhas", "contratos"]);

    expect(temAba("fidelidade")).toBe(false);
    expect(temAba("escolinhas")).toBe(true);
    expect(temAba("grupos")).toBe(true);
  });

  it("oculta Escolinhas e Grupos (contratos) quando os módulos não estão ativos", () => {
    renderizar(["fidelidade"]);

    expect(temAba("escolinhas")).toBe(false);
    expect(temAba("grupos")).toBe(false);
    expect(temAba("fidelidade")).toBe(true);
  });

  it("sempre mantém as abas do core, mesmo sem nenhum módulo opcional", () => {
    renderizar([]);

    for (const id of ["dashboard", "agenda", "quadras", "usuarios", "financeiro", "configuracoes"]) {
      expect(temAba(id)).toBe(true);
    }
    expect(temAba("fidelidade")).toBe(false);
  });

  it("oculta módulos opcionais enquanto a lista de módulos é desconhecida", () => {
    renderizar(undefined);

    expect(temAba("fidelidade")).toBe(false);
    expect(temAba("dashboard")).toBe(true);
  });
});

describe("moduloDaView / viewDisponivel", () => {
  it("mapeia views de módulos opcionais para seus módulos", () => {
    expect(moduloDaView("fidelidade")).toBe("fidelidade");
    expect(moduloDaView("escolinhas")).toBe("escolinhas");
    expect(moduloDaView("grupos")).toBe("contratos");
    expect(moduloDaView("agenda")).toBeUndefined();
  });

  it("indica disponibilidade da view conforme os módulos ativos", () => {
    expect(viewDisponivel("fidelidade", ["fidelidade"])).toBe(true);
    expect(viewDisponivel("fidelidade", ["vagas"])).toBe(false);
    expect(viewDisponivel("fidelidade", undefined)).toBe(false);
    expect(viewDisponivel("agenda", undefined)).toBe(true);
  });
});

describe("AdminSidebar - papel do usuário", () => {
  const todos = ["fidelidade", "vagas", "escolinhas", "contratos"];

  it("operador não vê financeiro, quadras, pagamentos, equipe nem configurações", () => {
    render(
      <AdminSidebar viewAtual="agenda" onChangeView={vi.fn()} onLogout={vi.fn()} modulosAtivos={todos} role="operador" />
    );

    expect(temAba("agenda")).toBe(true);
    expect(temAba("usuarios")).toBe(true);
    for (const aba of ["financeiro", "quadras", "fidelidade", "pagamentos", "equipe", "configuracoes"]) {
      expect(temAba(aba)).toBe(false);
    }
  });

  it("proprietário vê pagamentos, equipe e configurações", () => {
    render(
      <AdminSidebar viewAtual="dashboard" onChangeView={vi.fn()} onLogout={vi.fn()} modulosAtivos={todos} role="proprietario" />
    );

    expect(temAba("pagamentos")).toBe(true);
    expect(temAba("equipe")).toBe(true);
    expect(temAba("configuracoes")).toBe(true);
  });

  it("viewDisponivel combina módulo e papel", () => {
    expect(viewDisponivel("fidelidade", ["fidelidade"], "operador")).toBe(false);
    expect(viewDisponivel("fidelidade", ["fidelidade"], "gerente")).toBe(true);
    expect(viewDisponivel("equipe", undefined, "gerente")).toBe(false);
    expect(viewDisponivel("equipe", undefined, null)).toBe(false);
  });
});
