import { describe, expect, it } from "vitest";
import {
  escolinhaVazia,
  hrefBotaoEscolinha,
  limparNomeProfessor,
  linkValido,
  mensagemPadraoEscolinha,
  normalizarWhatsApp,
  resumirTurmas,
  tituloEscolinha,
  validarEscolinhaSite,
  type EscolinhaSiteInput,
} from "@/lib/institucional/escolinhasSite";

const valida = (extra: Partial<EscolinhaSiteInput> = {}): EscolinhaSiteInput => ({
  ...escolinhaVazia(),
  esporte: "Beach tennis",
  professor: "Italo Bianck",
  turmas: [{ dias: "Seg e Qua", horas: "16h", categoria: "Avançado" }],
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
    const erros = validarEscolinhaSite(valida({ esporte: " ", professor: "Prof. ", turmas: [{ dias: "", horas: "", categoria: "" }] }));
    expect(Object.keys(erros).sort()).toEqual(["esporte", "professor", "turmas"]);
  });

  it("recusa turma com dias mas sem horários", () => {
    expect(validarEscolinhaSite(valida({ turmas: [{ dias: "Seg", horas: "", categoria: "Livre" }] })).turmas).toMatch(/dias e horários/);
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
  it("resume as turmas preenchidas", () => {
    expect(resumirTurmas([{ dias: "Seg e Qua", horas: "16h", categoria: "Avançado" }, { dias: "", horas: "", categoria: "" }, { dias: "Sáb", horas: "9h", categoria: "" }])).toBe("Seg e Qua 16h; Sáb 9h");
  });

  it("título é o nome ou, sem nome, o esporte", () => {
    expect(tituloEscolinha({ nome: "CT Falcão 12", esporte: "Futebol society" })).toBe("CT Falcão 12");
    expect(tituloEscolinha({ nome: " ", esporte: "Vôlei" })).toBe("Vôlei");
  });
});
