/**
 * @file checkoutServidorService.ts
 * @description Caso de uso (somente servidor) de criação de reservas pelo portal público.
 *
 * O navegador envia apenas a intenção (arena, quadra, data, horários, identificação, tipo de
 * pagamento e vouchers escolhidos). Tudo o que tem valor é decidido aqui, com dados do banco:
 * - a arena e a quadra existem e estão ativas;
 * - os horários pertencem ao funcionamento da arena, são consecutivos, futuros e respeitam a
 *   antecedência mínima (no fuso da arena);
 * - o horário está livre (reservas confirmadas/pendentes e locks vigentes), inclusive contra
 *   corridas entre dois checkouts simultâneos;
 * - o telefone não está bloqueado;
 * - o preço é recalculado pela tabela da quadra e os vouchers são validados no banco.
 *
 * A reserva nasce `em_processamento` (lock de 10 min) com um `checkout_token` secreto, que prova a
 * autoria do checkout para gerar o Pix, consultar o status, cancelar o lock e vincular a conta.
 */

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import {
  mapearLinhaParaArena,
  mapearLinhaParaPreco,
  mapearLinhaParaQuadra,
} from "@/lib/arena/arenaRepository";
import { calcularPrecoReserva, gerarHorariosOperacionais } from "@/lib/arena/arenaService";
import type { Arena } from "@/lib/arena/types";
import { temModuloAtivo } from "@/lib/arena/modulos";
import { rowToReserva, type ReservaDbRow } from "@/lib/supabase/types";
import { DIAS_AGENDAMENTO_FUTURO, saoConsecutivos } from "@/lib/constants";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { LockService, TEMPO_PADRAO_LOCK_MINUTOS } from "@/lib/pagamento/lockService";
import { FUSO_PADRAO_ARENA, hojeNoFuso, instanteNoFuso, somarDias } from "@/lib/datas/fusoHorario";
import { aplicarDescontoVouchers } from "@/lib/fidelidade/fidelidadeService";
import {
  consumirVouchersDaReserva,
  validarVouchersParaCheckout,
} from "@/lib/fidelidade/fidelidadeServidorService";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";

/** Máximo de horas numa única reserva online. */
const MAX_HORARIOS_POR_RESERVA = 6;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^\d{2}:\d{2}$/;

/** Dados validados de um pedido de checkout. */
export interface SolicitacaoCheckout {
  arenaId: string;
  quadraId: string;
  data: string;
  horarios: string[];
  nomeCliente: string;
  whatsappCliente: string;
  esporte?: Esporte;
  observacoes?: string;
  tipoPagamento: "sinal" | "integral";
  voucherIds: string[];
}

/** Resumo devolvido ao navegador (sem dados internos como o txid do gateway). */
export interface ReservaCheckoutCriada {
  id: string;
  status: "em_processamento" | "confirmada";
  valorOriginal: number;
  descontoFidelidade: number;
  valorTotal: number;
  valorSinal: number;
  valorPendente: number;
  expiraEm: string | null;
  reservaGratuitaFidelidade: boolean;
}

/**
 * Valida e normaliza o corpo bruto da requisição de checkout.
 *
 * @param input Corpo JSON recebido
 * @returns Solicitação normalizada
 * @throws ErroHttp 400 se algum campo for inválido
 */
export function validarSolicitacaoCheckout(input: unknown): SolicitacaoCheckout {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const arenaId = texto(bruto.arenaId, 80);
  const quadraId = texto(bruto.quadraId, 120);
  const data = texto(bruto.data, 10);
  if (!arenaId || !quadraId) throw new ErroHttp("Selecione a quadra desejada.", 400);
  if (!REGEX_DATA.test(data)) throw new ErroHttp("Data inválida.", 400);

  const horarios = Array.isArray(bruto.horarios)
    ? [...new Set(bruto.horarios.filter((h): h is string => typeof h === "string" && REGEX_HORA.test(h)))].sort()
    : [];
  if (horarios.length === 0 || horarios.length !== (bruto.horarios as unknown[]).length) {
    throw new ErroHttp("Selecione horários válidos.", 400);
  }
  if (horarios.length > MAX_HORARIOS_POR_RESERVA) {
    throw new ErroHttp(`É possível reservar no máximo ${MAX_HORARIOS_POR_RESERVA} horas por vez.`, 400);
  }
  if (!saoConsecutivos(horarios)) throw new ErroHttp("Os horários precisam ser consecutivos.", 400);

  const nomeCliente = texto(bruto.nomeCliente, 120);
  if (nomeCliente.length < 2) throw new ErroHttp("Informe seu nome.", 400);

  const whatsappCliente = typeof bruto.whatsappCliente === "string" ? bruto.whatsappCliente.replace(/\D/g, "") : "";
  if (whatsappCliente.length < 10 || whatsappCliente.length > 13) {
    throw new ErroHttp("Informe um WhatsApp válido com DDD.", 400);
  }

  const esporte = ESPORTES.includes(bruto.esporte as Esporte) ? (bruto.esporte as Esporte) : undefined;
  const observacoes = texto(bruto.observacoes, 500) || undefined;
  const tipoPagamento = bruto.tipoPagamento === "integral" ? "integral" : "sinal";
  const voucherIds = Array.isArray(bruto.voucherIds)
    ? bruto.voucherIds.filter((v): v is string => typeof v === "string")
    : [];

  return {
    arenaId,
    quadraId,
    data,
    horarios,
    nomeCliente,
    whatsappCliente,
    esporte,
    observacoes,
    tipoPagamento,
    voucherIds,
  };
}

