/**
 * @file AgendaHorarioLivre.test.tsx
 * @description Agenda, visão Dia: clicar num horário livre abre a escolha rápida "Nova reserva" ou
 * "Bloquear horário", as duas já com quadra, dia e hora do clique.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §3
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EscolhaHorarioLivre } from "@/components/admin/agenda/PaginaAgenda";

vi.mock("@/store/useCatalogoArenaStore", () => ({
  useQuadrasCatalogo: () => [{ id: "q1", descricao: "Areia 1 · Terraço" }],
  useHorariosCatalogo: () => ["18:00", "19:00"],
}));

const SELECAO = { quadraId: "q1", data: "2026-11-02", horario: "19:00" };

describe("EscolhaHorarioLivre", () => {
  it("mostra quadra, dia e hora clicados e as duas opções", () => {
    render(<EscolhaHorarioLivre selecao={SELECAO} aoEscolher={vi.fn()} aoFechar={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "O que fazer neste horário?" })).toHaveTextContent("Areia 1 · Terraço");
    expect(screen.getByRole("dialog")).toHaveTextContent("19:00");
    expect(screen.getByRole("button", { name: /Nova reserva/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bloquear horário/ })).toBeInTheDocument();
  });

  it("Nova reserva e Bloquear horário seguem com a seleção preenchida", () => {
    const aoEscolher = vi.fn();
    const { rerender } = render(<EscolhaHorarioLivre selecao={SELECAO} aoEscolher={aoEscolher} aoFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Bloquear horário/ }));
    expect(aoEscolher).toHaveBeenLastCalledWith("bloqueio", SELECAO);
    rerender(<EscolhaHorarioLivre selecao={SELECAO} aoEscolher={aoEscolher} aoFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Nova reserva/ }));
    expect(aoEscolher).toHaveBeenLastCalledWith("reserva", SELECAO);
  });

  it("fecha com Esc e não aparece sem seleção", () => {
    const aoFechar = vi.fn();
    const { rerender } = render(<EscolhaHorarioLivre selecao={SELECAO} aoEscolher={vi.fn()} aoFechar={aoFechar} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(aoFechar).toHaveBeenCalledTimes(1);
    rerender(<EscolhaHorarioLivre selecao={null} aoEscolher={vi.fn()} aoFechar={aoFechar} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
