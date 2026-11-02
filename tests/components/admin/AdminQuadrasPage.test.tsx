/**
 * @file AdminQuadrasPage.test.tsx
 * @description Tela Quadras e preços (SPEC/2026-11-02-admin-ajustes-demo.md §8): o que o site mostra,
 * o painel edita. Sem "coberta"/"iluminação"; foto, esportes e preço como no site; tarifa editável
 * com o efeito no site; fechar a quadra inteira; janelas fecham com Esc.
 */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminQuadrasPage, textoDiasTarifa } from "@/components/admin/AdminQuadrasPage";
import { JanelaQuadra, lerPosicao, validarQuadra } from "@/components/admin/quadras/JanelaQuadra";
import { JanelaTarifa, validarTarifa } from "@/components/admin/quadras/JanelaTarifa";
import { JanelaFechamento } from "@/components/admin/quadras/JanelaFechamento";

describe("AdminQuadrasPage", () => {
  it("lista as quadras sem coberta/iluminação e com o preço como no site", async () => {
    render(<AdminQuadrasPage />);
    expect(await screen.findByRole("heading", { name: "Quadras e preços", level: 1 })).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "Quadras" });
    expect(within(lista).getAllByText("No site").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^(Coberta|Descoberta|Com iluminação|Sem iluminação)$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Piso: /)).not.toBeInTheDocument();
  });

  it("Nova quadra abre a janela com foto e esportes; fecha com Esc", async () => {
    render(<AdminQuadrasPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova quadra/i }));
    expect(screen.getByRole("dialog", { name: "Nova quadra" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enviar foto da quadra")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Nova tarifa explica o 'de dia / à noite' do site; fecha com Esc", async () => {
    render(<AdminQuadrasPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Nova tarifa/i }))[0]);
    const janela = screen.getByRole("dialog", { name: "Nova tarifa" });
    expect(janela).toHaveTextContent("“de dia”");
    expect(janela).toHaveTextContent("Esta tarifa vira o preço “à noite” do site.");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cada quadra tem 'Fechar quadra' e setas de ordem no site", async () => {
    render(<AdminQuadrasPage />);
    expect((await screen.findAllByRole("button", { name: "Fechar quadra" })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Subir / })[0]).toBeDisabled();
  });
});

describe("textoDiasTarifa", () => {
  it("agrupa dias comuns", () => {
    expect(textoDiasTarifa([0, 1, 2, 3, 4, 5, 6])).toBe("Todos os dias");
    expect(textoDiasTarifa([5, 1, 2, 3, 4])).toBe("Seg a Sex");
    expect(textoDiasTarifa([6, 0])).toBe("Sáb e Dom");
    expect(textoDiasTarifa([1, 3, 5])).toBe("Seg, Qua e Sex");
  });
});