/** Hora de término do último slot (ex.: ['20:00','21:00'] com 60 min -> '22:00'). */
function horaFimDosHorarios(horarios: string[], intervaloMinutos: number): string {
  const [h, m] = horarios[horarios.length - 1].split(":").map(Number);
  const total = h * 60 + m + intervaloMinutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Valida data e horários contra o calendário e o funcionamento da arena. */
function validarCalendario(arena: Arena, dados: SolicitacaoCheckout, agora: Date): void {
  const hoje = hojeNoFuso(FUSO_PADRAO_ARENA, agora);
  if (dados.data < hoje || dados.data > somarDias(hoje, DIAS_AGENDAMENTO_FUTURO)) {
    throw new ErroHttp("Esta data não está disponível para reservas online.", 422);
  }

  const operacionais = gerarHorariosOperacionais(
    arena.horarioAbertura,
    arena.horarioFechamento,
    arena.intervaloMinutos || 60
  );
  if (!dados.horarios.every((h) => operacionais.includes(h))) {
    throw new ErroHttp("Horário fora do funcionamento da arena.", 422);
  }

  const inicio = instanteNoFuso(dados.data, dados.horarios[0], FUSO_PADRAO_ARENA);
  const minutosAteInicio = (inicio.getTime() - agora.getTime()) / 60000;
  const antecedencia = Math.max(0, arena.antecedenciaMinimaMinutos ?? 0);
  if (minutosAteInicio < antecedencia) {
    throw new ErroHttp(
      antecedencia > 0
        ? `Reservas online precisam de ${antecedencia} minutos de antecedência.`
        : "Este horário já passou.",
      422
    );
  }
}

/** Busca as reservas que ocupam algum dos horários pedidos (excluindo `ignorarId`). */
async function buscarConflitos(
  dados: SolicitacaoCheckout,
  agora: Date,
  ignorarId?: string
): Promise<ReturnType<typeof rowToReserva>[]> {
  const { data, error } = await supabaseAdmin
    .from("reservas")
    .select("*")
    .eq("arena_id", dados.arenaId)
    .eq("quadra_id", dados.quadraId)
    .eq("data", dados.data)
    .in("status", ["confirmada", "pendente", "em_processamento"]);
  if (error) throw new Error(error.message);

  return ((data ?? []) as ReservaDbRow[])
    .map(rowToReserva)
    .filter(
      (r) =>
        r.id !== ignorarId &&
        LockService.isReservaOcupandoSlot(r, agora) &&
        r.horarios.some((h) => dados.horarios.includes(h))
    );
}

/**
 * Cria a reserva do checkout público.
 *
 * @param dados Solicitação validada por {@link validarSolicitacaoCheckout}
 * @param usuarioId Atleta autenticado pelo token (null para visitantes)
 * @param agora Instante de referência (testes)
 * @returns Reserva criada e o token secreto do checkout
 * @throws ErroHttp 403 (telefone bloqueado), 404 (arena/quadra), 409 (horário ocupado), 422 (regra)
 */
export async function criarReservaCheckout(
  dados: SolicitacaoCheckout,
  usuarioId: string | null,
  agora: Date = new Date()
): Promise<{ reserva: ReservaCheckoutCriada; checkoutToken: string }> {
  // 1. Arena e quadra ativas
  const { data: linhaArena, error: erroArena } = await supabaseAdmin
    .from("arenas")
    .select("*")
    .eq("id", dados.arenaId)
    .eq("ativo", true)
    .maybeSingle();
  if (erroArena) throw new Error(erroArena.message);
  if (!linhaArena) throw new ErroHttp("Arena não encontrada.", 404);
  const arena = mapearLinhaParaArena(linhaArena as Record<string, unknown>);

  const { data: linhaQuadra, error: erroQuadra } = await supabaseAdmin
    .from("quadras")
    .select("*")
    .eq("id", dados.quadraId)
    .eq("arena_id", arena.id)
    .eq("ativa", true)
    .maybeSingle();
  if (erroQuadra) throw new Error(erroQuadra.message);
  if (!linhaQuadra) throw new ErroHttp("Quadra não encontrada.", 404);
  const quadra = mapearLinhaParaQuadra(linhaQuadra as Record<string, unknown>);

  // 2. Calendário, funcionamento e antecedência
  validarCalendario(arena, dados, agora);

  // 3. Bloqueio de cadastro (pelo WhatsApp informado ou pela conta autenticada)
  const filtroBloqueio = usuarioId
    ? `telefone.eq.${dados.whatsappCliente},id.eq.${usuarioId}`
    : `telefone.eq.${dados.whatsappCliente}`;
  const { data: bloqueados, error: erroBloqueio } = await supabaseAdmin
    .from("usuarios")
    .select("id")
    .eq("bloqueado", true)
    .or(filtroBloqueio)
    .limit(1);
  if (erroBloqueio) throw new Error(erroBloqueio.message);
  if (bloqueados && bloqueados.length > 0) {
    throw new ErroHttp(
      "Sua conta está com restrição para novos agendamentos. Fale com a arena para entender o motivo.",
      403
    );
  }

  // 4. Horário livre
  if ((await buscarConflitos(dados, agora)).length > 0) {
    throw new ErroHttp("Esse horário acabou de ser reservado. Escolha outro.", 409);
  }

  // 5. Preço calculado no servidor + vouchers validados no banco
  const { data: linhasPrecos, error: erroPrecos } = await supabaseAdmin
    .from("quadras_precos")
    .select("*")
    .eq("arena_id", arena.id)
    .eq("quadra_id", quadra.id)
    .eq("ativo", true);
  if (erroPrecos) throw new Error(erroPrecos.message);

  const preco = calcularPrecoReserva({
    quadra,
    precos: (linhasPrecos ?? []).map((p) => mapearLinhaParaPreco(p as Record<string, unknown>)),
    data: dados.data,
    horarios: dados.horarios,
    percentualSinal: arena.percentualSinalMinimo,
  });
  if (!(preco.valorTotal > 0)) throw new ErroHttp("Esta quadra ainda não tem preço configurado.", 422);

  if (dados.voucherIds.length > 0 && !temModuloAtivo(arena.modulosAtivos, "fidelidade")) {
    throw new ErroHttp("Esta arena não oferece programa de fidelidade.", 422);
  }
  const vouchers = await validarVouchersParaCheckout(usuarioId, arena.id, dados.voucherIds);
  const desconto = aplicarDescontoVouchers(preco.valorTotal, vouchers);
  const valorTotal = desconto.valorFinal;
  const gratuita = vouchers.length > 0 && desconto.reservaGratuita;
  const valorSinal = gratuita
    ? 0
    : Math.round(valorTotal * (Math.max(0, Math.min(100, arena.percentualSinalMinimo)) / 100) * 100) / 100;
  const valorPendente = Math.round((valorTotal - valorSinal) * 100) / 100;

  // 6. Grava a reserva
  const id = `rsv_${randomUUID()}`;
  const checkoutToken = randomUUID();
  const agoraIso = agora.toISOString();
  const expiraEm = gratuita ? null : LockService.gerarTimestampExpiracaoLock(TEMPO_PADRAO_LOCK_MINUTOS, agora);
  const linha = {
    id,
    arena_id: arena.id,
    user_id: usuarioId,
    quadra_id: quadra.id,
    data: dados.data,
    horarios: dados.horarios,
    hora_inicio: dados.horarios[0],
    hora_fim: horaFimDosHorarios(dados.horarios, arena.intervaloMinutos || 60),
    nome_cliente: dados.nomeCliente,
    whatsapp_cliente: dados.whatsappCliente,
    telefone_cliente: dados.whatsappCliente,
    esporte: dados.esporte ?? null,
    observacoes: dados.observacoes ?? null,
    tipo_reserva: "avulsa",
    valor_original: preco.valorTotal,
    desconto_fidelidade: desconto.valorDesconto,
    vouchers_utilizados: vouchers.map((v) => v.codigo),
    reserva_gratuita_fidelidade: gratuita,
    metodo_pagamento: gratuita ? "fidelidade" : vouchers.length > 0 ? "misto" : "pix",
    valor_total: valorTotal,
    valor_sinal: valorSinal,
    valor_pendente: valorPendente,
    status: gratuita ? "confirmada" : "em_processamento",
    status_whatsapp: "nao_enviado",
    pago_em: gratuita ? agoraIso : null,
    expira_em: expiraEm,
    checkout_token: checkoutToken,
    criada_em: agoraIso,
  };

  const { error: erroInsert } = await supabaseAdmin.from("reservas").insert(linha);
  if (erroInsert) throw new Error(erroInsert.message);

  // 7. Defesa contra corrida: se outro checkout gravou o mesmo horário ao mesmo tempo, o mais
  //    antigo vence e este é desfeito.
  const concorrentes = await buscarConflitos(dados, agora, id);
  const perdeu = concorrentes.some((c) => c.criadaEm < agoraIso || (c.criadaEm === agoraIso && c.id < id));
  if (perdeu) {
    await supabaseAdmin.from("reservas").update({ status: "cancelada" }).eq("id", id);
    throw new ErroHttp("Esse horário acabou de ser reservado. Escolha outro.", 409);
  }

  if (gratuita) {
    await consumirVouchersDaReserva(arena.id, linha.vouchers_utilizados, id);
  }

  return {
    checkoutToken,
    reserva: {
      id,
      status: gratuita ? "confirmada" : "em_processamento",
      valorOriginal: preco.valorTotal,
      descontoFidelidade: desconto.valorDesconto,
      valorTotal,
      valorSinal,
      valorPendente,
      expiraEm,
      reservaGratuitaFidelidade: gratuita,
    },
  };
}

/**
 * Carrega uma reserva conferindo o token do checkout (prova de autoria).
 *
 * @param reservaId Reserva
 * @param checkoutToken Token devolvido na criação
 * @returns Linha bruta da reserva
 * @throws ErroHttp 404 se a reserva não existe ou o token não confere
 */
export async function carregarReservaDoCheckout(
  reservaId: string,
  checkoutToken: string
): Promise<ReservaDbRow & { checkout_token?: string | null }> {
  if (!reservaId || !checkoutToken) throw new ErroHttp("Reserva não encontrada.", 404);

  const { data, error } = await supabaseAdmin.from("reservas").select("*").eq("id", reservaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.checkout_token || data.checkout_token !== checkoutToken) {
    throw new ErroHttp("Reserva não encontrada.", 404);
  }
  return data as ReservaDbRow & { checkout_token?: string | null };
}

/**
 * Libera o lock de um checkout abandonado (status `cancelada`). Reservas já pagas não são afetadas.
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 * @returns true se o lock foi liberado agora
 */
export async function cancelarLockDoCheckout(reservaId: string, checkoutToken: string): Promise<boolean> {
  const reserva = await carregarReservaDoCheckout(reservaId, checkoutToken);
  if (reserva.status !== "em_processamento") return false;
  // Pix manual já informado como pago: só o balcão decide (o atleta pode ter pago e fechado a tela)
  if ((reserva as { pagamento_informado_em?: string | null }).pagamento_informado_em) return false;

  const { data, error } = await supabaseAdmin
    .from("reservas")
    .update({ status: "cancelada" })
    .eq("id", reservaId)
    .eq("status", "em_processamento")
    .select("id");
  if (error) throw new Error(error.message);
  return Boolean(data && data.length > 0);
}

/**
 * Vincula a reserva do checkout ao atleta que acabou de criar a conta (exige o token do checkout,
 * para que ninguém reivindique reservas alheias apenas sabendo o telefone).
 *
 * @param reservaId Reserva
 * @param checkoutToken Token do checkout
 * @param usuarioId Atleta autenticado
 */
export async function vincularReservaAoAtleta(
  reservaId: string,
  checkoutToken: string,
  usuarioId: string
): Promise<void> {
  const reserva = await carregarReservaDoCheckout(reservaId, checkoutToken);
  if (reserva.user_id && reserva.user_id !== usuarioId) {
    throw new ErroHttp("Esta reserva já pertence a outra conta.", 409);
  }
  const { error } = await supabaseAdmin.from("reservas").update({ user_id: usuarioId }).eq("id", reservaId);
  if (error) throw new Error(error.message);
}
