/**
 * @file HorasGratisAnalise.test.tsx
 * @description Fila "Horas grátis para liberar" (Fidelidade) e aviso da tela Hoje
 * (SPEC/2026-11-02-admin-ajustes-demo.md §10).
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilaHorasGratis } from "@/components/admin/fidelidade/FilaHorasGratis";
import { AvisoHorasGratis } from "@/components/admin/hoje/AvisoHorasGratis";
import type { SeloFidelidade, VoucherFidelidade } from "@/lib/fidelidade/types";

const pedido: VoucherFidelidade = {
  id: "v1",
  codigo: "CLUBE-1",
  usuarioId: "u1",
  valorTeto: 100,
  status: "em_analise",
  criadoEm: "2026-11-01T10:00:00Z",
  expiraEm: "2026-12-31",
};
const selo = (id: string, data: string, horas: number): SeloFidelidade => ({
  id,
  usuarioId: "u1",
  reservaId: `r-${id}`,
  horasContabilizadas: horas,
  valorPorHora: 100,
  valorTotalReserva: 100 * horas,
  dataJogo: data,
  criadoEm: "",
  expiraEm: "2027-01-01",
  resgatado: true,
  voucherId: "v1",
});

describe("FilaHorasGratis", () => {
  const montar = (aoDecidir = vi.fn().mockResolvedValue(null)) => {
    render(<FilaHorasGratis pedidos={[pedido]} selos={[selo("s1", "2026-10-05", 2), selo("s2", "2026-10-12", 1)]} nomeAtleta={() => "Rafael Souza"} aoDecidir={aoDecidir} />);
    return aoDecidir;
  };

  it("não aparece sem pedidos", () => {
    const { container } = render(<FilaHorasGratis pedidos={[]} selos={[]} nomeAtleta={() => ""} aoDecidir={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o atleta, as horas que geraram o pedido e libera", async () => {
    const aoDecidir = montar();
    const item = screen.getByRole("listitem", { name: "Pedido de Rafael Souza" });
    expect(item).toHaveTextContent("3 horas jogadas");
    expect(item).toHaveTextContent("5 de out.");
    fireEvent.click(screen.getByRole("button", { name: "Liberar" }));
    await vi.waitFor(() => expect(aoDecidir).toHaveBeenCalledWith("v1", { decisao: "liberar" }));
  });

  it("recusar pede motivo antes de enviar e fecha com Esc", async () => {
    const aoDecidir = montar();
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    const janela = screen.getByRole("dialog", { name: "Recusar a hora grátis?" });
    fireEvent.click(screen.getAllByRole("button", { name: "Recusar" }).at(-1)!);
    expect(janela).toHaveTextContent("Diga o motivo");
    expect(aoDecidir).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Reservas não jogadas" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Recusar" }).at(-1)!);
    await vi.waitFor(() => expect(aoDecidir).toHaveBeenCalledWith("v1", { decisao: "recusar", motivo: "Reservas não jogadas" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Esc fecha a janela de recusa sem decidir", () => {
    const aoDecidir = montar();
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(aoDecidir).not.toHaveBeenCalled();
  });
});

describe("AvisoHorasGratis", () => {
  it("sem pedidos não aparece; com pedidos leva à fila", async () => {
    const { container, unmount } = render(<AvisoHorasGratis contar={() => Promise.resolve(0)} />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    unmount();
    render(<AvisoHorasGratis contar={() => Promise.resolve(2)} />);
    expect(await screen.findByText("2 horas grátis do Clube para liberar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver pedidos" })).toHaveAttribute("href", "/admin/fidelidade");
  });
});
