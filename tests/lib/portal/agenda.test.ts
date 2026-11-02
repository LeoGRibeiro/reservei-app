/**
 * @file agenda.test.ts
 * @description Regras da grade do portal (SPEC §7.3): horas seguidas, preço por faixa, antecedência e
 * horário de Belém, estados do horário, sinal e hora grátis (teto R$ 100), nome e .ics.
 */

import { describe, expect, it } from "vitest";
import type { QuadraPreco } from "@/lib/arena/types";
import {
  SELECAO_VAZIA,
  alternarHora,
  avisoDoDia,
  textoAntecedencia,
  diasDaGrade,
  hojeNoFusoArena,
  indexarGrade,
  mapearLinhaGrade,
  minutosNoFusoArena,
  periodosDoDia,
  precoDaHora,
  resumirSelecao,
  situacaoDoHorario,
} from "@/lib/portal/agenda";
import {
  codigoReserva,
  diaCurto,
  diaLongo,
  esporteNaFrase,
  funcionamento,
  haQuanto,
  haQuantoTempo,
  nomeProprio,
  reais,
  rotuloEsporte,
} from "@/lib/portal/formatos";
import { montarIcs } from "@/lib/portal/ics";
import type { QuadraPortal } from "@/lib/portal/types";

const areia: QuadraPortal = { id: "q1", nome: "Areia 1", esportes: ["Beach Tennis"], tipoPiso: "areia", valorHoraPadrao: 80, ordem: 1 };
const preco = (id: string, dias: number[], inicio: string, fim: string, valor: number): QuadraPreco => ({
  id, arenaId: "a", quadraId: "q1", diasSemana: dias, horaInicio: inicio, horaFim: fim, valorHora: valor, ativo: true, criadaEm: "",
});
const PRECOS = [preco("noite", [0, 1, 2, 3, 4, 5, 6], "18:00", "23:00", 100), preco("fds", [0, 6], "07:00", "18:00", 90)];
// 30/10/2026 é sexta; 31/10 é sábado
const SEXTA = "2026-10-30";
const SABADO = "2026-10-31";

describe("seleção de horas seguidas na mesma quadra", () => {
  it("junta horas vizinhas e começa nova seleção fora da sequência", () => {
    let s = alternarHora(SELECAO_VAZIA, "q1", 19);
    s = alternarHora(s, "q1", 20);
    expect(s).toEqual({ quadraId: "q1", horas: [19, 20] });
    s = alternarHora(s, "q1", 18);
    expect(s.horas).toEqual([18, 19, 20]);
    expect(alternarHora(s, "q1", 22)).toEqual({ quadraId: "q1", horas: [22] });
  });

  it("outra quadra troca a seleção", () => {
    expect(alternarHora({ quadraId: "q1", horas: [19, 20] }, "q2", 8)).toEqual({ quadraId: "q2", horas: [8] });
  });

  it("tirar a ponta encurta; tirar do meio corta dali em diante; tirar a última limpa", () => {
    const s = { quadraId: "q1", horas: [18, 19, 20, 21] };
    expect(alternarHora(s, "q1", 18).horas).toEqual([19, 20, 21]);
    expect(alternarHora(s, "q1", 21).horas).toEqual([18, 19, 20]);
    expect(alternarHora(s, "q1", 20).horas).toEqual([18, 19]);
    expect(alternarHora({ quadraId: "q1", horas: [19] }, "q1", 19)).toEqual(SELECAO_VAZIA);
  });
});

describe("preço por faixa", () => {
  it("dia de semana usa o padrão; noite e fim de semana usam a faixa", () => {
    expect(precoDaHora(areia, PRECOS, SEXTA, 10)).toBe(80);
    expect(precoDaHora(areia, PRECOS, SEXTA, 19)).toBe(100);
    expect(precoDaHora(areia, PRECOS, SABADO, 10)).toBe(90);
    expect(precoDaHora(areia, PRECOS, SABADO, 18)).toBe(100);
  });
});

describe("sinal e hora grátis do Clube", () => {
  it("sinal de 50% do total", () => {
    const r = resumirSelecao({ quadra: areia, horas: [19, 20], dia: SEXTA, precos: PRECOS, percentualSinal: 50, integral: false, tetoHoraGratis: null });
    expect([r.bruto, r.total, r.sinal, r.agora, r.resto]).toEqual([200, 200, 100, 100, 100]);
    expect([r.inicio, r.fim]).toEqual(["19:00", "21:00"]);
  });

  it("valor integral não deixa nada para a arena", () => {
    const r = resumirSelecao({ quadra: areia, horas: [10], dia: SEXTA, precos: PRECOS, percentualSinal: 50, integral: true, tetoHoraGratis: null });
    expect([r.agora, r.resto]).toEqual([80, 0]);
  });

  it("hora grátis desconta a hora mais barata, até o teto de R$ 100", () => {
    const mista = resumirSelecao({ quadra: areia, horas: [17, 18], dia: SEXTA, precos: PRECOS, percentualSinal: 50, integral: false, tetoHoraGratis: 100 });
    expect([mista.bruto, mista.desconto, mista.total, mista.sinal]).toEqual([180, 80, 100, 50]);
    const society: QuadraPortal = { ...areia, id: "q4", valorHoraPadrao: 150 };
    const cara = resumirSelecao({ quadra: society, horas: [10], dia: SEXTA, precos: [], percentualSinal: 50, integral: false, tetoHoraGratis: 100 });
    expect([cara.desconto, cara.total]).toEqual([100, 50]);
  });

  it("uma hora coberta pela hora grátis zera o valor", () => {
    const r = resumirSelecao({ quadra: areia, horas: [10], dia: SEXTA, precos: PRECOS, percentualSinal: 50, integral: false, tetoHoraGratis: 100 });
    expect([r.total, r.agora]).toEqual([0, 0]);
  });
});

