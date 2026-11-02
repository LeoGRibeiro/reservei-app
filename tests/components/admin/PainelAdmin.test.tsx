/**
 * @file PainelAdmin.test.tsx
 * @description Navegação do painel (rotas, módulos e papéis) e a moldura com sessão: nome da arena no
 * topo, menu agrupado, login quando não há sessão e bloqueio de telas fora do perfil.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hrefDaView, hrefReserva, moduloDaView, viewDisponivel, viewDoCaminho } from "@/lib/admin/navegacao";

const estado = vi.hoisted(() => ({
  autenticado: true as boolean | null,
  role: "proprietario" as "proprietario" | "gerente" | "operador",
  caminho: "/admin",
  modulos: ["agendamento_core", "fidelidade", "escolinhas", "contratos"],
}));

vi.mock("next/navigation", () => ({ usePathname: () => estado.caminho }));
vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({
    autenticado: estado.autenticado,
    login: vi.fn(),
    logout: vi.fn(),
    arenaSlug: "arena-belem",
    role: estado.role,
    user: { id: "u1", email: "dono@arena.com" },
  }),
}));
vi.mock("@/hooks/useArena", () => ({
  useArena: () => ({
    arena: { id: "arena-belem", slug: "arena-belem", nome: "Arena Belém", modulosAtivos: estado.modulos },
    carregando: false,
    recarregar: vi.fn(),
  }),
}));
vi.mock("@/hooks/useSetupAdmin", () => ({ useSetupAdmin: () => ({ precisaSetup: false, tokenValido: null }) }));
vi.mock("@/lib/supabase/adminAuthService", () => ({ precisaTrocarSenha: () => Promise.resolve(false) }));
vi.mock("@/components/admin/AdminLogin", () => ({ AdminLogin: () => <p>Tela de login</p> }));

import { PainelAdmin } from "@/components/admin/painel/PainelAdmin";

describe("navegação do painel", () => {
  it("cada tela tem endereço próprio e o detalhe da reserva pertence à Agenda", () => {
    expect(viewDoCaminho("/admin")).toBe("dashboard");
    expect(viewDoCaminho("/admin/")).toBe("dashboard");
    expect(viewDoCaminho("/admin/financeiro")).toBe("financeiro");
    expect(viewDoCaminho("/admin/clientes")).toBe("usuarios");
    expect(viewDoCaminho("/admin/recebimento")).toBe("pagamentos");
    expect(viewDoCaminho("/admin/reservas/r-1")).toBe("agenda");
    expect(viewDoCaminho("/admin/redefinir-senha")).toBeNull();
    expect(hrefDaView("institucional")).toBe("/admin/site");
    expect(hrefReserva("a b")).toBe("/admin/reservas/a%20b");
  });

  it("módulo e papel decidem a disponibilidade", () => {
    expect(moduloDaView("grupos")).toBe("contratos");
    expect(moduloDaView("agenda")).toBeUndefined();
    expect(viewDisponivel("fidelidade", ["fidelidade"], "operador")).toBe(false);
    expect(viewDisponivel("fidelidade", ["fidelidade"], "gerente")).toBe(true);
    expect(viewDisponivel("fidelidade", undefined)).toBe(false);
    expect(viewDisponivel("equipe", undefined, "gerente")).toBe(false);
    expect(viewDisponivel("agenda", [], "operador")).toBe(true);
  });
});

describe("PainelAdmin", () => {
  beforeEach(() => {
    estado.autenticado = true;
    estado.role = "proprietario";
    estado.caminho = "/admin";
    estado.modulos = ["agendamento_core", "fidelidade", "escolinhas", "contratos"];
  });

  it("mostra o nome da arena no topo, o papel e o menu agrupado", async () => {
    render(<PainelAdmin><p>Conteúdo de hoje</p></PainelAdmin>);

    expect(await screen.findByText("Conteúdo de hoje")).toBeInTheDocument();
    expect(screen.getByText("Arena Belém")).toBeInTheDocument();
    expect(screen.getByText("Proprietário · dono@arena.com")).toBeInTheDocument();
    for (const grupo of ["Operação", "Turmas e fixos", "Dinheiro", "Arena", "Ajustes"]) {
      expect(screen.getByText(grupo)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Hoje" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Recebimento" })).toHaveAttribute("href", "/admin/recebimento");
  });

  it("operador não vê dinheiro nem ajustes no menu", async () => {
    estado.role = "operador";
    render(<PainelAdmin><p>x</p></PainelAdmin>);

    expect(await screen.findByRole("link", { name: "Agenda" })).toBeInTheDocument();
    for (const item of ["Financeiro", "Quadras e preços", "Fidelidade", "Equipe", "Recebimento", "Configurações"]) {
      expect(screen.queryByRole("link", { name: item })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Dinheiro")).not.toBeInTheDocument();
  });

  it("tela fora do perfil não abre, mesmo digitando o endereço", async () => {
    estado.role = "operador";
    estado.caminho = "/admin/financeiro";
    render(<PainelAdmin><p>Números do financeiro</p></PainelAdmin>);

    expect(await screen.findByText("Esta área não está disponível")).toBeInTheDocument();
    expect(screen.queryByText("Números do financeiro")).not.toBeInTheDocument();
  });

  it("módulo não contratado esconde o menu e bloqueia a rota", async () => {
    estado.modulos = ["agendamento_core"];
    estado.caminho = "/admin/escolinhas";
    render(<PainelAdmin><p>Turmas</p></PainelAdmin>);

    expect(await screen.findByText("Esta área não está disponível")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Escolinhas" })).not.toBeInTheDocument();
  });

  it("sem sessão mostra o login", async () => {
    estado.autenticado = false;
    render(<PainelAdmin><p>x</p></PainelAdmin>);
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
  });
});
