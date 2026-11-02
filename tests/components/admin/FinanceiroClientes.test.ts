// @vitest-environment node
/**
 * @file FinanceiroClientes.test.ts
 * @description Regras das telas Financeiro e Clientes: limites do mês, planilha CSV, busca e filtros de
 * clientes e validação do bloqueio por arena.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/adminClient", () => ({ supabaseAdmin: {} }));

import { limitesDoMes, reservasParaCsv, somarMes } from "@/components/admin/financeiro/PaginaFinanceiro";
import { filtrarClientes } from "@/components/admin/clientes/PaginaClientes";
import { validarAcaoCliente } from "@/lib/clientes/clientesServidorService";
import { telefoneNacional, variacoesDoTelefone } from "@/lib/atletas/telefone";
import type { ClienteArena } from "@/lib/supabase/painelRepository";
import type { Reserva } from "@/store/useReservasStore";

describe("Financeiro", () => {
  it("limites e navegação de mês, inclusive fevereiro e virada de ano", () => {
    expect(limitesDoMes("2028-02")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
    expect(somarMes("2026-12", 1)).toBe("2027-01");
    expect(somarMes("2026-01", -1)).toBe("2025-12");
  });

  it("planilha com ponto e vírgula, vírgula decimal e status com nome de negócio", () => {
    const r = {
      id: "r1",
      quadraId: "q1",
      data: "2026-11-02",
      horaInicio: "19:00",
      horaFim: "20:00",
      nomeCliente: 'Ana "Bia"',
      whatsappCliente: "91999990000",
      valorTotal: 100,
      valorPendente: 50,
      status: "pendente",
    } as Reserva;
    const [cabecalho, linha] = reservasParaCsv([r], () => "Areia 1").split("\r\n");
    expect(cabecalho).toBe('"Data";"Início";"Fim";"Quadra";"Cliente";"WhatsApp";"Valor";"Pago";"Falta";"Situação"');
    expect(linha).toBe('"2026-11-02";"19:00";"20:00";"Areia 1";"Ana ""Bia""";"(91) 99999-0000";"100,00";"50,00";"50,00";"Sinal pago · falta R$ 50,00"');
  });
});

describe("Clientes", () => {
  const cliente = (extra: Partial<ClienteArena>): ClienteArena => ({
    telefone: "91900000001",
    nome: "Ana",
    outrosNomes: [],
    usuarioId: null,
    reservas: 1,
    canceladas: 0,
    ultimaData: "2026-10-01",
    proximaData: null,
    totalGasto: 0,
    bloqueado: null,
    ...extra,
  });
  const lista = [
    cliente({ telefone: "91900000001", nome: "Ana Souza", outrosNomes: ["Bia"], reservas: 3, ultimaData: "2026-10-20" }),
    cliente({ telefone: "91900000002", nome: "Bruno", usuarioId: "u1", reservas: 9, ultimaData: "2026-09-01" }),
    cliente({ telefone: "91900000003", nome: "Carla", proximaData: "2026-11-10", bloqueado: { motivo: "x", por: null, em: "" } }),
  ];

  it("busca por nome antigo ou parte do WhatsApp", () => {
    expect(filtrarClientes(lista, "bia", "todos", "nome").map((c) => c.nome)).toEqual(["Ana Souza"]);
    expect(filtrarClientes(lista, "0002", "todos", "nome").map((c) => c.nome)).toEqual(["Bruno"]);
  });

  it("filtra por conta e bloqueio e ordena por recente ou por reservas", () => {
    expect(filtrarClientes(lista, "", "com_conta", "nome").map((c) => c.nome)).toEqual(["Bruno"]);
    expect(filtrarClientes(lista, "", "bloqueados", "nome").map((c) => c.nome)).toEqual(["Carla"]);
    expect(filtrarClientes(lista, "", "todos", "recentes").map((c) => c.nome)).toEqual(["Carla", "Ana Souza", "Bruno"]);
    expect(filtrarClientes(lista, "", "todos", "mais_reservas")[0].nome).toBe("Bruno");
  });

  it("bloqueio exige motivo e WhatsApp válido; guarda o número nacional", () => {
    expect(validarAcaoCliente({ acao: "bloquear", telefone: "+55 (91) 98498-2865", motivo: "Faltou" })).toEqual({ acao: "bloquear", telefone: "91984982865", motivo: "Faltou" });
    expect(() => validarAcaoCliente({ acao: "bloquear", telefone: "91984982865", motivo: "" })).toThrow(/motivo/);
    expect(() => validarAcaoCliente({ acao: "desbloquear", telefone: "123" })).toThrow(/WhatsApp/);
  });

  it("telefone nacional e variações", () => {
    expect(telefoneNacional("5591984982865")).toBe("91984982865");
    expect(variacoesDoTelefone("91984982865")).toContain("(91) 98498-2865");
  });
});
