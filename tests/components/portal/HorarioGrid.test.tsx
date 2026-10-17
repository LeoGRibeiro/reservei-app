import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HorarioGrid } from "@/components/portal/HorarioGrid";
import type { VagaDisponivelItem } from "@/lib/vagas/types";

const mockVagasState = {
  vagasDisponiveis: [] as VagaDisponivelItem[],
  demonstrarInteresse: vi.fn(),
  temInteresseRegistrado: vi.fn().mockReturnValue(false),
};

vi.mock("@/hooks/useVagasService", () => ({
  useVagasService: () => mockVagasState,
}));

vi.mock("@/hooks/useUserAuth", () => ({
  useUserAuth: () => ({ user: null }),
}));

describe("HorarioGrid - Tag de Vagas Abertas", () => {
  // Data futura estável para garantir que os slots de horário não expirem durante os testes
  const dataHoje = "2099-10-15";

  beforeEach(() => {
    vi.clearAllMocks();
    mockVagasState.vagasDisponiveis = [];
  });

  it("exibe a tag 'vagas abertas' ao lado de Ocupado quando o horário possui vagas disponíveis", () => {
    mockVagasState.vagasDisponiveis = [
      {
        reservaId: "rsv_vaga_1",
        data: dataHoje,
        horaInicio: "19:00",
        horaFim: "20:00",
        quadraId: "q1",
        quadraNumero: 1,
        quadraDescricao: "Quadra 1",
        vagasAbertas: 2,
        totalInteressados: 0,
        organizadorNome: "Carlos",
      },
    ];

    render(
      <HorarioGrid
        quadraId="q1"
        dataSelecionada={dataHoje}
        horariosSelecionados={[]}
        horariosOcupados={["19:00"]}
        onToggleHorario={vi.fn()}
      />
    );

    // Deve exibir Ocupado e ao lado a tag vagas abertas
    expect(screen.getByText("Ocupado")).toBeInTheDocument();
    expect(screen.getByText("vagas abertas")).toBeInTheDocument();
  });

  it("abre o modal de confirmação ao clicar no card de horário com vagas abertas", () => {
    mockVagasState.vagasDisponiveis = [
      {
        reservaId: "rsv_vaga_2",
        data: dataHoje,
        horaInicio: "20:00",
        horaFim: "21:00",
        quadraId: "q1",
        quadraNumero: 1,
        quadraDescricao: "Quadra 1",
        vagasAbertas: 3,
        totalInteressados: 0,
        organizadorNome: "Lucas",
      },
    ];

    render(
      <HorarioGrid
        quadraId="q1"
        dataSelecionada={dataHoje}
        horariosSelecionados={[]}
        horariosOcupados={["20:00"]}
        onToggleHorario={vi.fn()}
      />
    );

    const button = screen.getByText("vagas abertas").closest("button");
    expect(button).toBeDefined();
    if (button) {
      fireEvent.click(button);
    }

    // Modal de confirmação de interesse deve ser aberto
    expect(screen.getByText("Quero Participar do Jogo")).toBeInTheDocument();
    expect(screen.getByText(/Lucas/i)).toBeInTheDocument();
  });
});
