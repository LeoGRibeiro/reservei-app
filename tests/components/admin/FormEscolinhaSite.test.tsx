import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormEscolinhaSite } from "@/components/admin/institucional/FormEscolinhaSite";
import { escolinhaVazia, mensagemPadraoEscolinha, turmaVazia, type EscolinhaSiteInput } from "@/lib/institucional/escolinhasSite";

const QUADRAS = [{ id: "q1", nome: "Areia 1" }, { id: "q4", nome: "Campo Society" }];
const HORARIOS = ["07:00", "08:00", "09:00", "16:00", "17:00"];

const novaComQuadra = (): EscolinhaSiteInput => ({ ...escolinhaVazia(), turmas: [turmaVazia("q1")] });

function montar(inicial: EscolinhaSiteInput = novaComQuadra(), aoSalvar = vi.fn().mockResolvedValue(undefined), editando = false) {
  render(
    <FormEscolinhaSite
      inicial={inicial}
      editando={editando}
      whatsappArena="5591984982865"
      quadras={QUADRAS}
      horarios={HORARIOS}
      aoSalvar={aoSalvar}
      aoCancelar={vi.fn()}
      aoEnviarFoto={vi.fn()}
    />
  );
  const mensagem = () => screen.getByLabelText("Mensagem pronta") as HTMLTextAreaElement;
  const digitar = (rotulo: string | RegExp, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
  return { aoSalvar, mensagem, digitar };
}

/** Preenche a turma 1: Ter e Qui, 8h às 10h. */
function preencherTurma(digitar: (r: string, v: string) => void) {
  fireEvent.click(screen.getByRole("button", { name: "Terça-feira na turma 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Quinta-feira na turma 1" }));
  digitar("Início da turma 1", "08:00");
  digitar("Fim da turma 1", "10:00");
}

describe("FormEscolinhaSite", () => {
  it("a mensagem padrão acompanha o esporte e o professor digitados", () => {
    const { mensagem, digitar } = montar();
    digitar("Esporte *", "Vôlei");
    digitar("Nome do professor *", "Prof. Lucas Andrade");
    expect(mensagem().value).toBe(mensagemPadraoEscolinha("Vôlei", "Lucas Andrade"));
  });

  it("mensagem editada fica como o dono escreveu e dá para voltar à padrão", () => {
    const { mensagem, digitar } = montar();
    digitar("Esporte *", "Vôlei");
    digitar("Mensagem pronta", "Quero a turma de sábado");
    digitar("Esporte *", "Futevôlei");
    expect(mensagem().value).toBe("Quero a turma de sábado");
    fireEvent.click(screen.getByRole("button", { name: "Voltar para a mensagem padrão" }));
    expect(mensagem().value).toContain("no futevôlei");
  });

  it("escolher dias e horário mostra como fica no site e pede o período da agenda", () => {
    const { digitar } = montar();
    preencherTurma(digitar);
    expect(screen.getByText(/No site: Ter e Qui · 8h e 9h/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terça-feira na turma 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Bloquear a partir de")).toBeInTheDocument();
    expect(screen.getByLabelText("Quadra da turma 1")).toHaveValue("q1");
  });

  it("mostra os erros e não salva sem esporte, professor e horário da turma", async () => {
    const { aoSalvar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira os campos");
    expect(screen.getByText("Informe o esporte (ex.: Beach tennis).")).toBeInTheDocument();
    expect(screen.getByText("Cadastre pelo menos uma turma com dias e horários.")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("salva a turma estruturada com quadra e o período da agenda", async () => {
    const { aoSalvar, digitar } = montar();
    digitar("Esporte *", "Vôlei");
    digitar("Nome do professor *", "Lucas");
    preencherTurma(digitar);
    digitar("Categoria da turma 1", "Iniciante");
    digitar("Quadra da turma 1", "q4");
    digitar("Por quanto tempo", "3");
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1));
    const [dados, periodo] = aoSalvar.mock.calls[0];
    expect(dados).toMatchObject({
      esporte: "Vôlei",
      mensagemWhatsapp: "",
      turmas: [{ diasSemana: [2, 4], horaInicio: "08:00", horaFim: "10:00", categoria: "Iniciante", bloquearAgenda: true, quadraId: "q4" }],
    });
    expect(periodo).toMatchObject({ meses: 3 });
  });

  it("turma sem 'Bloquear na agenda' salva sem quadra", async () => {
    const { aoSalvar, digitar } = montar();
    digitar("Esporte *", "Vôlei");
    digitar("Nome do professor *", "Lucas");
    preencherTurma(digitar);
    fireEvent.click(screen.getByRole("checkbox", { name: "Bloquear na agenda" }));
    expect(screen.queryByLabelText("Quadra da turma 1")).not.toBeInTheDocument();
    expect(screen.getByText("Só aparece no site, sem ocupar quadra.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    await waitFor(() => expect(aoSalvar.mock.calls[0][0].turmas[0]).toMatchObject({ bloquearAgenda: false }));
  });

  it("botão de link pede o endereço https", async () => {
    const inicial = { ...escolinhaVazia(), esporte: "Vôlei", professor: "Lucas", turmas: [{ ...turmaVazia("q1"), diasSemana: [6] as 6[], horaInicio: "09:00", horaFim: "10:00" }] };
    const { aoSalvar, digitar } = montar(inicial);
    fireEvent.click(screen.getByRole("radio", { name: /Abrir um link/ }));
    digitar("Endereço do link *", "forms.gle/abc");
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    expect(await screen.findByText("Cole o endereço completo, começando com https://")).toBeInTheDocument();
    digitar("Endereço do link *", "https://forms.gle/abc");
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ tipoBotao: "link", linkBotao: "https://forms.gle/abc" }), expect.anything()));
  });

  it("mostra o erro do banco sem fechar", async () => {
    const inicial = { ...escolinhaVazia(), esporte: "Vôlei", professor: "Lucas", turmas: [{ ...turmaVazia("q1"), diasSemana: [6] as 6[], horaInicio: "09:00", horaFim: "10:00" }] };
    montar(inicial, vi.fn().mockRejectedValue(new Error("Falha ao salvar a escolinha: sem permissão")), true);
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("sem permissão");
    expect(screen.getByRole("heading", { name: "Editar escolinha" })).toBeInTheDocument();
  });
});
