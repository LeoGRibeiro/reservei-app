/**
 * @file horariosAntigos.test.ts
 * @description Horários antigos sem escolinha (SPEC/2026-11-02-admin-ajustes-demo.md §4): quais
 * contratos aparecem no aviso e como viram turma de uma escolinha.
 */

import { describe, expect, it } from "vitest";
import { contratosSemEscolinha, planejarAgenda, turmaDoContrato, turmaVazia, vincularContratos } from "@/lib/institucional/escolinhasSite";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";

const base: Omit<ContratoRecorrente, "id"> = {
  tipo: "escolinha",
  nome: "Escolinha antiga",
  responsavelNome: "Prof. Ana",
  contatoWhatsapp: "91999990000",
  quadraId: "q1",
  diasSemana: [4, 2],
  horaInicio: "08:00",
  horaFim: "10:00",
  dataInicio: "2026-11-01",
  meses: 6,
  ativo: true,
} as Omit<ContratoRecorrente, "id">;

describe("contratosSemEscolinha", () => {
  const contratos = [
    { ...base, id: "sem-id" },
    { ...base, id: "ligado", escolinhaId: "e1" },
    { ...base, id: "escolinha-apagada", escolinhaId: "e-que-sumiu" },
    { ...base, id: "usado-como-turma" },
    { ...base, id: "encerrado", ativo: false },
    { ...base, id: "grupo", tipo: "grupo" as const },
  ] as ContratoRecorrente[];
  const escolinhas = [{ id: "e1", turmas: [{ ...turmaVazia("q1"), contratoId: "usado-como-turma" }] }];

  it("lista contratos de escolinha ativos sem turma: sem escolinha, escolinha apagada ou sem turma de mesmo horário", () => {
    expect(contratosSemEscolinha(contratos, escolinhas).map((c) => c.id)).toEqual(["sem-id", "ligado", "escolinha-apagada"]);
  });

  it("sem contratos, lista vazia", () => {
    expect(contratosSemEscolinha([], escolinhas)).toEqual([]);
  });
});

describe("vincularContratos", () => {
  it("casa o contrato da escolinha com a turma de mesmos dias e horário, mesmo sem o id gravado na turma", () => {
    const turma = { ...turmaVazia(""), diasSemana: [2, 4] as (2 | 4)[], horaInicio: "08:00", horaFim: "10:00", bloquearAgenda: false };
    const outra = { ...turmaVazia(""), diasSemana: [6] as 6[], horaInicio: "09:00", horaFim: "10:00", bloquearAgenda: false };
    const contratos = [
      { ...base, id: "da-escolinha", escolinhaId: "e1", quadraId: "q3" },
      { ...base, id: "horario-diferente", escolinhaId: "e1", horaInicio: "18:00", horaFim: "19:00" },
    ] as ContratoRecorrente[];
    const { escolinhas, antigos } = vincularContratos([{ id: "e1", turmas: [turma, outra] }], contratos);
    expect(escolinhas[0].turmas[0]).toMatchObject({ contratoId: "da-escolinha", bloquearAgenda: true, quadraId: "q3" });
    expect(escolinhas[0].turmas[1].contratoId).toBe("");
    expect(antigos.map((c) => c.id)).toEqual(["horario-diferente"]);
  });

  it("não altera as escolinhas recebidas (cópia)", () => {
    const turma = { ...turmaVazia(""), diasSemana: [2, 4] as (2 | 4)[], horaInicio: "08:00", horaFim: "10:00" };
    const original = [{ id: "e1", turmas: [turma] }];
    vincularContratos(original, [{ ...base, id: "c", escolinhaId: "e1" } as ContratoRecorrente]);
    expect(original[0].turmas[0].contratoId).toBe("");
  });

  it("um contrato só preenche uma turma, mesmo com duas turmas iguais", () => {
    const turma = { ...turmaVazia(""), diasSemana: [2, 4] as (2 | 4)[], horaInicio: "08:00", horaFim: "10:00" };
    const { escolinhas } = vincularContratos([{ id: "e1", turmas: [turma, { ...turma }] }], [{ ...base, id: "c", escolinhaId: "e1" } as ContratoRecorrente]);
    expect(escolinhas[0].turmas.map((t) => t.contratoId)).toEqual(["c", ""]);
  });
});

describe("turmaDoContrato", () => {
  it("vira turma com os mesmos dias, horário, quadra e contrato, já bloqueada na agenda", () => {
    const turma = turmaDoContrato({ ...base, id: "sem-id", faixaEtaria: "Infantil" });
    expect(turma).toMatchObject({
      dias: "Ter e Qui",
      horas: "8h e 9h",
      categoria: "Infantil",
      diasSemana: [2, 4],
      horaInicio: "08:00",
      horaFim: "10:00",
      quadraId: "q1",
      bloquearAgenda: true,
      contratoId: "sem-id",
    });
  });

  it("ligar não cria nem encerra contrato: o plano da agenda mantém a turma", () => {
    const turma = turmaDoContrato({ ...base, id: "sem-id" });
    const plano = planejarAgenda([turma], [turma]);
    expect(plano.criar).toEqual([]);
    expect(plano.encerrar).toEqual([]);
  });
});
