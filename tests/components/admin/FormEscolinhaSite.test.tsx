import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormEscolinhaSite } from "@/components/admin/institucional/FormEscolinhaSite";
import { escolinhaVazia, mensagemPadraoEscolinha } from "@/lib/institucional/escolinhasSite";

function montar(inicial = escolinhaVazia()) {
  const aoSalvar = vi.fn().mockResolvedValue(undefined);
  render(
    <FormEscolinhaSite
      inicial={inicial}
      editando={false}
      whatsappArena="5591984982865"
      aoSalvar={aoSalvar}
      aoCancelar={vi.fn()}
      aoEnviarFoto={vi.fn()}
    />
  );
  const mensagem = () => screen.getByLabelText("Mensagem pronta") as HTMLTextAreaElement;
  const digitar = (rotulo: string | RegExp, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
  return { aoSalvar, mensagem, digitar };
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
    expect(screen.getByText(/Você personalizou a mensagem/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para a mensagem padrão" }));
    expect(mensagem().value).toContain("no futevôlei");
  });

  it("mostra os erros e não salva sem esporte, professor e turma", async () => {
    const { aoSalvar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira os campos");
    expect(screen.getByText("Informe o esporte (ex.: Beach tennis).")).toBeInTheDocument();
    expect(screen.getByText("Cadastre pelo menos uma turma com dias e horários.")).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it("salva com turmas e mensagem padrão gravada vazia", async () => {
    const { aoSalvar, digitar } = montar();
    digitar("Esporte *", "Vôlei");
    digitar("Nome do professor *", "Lucas");
    digitar("Dias da turma 1", "Sábado");
    digitar("Horários da turma 1", "9h e 10h");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar turma/ }));
    digitar("Dias da turma 2", "Seg e Qua");
    digitar("Horários da turma 2", "19h");
    digitar("Categoria da turma 2", "Iniciante");
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1));
    expect(aoSalvar.mock.calls[0][0]).toMatchObject({
      esporte: "Vôlei",
      mensagemWhatsapp: "",
      tipoBotao: "whatsapp",
      turmas: [
        { dias: "Sábado", horas: "9h e 10h", categoria: "" },
        { dias: "Seg e Qua", horas: "19h", categoria: "Iniciante" },
      ],
    });
  });

  it("botão de link pede o endereço https", async () => {
    const { aoSalvar, digitar } = montar({ ...escolinhaVazia(), esporte: "Vôlei", professor: "Lucas", turmas: [{ dias: "Sáb", horas: "9h", categoria: "" }] });
    fireEvent.click(screen.getByRole("radio", { name: /Abrir um link/ }));
    digitar("Endereço do link *", "forms.gle/abc");
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    expect(await screen.findByText("Cole o endereço completo, começando com https://")).toBeInTheDocument();
    digitar("Endereço do link *", "https://forms.gle/abc");
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ tipoBotao: "link", linkBotao: "https://forms.gle/abc" })));
  });

  it("mostra o erro do banco sem fechar", async () => {
    const aoSalvar = vi.fn().mockRejectedValue(new Error("Falha ao salvar a escolinha: sem permissão"));
    render(
      <FormEscolinhaSite
        inicial={{ ...escolinhaVazia(), esporte: "Vôlei", professor: "Lucas", turmas: [{ dias: "Sáb", horas: "9h", categoria: "" }] }}
        editando
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
        aoEnviarFoto={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar escolinha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("sem permissão");
    expect(screen.getByRole("heading", { name: "Editar escolinha" })).toBeInTheDocument();
  });
});
