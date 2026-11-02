/**
 * @file balcaoServidorService.ts
 * @description Ações do balcão sobre uma reserva (somente servidor): quitar o restante com a forma de
 * pagamento, cancelar registrando a devolução do sinal, remarcar (dia, horário ou quadra) e marcar
 * "não compareceu". Cada ação grava um evento em `reservas_eventos` com quem fez e quando.
 *
 * Tudo é conferido aqui com dados do banco: a reserva é da arena do operador, o estado permite a
 * ação, o novo horário existe e o preço é recalculado pela tabela da quadra. A trava do banco contra
 * reserva dupla (`impedir_reserva_dupla`) protege a remarcação mesmo em corrida.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano E)
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { mapearLinhaParaArena, mapearLinhaParaPreco, mapearLinhaParaQuadra } from "@/lib/arena/arenaRepository";
import { calcularPrecoReserva, gerarHorariosOperacionais } from "@/lib/arena/arenaService";
import { rowToReserva, type ReservaDbRow } from "@/lib/supabase/types";
import { saoConsecutivos } from "@/lib/constants";
import { FUSO_PADRAO_ARENA, hojeNoFuso } from "@/lib/datas/fusoHorario";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { variacoesDoTelefone } from "@/lib/atletas/vinculoReservas";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";
import type { Reserva } from "@/store/useReservasStore";
import type { FormaPagamento } from "./formasPagamento";

export { FORMAS_PAGAMENTO, type FormaPagamento } from "./formasPagamento";

/** O que aconteceu com o sinal num cancelamento pelo balcão. */
export type DestinoSinal = "devolvido" | "devolver_depois" | "retido" | "sem_pagamento";

/** Ação pedida pelo painel. */
export type AcaoBalcao =
  | { acao: "quitar"; forma: FormaPagamento; valorRecebido: number; motivoDesconto?: string }
  | { acao: "cancelar"; motivo: string; destinoSinal: DestinoSinal }
  | { acao: "remarcar"; data: string; horarios: string[]; quadraId: string }
  | { acao: "comparecimento"; compareceu: boolean }
  | { acao: "registrar_devolucao" };

const CENTAVO = 0.009;
const arred = (v: number) => Math.round(v * 100) / 100;
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Valida o corpo enviado pelo painel.
 *
 * @param corpo Corpo bruto da requisição
 * @returns Ação normalizada
 * @throws ErroHttp 400 com a mensagem para o operador
 *
 * @example
 * ```ts
 * validarAcaoBalcao({ acao: "quitar", forma: "dinheiro", valorRecebido: 50 });
 * ```
 */
