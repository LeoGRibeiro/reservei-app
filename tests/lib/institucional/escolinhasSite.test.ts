import { describe, expect, it } from "vitest";
import {
  esporteDoContrato,
  escolinhaVazia,
  interpretarTextoTurma,
  planejarAgenda,
  textoDias,
  textoHoras,
  turmaVazia,
  hrefBotaoEscolinha,
  limparNomeProfessor,
  linkValido,
  mensagemPadraoEscolinha,
  normalizarWhatsApp,
  resumirTurmas,
  tituloEscolinha,
  validarEscolinhaSite,
  type EscolinhaSiteInput,
  type TurmaSite,
} from "@/lib/institucional/escolinhasSite";

const turma = (extra: Partial<TurmaSite> = {}): TurmaSite => ({
  ...turmaVazia("q1"),
  diasSemana: [1, 3],
  horaInicio: "16:00",
  horaFim: "17:00",
  categoria: "Avançado",
  ...extra,
});

const valida = (extra: Partial<EscolinhaSiteInput> = {}): EscolinhaSiteInput => ({
  ...escolinhaVazia(),
  esporte: "Beach tennis",
  professor: "Italo Bianck",
  turmas: [turma()],
  ...extra,
});

describe("mensagemPadraoEscolinha", () => {
  it("monta a frase com o esporte em minúscula e o professor", () => {
    expect(mensagemPadraoEscolinha("Beach tennis", "Italo Bianck")).toBe(
      "Olá! Vim pelo site e quero uma vaga no beach tennis com o Prof. Italo Bianck. Pode me passar os valores e as vagas das turmas?"
    );
  });

  it("não duplica o 'Prof.' digitado pelo dono e mantém siglas", () => {
    expect(mensagemPadraoEscolinha("CT Falcão 12", "Prof. Marcos Falcão")).toContain("no CT Falcão 12 com o Prof. Marcos Falcão.");
  });

  it("mostra marcadores enquanto esporte e professor estão vazios", () => {
    expect(mensagemPadraoEscolinha("", "")).toContain("no [esporte] com o Prof. [professor]");
  });
});

describe("limparNomeProfessor / normalizarWhatsApp / linkValido", () => {
  it("tira Prof., Profa. e Professora", () => {
    expect(limparNomeProfessor("Prof. Lucas")).toBe("Lucas");
    expect(limparNomeProfessor("Profa. Ana")).toBe("Ana");
    expect(limparNomeProfessor("professora Bia")).toBe("Bia");
    expect(limparNomeProfessor("Profeta Silva")).toBe("Profeta Silva");
  });

  it("põe o 55 em números nacionais e mantém vazio", () => {
    expect(normalizarWhatsApp("(91) 98498-2865")).toBe("5591984982865");
    expect(normalizarWhatsApp("5591984982865")).toBe("5591984982865");
    expect(normalizarWhatsApp("")).toBe("");
  });

  it("aceita só https com domínio", () => {
    expect(linkValido("https://forms.gle/abc")).toBe(true);
    expect(linkValido("http://forms.gle/abc")).toBe(false);
    expect(linkValido("javascript:alert(1)")).toBe(false);
    expect(linkValido("https://com espaço.com")).toBe(false);
  });
});

describe("validarEscolinhaSite", () => {
  it("aceita uma escolinha completa", () => {
    expect(validarEscolinhaSite(valida())).toEqual({});
  });

  it("exige esporte, professor e uma turma com dias e horários", () => {
    const erros = validarEscolinhaSite(valida({ esporte: " ", professor: "Prof. ", turmas: [turmaVazia()] }));
    expect(Object.keys(erros).sort()).toEqual(["esporte", "professor", "turmas"]);
  });

  it("recusa turma sem horário, com fim antes do início ou sem quadra quando bloqueia a agenda", () => {
    expect(validarEscolinhaSite(valida({ turmas: [turma({ horaFim: "" })] })).turmas).toMatch(/Turma 1: escolha os dias/);
    expect(validarEscolinhaSite(valida({ turmas: [turma({ horaInicio: "18:00", horaFim: "17:00" })] })).turmas).toMatch(/fim precisa ser depois/);
    expect(validarEscolinhaSite(valida({ turmas: [turma(), turma({ quadraId: "" })] })).turmas).toMatch(/Turma 2: escolha a quadra/);
    expect(validarEscolinhaSite(valida({ turmas: [turma({ quadraId: "", bloquearAgenda: false })] })).turmas).toBeUndefined();
  });

  it("recusa WhatsApp sem DDD e aceita vazio (usa o da arena)", () => {
    expect(validarEscolinhaSite(valida({ whatsapp: "98498-2865" })).whatsapp).toBeDefined();
    expect(validarEscolinhaSite(valida({ whatsapp: "" })).whatsapp).toBeUndefined();
  });

  it("exige link https quando o botão é de link", () => {
    expect(validarEscolinhaSite(valida({ tipoBotao: "link", linkBotao: "forms.gle/x" })).linkBotao).toBeDefined();
    expect(validarEscolinhaSite(valida({ tipoBotao: "link", linkBotao: "https://forms.gle/x" })).linkBotao).toBeUndefined();
  });

  it("limita a mensagem a 500 caracteres", () => {
    expect(validarEscolinhaSite(valida({ mensagemWhatsapp: "a".repeat(501) })).mensagemWhatsapp).toBeDefined();
  });
});

