/**
 * @file arenaService.spec.ts
 * @description Suíte de testes unitários extensivos para o serviço de domínio ArenaService.
 * Cobre regras de precificação dinâmica, dias da semana, tolerância temporal e validações.
 * Conforme especificação técnica SPEC/2026-10-14-arquitetura-multi-tenant-seguranca.md.
 */

import { describe, it, expect } from "vitest";
import {
  obterDiaSemanaUtc,
  normalizarHora,
  calcularPrecoReserva,
  gerarHorariosOperacionais,
  validarAntecedenciaMinima,
  validarEsporteQuadra,
} from "@/lib/arena/arenaService";
import type { Quadra, QuadraPreco } from "@/lib/arena/types";

describe("ArenaService - Funções Utilitárias e de Fuso Horário", () => {
  it("obterDiaSemanaUtc deve calcular corretamente os dias da semana sem desvios de timezone", () => {
    // 2026-10-25 foi um Domingo (0)
    expect(obterDiaSemanaUtc("2026-10-25")).toBe(0);
    // 2026-10-26 foi uma Segunda-feira (1)
    expect(obterDiaSemanaUtc("2026-10-26")).toBe(1);
    // 2026-10-31 foi um Sábado (6)
    expect(obterDiaSemanaUtc("2026-10-31")).toBe(6);
  });

  it("obterDiaSemanaUtc deve retornar 0 para strings inválidas ou vazias", () => {
    expect(obterDiaSemanaUtc("")).toBe(0);
    expect(obterDiaSemanaUtc("invalido")).toBe(0);
  });

  it("normalizarHora deve padronizar strings no formato HH:mm", () => {
    expect(normalizarHora("8:00")).toBe("08:00");
    expect(normalizarHora("08:00")).toBe("08:00");
    expect(normalizarHora("19:30")).toBe("19:30");
    expect(normalizarHora("")).toBe("00:00");
  });
});

describe("ArenaService - Cálculo de Preços Dinâmicos (calcularPrecoReserva)", () => {
  const quadraSociety: Quadra = {
    id: "quadra-society-1",
    arenaId: "arena-belem",
    numero: 1,
    nome: "Quadra Society Principal",
    tipoPiso: "society",
    esportes: ["Futsal", "Outro"],
    coberta: false,
    iluminacao: true,
    valorHoraPadrao: 100.0,
    ordem: 1,
    ativa: true,
    criadaEm: "2026-01-01T00:00:00Z",
  };

  const regrasPreco: QuadraPreco[] = [
    // Tarifa Noturna com Luz (Seg a Sex das 18h às 23h): R$ 150
    {
      id: "preco-noturno-society",
      arenaId: "arena-belem",
      quadraId: "quadra-society-1",
      diasSemana: [1, 2, 3, 4, 5],
      horaInicio: "18:00",
      horaFim: "23:00",
      valorHora: 150.0,
      descricao: "Tarifa Noturna com Refletores",
      ativo: true,
      criadaEm: "2026-01-01T00:00:00Z",
    },
    // Tarifa Fim de Semana Integral (Sáb e Dom): R$ 180
    {
      id: "preco-fds-society",
      arenaId: "arena-belem",
      quadraId: "quadra-society-1",
      diasSemana: [0, 6],
      horaInicio: "07:00",
      horaFim: "23:00",
      valorHora: 180.0,
      descricao: "Tarifa Especial Fim de Semana",
      ativo: true,
      criadaEm: "2026-01-01T00:00:00Z",
    },
    // Regra inativa (não deve ser aplicada)
    {
      id: "preco-inativo",
      arenaId: "arena-belem",
      quadraId: "quadra-society-1",
      diasSemana: [1, 2, 3, 4, 5],
      horaInicio: "08:00",
      horaFim: "12:00",
      valorHora: 50.0,
      descricao: "Promoção Antiga Inativa",
      ativo: false,
      criadaEm: "2026-01-01T00:00:00Z",
    },
  ];

  it("deve retornar zeros quando nenhum horário for fornecido", () => {
    const resultado = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-26",
      horarios: [],
    });

    expect(resultado.valorTotal).toBe(0);
    expect(resultado.valorSinal).toBe(0);
    expect(resultado.valorPendente).toBe(0);
    expect(resultado.detalhamento).toHaveLength(0);
  });

  it("deve utilizar a tarifa base da quadra caso nenhuma regra dinâmica seja aplicável", () => {
    // Segunda-feira (1) às 10:00 (fora da regra noturna 18-23h e a regra da manhã está inativa)
    const resultado = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-26",
      horarios: ["10:00"],
      percentualSinal: 50,
    });

    expect(resultado.valorTotal).toBe(100.0);
    expect(resultado.valorSinal).toBe(50.0);
    expect(resultado.valorPendente).toBe(50.0);
    expect(resultado.detalhamento[0].regraAplicada).toBe("Tarifa Base Padrão");
  });

  it("deve aplicar a tarifa noturna quando o slot estiver no horário de refletores em dia de semana", () => {
    // Segunda-feira (1) às 19:00 e 20:00
    const resultado = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-26",
      horarios: ["19:00", "20:00"],
      percentualSinal: 50,
    });

    expect(resultado.valorTotal).toBe(300.0); // 2 * 150
    expect(resultado.valorSinal).toBe(150.0);
    expect(resultado.valorPendente).toBe(150.0);
    expect(resultado.detalhamento[0].regraAplicada).toBe("Tarifa Noturna com Refletores");
    expect(resultado.detalhamento[1].regraAplicada).toBe("Tarifa Noturna com Refletores");
  });

  it("deve calcular corretamente reservas com horários mistos (diurno base + noturno especial)", () => {
    // Segunda-feira às 17:00 (base: R$ 100) e 18:00 (noturno: R$ 150)
    const resultado = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-26",
      horarios: ["17:00", "18:00"],
      percentualSinal: 50,
    });

    expect(resultado.valorTotal).toBe(250.0); // 100 + 150
    expect(resultado.valorSinal).toBe(125.0);
    expect(resultado.valorPendente).toBe(125.0);
    expect(resultado.detalhamento[0].valor).toBe(100.0);
    expect(resultado.detalhamento[1].valor).toBe(150.0);
  });

  it("deve aplicar a tarifa de final de semana nos sábados e domingos", () => {
    // Domingo (2026-10-25) às 10:00
    const resultado = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-25",
      horarios: ["10:00"],
      percentualSinal: 50,
    });

    expect(resultado.valorTotal).toBe(180.0);
    expect(resultado.valorSinal).toBe(90.0);
    expect(resultado.detalhamento[0].regraAplicada).toBe("Tarifa Especial Fim de Semana");
  });

  it("deve suportar percentuais de sinal personalizados (ex: 100% integral ou 30%)", () => {
    // Sinal de 100% (pagamento integral)
    const resultado100 = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-26",
      horarios: ["10:00"],
      percentualSinal: 100,
    });
    expect(resultado100.valorSinal).toBe(100.0);
    expect(resultado100.valorPendente).toBe(0.0);

    // Sinal de 30%
    const resultado30 = calcularPrecoReserva({
      quadra: quadraSociety,
      precos: regrasPreco,
      data: "2026-10-26",
      horarios: ["10:00"],
      percentualSinal: 30,
    });
    expect(resultado30.valorSinal).toBe(30.0);
    expect(resultado30.valorPendente).toBe(70.0);
  });
});

