/**
 * @file pixServidorService.ts
 * @description Caso de uso (somente servidor) de emissão de cobrança Pix para uma reserva.
 * Usa o cliente service role para ler a reserva e a arena e gravar os metadados do Pix,
 * já que o RLS impede atualizações de `reservas` pelo navegador (chave anon).
 *
 * Segurança: valores monetários vêm SEMPRE do banco, nunca do corpo da requisição.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { mapearLinhaParaArena } from "@/lib/arena/arenaRepository";
import { ARENA_PADRAO, ARENA_PADRAO_ID } from "@/lib/arena/defaultArena";
import type { Arena } from "@/lib/arena/types";
import { obterPaymentGateway } from "./paymentGateway";
import type { PixCobranca, ProvedorGateway } from "./types";

/**
 * Status em que uma reserva pode receber uma cobrança Pix: apenas o checkout em andamento.
 * Reservas já pagas (`pendente` = sinal pago) não voltam para `em_processamento`, senão o lock
 * expiraria e liberaria um horário que já foi pago.
 */
const STATUS_ELEGIVEIS = new Set(["em_processamento"]);

/** Limites do tempo de expiração aceito do cliente (minutos). */
const EXPIRACAO_MIN = 1;
const EXPIRACAO_MAX = 60;
const EXPIRACAO_PADRAO = 10;

/**
 * Erro de negócio com código HTTP sugerido (mapeado pela rota de API).
 */
export class ErroPixServidor extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ErroPixServidor";
  }
}

/** Dados validados da requisição de Pix. */
export interface SolicitacaoPixServidor {
  reservaId: string;
  /** Token secreto devolvido pelo checkout (prova de autoria da reserva) */
  checkoutToken: string;
  tipoPagamento: "sinal" | "integral";
  expiracaoMinutos: number;
  /** Identificação opcional do pagador (usada apenas se a reserva ainda não tiver) */
  nomeCliente: string;
  whatsappCliente: string;
}

/**
 * Valida o corpo bruto da requisição.
 *
 * @param input Corpo JSON recebido
 * @returns Solicitação normalizada
 * @throws ErroPixServidor (400) se inválido
 */
export function validarSolicitacaoPix(input: unknown): SolicitacaoPixServidor {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const reservaId = typeof bruto.reservaId === "string" ? bruto.reservaId.trim() : "";
  if (!reservaId) {
    throw new ErroPixServidor("Informe o identificador da reserva.", 400);
  }

  const tipoPagamento = bruto.tipoPagamento === "integral" ? "integral" : "sinal";
  if (bruto.tipoPagamento !== undefined && bruto.tipoPagamento !== "sinal" && bruto.tipoPagamento !== "integral") {
    throw new ErroPixServidor("Tipo de pagamento inválido.", 400);
  }

  const informada = Number(bruto.expiracaoMinutos ?? EXPIRACAO_PADRAO);
  const expiracaoMinutos = Number.isFinite(informada)
    ? Math.min(EXPIRACAO_MAX, Math.max(EXPIRACAO_MIN, Math.round(informada)))
    : EXPIRACAO_PADRAO;

  return {
    reservaId,
    checkoutToken: typeof bruto.checkoutToken === "string" ? bruto.checkoutToken.trim() : "",
    tipoPagamento,
    expiracaoMinutos,
    nomeCliente: typeof bruto.nomeCliente === "string" ? bruto.nomeCliente.trim().slice(0, 120) : "",
    whatsappCliente:
      typeof bruto.whatsappCliente === "string" ? bruto.whatsappCliente.replace(/\D/g, "").slice(0, 15) : "",
  };
}

/**
 * Carrega a arena da reserva (com fallback à arena demo apenas se for ela mesma).
 */
async function carregarArena(arenaId: string | null): Promise<Arena> {
  const id = arenaId || ARENA_PADRAO_ID;

  const { data, error } = await supabaseAdmin.from("arenas").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);

  if (data) return mapearLinhaParaArena(data as Record<string, unknown>);
  if (id === ARENA_PADRAO_ID) return ARENA_PADRAO;
  throw new ErroPixServidor("Arena da reserva não encontrada.", 404);
}

/**
 * Emite (ou reaproveita) a cobrança Pix de uma reserva e grava seus metadados no banco.
 *
 * Fluxo: valida a reserva (existe, elegível, valor > 0) -> reaproveita Pix vigente ->
 * gera no gateway -> UPDATE via service role (status `em_processamento` + dados do Pix).
 *
 * @param solicitacao Dados já validados por {@link validarSolicitacaoPix}
 * @returns Cobrança Pix para exibir ao cliente
 * @throws ErroPixServidor 404 (reserva/arena), 409 (reserva não elegível), 422 (valor inválido), 502 (gateway)
 */
