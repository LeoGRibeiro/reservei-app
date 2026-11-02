/**
 * @file DetalheReserva.test.tsx
 * @description Detalhe da reserva: valores reais (sem 40%/60% fixos), nome da quadra, ações do balcão
 * conforme o estado e os formulários de receber e cancelar.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reserva } from "@/store/useReservasStore";

const estado = vi.hoisted(() => ({
  reserva: null as Reserva | null,
  eventos: [] as unknown[],
  executar: vi.fn(),
}));

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("@/components/admin/painel/ContextoPainel", () => ({
  usePainel: () => ({ arena: { nome: "Arena Belém", politicaCancelamento: "Mais de 24h: sinal volta." }, arenaSlug: "arena-belem" }),
}));
vi.mock("@/hooks/useReservaDetalhe", () => ({
  useReservaDetalhe: () => ({ reserva: estado.reserva, estado: estado.reserva ? "pronta" : "nao_encontrada", eventos: estado.eventos, executar: estado.executar, ocupado: false }),
}));
vi.mock("@/hooks/useReservasService", () => ({ useReservasService: () => ({ carregarPeriodo: async () => [] }) }));
vi.mock("@/lib/constants", async (original) => ({ ...(await original<typeof import("@/lib/constants")>()), getHoje: () => "2026-11-02" }));

import { DetalheReserva, descreverEvento } from "@/components/admin/reservas/DetalheReserva";
import { useCatalogoArenaStore } from "@/store/useCatalogoArenaStore";

const reserva = (extra: Partial<Reserva> = {}): Reserva => ({
  id: "r1",
  quadraId: "q4",
  nomeCliente: "Bruno Lima",
  whatsappCliente: "91900000002",
  cpfCliente: "",
  data: "2026-11-03",
  horarios: ["19:00"],
  horaInicio: "19:00",
  horaFim: "20:00",
  valorTotal: 180,
  valorSinal: 90,
  valorPendente: 90,
  status: "pendente",
  statusWhatsApp: "nao_enviado",
  criadaEm: "2026-11-01T11:30:00Z",
  tipoReserva: "avulsa",
  ...extra,
});

beforeEach(() => {
  estado.reserva = reserva();
  estado.eventos = [];
  estado.executar.mockReset().mockResolvedValue({ ok: true, reserva: reserva({ status: "confirmada", valorPendente: 0 }) });
  useCatalogoArenaStore.setState({ quadras: [{ id: "q4", numero: 4, descricao: "Campo Society", esportes: [] }] });
});

describe("DetalheReserva", () => {
  it("mostra a quadra pelo nome, os valores reais e o status com nome de negócio", () => {
    render(<DetalheReserva reservaId="r1" />);
    expect(screen.getByRole("heading", { name: "Bruno Lima" })).toBeInTheDocument();
    expect(screen.getByText(/Campo Society · terça-feira, 3 de novembro de 2026 · 19:00 às 20:00/)).toBeInTheDocument();
    expect(screen.getByText("Sinal pago · falta R$ 90,00")).toBeInTheDocument();
    expect(screen.queryByText(/40%|60%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/enviada pelo portal/i)).not.toBeInTheDocument();
  });

  it("recebe o restante escolhendo a forma de pagamento", async () => {
    render(<DetalheReserva reservaId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: "Receber R$ 90,00" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
    expect(await screen.findByText("Escolha como o cliente pagou.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Pix" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
    await waitFor(() => expect(estado.executar).toHaveBeenCalledWith({ acao: "quitar", forma: "pix", valorRecebido: 90, motivoDesconto: undefined }));
  });

  it("desconto no balcão pede o motivo", async () => {
    render(<DetalheReserva reservaId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: "Receber R$ 90,00" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dinheiro" }));
    fireEvent.change(screen.getByLabelText("Valor recebido (R$)"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
    expect(await screen.findByText(/diga o motivo do desconto/)).toBeInTheDocument();
    expect(estado.executar).not.toHaveBeenCalled();
  });

  it("cancela dizendo o que acontece com o sinal pago", async () => {
    render(<DetalheReserva reservaId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar reserva" }));
    expect(screen.getByText("O cliente pagou R$ 90,00. E o sinal?")).toBeInTheDocument();
    expect(screen.getByText(/Política da arena: Mais de 24h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Vou devolver depois/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar reserva" }).at(-1)!);
    await waitFor(() => expect(estado.executar).toHaveBeenCalledWith({ acao: "cancelar", motivo: "Cliente desistiu", destinoSinal: "devolver_depois" }));
  });

  it("reserva cancelada com devolução pendente oferece 'Já devolvi' e nenhuma outra ação", () => {
    estado.reserva = reserva({ status: "cancelada", reembolsoStatus: "pendente", reembolsoValor: 90, motivoCancelamento: "Chuva" });
    render(<DetalheReserva reservaId="r1" />);
    expect(screen.getByText("Falta devolver R$ 90,00 ao cliente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Já devolvi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Receber|Remarcar/ })).not.toBeInTheDocument();
  });

  it("sessão de escolinha aponta para a tela certa e não tem ações de balcão", () => {
    estado.reserva = reserva({ tipoReserva: "escolinha", nomeCliente: "CT Falcão 12" });
    render(<DetalheReserva reservaId="r1" />);
    expect(screen.getByRole("link", { name: "Escolinhas" })).toHaveAttribute("href", "/admin/escolinhas");
    expect(screen.queryByRole("button", { name: /Cancelar reserva/ })).not.toBeInTheDocument();
  });

  it("reserva inexistente mostra o aviso e o caminho de volta", () => {
    estado.reserva = null;
    render(<DetalheReserva reservaId="nao-existe" />);
    expect(screen.getByText("Reserva não encontrada")).toBeInTheDocument();
  });
});

describe("descreverEvento", () => {
  const nome = (id: string) => (id === "q1" ? "Areia 1" : "Campo Society");
  it("explica a remarcação com a diferença ou o crédito", () => {
    expect(
      descreverEvento(
        { id: "e", tipo: "remarcada", autorNome: null, criadoEm: "", detalhes: { de: { data: "2026-11-03", horarios: ["19:00"], quadraId: "q4" }, para: { data: "2026-11-05", horarios: ["08:00"], quadraId: "q1" }, diferenca: -30, credito: 30 } },
        nome
      )
    ).toBe("Remarcou de terça-feira, 3 de novembro 19:00 (Campo Society) para quinta-feira, 5 de novembro 08:00 (Areia 1) · crédito de R$ 30,00");
  });

  it("explica o recebimento com desconto", () => {
    expect(descreverEvento({ id: "e", tipo: "quitada", autorNome: null, criadoEm: "", detalhes: { forma: "dinheiro", valor: 80, desconto: 10, motivo: "fiel" } }, nome)).toBe(
      "Recebeu R$ 80,00 em dinheiro (desconto de R$ 10,00: fiel)"
    );
  });
});
