/**
 * @file AdminEscolinhasPage.test.tsx
 * @description Escolinhas num cadastro só (SPEC/2026-11-02-admin-ajustes-demo.md §4): uma tela, sem
 * as abas "No site" e "Horários na agenda", com o formulário completo da escolinha; horários antigos
 * sem escolinha aparecem num aviso com "Ligar à escolinha" e "Encerrar".
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminEscolinhasPage } from "@/components/admin/AdminEscolinhasPage";
import { HorariosAntigos } from "@/components/admin/escolinhas/HorariosAntigos";
import { escolinhaVazia, type EscolinhaSite } from "@/lib/institucional/escolinhasSite";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";

describe("AdminEscolinhasPage - um cadastro só", () => {
  it("não tem mais abas: uma tela com o botão Nova escolinha no topo", () => {
    render(<AdminEscolinhasPage />);
    expect(screen.getByRole("heading", { name: "Escolinhas", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "No site" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Horários na agenda" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo horário de aula/ })).not.toBeInTheDocument();
  });

  it("Nova escolinha abre o formulário completo (turmas, agenda e botão Quero uma vaga)", () => {
    render(<AdminEscolinhasPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /Nova escolinha/i })[0]);
    expect(screen.getByRole("dialog", { name: "Nova escolinha" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Abrir o WhatsApp/ })).toBeChecked();
    expect(screen.getAllByText(/Bloquear na agenda/).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Mensagem pronta") as HTMLTextAreaElement).value).toContain("Vim pelo site e quero uma vaga");
  });
});

describe("HorariosAntigos", () => {
  const contrato = {
    id: "ctr-antigo",
    tipo: "escolinha",
    nome: "Escolinha Craques",
    responsavelNome: "Prof. Ana",
    contatoWhatsapp: "91999990000",
    quadraId: "q1",
    diasSemana: [2, 4],
    horaInicio: "17:00",
    horaFim: "18:00",
    dataInicio: "2026-11-01",
    meses: 6,
    ativo: true,
  } as ContratoRecorrente;
  const escolinhas: EscolinhaSite[] = [
    { ...escolinhaVazia(1), id: "e1", esporte: "Futebol", professor: "Diego" } as EscolinhaSite,
    { ...escolinhaVazia(2), id: "e2", esporte: "Vôlei", professor: "Lia" } as EscolinhaSite,
  ];
  const nomeQuadra = () => "Campo Society";

  it("não aparece quando não há horário antigo", () => {
    const { container } = render(
      <HorariosAntigos contratos={[]} escolinhas={escolinhas} nomeQuadra={nomeQuadra} aoLigar={vi.fn()} aoEncerrar={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o horário e liga à escolinha escolhida", async () => {
    const aoLigar = vi.fn().mockResolvedValue(undefined);
    render(<HorariosAntigos contratos={[contrato]} escolinhas={escolinhas} nomeQuadra={nomeQuadra} aoLigar={aoLigar} aoEncerrar={vi.fn()} />);
    expect(screen.getByText(/Horários antigos sem escolinha \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("Ter e Qui · 17h · Campo Society")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Escolinha para Escolinha Craques"), { target: { value: "e2" } });
    fireEvent.click(screen.getByRole("button", { name: "Ligar à escolinha" }));
    await vi.waitFor(() => expect(aoLigar).toHaveBeenCalledWith(contrato, escolinhas[1]));
  });

  it("encerrar pede confirmação antes", async () => {
    const aoEncerrar = vi.fn().mockResolvedValue(undefined);
    render(<HorariosAntigos contratos={[contrato]} escolinhas={escolinhas} nomeQuadra={nomeQuadra} aoLigar={vi.fn()} aoEncerrar={aoEncerrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(aoEncerrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar e liberar a agenda" }));
    await vi.waitFor(() => expect(aoEncerrar).toHaveBeenCalledWith(contrato));
  });

  it("sem escolinha cadastrada, explica que precisa cadastrar uma para ligar", () => {
    render(<HorariosAntigos contratos={[contrato]} escolinhas={[]} nomeQuadra={nomeQuadra} aoLigar={vi.fn()} aoEncerrar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Ligar à escolinha" })).not.toBeInTheDocument();
    expect(screen.getByText(/Cadastre uma escolinha para ligar/)).toBeInTheDocument();
  });
});
