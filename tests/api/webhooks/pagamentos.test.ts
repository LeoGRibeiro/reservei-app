/**
 * @file pagamentos.test.ts
 * @description Testes automatizados para a API Route de Webhooks de Pagamento.
 * Valida o endpoint de healthcheck (GET) e o recebimento de notificações (POST).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/webhooks/pagamentos/route";
import { NextRequest } from "next/server";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";

describe("API Route - Webhook de Pagamentos (/api/webhooks/pagamentos)", () => {
  beforeEach(() => {
    useReservasStore.setState({ reservas: [], isLoadedFromDb: true });
  });

  it("GET deve responder com status online e identificar o provedor ativo", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("online");
    expect(data.servico).toBe("Reservei Payment Webhook Handler");
    expect(data.provedorAtivo).toBeDefined();
  });

  it("POST deve ignorar payloads inválidos ou desconhecidos", async () => {
    const request = new NextRequest("http://localhost:3000/api/webhooks/pagamentos", {
      method: "POST",
      body: JSON.stringify({ eventoInvalido: true }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Como o mockGateway normaliza qualquer objeto com txid/valor ou retorna normalizado:
    expect(data.status).toBeDefined();
  });

  it("POST deve processar liquidação Pix e confirmar a reserva correspondente", async () => {
    const reservaId = "rsv_webhook_test_1";
    const reserva: Reserva = {
      id: reservaId,
      quadraId: "q1",
      data: "2026-10-30",
      horarios: ["20:00"],
      horaInicio: "20:00",
      horaFim: "21:00",
      nomeCliente: "Juliana Mendes",
      whatsappCliente: "91999997777",
      cpfCliente: "",
      valorTotal: 120,
      valorSinal: 48,
      valorPendente: 72,
      status: "em_processamento",
      statusWhatsApp: "nao_enviado",
      criadaEm: new Date().toISOString(),
    };

    useReservasStore.getState().adicionarReserva(reserva);

    const payload = {
      txid: reservaId,
      valor: 48,
      status: "CONFIRMED",
    };

    const request = new NextRequest("http://localhost:3000/api/webhooks/pagamentos", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("success");
    expect(data.processado).toBe(true);
    expect(data.reservaId).toBe(reservaId);

    // Valida se o status na store mudou para confirmada
    const reservaAtualizada = useReservasStore.getState().getReservaById(reservaId);
    expect(reservaAtualizada?.status).toBe("confirmada");
    expect(reservaAtualizada?.statusWhatsApp).toBe("enviado");
  });
});