export async function emitirPixParaReserva(
  solicitacao: SolicitacaoPixServidor
): Promise<PixCobranca> {
  const { data: reserva, error } = await supabaseAdmin
    .from("reservas")
    .select("*")
    .eq("id", solicitacao.reservaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  // Sem o token do checkout, a reserva é tratada como inexistente (não revela que o id existe)
  if (!reserva || !reserva.checkout_token || reserva.checkout_token !== solicitacao.checkoutToken) {
    throw new ErroPixServidor("Reserva não encontrada.", 404);
  }
  if (!STATUS_ELEGIVEIS.has(String(reserva.status))) {
    throw new ErroPixServidor("Esta reserva não está disponível para pagamento.", 409);
  }

  const valorTotal = Number(reserva.valor_total ?? 0);
  const valorSinal = Number(reserva.valor_sinal ?? 0);
  const valor =
    solicitacao.tipoPagamento === "integral" ? valorTotal : valorSinal > 0 ? valorSinal : valorTotal;

  if (!(valor > 0)) {
    throw new ErroPixServidor("O valor da reserva deve ser maior que zero para emissão de Pix.", 422);
  }

  // Idempotência: se já existe um Pix vigente, devolve o mesmo (evita cobranças duplicadas)
  if (reserva.pix_txid && reserva.pix_copia_cola && reserva.expira_em) {
    if (new Date(String(reserva.expira_em)).getTime() > Date.now()) {
      return {
        txid: String(reserva.pix_txid),
        copiaECola: String(reserva.pix_copia_cola),
        qrCodeUrl: String(reserva.pix_qr_code_url ?? ""),
        valor,
        expiraEm: String(reserva.expira_em),
        provedor: (reserva.gateway_provedor as ProvedorGateway) ?? "mock",
        transacaoId: String(reserva.gateway_transacao_id ?? reserva.pix_txid),
      };
    }
  }

  // Lock vencido: o horário pode já ter sido reservado por outra pessoa
  if (reserva.expira_em && new Date(String(reserva.expira_em)).getTime() <= Date.now()) {
    throw new ErroPixServidor("O tempo para pagamento acabou. Faça a reserva novamente.", 409);
  }

  const arena = await carregarArena(reserva.arena_id ? String(reserva.arena_id) : null);

  // Identificação: o banco prevalece; a informada pelo cliente só preenche lacunas
  const nomeCliente = String(reserva.nome_cliente || "") || solicitacao.nomeCliente;
  const whatsappCliente = String(reserva.whatsapp_cliente || "") || solicitacao.whatsappCliente;

  const resultado = await obterPaymentGateway().gerarPix({
    reservaId: String(reserva.id),
    arena,
    nomeCliente,
    whatsappCliente,
    cpfCliente: reserva.cpf_cliente ? String(reserva.cpf_cliente) : undefined,
    valor,
    descricao: `Reserva ${arena.nome} - Quadra #${reserva.quadra_id} (${String(reserva.data).split("T")[0]})`,
    expiracaoMinutos: solicitacao.expiracaoMinutos,
  });

  if (!resultado.sucesso || !resultado.cobranca) {
    throw new ErroPixServidor(resultado.erro ?? "O gateway de pagamento não gerou a cobrança.", 502);
  }

  const cobranca = resultado.cobranca;
  const atualizacao: Record<string, unknown> = {
    status: "em_processamento",
    pix_txid: cobranca.txid,
    pix_copia_cola: cobranca.copiaECola,
    pix_qr_code_url: cobranca.qrCodeUrl,
    expira_em: cobranca.expiraEm,
    gateway_provedor: cobranca.provedor,
    gateway_transacao_id: cobranca.transacaoId,
  };
  if (!reserva.nome_cliente && nomeCliente) atualizacao.nome_cliente = nomeCliente;
  if (!reserva.whatsapp_cliente && whatsappCliente) atualizacao.whatsapp_cliente = whatsappCliente;

  const { data: atualizadas, error: erroUpdate } = await supabaseAdmin
    .from("reservas")
    .update(atualizacao)
    .eq("id", String(reserva.id))
    .select("id");

  if (erroUpdate || !atualizadas || atualizadas.length === 0) {
    throw new Error(erroUpdate?.message ?? "Nenhuma linha atualizada ao gravar o Pix.");
  }

  return cobranca;
}
