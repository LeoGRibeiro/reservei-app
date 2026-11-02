/**
 * @file GruposPage.test.tsx
 * @description Grupos (SPEC/2026-11-02-admin-ajustes-demo.md §5): frase explicando que no site o grupo
 * aparece como "Ocupado"; formulário novo (Janela + Campo) com validação, criação, edição e Esc.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminGruposPage } from "@/components/admin/AdminGruposPage";
import { JanelaGrupo } from "@/components/admin/grupos/JanelaGrupo";

vi.mock("@/store/useCatalogoArenaStore", async (original) => ({
  ...(await original<typeof import("@/store/useCatalogoArenaStore")>()),
  useQuadrasCatalogo: () => [
    { id: "q1", descricao: "Areia 1" },
    { id: "q4", descricao: "Campo Society" },
  ],
  useHorariosCatalogo: () => ["19:00", "20:00", "21:00", "22:00"],
}));

describe("AdminGruposPage", () => {
  it("explica que o grupo aparece como Ocupado no site, e Aula é das escolinhas", () => {
    render(<AdminGruposPage />);
    const frase = screen.getByText(/No site, o horário do grupo aparece como/);
    expect(frase).toHaveTextContent("“Ocupado”");
    expect(frase).toHaveTextContent("Escolinhas");
  });

  it("Novo grupo abre a janela nova", () => {
    render(<AdminGruposPage />);
    fireEvent.click(screen.getByRole("button", { name: /Novo grupo/ }));
    expect(screen.getByRole("dialog", { name: "Novo grupo" })).toBeInTheDocument();
  });
});

describe("JanelaGrupo", () => {
  const montar = (extra: Partial<React.ComponentProps<typeof JanelaGrupo>> = {}) => {
    const props = {
      aoFechar: vi.fn(),
      aoCriar: vi.fn().mockResolvedValue({ ok: true, contrato: { id: "c1" }, totalOcorrencias: 26 }),
      aoAtualizar: vi.fn().mockResolvedValue({ ok: true }),
      aoSalvo: vi.fn(),
      ...extra,
    };
    render(<JanelaGrupo {...props} />);
    return props;
  };

  const preencherContato = () => {
    fireEvent.change(screen.getByLabelText("Nome do grupo"), { target: { value: "Pelada do Marcos" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "Marcos" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp do responsável/), { target: { value: "91988887777" } });
  };

  it("valida os campos obrigatórios antes de criar", () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar grupo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome do grupo.");
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos um dia da semana.");
    expect(p.aoCriar).not.toHaveBeenCalled();
  });

  it("cria com nome, responsável, WhatsApp, quadra, dias, horário e período", async () => {
    const p = montar();
    preencherContato();
    fireEvent.change(screen.getByLabelText("Quadra"), { target: { value: "q4" } });
    fireEvent.click(screen.getByRole("button", { name: "Terça-feira" }));
    fireEvent.change(screen.getByLabelText("Começa às"), { target: { value: "20:00" } });
    fireEvent.change(screen.getByLabelText("Termina às"), { target: { value: "22:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar grupo" }));
    await vi.waitFor(() => expect(p.aoSalvo).toHaveBeenCalledWith("Grupo cadastrado: 26 horários reservados na agenda."));
    expect(p.aoCriar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "grupo",
        nome: "Pelada do Marcos",
        responsavelNome: "Marcos",
        contatoWhatsapp: "91988887777",
        quadraId: "q4",
        diasSemana: [2],
        horaInicio: "20:00",
        horaFim: "22:00",
        meses: 6,
      })
    );
  });

  it("mostra os conflitos que o banco devolver", async () => {
    montar({
      aoCriar: vi.fn().mockResolvedValue({
        ok: false,
        erros: ["Há reservas no caminho."],
        conflitos: [{ data: "2026-11-03", nomeCliente: "Ana", reservaId: "r", horarios: [] }],
      }),
    });
    preencherContato();
    fireEvent.click(screen.getByRole("button", { name: "Terça-feira" }));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar grupo" }));
    expect(await screen.findByText(/Já reservado:/)).toHaveTextContent("Ana");
  });

  it("edição muda só os dados de contato e explica como mudar o horário", async () => {
    const grupo = {
      id: "g1",
      tipo: "grupo",
      nome: "Pelada",
      responsavelNome: "Marcos",
      contatoWhatsapp: "91988887777",
      quadraId: "q1",
      diasSemana: [2],
      horaInicio: "20:00",
      horaFim: "21:00",
      dataInicio: "2026-11-01",
      meses: 6,
      ativo: true,
    };
    const p = montar({ grupo: grupo as never });
    expect(screen.getByRole("dialog", { name: "Editar grupo" })).toHaveTextContent("encerre este grupo e cadastre de novo");
    expect(screen.queryByLabelText("Quadra")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "Marcos Lima" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await vi.waitFor(() =>
      expect(p.aoAtualizar).toHaveBeenCalledWith("g1", { nome: "Pelada", responsavelNome: "Marcos Lima", contatoWhatsapp: "91988887777" })
    );
  });

  it("fecha com Esc", () => {
    const p = montar();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(p.aoFechar).toHaveBeenCalledTimes(1);
  });
});
