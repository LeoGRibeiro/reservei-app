import { describe, expect, it } from "vitest";
import { escolinhaSiteParaColunas, linhaParaEscolinhaSite } from "@/lib/supabase/escolinhasSiteRepository";
import { escolinhaVazia, mensagemPadraoEscolinha } from "@/lib/institucional/escolinhasSite";

describe("linhaParaEscolinhaSite", () => {
  it("lê a categoria da turma da chave 'nivel' e o botão do banco", () => {
    const e = linhaParaEscolinhaSite({
      id: "e1", nome: "CT Falcão 12", sport_name: "Futebol society", teacher_name: "Prof. Marcos Falcão",
      teacher_image_url: null, turmas: [{ dias: "Ter e Qui", horas: "8h", nivel: "6 a 10 anos" }, "lixo"],
      whatsapp_number: "5591984982865", botao_tipo: "link", botao_url: "https://forms.gle/x", mensagem_whatsapp: null,
      ordem: 4, is_active: false,
    });
    expect(e).toMatchObject({
      nome: "CT Falcão 12", esporte: "Futebol society", professor: "Marcos Falcão", fotoProfessorUrl: "",
      turmas: [{ dias: "Ter e Qui", horas: "8h", categoria: "6 a 10 anos" }],
      tipoBotao: "link", linkBotao: "https://forms.gle/x", mensagemWhatsapp: "", ordem: 4, ativa: false,
    });
  });

  it("linha antiga sem colunas novas vira botão de WhatsApp sem turmas", () => {
    const e = linhaParaEscolinhaSite({ id: "e2", sport_name: "Tênis", teacher_name: "Ana" });
    expect(e).toMatchObject({ nome: "", tipoBotao: "whatsapp", turmas: [], ativa: true, ordem: 0 });
  });
});

describe("escolinhaSiteParaColunas", () => {
  const form = {
    ...escolinhaVazia(2),
    esporte: " Beach tennis ",
    professor: "Prof. Italo Bianck",
    whatsapp: "(91) 98498-2865",
    turmas: [{ dias: "Seg e Qua", horas: "16h", categoria: "Avançado" }, { dias: "", horas: "", categoria: "" }],
  };

  it("grava turmas com 'nivel', resumo, número com 55 e professor sem 'Prof.'", () => {
    expect(escolinhaSiteParaColunas(form)).toMatchObject({
      nome: null, sport_name: "Beach tennis", teacher_name: "Italo Bianck", teacher_image_url: null,
      turmas: [{ dias: "Seg e Qua", horas: "16h", nivel: "Avançado" }], schedule_info: "Seg e Qua 16h",
      whatsapp_number: "5591984982865", botao_tipo: "whatsapp", botao_url: null, mensagem_whatsapp: null, ordem: 2, is_active: true,
    });
  });

  it("mensagem igual à padrão é gravada vazia; personalizada é mantida", () => {
    expect(escolinhaSiteParaColunas({ ...form, mensagemWhatsapp: mensagemPadraoEscolinha("Beach tennis", "Italo Bianck") }).mensagem_whatsapp).toBeNull();
    expect(escolinhaSiteParaColunas({ ...form, mensagemWhatsapp: " Oi, tem vaga? " }).mensagem_whatsapp).toBe("Oi, tem vaga?");
  });

  it("só grava o link quando o botão é de link e o endereço é https", () => {
    expect(escolinhaSiteParaColunas({ ...form, tipoBotao: "link", linkBotao: "https://forms.gle/x" })).toMatchObject({ botao_tipo: "link", botao_url: "https://forms.gle/x" });
    expect(escolinhaSiteParaColunas({ ...form, tipoBotao: "whatsapp", linkBotao: "https://forms.gle/x" })).toMatchObject({ botao_tipo: "whatsapp", botao_url: null });
    expect(escolinhaSiteParaColunas({ ...form, tipoBotao: "link", linkBotao: "http://x.com" })).toMatchObject({ botao_tipo: "whatsapp", botao_url: null });
  });
});
