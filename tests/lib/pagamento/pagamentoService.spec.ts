/**
 * @file pagamentoService.spec.ts
 * @description Testes da emissão de Pix pelo navegador no modo offline (gateway simulado local).
 * A confirmação e a expiração de locks são testadas em confirmacaoServidor.spec.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { solicitarPixParaReserva } from "@/lib/pagamento/pagamentoService";
import { useReservasStore, type Reserva } from "@/store/useReservasStore";
import { ARENA_PADRAO } from "@/lib/arena/defaultArena";

describe("PagamentoService - Casos de Uso de Pagamento Pix e Locks", () => {
  beforeEach(() => {
    // Limpa a store antes de cada teste
    useReservasStore.setState({ reservas: [], isLoadedFromDb: true });
  });

  const reservaBase: Reserva = {
    id: "rsv_teste_1",
    quadraId: "quadra-1",
    data: "2026-10-25",
    horarios: ["19:00"],
    horaInicio: "19:00",
    horaFim: "20:00",
    nomeCliente: "Carlos Silva",
    whatsappCliente: "91999998888",
    cpfCliente: "123.456.789-00",
    valorTotal: 100,
    valorSinal: 40,
    valorPendente: 60,
    status: "em_processamento",
    statusWhatsApp: "nao_enviado",
    criadaEm: new Date().toISOString(),
  };

  describe("solicitarPixParaReserva", () => {
    it("deve emitir cobrança Pix com sucesso para o valor do sinal (padrão)", async () => {
      useReservasStore.getState().adicionarReserva(reservaBase);

      const resultado = await solicitarPixParaReserva({
        reserva: reservaBase,
        arena: ARENA_PADRAO,
        tipoPagamento: "sinal",
      });

      expect(resultado.sucesso).toBe(true);
      expect(resultado.cobranca).toBeDefined();
      expect(resultado.cobranca?.valor).toBe(40);
      expect(resultado.cobranca?.copiaECola).toContain("00020126");
      expect(resultado.cobranca?.qrCodeUrl).toBeDefined();
      expect(resultado.cobranca?.txid).toBeDefined();

      // Confirma que a store manteve a reserva em status em_processamento
      const reservaAtual = useReservasStore.getState().getReservaById("rsv_teste_1");
      expect(reservaAtual?.status).toBe("em_processamento");
    });

    it("deve emitir cobrança Pix com o valor integral quando solicitado", async () => {
      useReservasStore.getState().adicionarReserva(reservaBase);

      const resultado = await solicitarPixParaReserva({
        reserva: reservaBase,
        arena: ARENA_PADRAO,
        tipoPagamento: "integral",
      });

      expect(resultado.sucesso).toBe(true);
      expect(resultado.cobranca?.valor).toBe(100);
    });

    it("deve rejeitar emissão de Pix quando o valor da reserva for zero ou negativo", async () => {
      const reservaGratis: Reserva = {
        ...reservaBase,
        id: "rsv_gratis",
        valorTotal: 0,
        valorSinal: 0,
        valorPendente: 0,
      };

      const resultado = await solicitarPixParaReserva({
        reserva: reservaGratis,
        arena: ARENA_PADRAO,
      });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toContain("maior que zero");
    });
  });
});