describe("hrefBotaoEscolinha", () => {
  const base = { tipoBotao: "whatsapp" as const, linkBotao: "", whatsapp: "", mensagemWhatsapp: "", esporte: "Vôlei", professor: "Lucas" };

  it("usa o WhatsApp da arena e a mensagem padrão quando não há número nem mensagem", () => {
    const href = hrefBotaoEscolinha(base, "5591984982865");
    expect(href.startsWith("https://wa.me/5591984982865?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1])).toBe(mensagemPadraoEscolinha("Vôlei", "Lucas"));
  });

  it("usa o número e a mensagem personalizados", () => {
    const href = hrefBotaoEscolinha({ ...base, whatsapp: "(91) 99999-0000", mensagemWhatsapp: "Quero a turma de sábado" }, "5591984982865");
    expect(href).toBe(`https://wa.me/5591999990000?text=${encodeURIComponent("Quero a turma de sábado")}`);
  });

  it("abre o link quando o botão é de link; link inválido volta para o WhatsApp", () => {
    expect(hrefBotaoEscolinha({ ...base, tipoBotao: "link", linkBotao: "https://forms.gle/x" }, "55")).toBe("https://forms.gle/x");
    expect(hrefBotaoEscolinha({ ...base, tipoBotao: "link", linkBotao: "javascript:x" }, "5591984982865")).toMatch(/^https:\/\/wa\.me\//);
  });
});

describe("resumirTurmas / tituloEscolinha", () => {
  it("resume as turmas preenchidas com o texto montado dos dias e horários", () => {
    expect(resumirTurmas([turma(), turmaVazia(), turma({ diasSemana: [6], horaInicio: "09:00", horaFim: "12:00" })])).toBe("Seg e Qua 16h; Sábado 9h, 10h e 11h");
  });

  it("título é o nome ou, sem nome, o esporte", () => {
    expect(tituloEscolinha({ nome: "CT Falcão 12", esporte: "Futebol society" })).toBe("CT Falcão 12");
    expect(tituloEscolinha({ nome: " ", esporte: "Vôlei" })).toBe("Vôlei");
  });
});

describe("textoDias / textoHoras", () => {
  it("monta os dias como o aluno lê", () => {
    expect(textoDias([4, 2])).toBe("Ter e Qui");
    expect(textoDias([1, 2, 3, 4, 5])).toBe("Seg a Sex");
    expect(textoDias([6])).toBe("Sábado");
    expect(textoDias([0])).toBe("Domingo");
    expect(textoDias([1, 3, 5])).toBe("Seg, Qua e Sex");
    expect(textoDias([])).toBe("");
  });

  it("monta os horários por aula de 1 hora e faixa acima de 4 aulas", () => {
    expect(textoHoras("08:00", "10:00")).toBe("8h e 9h");
    expect(textoHoras("16:00", "17:00")).toBe("16h");
    expect(textoHoras("17:00", "20:00")).toBe("17h, 18h e 19h");
    expect(textoHoras("07:00", "12:00")).toBe("7h às 12h");
    expect(textoHoras("10:00", "09:00")).toBe("");
  });
});

describe("interpretarTextoTurma (turmas antigas, só em texto)", () => {
  it("entende dias e horários do seed", () => {
    expect(interpretarTextoTurma("Seg e Qua", "17h e 18h")).toEqual({ diasSemana: [1, 3], horaInicio: "17:00", horaFim: "19:00" });
    expect(interpretarTextoTurma("Sábado", "9h, 10h e 11h")).toEqual({ diasSemana: [6], horaInicio: "09:00", horaFim: "12:00" });
    expect(interpretarTextoTurma("Seg a Sex", "7h às 12h")).toEqual({ diasSemana: [1, 2, 3, 4, 5], horaInicio: "07:00", horaFim: "12:00" });
  });

  it("deixa vazio o que não entende", () => {
    expect(interpretarTextoTurma("a combinar", "fim de tarde")).toEqual({ diasSemana: [], horaInicio: "", horaFim: "" });
  });
});

describe("esporteDoContrato", () => {
  it("acha o esporte da lista mesmo com escrita diferente", () => {
    expect(esporteDoContrato("Beach tennis")).toBe("Beach Tennis");
    expect(esporteDoContrato("futevolei")).toBe("Futevôlei");
    expect(esporteDoContrato("Futebol society")).toBe("Futebol Society");
    expect(esporteDoContrato("Xadrez")).toBe("Outro");
  });
});

describe("planejarAgenda", () => {
  it("cria contrato para turma nova que bloqueia a agenda e ignora as que não bloqueiam", () => {
    expect(planejarAgenda([], [turma(), turma({ bloquearAgenda: false })])).toEqual({ criar: [0], encerrar: [], manter: [] });
  });

  it("mantém o contrato quando dia, horário e quadra não mudaram", () => {
    const antes = [turma({ contratoId: "c1" })];
    expect(planejarAgenda(antes, [turma({ contratoId: "c1", categoria: "Outra" })])).toEqual({ criar: [], encerrar: [], manter: [0] });
  });

  it("refaz o contrato quando muda dia, horário ou quadra", () => {
    const antes = [turma({ contratoId: "c1" })];
    expect(planejarAgenda(antes, [turma({ contratoId: "c1", horaFim: "18:00" })])).toEqual({ criar: [0], encerrar: ["c1"], manter: [] });
    expect(planejarAgenda(antes, [turma({ contratoId: "c1", quadraId: "q2" })])).toEqual({ criar: [0], encerrar: ["c1"], manter: [] });
  });

  it("encerra o contrato da turma removida ou desmarcada", () => {
    const antes = [turma({ contratoId: "c1" }), turma({ contratoId: "c2", diasSemana: [6] })];
    expect(planejarAgenda(antes, [turma({ contratoId: "c2", diasSemana: [6], bloquearAgenda: false })])).toEqual({ criar: [], encerrar: ["c2", "c1"], manter: [] });
  });
});