export function validarAcaoBalcao(corpo: unknown): AcaoBalcao {
  const b = (corpo ?? {}) as Record<string, unknown>;
  switch (b.acao) {
    case "quitar": {
      if (b.forma !== "dinheiro" && b.forma !== "pix" && b.forma !== "cartao") {
        throw new ErroHttp("Escolha como o cliente pagou: dinheiro, Pix ou cartão.", 400);
      }
      const valorRecebido = Number(b.valorRecebido);
      if (!Number.isFinite(valorRecebido) || valorRecebido < 0) throw new ErroHttp("Informe o valor recebido.", 400);
      return { acao: "quitar", forma: b.forma, valorRecebido: arred(valorRecebido), motivoDesconto: texto(b.motivoDesconto, 200) || undefined };
    }
    case "cancelar": {
      const motivo = texto(b.motivo, 300);
      if (motivo.length < 3) throw new ErroHttp("Informe o motivo do cancelamento.", 400);
      const destinos: DestinoSinal[] = ["devolvido", "devolver_depois", "retido", "sem_pagamento"];
      if (!destinos.includes(b.destinoSinal as DestinoSinal)) throw new ErroHttp("Diga o que acontece com o sinal.", 400);
      return { acao: "cancelar", motivo, destinoSinal: b.destinoSinal as DestinoSinal };
    }
    case "remarcar": {
      const data = texto(b.data, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroHttp("Escolha a nova data.", 400);
      const horarios = Array.isArray(b.horarios) ? b.horarios.filter((h): h is string => typeof h === "string" && /^\d{2}:\d{2}$/.test(h)) : [];
      if (horarios.length === 0) throw new ErroHttp("Escolha o novo horário.", 400);
      const ordenados = [...new Set(horarios)].sort();
      if (!saoConsecutivos(ordenados)) throw new ErroHttp("Os horários precisam ser seguidos.", 400);
      const quadraId = texto(b.quadraId, 120);
      if (!quadraId) throw new ErroHttp("Escolha a quadra.", 400);
      return { acao: "remarcar", data, horarios: ordenados, quadraId };
    }
    case "comparecimento":
      if (typeof b.compareceu !== "boolean") throw new ErroHttp("Comparecimento inválido.", 400);
      return { acao: "comparecimento", compareceu: b.compareceu };
    case "registrar_devolucao":
      return { acao: "registrar_devolucao" };
    default:
      throw new ErroHttp("Ação inválida.", 400);
  }
}

/** Hora de término do último horário (ex.: ['20:00','21:00'] com 60 min -> '22:00'). */
export function horaFim(horarios: string[], intervaloMinutos: number): string {
  const [h, m] = horarios[horarios.length - 1].split(":").map(Number);
  const total = h * 60 + m + intervaloMinutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function carregarReserva(membro: MembroArena, reservaId: string): Promise<{ reserva: Reserva; linha: Record<string, unknown> }> {
  const { data, error } = await supabaseAdmin.from("reservas").select("*").eq("id", reservaId).eq("arena_id", membro.arenaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ErroHttp("Reserva não encontrada nesta arena.", 404);
  return { reserva: rowToReserva(data as ReservaDbRow), linha: data as Record<string, unknown> };
}

async function gravar(reservaId: string, arenaId: string, mudanca: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from("reservas").update(mudanca).eq("id", reservaId).eq("arena_id", arenaId);
  if (error?.code === "23P01") throw new ErroHttp("Esse horário já está ocupado nesta quadra. Escolha outro.", 409);
  if (error) throw new Error(error.message);
}

/** Registra o evento na linha do tempo da reserva (best-effort: não desfaz a ação se falhar). */
async function registrarEvento(membro: MembroArena, reservaId: string, tipo: string, detalhes: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from("reservas_eventos").insert({
    arena_id: membro.arenaId,
    reserva_id: reservaId,
    tipo,
    detalhes,
    autor_id: membro.userId,
    autor_nome: membro.email,
  });
  if (error) console.error(`[Balcão] Falha ao registrar o evento '${tipo}' da reserva ${reservaId}:`, error.message);
}

function exigirReservaDeCliente(reserva: Reserva): void {
  if (reserva.tipoReserva === "manutencao_bloqueio") throw new ErroHttp("Isto é um bloqueio, não uma reserva. Remova o bloqueio na agenda.", 422);
  if (reserva.tipoReserva === "escolinha" || reserva.tipoReserva === "grupo") {
    throw new ErroHttp("Sessões de escolinha e grupo são gerenciadas nas telas Escolinhas e Grupos.", 422);
  }
}

/**
 * Executa uma ação do balcão.
 *
 * @param membro Operador autenticado da arena
 * @param reservaId Reserva
 * @param acao Ação validada por {@link validarAcaoBalcao}
 * @param agora Instante de referência (testes)
 * @returns A reserva depois da ação
 * @throws ErroHttp 404 (não é da arena), 409 (estado ou horário não permite), 422 (regra)
 */
export async function executarAcaoBalcao(membro: MembroArena, reservaId: string, acao: AcaoBalcao, agora: Date = new Date()): Promise<Reserva> {
  const { reserva } = await carregarReserva(membro, reservaId);
  const pago = arred(Math.max(0, (Number(reserva.valorTotal) || 0) - (Number(reserva.valorPendente) || 0)));
  const instante = agora.toISOString();

  switch (acao.acao) {
    case "quitar": {
      exigirReservaDeCliente(reserva);
      if (reserva.status !== "pendente" || !(Number(reserva.valorPendente) > 0)) {
        throw new ErroHttp("Esta reserva não tem valor a receber.", 409);
      }
      const falta = arred(Number(reserva.valorPendente));
      if (acao.valorRecebido > falta + CENTAVO) throw new ErroHttp(`O restante é de R$ ${falta.toFixed(2).replace(".", ",")}.`, 400);
      const desconto = arred(falta - acao.valorRecebido);
      if (desconto > CENTAVO && !acao.motivoDesconto) throw new ErroHttp("Recebeu menos que o restante: informe o motivo do desconto.", 400);
      const novoTotal = arred(Number(reserva.valorTotal) - desconto);
      await gravar(reservaId, membro.arenaId, {
        status: "confirmada",
        valor_total: novoTotal,
        valor_sinal: novoTotal,
        valor_pendente: 0,
        forma_pagamento_restante: acao.forma,
        quitada_em: instante,
        quitada_por: membro.userId,
      });
      await registrarEvento(membro, reservaId, "quitada", {
        forma: acao.forma,
        valor: acao.valorRecebido,
        ...(desconto > CENTAVO ? { desconto, motivo: acao.motivoDesconto } : {}),
      });
      break;
    }

    case "cancelar": {
      exigirReservaDeCliente(reserva);
      if (reserva.status === "cancelada") throw new ErroHttp("Esta reserva já está cancelada.", 409);
      const destino = pago > CENTAVO ? acao.destinoSinal : "sem_pagamento";
      const reembolso =
        destino === "devolvido"
          ? { reembolso_status: "reembolsado", reembolso_valor: pago, reembolsado_em: instante }
          : destino === "devolver_depois"
            ? { reembolso_status: "pendente", reembolso_valor: pago, reembolsado_em: null }
            : destino === "retido"
              ? { reembolso_status: "retido", reembolso_valor: null, reembolsado_em: null }
              : {};
      await gravar(reservaId, membro.arenaId, {
        status: "cancelada",
        permite_vagas: false,
        vagas_abertas: 0,
        cancelada_em: instante,
        cancelada_por: membro.userId,
        motivo_cancelamento: acao.motivo,
        ...reembolso,
      });
      // Reserva cancelada não vale carimbo no Clube (os que já viraram hora grátis ficam)
      await supabaseAdmin.from("fidelidade_selos").delete().eq("reserva_id", reservaId).eq("resgatado", false);
      await registrarEvento(membro, reservaId, "cancelada", { motivo: acao.motivo, sinal: destino, valorPago: pago });
      break;
    }

    case "remarcar": {
      exigirReservaDeCliente(reserva);
      if (reserva.status !== "pendente" && reserva.status !== "confirmada") throw new ErroHttp("Só reservas pagas podem ser remarcadas.", 409);
      if (acao.data < hojeNoFuso(FUSO_PADRAO_ARENA, agora)) throw new ErroHttp("Escolha uma data de hoje em diante.", 422);

      const [{ data: linhaArena }, { data: linhaQuadra }, { data: linhasPrecos }] = await Promise.all([
        supabaseAdmin.from("arenas").select("*").eq("id", membro.arenaId).maybeSingle(),
        supabaseAdmin.from("quadras").select("*").eq("id", acao.quadraId).eq("arena_id", membro.arenaId).eq("ativa", true).maybeSingle(),
        supabaseAdmin.from("quadras_precos").select("*").eq("arena_id", membro.arenaId).eq("quadra_id", acao.quadraId).eq("ativo", true),
      ]);
      if (!linhaArena) throw new ErroHttp("Arena não encontrada.", 404);
      if (!linhaQuadra) throw new ErroHttp("Quadra não encontrada.", 404);
      const arena = mapearLinhaParaArena(linhaArena as Record<string, unknown>);
      const quadra = mapearLinhaParaQuadra(linhaQuadra as Record<string, unknown>);
      const operacionais = gerarHorariosOperacionais(arena.horarioAbertura, arena.horarioFechamento, arena.intervaloMinutos || 60);
      if (!acao.horarios.every((h) => operacionais.includes(h))) throw new ErroHttp("Horário fora do funcionamento da arena.", 422);

      const preco = calcularPrecoReserva({
        quadra,
        precos: (linhasPrecos ?? []).map((p) => mapearLinhaParaPreco(p as Record<string, unknown>)),
        data: acao.data,
        horarios: acao.horarios,
        percentualSinal: arena.percentualSinalMinimo,
      });
      // Desconto de fidelidade continua valendo; a diferença de tabela é cobrada (ou vira crédito)
      const desconto = Number(reserva.descontoFidelidade) || 0;
      const novoTotal = arred(Math.max(0, preco.valorTotal - desconto));
      const falta = arred(Math.max(0, novoTotal - pago));
      const credito = arred(Math.max(0, pago - novoTotal));

      await gravar(reservaId, membro.arenaId, {
        quadra_id: quadra.id,
        data: acao.data,
        horarios: acao.horarios,
        hora_inicio: acao.horarios[0],
        hora_fim: horaFim(acao.horarios, arena.intervaloMinutos || 60),
        valor_original: preco.valorTotal,
        valor_total: novoTotal,
        valor_pendente: falta,
        status: falta > CENTAVO ? "pendente" : "confirmada",
      });
      await registrarEvento(membro, reservaId, "remarcada", {
        de: { data: reserva.data, horarios: reserva.horarios, quadraId: reserva.quadraId },
        para: { data: acao.data, horarios: acao.horarios, quadraId: quadra.id },
        diferenca: arred(novoTotal - Number(reserva.valorTotal)),
        ...(credito > CENTAVO ? { credito } : {}),
      });
      break;
    }

    case "comparecimento": {
      exigirReservaDeCliente(reserva);
      if (reserva.status !== "pendente" && reserva.status !== "confirmada") throw new ErroHttp("A reserva não está ativa.", 409);
      if (reserva.data > hojeNoFuso(FUSO_PADRAO_ARENA, agora)) throw new ErroHttp("Só dá para marcar a partir do dia do jogo.", 422);
      await gravar(reservaId, membro.arenaId, { nao_compareceu: !acao.compareceu });
      await registrarEvento(membro, reservaId, acao.compareceu ? "compareceu" : "nao_compareceu", {});
      break;
    }

    case "registrar_devolucao": {
      const { data: linha } = await supabaseAdmin.from("reservas").select("reembolso_status, reembolso_valor").eq("id", reservaId).maybeSingle();
      if (linha?.reembolso_status !== "pendente") throw new ErroHttp("Não há devolução pendente nesta reserva.", 409);
      await gravar(reservaId, membro.arenaId, { reembolso_status: "reembolsado", reembolsado_em: instante });
      await registrarEvento(membro, reservaId, "devolucao_registrada", { valor: Number(linha.reembolso_valor) || 0 });
      break;
    }
  }

  return (await carregarReserva(membro, reservaId)).reserva;
}

// ─── Reserva feita no balcão ─────────────────────────────────────────────────

/** Quanto o cliente já pagou ao reservar no balcão. */
export type PagamentoNaReserva = "nada" | "sinal" | "integral";

/** Dados de uma reserva feita pelo balcão. */
export interface NovaReservaBalcao {
  quadraId: string;
  data: string;
  horarios: string[];
  nomeCliente: string;
  whatsappCliente: string;
  esporte?: Esporte;
  observacoes?: string;
  pagamento: PagamentoNaReserva;
  forma?: FormaPagamento;
  /** Valor combinado diferente da tabela (ex.: pacote); ausente = tabela da quadra */
  valorCombinado?: number;
}

/**
 * Valida a reserva feita no balcão.
 *
 * @param corpo Corpo bruto
 * @returns Dados normalizados
 * @throws ErroHttp 400 com a mensagem para o operador
 */
export function validarNovaReservaBalcao(corpo: unknown): NovaReservaBalcao {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const quadraId = texto(b.quadraId, 120);
  if (!quadraId) throw new ErroHttp("Escolha a quadra.", 400);
  const data = texto(b.data, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroHttp("Escolha a data.", 400);
  const horarios = Array.isArray(b.horarios) ? [...new Set(b.horarios.filter((h): h is string => typeof h === "string" && /^\d{2}:\d{2}$/.test(h)))].sort() : [];
  if (horarios.length === 0) throw new ErroHttp("Escolha o horário.", 400);
  if (!saoConsecutivos(horarios)) throw new ErroHttp("Os horários precisam ser seguidos.", 400);
  const nomeCliente = texto(b.nomeCliente, 120);
  if (nomeCliente.length < 2) throw new ErroHttp("Informe o nome do cliente.", 400);
  const whatsappCliente = typeof b.whatsappCliente === "string" ? b.whatsappCliente.replace(/\D/g, "") : "";
  if (whatsappCliente && (whatsappCliente.length < 10 || whatsappCliente.length > 13)) throw new ErroHttp("WhatsApp inválido: use DDD + número.", 400);
  const pagamento = b.pagamento === "sinal" || b.pagamento === "integral" ? b.pagamento : "nada";
  const forma = b.forma === "dinheiro" || b.forma === "pix" || b.forma === "cartao" ? b.forma : undefined;
  if (pagamento !== "nada" && !forma) throw new ErroHttp("Diga como o cliente pagou.", 400);
  let valorCombinado: number | undefined;
  if (b.valorCombinado !== undefined && b.valorCombinado !== null && b.valorCombinado !== "") {
    valorCombinado = Number(b.valorCombinado);
    if (!Number.isFinite(valorCombinado) || valorCombinado < 0) throw new ErroHttp("Valor combinado inválido.", 400);
    valorCombinado = arred(valorCombinado);
  }
  return {
    quadraId,
    data,
    horarios,
    nomeCliente,
    whatsappCliente,
    esporte: ESPORTES.includes(b.esporte as Esporte) ? (b.esporte as Esporte) : undefined,
    observacoes: texto(b.observacoes, 500) || undefined,
    pagamento,
    forma,
    valorCombinado,
  };
}

/**
 * Cria uma reserva pelo balcão com o preço da tabela da quadra (ou o valor combinado), já ligada à
 * conta do cliente quando o WhatsApp tem conta. A trava do banco impede horário ocupado.
 *
 * @param membro Operador da arena
 * @param dados Dados validados por {@link validarNovaReservaBalcao}
 * @param agora Instante de referência (testes)
 * @returns Reserva criada
 * @throws ErroHttp 404 (quadra), 409 (horário ocupado), 422 (data ou horário fora do funcionamento)
 */
export async function criarReservaBalcao(membro: MembroArena, dados: NovaReservaBalcao, agora: Date = new Date()): Promise<Reserva> {
  if (dados.data < hojeNoFuso(FUSO_PADRAO_ARENA, agora)) throw new ErroHttp("Escolha uma data de hoje em diante.", 422);

  const [{ data: linhaArena }, { data: linhaQuadra }, { data: linhasPrecos }] = await Promise.all([
    supabaseAdmin.from("arenas").select("*").eq("id", membro.arenaId).maybeSingle(),
    supabaseAdmin.from("quadras").select("*").eq("id", dados.quadraId).eq("arena_id", membro.arenaId).eq("ativa", true).maybeSingle(),
    supabaseAdmin.from("quadras_precos").select("*").eq("arena_id", membro.arenaId).eq("quadra_id", dados.quadraId).eq("ativo", true),
  ]);
  if (!linhaArena) throw new ErroHttp("Arena não encontrada.", 404);
  if (!linhaQuadra) throw new ErroHttp("Quadra não encontrada.", 404);
  const arena = mapearLinhaParaArena(linhaArena as Record<string, unknown>);
  const quadra = mapearLinhaParaQuadra(linhaQuadra as Record<string, unknown>);
  const operacionais = gerarHorariosOperacionais(arena.horarioAbertura, arena.horarioFechamento, arena.intervaloMinutos || 60);
  if (!dados.horarios.every((h) => operacionais.includes(h))) throw new ErroHttp("Horário fora do funcionamento da arena.", 422);

  const preco = calcularPrecoReserva({
    quadra,
    precos: (linhasPrecos ?? []).map((p) => mapearLinhaParaPreco(p as Record<string, unknown>)),
    data: dados.data,
    horarios: dados.horarios,
    percentualSinal: arena.percentualSinalMinimo,
  });
  const total = dados.valorCombinado ?? preco.valorTotal;
  const sinal = arred(total * (Math.max(0, Math.min(100, arena.percentualSinalMinimo)) / 100));
  const pago = dados.pagamento === "integral" ? total : dados.pagamento === "sinal" ? sinal : 0;

  // Cliente com conta (mesmo WhatsApp): a reserva aparece na conta dele
  let userId: string | null = null;
  const variacoes = dados.whatsappCliente ? variacoesDoTelefone(dados.whatsappCliente) : [];
  if (variacoes.length > 0) {
    const { data: conta } = await supabaseAdmin.from("usuarios").select("id, auth_user_id").in("telefone", variacoes).limit(1).maybeSingle();
    if (conta) userId = String(conta.auth_user_id ?? conta.id);
  }

  const id = `rsv_adm_${agora.getTime()}_${Math.random().toString(36).slice(2, 7)}`;
  const instante = agora.toISOString();
  const { error } = await supabaseAdmin.from("reservas").insert({
    id,
    arena_id: membro.arenaId,
    user_id: userId,
    quadra_id: quadra.id,
    data: dados.data,
    horarios: dados.horarios,
    hora_inicio: dados.horarios[0],
    hora_fim: horaFim(dados.horarios, arena.intervaloMinutos || 60),
    nome_cliente: dados.nomeCliente,
    whatsapp_cliente: dados.whatsappCliente,
    telefone_cliente: dados.whatsappCliente,
    cpf_cliente: "",
    esporte: dados.esporte ?? null,
    observacoes: dados.observacoes ?? null,
    tipo_reserva: "admin_manual",
    metodo_pagamento: "balcao",
    valor_original: preco.valorTotal,
    valor_total: total,
    valor_sinal: pago,
    valor_pendente: arred(total - pago),
    status: pago >= total - CENTAVO ? "confirmada" : "pendente",
    status_whatsapp: "nao_enviado",
    forma_pagamento_restante: dados.pagamento === "integral" ? dados.forma : null,
    quitada_em: dados.pagamento === "integral" ? instante : null,
    quitada_por: dados.pagamento === "integral" ? membro.userId : null,
    pago_em: pago > 0 ? instante : null,
    criada_em: instante,
  });
  if (error?.code === "23P01") throw new ErroHttp("Esse horário já está ocupado nesta quadra. Escolha outro.", 409);
  if (error) throw new Error(error.message);

  await registrarEvento(membro, id, "criada", {
    pagamento: dados.pagamento,
    ...(dados.forma && dados.pagamento !== "nada" ? { forma: dados.forma, valor: pago } : {}),
    ...(dados.valorCombinado !== undefined ? { valorCombinado: dados.valorCombinado, valorTabela: preco.valorTotal } : {}),
  });

  return (await carregarReserva(membro, id)).reserva;
}
