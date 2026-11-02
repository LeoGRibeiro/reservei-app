/**
 * @file HojeAgenda.test.tsx
 * @description Regras das telas Hoje e Agenda: horário em andamento, números do dia (sem Pix vencido
 * nem bloqueios) e quem ocupa cada horário da grade.
 */

import { describe, expect, it } from "vitest";
import { horarioAtual, resumoDoDia } from "@/components/admin/hoje/PaginaHoje";
import { ocupanteDoHorario } from "@/components/admin/agenda/PaginaAgenda";
import type { Reserva } from "@/store/useReservasStore";

const AGORA = new Date(2026, 10, 2, 18, 30);

const r = (id: string, extra: Partial<Reserva> = {}): Reserva => ({
  id,
  quadraId: "q1",
  nomeCliente: id,
  whatsappCliente: "",
  cpfCliente: "",
  data: "2026-11-02",
  horarios: ["18:00"],
  horaInicio: "18:00",
  horaFim: "19:00",
  valorTotal: 100,
  valorSinal: 50,
  valorPendente: 50,
  status: "pendente",
  statusWhatsApp: "nao_enviado",
  criadaEm: "2026-11-01T10:00:00Z",
  tipoReserva: "avulsa",
  ...extra,
});

describe("horarioAtual", () => {
  it("é o último horário que já começou", () => {
    expect(horarioAtual(["07:00", "18:00", "19:00"], AGORA)).toBe("18:00");
    expect(horarioAtual(["19:00"], AGORA)).toBeNull();
  });
});

describe("resumoDoDia", () => {
  it("separa recebido e a receber e ignora Pix vencido, canceladas e bloqueios", () => {
    const reservas = [
      r("sinal"),
      r("quitada", { status: "confirmada", valorPendente: 0, horarios: ["19:00"] }),
      r("pix-vencido", { status: "em_processamento", expiraEm: "2026-11-02T00:00:00Z" }),
      r("cancelada", { status: "cancelada" }),
      r("bloqueio", { tipoReserva: "manutencao_bloqueio", status: "confirmada", valorTotal: 0, valorPendente: 0, horarios: ["20:00", "21:00"] }),
      r("ontem", { data: "2026-11-01" }),
    ];
    const resumo = resumoDoDia(reservas, "2026-11-02", 10, AGORA);
    expect(resumo).toMatchObject({ reservas: 2, recebido: 150, aReceber: 50, ocupacao: 20 });
  });
});

describe("ocupanteDoHorario", () => {
  it("acha quem ocupa a quadra no horário e ignora canceladas", () => {
    const lista = [r("a", { horarios: ["18:00", "19:00"] }), r("b", { status: "cancelada", horarios: ["20:00"] })];
    expect(ocupanteDoHorario(lista, "q1", "2026-11-02", "19:00", AGORA)?.id).toBe("a");
    expect(ocupanteDoHorario(lista, "q1", "2026-11-02", "20:00", AGORA)).toBeUndefined();
    expect(ocupanteDoHorario(lista, "q2", "2026-11-02", "18:00", AGORA)).toBeUndefined();
  });
});