describe("horário de Belém e antecedência", () => {
  const meioDiaUtc = new Date("2026-10-31T02:30:00Z"); // 23:30 do dia 30 em Belém

  it("hoje e minutos no fuso da arena, não do servidor", () => {
    expect(hojeNoFusoArena(meioDiaUtc)).toBe("2026-10-30");
    expect(minutosNoFusoArena(meioDiaUtc)).toBe(23 * 60 + 30);
  });

  it("31 fichas de data a partir de hoje", () => {
    const dias = diasDaGrade(SEXTA);
    expect(dias).toHaveLength(31);
    expect(dias[0]).toBe(SEXTA);
    expect(dias[30]).toBe("2026-11-29");
  });

  it("períodos a partir do funcionamento", () => {
    expect(periodosDoDia("07:00", "23:00").map((p) => [p.nome, p.horas[0], p.horas.at(-1)])).toEqual([
      ["Manhã", 7, 11], ["Tarde", 12, 17], ["Noite", 18, 22],
    ]);
  });

  it("aviso do dia: só quando o dia acabou ou a antecedência fecha o resto do dia", () => {
    const periodos = periodosDoDia("07:00", "23:00");
    const base = { dia: SEXTA, hoje: SEXTA, antecedenciaMin: 0, periodos };
    expect(avisoDoDia({ ...base, agoraMin: 6 * 60 })).toBeNull();
    // Antecedência 0: até as 22:00 começarem ainda dá para reservar
    expect(avisoDoDia({ ...base, agoraMin: 21 * 60 + 59 })).toBeNull();
    expect(avisoDoDia({ ...base, agoraMin: 22 * 60 })).toBe("Os horários de hoje já acabaram. Escolha outro dia.");
    // Antecedência de 1 hora às 21:30: as 22:00 ficam fechadas para o site
    expect(avisoDoDia({ ...base, antecedenciaMin: 60, agoraMin: 21 * 60 + 30 })).toBe(
      "Pelo site, as reservas fecham 1 hora antes do horário. Para hoje, fale com a arena."
    );
    expect(avisoDoDia({ ...base, antecedenciaMin: 60, agoraMin: 14 * 60 })).toBeNull();
    expect(avisoDoDia({ ...base, dia: SABADO, agoraMin: 22 * 60 })).toBeNull();
  });

  it("texto da antecedência", () => {
    expect(textoAntecedencia(30)).toBe("30 minutos");
    expect(textoAntecedencia(60)).toBe("1 hora");
    expect(textoAntecedencia(90)).toBe("1h30");
    expect(textoAntecedencia(120)).toBe("2 horas");
  });
});