describe("JanelaQuadra", () => {
  it("valida nome, esportes, preço e descrição da foto", () => {
    expect(validarQuadra({ nome: "", esportes: [], tipoPiso: "areia", valorHoraPadrao: 0, fotoUrl: "x", fotoPosicao: "50% 50%", fotoDescricao: "" })).toHaveLength(4);
    expect(validarQuadra({ nome: "A", esportes: ["Vôlei"], tipoPiso: "areia", valorHoraPadrao: 80, fotoUrl: "", fotoPosicao: "", fotoDescricao: "" })).toEqual([]);
    expect(lerPosicao("30% 70%")).toEqual([30, 70]);
    expect(lerPosicao("left top")).toEqual([50, 50]);
  });

  it("mostra a linha de esportes como no site enquanto o dono marca", () => {
    render(<JanelaQuadra aoFechar={vi.fn()} aoSalvar={vi.fn()} aoEnviarFoto={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Futevôlei" }));
    fireEvent.click(screen.getByRole("button", { name: "Vôlei" }));
    expect(screen.getByText(/No site:/)).toHaveTextContent("No site: Futevôlei e vôlei");
  });

  it("envia a foto, mostra o enquadramento e salva com descrição", async () => {
    const aoSalvar = vi.fn().mockResolvedValue(undefined);
    const aoEnviarFoto = vi.fn().mockResolvedValue({ success: true, url: "https://cdn/q.jpg" });
    render(<JanelaQuadra aoFechar={vi.fn()} aoSalvar={aoSalvar} aoEnviarFoto={aoEnviarFoto} />);
    fireEvent.change(screen.getByLabelText("Nome no site"), { target: { value: "Areia 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Beach Tennis" }));
    const arquivo = new File(["x"], "q.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Enviar foto da quadra"), { target: { files: [arquivo] } });
    expect(await screen.findByLabelText("Enquadrar na horizontal")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Descrição da foto"), { target: { value: "Quadra de areia" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar quadra" }));
    await vi.waitFor(() =>
      expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ nome: "Areia 4", fotoUrl: "https://cdn/q.jpg", fotoDescricao: "Quadra de areia", esportes: ["Beach Tennis"] }))
    );
  });

  it("erro no envio da foto aparece na janela", async () => {
    render(<JanelaQuadra aoFechar={vi.fn()} aoSalvar={vi.fn()} aoEnviarFoto={vi.fn().mockResolvedValue({ success: false, error: "A imagem deve ter no máximo 5 MB." })} />);
    fireEvent.change(screen.getByLabelText("Enviar foto da quadra"), { target: { files: [new File(["x"], "q.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("no máximo 5 MB");
  });
});

describe("JanelaTarifa", () => {
  it("edita uma tarifa existente com os dados preenchidos", async () => {
    const aoSalvar = vi.fn().mockResolvedValue(undefined);
    const tarifa = { id: "p1", arenaId: "a", quadraId: "q1", diasSemana: [0, 6], horaInicio: "07:00", horaFim: "18:00", valorHora: 90, descricao: "Fim de semana", ativo: true, criadaEm: "" };
    render(<JanelaTarifa nomeQuadra="Areia 1" tarifa={tarifa} valorSugerido={100} aoFechar={vi.fn()} aoSalvar={aoSalvar} />);
    expect(screen.getByRole("dialog", { name: "Editar tarifa" })).toHaveTextContent("vira o preço “de dia” do site");
    fireEvent.change(screen.getByLabelText("Valor da hora (R$)"), { target: { value: "95" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tarifa" }));
    await vi.waitFor(() =>
      expect(aoSalvar).toHaveBeenCalledWith({ descricao: "Fim de semana", diasSemana: [0, 6], horaInicio: "07:00", horaFim: "18:00", valorHora: 95 })
    );
  });

  it("valida dias, horário e valor", () => {
    expect(validarTarifa({ descricao: "", diasSemana: [], horaInicio: "18:00", horaFim: "18:00", valorHora: 0 })).toHaveLength(4);
  });
});

describe("JanelaFechamento", () => {
  it("lista as reservas no caminho e fecha 'até eu liberar' com o motivo", async () => {
    const aoBuscar = vi.fn().mockResolvedValue([{ id: "r1", data: "2099-11-10", horaInicio: "19:00", horaFim: "20:00", nomeCliente: "Ana" }]);
    const aoConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<JanelaFechamento nomeQuadra="Areia 2" aoFechar={vi.fn()} aoBuscarReservas={aoBuscar} aoConfirmar={aoConfirmar} />);
    expect(await screen.findByText(/1 reserva\(s\) já marcada\(s\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ana/ })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Até eu liberar/));
    expect(aoBuscar).toHaveBeenLastCalledWith(expect.any(String), null);
    fireEvent.change(screen.getByLabelText(/Detalhe/), { target: { value: "troca da areia" } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar a quadra" }));
    await vi.waitFor(() => expect(aoConfirmar).toHaveBeenCalledWith(expect.objectContaining({ fim: "", motivo: "Reforma (troca da areia)" })));
  });

  it("avisa quando não consegue conferir as reservas", async () => {
    render(<JanelaFechamento nomeQuadra="Areia 2" aoFechar={vi.fn()} aoBuscarReservas={vi.fn().mockResolvedValue(null)} aoConfirmar={vi.fn()} />);
    expect(await screen.findByText(/Não foi possível conferir as reservas/)).toBeInTheDocument();
  });

  it("fecha com Esc", () => {
    const aoFechar = vi.fn();
    render(<JanelaFechamento nomeQuadra="Areia 2" aoFechar={aoFechar} aoBuscarReservas={vi.fn().mockResolvedValue([])} aoConfirmar={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(aoFechar).toHaveBeenCalled();
  });
});
