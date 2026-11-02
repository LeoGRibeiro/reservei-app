import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escolinhaVazia, turmaVazia, type EscolinhaSite, type TurmaSite } from "@/lib/institucional/escolinhasSite";

const criarContrato = vi.fn();
const atualizarContrato = vi.fn();
const encerrarContrato = vi.fn();
vi.mock("@/hooks/useContratosService", () => ({
  useContratosService: () => ({ criarContrato, atualizarContrato, encerrarContrato }),
}));

import { useAgendaEscolinha } from "@/hooks/useAgendaEscolinha";

const turma = (extra: Partial<TurmaSite> = {}): TurmaSite => ({
  ...turmaVazia("q1"), diasSemana: [2, 4], horaInicio: "08:00", horaFim: "10:00", dias: "Ter e Qui", horas: "8h e 9h", ...extra,
});
const escolinha = (turmas: TurmaSite[]): EscolinhaSite => ({
  ...escolinhaVazia(), id: "esc1", nome: "CT Falcão 12", esporte: "Futebol society", professor: "Marcos Falcão", turmas,
});
const periodo = { dataInicio: "2026-11-02", meses: 6 };

describe("useAgendaEscolinha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    encerrarContrato.mockResolvedValue({ ok: true, sessoesCanceladas: 3 });
    atualizarContrato.mockResolvedValue({ ok: true });
  });

  it("cria o contrato da turma nova ligado à escolinha, com o esporte da lista e o WhatsApp da arena", async () => {
    criarContrato.mockResolvedValue({ ok: true, contrato: { id: "c-novo" }, totalOcorrencias: 52 });
    const { result } = renderHook(() => useAgendaEscolinha());
    const r = await result.current.sincronizarAgenda(escolinha([turma()]), [], periodo, "5591984982865");

    expect(criarContrato).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "escolinha", nome: "CT Falcão 12", esporte: "Futebol Society", responsavelNome: "Marcos Falcão",
      contatoWhatsapp: "91984982865", escolinhaId: "esc1", quadraId: "q1", diasSemana: [2, 4],
      horaInicio: "08:00", horaFim: "10:00", dataInicio: "2026-11-02", meses: 6,
    }));
    expect(r).toMatchObject({ criadas: 1, encerradas: 0, falhas: [] });
    expect(r.turmas[0].contratoId).toBe("c-novo");
  });

  it("conflito com reserva vira falha clara e a turma fica sem contrato", async () => {
    criarContrato.mockResolvedValue({ ok: false, erros: ["2 data(s) do contrato colidem com reservas existentes."] });
    const { result } = renderHook(() => useAgendaEscolinha());
    const r = await result.current.sincronizarAgenda(escolinha([turma()]), [], periodo, "5591984982865");

    expect(r.criadas).toBe(0);
    expect(r.turmas[0].contratoId).toBe("");
    expect(r.falhas[0]).toMatch(/Turma 1 \(Ter e Qui 8h e 9h\): 2 data\(s\) do contrato colidem/);
  });

  it("mantém o contrato igual (só atualiza nome e contato) e encerra o da turma removida", async () => {
    const antes = [turma({ contratoId: "c1" }), turma({ contratoId: "c2", diasSemana: [6] })];
    const { result } = renderHook(() => useAgendaEscolinha());
    const r = await result.current.sincronizarAgenda(escolinha([turma({ contratoId: "c1" })]), antes, periodo, "5591984982865");

    expect(atualizarContrato).toHaveBeenCalledWith("c1", expect.objectContaining({ nome: "CT Falcão 12", escolinhaId: "esc1" }));
    expect(encerrarContrato).toHaveBeenCalledWith("c2");
    expect(criarContrato).not.toHaveBeenCalled();
    expect(r).toMatchObject({ criadas: 0, encerradas: 1 });
  });

  it("liberarAgenda encerra todos os contratos da escolinha excluída", async () => {
    const { result } = renderHook(() => useAgendaEscolinha());
    const n = await result.current.liberarAgenda([turma({ contratoId: "c1" }), turma(), turma({ contratoId: "c3" })]);
    expect(encerrarContrato.mock.calls).toEqual([["c1"], ["c3"]]);
    expect(n).toBe(2);
  });
});