describe("estados do horário", () => {
  const agora = new Date("2026-10-30T12:00:00Z");
  const grade = [
    mapearLinhaGrade({ id: "r1", quadra_id: "q1", data: SEXTA, horarios: ["19:00"], status: "pendente", tipo_reserva: "avulsa" }),
    mapearLinhaGrade({ id: "aula", quadra_id: "q1", data: SEXTA, horarios: ["16:00"], status: "confirmada", tipo_reserva: "escolinha", escolinha_id: "e1", esporte: "Beach Tennis" }),
    mapearLinhaGrade({ id: "lock", quadra_id: "q1", data: SEXTA, horarios: ["20:00"], status: "em_processamento", tipo_reserva: "avulsa", expira_em: "2026-10-30T11:00:00Z" }),
  ];
  const indice = indexarGrade(grade, agora);
  const base = { quadraId: "q1", dia: SEXTA, hoje: SEXTA, agoraMin: 9 * 60, antecedenciaMin: 60, indice, minhas: new Map<string, string>() };

  it("livre, ocupado, aula e encerrado (horário que já começou)", () => {
    expect(situacaoDoHorario({ ...base, h: 18 }).tipo).toBe("livre");
    expect(situacaoDoHorario({ ...base, h: 19 }).tipo).toBe("ocupado");
    expect(situacaoDoHorario({ ...base, h: 16 })).toEqual({ tipo: "aula", escolinhaId: "e1", esporte: "Beach Tennis" });
    expect(situacaoDoHorario({ ...base, h: 9 }).tipo).toBe("encerrado");
    expect(situacaoDoHorario({ ...base, h: 7 }).tipo).toBe("encerrado");
  });

  it("às 12:35 com antecedência 0: 12:00 encerrado, 13:00 livre", () => {
    const meioDia = { ...base, agoraMin: 12 * 60 + 35, antecedenciaMin: 0 };
    expect(situacaoDoHorario({ ...meioDia, h: 12 }).tipo).toBe("encerrado");
    expect(situacaoDoHorario({ ...meioDia, h: 13 }).tipo).toBe("livre");
  });

  it("às 12:35 com antecedência de 1 hora: 13:00 indisponível com motivo, 14:00 livre", () => {
    const meioDia = { ...base, agoraMin: 12 * 60 + 35, antecedenciaMin: 60 };
    expect(situacaoDoHorario({ ...meioDia, h: 13 })).toEqual({
      tipo: "indisponivel",
      motivo: "A arena fecha as reservas pelo site 1 hora antes do horário.",
    });
    expect(situacaoDoHorario({ ...meioDia, h: 14 }).tipo).toBe("livre");
  });

  it("horário ocupado dentro da antecedência continua ocupado; outro dia não tem corte", () => {
    const comCorte = { ...base, agoraMin: 18 * 60 + 30, antecedenciaMin: 60 };
    expect(situacaoDoHorario({ ...comCorte, h: 19 }).tipo).toBe("ocupado");
    expect(situacaoDoHorario({ ...comCorte, dia: SABADO, h: 7 }).tipo).toBe("livre");
  });

  it("exatamente na hora de início o horário já está encerrado", () => {
    expect(situacaoDoHorario({ ...base, agoraMin: 13 * 60, antecedenciaMin: 0, h: 13 }).tipo).toBe("encerrado");
  });

  it("lock de checkout vencido não ocupa", () => {
    expect(situacaoDoHorario({ ...base, h: 20 }).tipo).toBe("livre");
  });

  it("a reserva do próprio atleta aparece como sua", () => {
    const minhas = new Map([["2026-10-30|q1|19", "r1"]]);
    expect(situacaoDoHorario({ ...base, h: 19, minhas })).toEqual({ tipo: "meu", reservaId: "r1" });
  });
});

describe("textos", () => {
  it("datas por extenso relativas a hoje", () => {
    expect(diaLongo(SEXTA, SEXTA)).toBe("Hoje, sexta-feira, 30 de outubro");
    expect(diaLongo(SABADO, SEXTA)).toBe("Amanhã, sábado, 31 de outubro");
    expect(diaLongo("2026-11-02", SEXTA)).toBe("Segunda-feira, 2 de novembro");
    expect(diaCurto("2026-11-02", SEXTA)).toBe("Seg, 2 de nov");
  });

  it("dinheiro sem centavos quando inteiro", () => {
    expect(reais(100)).toBe("R$ 100");
    expect(reais(82.5)).toBe("R$ 82,50");
    expect(reais(1200)).toBe("R$ 1.200");
  });

  it("nome capitalizado (ana de souza → Ana de Souza)", () => {
    expect(nomeProprio("ana de souza")).toBe("Ana de Souza");
    expect(nomeProprio("  MARINA   DOS   santos e silva ")).toBe("Marina dos Santos e Silva");
  });

  it("esporte para exibir e dentro de frase", () => {
    expect(rotuloEsporte("Beach Tennis")).toBe("Beach tennis");
    expect(esporteNaFrase("Beach tennis")).toBe("beach tennis");
    expect(esporteNaFrase("CT Falcão 12")).toBe("CT Falcão 12");
  });

  it("funcionamento, tempo de publicação e de pedido", () => {
    expect(funcionamento("07:00", "23:00")).toBe("Todos os dias, das 7h às 23h");
    expect(haQuanto("2026-10-27", SEXTA)).toBe("há 3 dias");
    expect(haQuanto("2026-10-22", SEXTA)).toBe("há 1 semana");
    expect(haQuanto("2026-10-09", SEXTA)).toBe("há 3 semanas");
    const agora = new Date("2026-10-30T15:00:00Z");
    expect(haQuantoTempo("2026-10-30T13:00:00Z", agora)).toBe("há 2 horas");
    expect(haQuantoTempo("2026-10-29T10:00:00Z", agora)).toBe("ontem");
  });

  it("código curto da reserva", () => {
    expect(codigoReserva("rsv_1730312345_k7p2")).toBe("K7P2");
  });
});

describe(".ics", () => {
  it("converte o horário de Belém para UTC e escapa o endereço", () => {
    const ics = montarIcs(
      { id: "r1", data: SEXTA, horas: [19, 20], quadra: "Areia 2", arena: "Arena X", endereco: "Rua A, 1 - Centro" },
      new Date("2026-10-30T12:00:00Z")
    );
    expect(ics).toContain("DTSTART:20261030T220000Z");
    expect(ics).toContain("DTEND:20261031T000000Z");
    expect(ics).toContain("SUMMARY:Areia 2 · Arena X");
    expect(ics).toContain("LOCATION:Rua A\\, 1 - Centro");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
