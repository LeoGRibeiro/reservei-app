/**
 * @file lockService.spec.ts
 * @description Suíte de testes unitários para as regras transacionais de lock temporário
 * contra double-booking do sistema Reservei.
 */

import { describe, it, expect } from "vitest";
import {
  isLockAtivo,
  isReservaOcupandoSlot,
  filtrarHorariosOcupadosComLock,
  identificarReservasExpiradas,
  calcularTempoRestanteLockSegundos,
  gerarTimestampExpiracaoLock,
} from "@/lib/pagamento/lockService";
import type { Reserva } from "@/store/useReservasStore";

describe("LockService - Validação de Locks Temporários", () => {
  const agora = new Date("2026-10-20T14:00:00Z");

  it("deve considerar lock ativo quando a reserva estiver em processamento com prazo futuro", () => {
    const reservaComLock: Reserva = {
      id: "r1",
      quadraId: "q1",
      data: "2026-10-20",
      horarios: ["18:00"],
      horaInicio: "18:00",
      horaFim: "19:00",
      nomeCliente: "Carlos",
      whatsappCliente: "91999998888",
      cpfCliente: "",
      valorTotal: 100,
      valorSinal: 50,
      valorPendente: 50,
      status: "em_processamento",
      statusWhatsApp: "nao_enviado",
      criadaEm: "2026-10-20T13:55:00Z",
      expiraEm: "2026-10-20T14:05:00Z", // 5 minutos no futuro em relação a `agora`
    } as any;

    expect(isLockAtivo(reservaComLock, agora)).toBe(true);
  });

  it("deve considerar lock inativo quando o prazo limite expirar", () => {
    const reservaExpirada: Reserva = {
      id: "r2",
      quadraId: "q1",
      data: "2026-10-20",
      horarios: ["18:00"],
      horaInicio: "18:00",
      horaFim: "19:00",
      nomeCliente: "Marcos",
      whatsappCliente: "91999998888",
      cpfCliente: "",
      valorTotal: 100,
      valorSinal: 50,
      valorPendente: 50,
      status: "em_processamento",
      statusWhatsApp: "nao_enviado",
      criadaEm: "2026-10-20T13:40:00Z",
      expiraEm: "2026-10-20T13:50:00Z", // Expirou há 10 minutos
    } as any;

    expect(isLockAtivo(reservaExpirada, agora)).toBe(false);
  });

  it("deve retornar false para reservas que não estejam em_processamento", () => {
    const reservaConfirmada: Reserva = {
      id: "r3",
      quadraId: "q1",
      data: "2026-10-20",
      horarios: ["18:00"],
      horaInicio: "18:00",
      horaFim: "19:00",
      nomeCliente: "Lucas",
      whatsappCliente: "91999998888",
      cpfCliente: "",
      valorTotal: 100,
      valorSinal: 50,
      valorPendente: 50,
      status: "confirmada",
      statusWhatsApp: "enviado",
      criadaEm: "2026-10-20T13:00:00Z",
    };

    expect(isLockAtivo(reservaConfirmada, agora)).toBe(false);
  });
});

describe("LockService - Bloqueio de Slots na Agenda (isReservaOcupandoSlot)", () => {
  const agora = new Date("2026-10-20T14:00:00Z");

  const base: Omit<Reserva, "id" | "status"> = {
    quadraId: "q1",
    data: "2026-10-20",
    horarios: ["19:00"],
    horaInicio: "19:00",
    horaFim: "20:00",
    nomeCliente: "Cliente",
    whatsappCliente: "91999998888",
    cpfCliente: "",
    valorTotal: 100,
    valorSinal: 50,
    valorPendente: 50,
    statusWhatsApp: "nao_enviado",
    criadaEm: "2026-10-20T13:55:00Z",
  };

  it("reservas confirmadas ocupam o slot", () => {
    expect(isReservaOcupandoSlot({ ...base, id: "1", status: "confirmada" }, agora)).toBe(true);
  });

  it("reservas canceladas NUNCA ocupam o slot", () => {
    expect(isReservaOcupandoSlot({ ...base, id: "2", status: "cancelada" }, agora)).toBe(false);
  });

  it("reservas com lock ativo ocupam temporariamente o slot para evitar double-booking", () => {
    const reservaLockAtivo: Reserva = {
      ...base,
      id: "3",
      status: "em_processamento",
      expiraEm: "2026-10-20T14:10:00Z",
    } as any;

    expect(isReservaOcupandoSlot(reservaLockAtivo, agora)).toBe(true);
  });

  it("reservas com lock expirado NÃO ocupam o slot, liberando a agenda", () => {
    const reservaLockExpirado: Reserva = {
      ...base,
      id: "4",
      status: "em_processamento",
      expiraEm: "2026-10-20T13:50:00Z",
    } as any;

    expect(isReservaOcupandoSlot(reservaLockExpirado, agora)).toBe(false);
  });
});

describe("LockService - Filtragem de Horários e Tempo Restante", () => {
  const agora = new Date("2026-10-20T14:00:00Z");

  it("filtrarHorariosOcupadosComLock deve consolidar slots ocupados de confirmadas e locks válidos", () => {
    const reservas: Reserva[] = [
      {
        id: "r1",
        quadraId: "q1",
        data: "2026-10-20",
        horarios: ["10:00", "11:00"],
        horaInicio: "10:00",
        horaFim: "12:00",
        status: "confirmada",
      } as any,
      {
        id: "r2",
        quadraId: "q1",
        data: "2026-10-20",
        horarios: ["18:00"],
        horaInicio: "18:00",
        horaFim: "19:00",
        status: "em_processamento",
        expiraEm: "2026-10-20T14:10:00Z", // Lock ativo
      } as any,
      {
        id: "r3",
        quadraId: "q1",
        data: "2026-10-20",
        horarios: ["21:00"],
        horaInicio: "21:00",
        horaFim: "22:00",
        status: "em_processamento",
        expiraEm: "2026-10-20T13:30:00Z", // Lock expirado
      } as any,
      {
        id: "r4",
        quadraId: "q2", // Outra quadra
        data: "2026-10-20",
        horarios: ["18:00"],
        horaInicio: "18:00",
        horaFim: "19:00",
        status: "confirmada",
      } as any,
    ];

    const ocupados = filtrarHorariosOcupadosComLock(reservas, "q1", "2026-10-20", agora);
    // Deve incluir 10:00, 11:00 (confirmada) e 18:00 (lock ativo), ignorando 21:00 (lock expirado) e q2
    expect(ocupados).toEqual(["10:00", "11:00", "18:00"]);
  });

  it("calcularTempoRestanteLockSegundos deve retornar a contagem exata e travar em zero", () => {
    const expiraEm = "2026-10-20T14:02:30Z"; // 150 segundos no futuro
    expect(calcularTempoRestanteLockSegundos(expiraEm, agora)).toBe(150);

    const expiraPassado = "2026-10-20T13:59:00Z";
    expect(calcularTempoRestanteLockSegundos(expiraPassado, agora)).toBe(0);
  });
});