describe("ArenaService - Geração de Slots Operacionais", () => {
  it("deve gerar a grade correta para intervalo comercial de 08:00 às 12:00 em blocos de 60 minutos", () => {
    const slots = gerarHorariosOperacionais("08:00", "12:00", 60);
    expect(slots).toEqual(["08:00", "09:00", "10:00", "11:00"]);
  });

  it("deve suportar abertura cedo às 06:00 e fechamento tarde às 23:00", () => {
    const slots = gerarHorariosOperacionais("06:00", "23:00", 60);
    expect(slots[0]).toBe("06:00");
    expect(slots[slots.length - 1]).toBe("22:00");
    expect(slots).toHaveLength(17);
  });
});

describe("ArenaService - Validação de Antecedência Mínima e Esportes", () => {
  it("deve rejeitar reservas para horários que já passaram", () => {
    const agora = new Date(2026, 9, 20, 15, 0, 0); // 20/10/2026 às 15:00
    const checagem = validarAntecedenciaMinima("2026-10-20", "14:00", 60, agora);
    expect(checagem.valido).toBe(false);
    expect(checagem.motivo).toContain("passado");
  });

  it("deve rejeitar reservas que não cumpram a antecedência mínima em minutos", () => {
    const agora = new Date(2026, 9, 20, 14, 30, 0); // 20/10/2026 às 14:30
    // O jogo começa em 30 minutos (15:00), mas a arena exige 60 minutos de antecedência
    const checagem = validarAntecedenciaMinima("2026-10-20", "15:00", 60, agora);
    expect(checagem.valido).toBe(false);
    expect(checagem.motivo).toContain("antecedência mínima de 60 minutos");
  });

  it("deve aprovar reservas com tempo de antecedência suficiente", () => {
    const agora = new Date(2026, 9, 20, 10, 0, 0); // 20/10/2026 às 10:00
    // O jogo começa às 18:00 (8 horas de antecedência)
    const checagem = validarAntecedenciaMinima("2026-10-20", "18:00", 60, agora);
    expect(checagem.valido).toBe(true);
  });

  it("deve validar se a quadra aceita a modalidade esportiva", () => {
    const quadraBeach: Quadra = {
      id: "q-areia",
      arenaId: "arena-1",
      numero: 1,
      nome: "Quadra de Areia",
      tipoPiso: "areia",
      esportes: ["Vôlei", "Outro"],
      coberta: false,
      iluminacao: true,
      valorHoraPadrao: 80,
      ordem: 1,
      ativa: true,
      criadaEm: "2026-01-01T00:00:00Z",
    };

    expect(validarEsporteQuadra(quadraBeach, "Vôlei")).toBe(true);
    expect(validarEsporteQuadra(quadraBeach, "vôlei")).toBe(true); // case-insensitive
    expect(validarEsporteQuadra(quadraBeach, "Basquete")).toBe(false);
  });
});
