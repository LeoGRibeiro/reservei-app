/**
 * @file fusoHorario.spec.ts
 * @description Cálculos de data/hora no fuso da arena, independentes do fuso do servidor (UTC na Vercel).
 */

import { describe, expect, it } from "vitest";
import { hojeNoFuso, instanteNoFuso, somarDias } from "@/lib/datas/fusoHorario";

describe("fusoHorario", () => {
  it("calcula 'hoje' em Belém mesmo quando já é amanhã em UTC", () => {
    expect(hojeNoFuso("America/Belem", new Date("2026-10-22T01:30:00Z"))).toBe("2026-10-21");
    expect(hojeNoFuso("America/Belem", new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-22");
  });

  it("converte o horário de parede da arena para o instante absoluto", () => {
    expect(instanteNoFuso("2026-10-21", "20:00", "America/Belem").toISOString()).toBe("2026-10-21T23:00:00.000Z");
    expect(instanteNoFuso("2026-10-21", "22:30", "America/Belem").toISOString()).toBe("2026-10-22T01:30:00.000Z");
    expect(instanteNoFuso("2026-07-01", "10:00", "America/Sao_Paulo").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });

  it("soma dias atravessando meses e anos", () => {
    expect(somarDias("2026-10-30", 7)).toBe("2026-11-06");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});
