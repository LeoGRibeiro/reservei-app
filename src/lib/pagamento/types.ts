/**
 * @file types.ts
 * @description Contratos de interface e tipos de domínio para o subsistema de pagamentos,
 * integração de gateways Pix (Asaas, Mercado Pago, Efí) e locks de concorrência.
 */

import type { Reserva } from "@/store/useReservasStore";
import type { Arena } from "@/lib/arena/types";

/**
 * Provedores de gateway de pagamentos suportados pela plataforma.
 */
export type ProvedorGateway = "asaas" | "mercadopago" | "efi" | "mock";

/**
 * Status transacionais de uma cobrança Pix.
 */
export type StatusPagamentoPix =
  | "aguardando_pagamento"
  | "pago"
  | "expirado"
  | "estornado"
  | "cancelado";

/**
 * Objeto com os dados de uma cobrança Pix emitida.
 */
export interface PixCobranca {
  /** Identificador único da transação Pix (Bacen/Gateway) */
  txid: string;
  /** Código textual 'Copia e Cola' (padrão EMV QRCode Payload) */
  copiaECola: string;
  /** Imagem Base64 ou URL do QR Code para exibição na tela do cliente */
  qrCodeUrl: string;
  /** Valor monetário nominal cobrado em Reais (ex: 50.00 para R$ 50,00) */
  valor: number;
  /** Data e hora de expiração da cobrança (ISO 8601) */
  expiraEm: string;
  /** Provedor que gerou a cobrança */
  provedor: ProvedorGateway;
  /** Identificador interno da cobrança no gateway parceiro */
  transacaoId: string;
}

/**
 * Parâmetros de entrada para geração de cobrança Pix no gateway.
 */
export interface RequisicaoCobrancaPix {
  /** Identificador único da reserva no Reservei */
  reservaId: string;
  /** Dados da Arena recebedora do pagamento */
  arena: Arena;
  /** Nome completo do cliente pagador */
  nomeCliente: string;
  /** WhatsApp ou telefone do cliente */
  whatsappCliente: string;
  /** CPF ou CNPJ do pagador (opcional caso o gateway exija) */
  cpfCliente?: string;
  /** Valor a ser cobrado nesta transação (sinal ou valor integral) */
  valor: number;
  /** Descrição informativa que aparece no extrato do cliente */
  descricao: string;
  /** Tempo de expiração do Pix em minutos (padrão: 10 minutos) */
  expiracaoMinutos?: number;
}

/**
 * Resultado da emissão de cobrança Pix pelo gateway.
 */
export interface ResultadoCriacaoPix {
  sucesso: boolean;
  cobranca?: PixCobranca;
  erro?: string;
}

/**
 * Dados unificados recebidos através de Webhooks de provedores de pagamento.
 */
export interface WebhookPagamentoPayload {
  /** Tipo de evento normalizado */
  evento: "PAGAMENTO_CONFIRMADO" | "PAGAMENTO_EXPIRADO" | "PAGAMENTO_ESTORNADO";
  /** Identificador da transação Pix */
  txid: string;
  /** Identificador interno no gateway */
  transacaoId: string;
  /** Valor efetivamente pago pelo cliente */
  valorPago: number;
  /** Data e hora em que a liquidação foi efetuada pelo Banco Central */
  dataPagamento: string;
  /** Provedor emissor do webhook */
  provedor: ProvedorGateway;
  /** Payload original bruto retornado pelo gateway para auditoria */
  rawPayload: Record<string, unknown>;
}

/**
 * Contrato padrão de Gateway de Pagamentos (Desacoplamento de Provedor).
 */
export interface PaymentGateway {
  /** Nome identificador do provedor */
  readonly provedor: ProvedorGateway;

  /**
   * Emite uma cobrança Pix dinâmica com QR Code e Copia e Cola.
   */
  gerarPix(requisicao: RequisicaoCobrancaPix): Promise<ResultadoCriacaoPix>;

  /**
   * Consulta o status atual de uma cobrança no gateway.
   */
  consultarStatus(transacaoId: string): Promise<StatusPagamentoPix>;

  /**
   * Cancela uma cobrança pendente.
   */
  cancelarCobranca(transacaoId: string): Promise<boolean>;

  /**
   * Interpreta e normaliza o payload bruto de webhook recebido na API Route.
   */
  normalizarWebhook(
    headers: Headers,
    body: Record<string, unknown>
  ): WebhookPagamentoPayload | null;
}
