import { describe, expect, it } from "vitest";
import { escolinhaSiteParaColunas, linhaParaEscolinhaSite } from "@/lib/supabase/escolinhasSiteRepository";
import { escolinhaVazia, mensagemPadraoEscolinha, turmaVazia } from "@/lib/institucional/escolinhasSite";

describe("linhaParaEscolinhaSite", () => {
  it("lê a turma estruturada (dias, horário, quadra e contrato) e o botão do banco", () => {
    const e = linhaParaEscolinhaSite({
      id: "e1", nome: "CT Falcão 12", sport_name: "Futebol society", teacher_name: "Prof. Marcos Falcão",
      teacher_image_url: null,
      turmas: [
        { dias: "Ter e Qui", horas: "8h e 9h", nivel: "6 a 10 anos", dias_semana: [2, 4], hora_inicio: "08:00", hora_fim: "10:00", bloquear_agenda: true, quadra_id: "q4", contrato_id: "c1" },
        "lixo",
      ],
      whatsapp_number: "5591984982865", botao_tipo: "link", botao_url: "https://forms.gle/x", mensagem_whatsapp: null,
      ordem: 4, is_active: false,
    });
    expect(e).toMatchObject({
      nome: "CT Falcão 12", esporte: "Futebol society", professor: "Marcos Falcão", fotoProfessorUrl: "",
      turmas: [{ dias: "Ter e Qui", horas: "8h e 9h", categoria: "6 a 10 anos", diasSemana: [2, 4], horaInicio: "08:00", horaFim: "10:00", bloquearAgenda: true, quadraId: "q4", contratoId: "c1" }],
      tipoBotao: "link", linkBotao: "https://forms.gle/x", mensagemWhatsapp: "", ordem: 4, ativa: false,
    });
  });

  it("turma antiga só em texto tem dias e horários interpretados e não bloqueia a agenda", () => {
    const e = linhaParaEscolinhaSite({ id: "e2", sport_name: "Vôlei", teacher_name: "Lucas", turmas: [{ dias: "Sábado", horas: "9h, 10h e 11h", nivel: "Livre" }] });
    expect(e.turmas[0]).toMatchObject({ diasSemana: [6], horaInicio: "09:00", horaFim: "12:00", bloquearAgenda: false, contratoId: "" });
  });

  it("linha antiga sem colunas novas vira botão de WhatsApp sem turmas", () => {
    const e = linhaParaEscolinhaSite({ id: "e3", sport_name: "Tênis", teacher_name: "Ana" });
    expect(e).toMatchObject({ nome: "", tipoBotao: "whatsapp", turmas: [], ativa: true, ordem: 0 });
  });
});

describe("escolinhaSiteParaColunas", () => {
  const form = {
    ...escolinhaVazia(2),
    esporte: " Beach tennis ",
    professor: "Prof. Italo Bianck",
    whatsapp: "(91) 98498-2865",
    turmas: [{ ...turmaVazia("q1"), diasSemana: [3, 1] as (1 | 3)[], horaInicio: "16:00", horaFim: "17:00", categoria: "Avançado" }, turmaVazia()],
  };

  it("grava a turma com o texto do site montado, a estrutura, o resumo e o número com 55", () => {
    expect(escolinhaSiteParaColunas(form)).toMatchObject({
      nome: null, sport_name: "Beach tennis", teacher_name: "Italo Bianck", teacher_image_url: null,
      turmas: [{ dias: "Seg e Qua", horas: "16h", nivel: "Avançado", dias_semana: [3, 1], hora_inicio: "16:00", hora_fim: "17:00", bloquear_agenda: true, quadra_id: "q1", contrato_id: null }],
      schedule_info: "Seg e Qua 16h",
      whatsapp_number: "5591984982865", botao_tipo: "whatsapp", botao_url: null, mensagem_whatsapp: null, ordem: 2, is_active: true,
    });
  });

  it("turma que não bloqueia a agenda não guarda quadra nem contrato", () => {
    const colunas = escolinhaSiteParaColunas({ ...form, turmas: [{ ...form.turmas[0], bloquearAgenda: false, contratoId: "c9" }] });
    expect(colunas.turmas).toEqual([expect.objectContaining({ bloquear_agenda: false, quadra_id: null, contrato_id: null })]);
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
