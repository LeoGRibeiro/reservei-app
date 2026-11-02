/**
 * @file agenda.ts
 * @description Regras da grade de horários do portal: dias à frente, períodos do dia, situação de
 * cada horário (livre, ocupado, aula, sua reserva, passado), seleção de horas seguidas e preço.
 */

import { calcularPrecoReserva } from "@/lib/arena/arenaService";
import type { Quadra, QuadraPreco } from "@/lib/arena/types";
import { hh, horaDe, somarDias } from "./formatos";
import type { LinhaGrade, QuadraPortal } from "./types";

export type { LinhaGrade };

/** Hoje + 30 dias nas fichas de data. */
export const DIAS_A_FRENTE = 30;

/** Data ISO de hoje no fuso da arena. */
export function hojeNoFusoArena(agora: Date, fuso = "America/Belem"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Minutos desde a meia-noite no fuso da arena. */
export function minutosNoFusoArena(agora: Date, fuso = "America/Belem"): number {
  const [h, m] = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(agora)
    .split(":")
    .map(Number);
  return h * 60 + m;
}

/** As datas das fichas: hoje + {@link DIAS_A_FRENTE}. */
export function diasDaGrade(hoje: string): string[] {
  return Array.from({ length: DIAS_A_FRENTE + 1 }, (_, i) => somarDias(hoje, i));
}

/** Período do dia com as horas de início dos horários. */
export interface Periodo {
  nome: "Manhã" | "Tarde" | "Noite";
  horas: number[];
}

/**
 * Períodos a partir do funcionamento da arena: Manhã (antes das 12h), Tarde (12h–17h), Noite (18h em diante).
 *
 * @example
 * ```ts
 * periodosDoDia("07:00", "23:00"); // Manhã 7–11, Tarde 12–17, Noite 18–22
 * ```
 */
export function periodosDoDia(abertura: string, fechamento: string): Periodo[] {
  const inicio = horaDe(abertura);
  const fim = Math.max(inicio, horaDe(fechamento) - 1);
  const horas = Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);
  const periodos: Periodo[] = [
    { nome: "Manhã", horas: horas.filter((h) => h < 12) },
    { nome: "Tarde", horas: horas.filter((h) => h >= 12 && h < 18) },
    { nome: "Noite", horas: horas.filter((h) => h >= 18) },
  ];
  return periodos.filter((p) => p.horas.length > 0);
}

/**
 * Texto da antecedência para o atleta: "30 minutos", "1 hora", "1h30".
 *
 * @example
 * ```ts
 * textoAntecedencia(90); // "1h30"
 * ```
 */
export function textoAntecedencia(minutos: number): string {
  if (minutos < 60) return `${minutos} minutos`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m) return `${h}h${String(m).padStart(2, "0")}`;
  return h === 1 ? "1 hora" : `${h} horas`;
}

/**
 * Aviso da linha do dia, só para hoje. Todos os horários continuam na grade (os que já começaram
 * aparecem como "Encerrado"); o aviso só explica quando o dia acabou ou quando a arena fecha as
 * reservas do site algum tempo antes do horário.
 *
 * @returns Texto do aviso, ou null quando não há o que avisar
 */
export function avisoDoDia(params: {
  dia: string;
  hoje: string;
  agoraMin: number;
  antecedenciaMin: number;
  periodos: Periodo[];
}): string | null {
  const { dia, hoje, agoraMin, antecedenciaMin, periodos } = params;
  if (dia !== hoje || !periodos.length) return null;
  const ultima = periodos[periodos.length - 1].horas.at(-1) as number;
  if (ultima * 60 <= agoraMin) return "Os horários de hoje já acabaram. Escolha outro dia.";
  const antecedencia = Math.max(0, antecedenciaMin);
  if (antecedencia > 0 && ultima * 60 < agoraMin + antecedencia) {
    return `Pelo site, as reservas fecham ${textoAntecedencia(antecedencia)} antes do horário. Para hoje, fale com a arena.`;
  }
  return null;
}

/** Converte a linha bruta da RPC `grade_publica`. */
export function mapearLinhaGrade(row: Record<string, unknown>): LinhaGrade {
  const horarios = Array.isArray(row.horarios) ? row.horarios.map(String) : [];
  return {
    id: String(row.id ?? ""),
    quadraId: String(row.quadra_id ?? ""),
    data: String(row.data ?? "").slice(0, 10),
    horas: horarios.map(horaDe).filter((h) => Number.isFinite(h)),
    status: String(row.status ?? ""),
    tipoReserva: String(row.tipo_reserva ?? "avulsa"),
    esporte: row.esporte ? String(row.esporte) : undefined,
    escolinhaId: row.escolinha_id ? String(row.escolinha_id) : undefined,
    expiraEm: row.expira_em ? String(row.expira_em) : undefined,
    permiteVagas: row.permite_vagas === true,
    vagasAbertas: Number(row.vagas_abertas ?? 0),
    userId: row.user_id ? String(row.user_id) : undefined,
    organizador: row.nome_cliente && row.permite_vagas ? String(row.nome_cliente) : undefined,
  };
}

/** Chave de um horário: "AAAA-MM-DD|quadra|hora". */
export const chaveHorario = (data: string, quadraId: string, h: number): string => `${data}|${quadraId}|${h}`;

/**
 * Índice horário → reserva que o ocupa. Locks de checkout vencidos não ocupam.
 *
 * @param grade Linhas da grade pública
 * @param agora Instante atual (para os locks)
 */
export function indexarGrade(grade: LinhaGrade[], agora: Date): Map<string, LinhaGrade> {
  const indice = new Map<string, LinhaGrade>();
  for (const linha of grade) {
    if (linha.status === "em_processamento" && linha.expiraEm && new Date(linha.expiraEm).getTime() <= agora.getTime()) continue;
    for (const h of linha.horas) indice.set(chaveHorario(linha.data, linha.quadraId, h), linha);
  }
  return indice;
}

/** Situação de um horário na grade. */
export type SituacaoHorario =
  | { tipo: "livre" }
  | { tipo: "ocupado" }
  /** O horário já começou (hoje) */
  | { tipo: "encerrado" }
  /** Ainda não começou, mas está dentro da antecedência mínima da arena */
  | { tipo: "indisponivel"; motivo: string }
  | { tipo: "aula"; escolinhaId?: string; esporte: string }
  | { tipo: "meu"; reservaId: string };

/**
 * Situação de um horário. Ordem: sua reserva, encerrado (já começou), aula, ocupado, indisponível
 * (dentro da antecedência) e livre. Nenhum horário some: a grade tem sempre o mesmo tamanho.
 *
 * A regra de tempo é a mesma do checkout no servidor (`validarCalendario`): dá para reservar enquanto
 * faltarem pelo menos `antecedenciaMin` minutos para o início. Com antecedência 0, reserva-se até o
 * horário começar (às 12:35, as 13:00 estão livres).
 *
 * @param params.minhas Ids das reservas ativas do atleta logado
 * @param params.antecedenciaMin Antecedência mínima da arena, em minutos (0 = até começar)
 */
export function situacaoDoHorario(params: {
  quadraId: string;
  dia: string;
  h: number;
  hoje: string;
  agoraMin: number;
  antecedenciaMin: number;
  indice: Map<string, LinhaGrade>;
  minhas: Map<string, string>;
}): SituacaoHorario {
  const { quadraId, dia, h, hoje, agoraMin, antecedenciaMin, indice, minhas } = params;
  const chave = chaveHorario(dia, quadraId, h);
  const minha = minhas.get(chave);
  if (minha) return { tipo: "meu", reservaId: minha };
  if (dia === hoje && h * 60 <= agoraMin) return { tipo: "encerrado" };
  const ocupacao = indice.get(chave);
  if (ocupacao?.tipoReserva === "escolinha") {
    return { tipo: "aula", escolinhaId: ocupacao.escolinhaId, esporte: ocupacao.esporte ?? "" };
  }
  if (ocupacao) return { tipo: "ocupado" };
  const antecedencia = Math.max(0, antecedenciaMin);
  if (dia === hoje && h * 60 < agoraMin + antecedencia) {
    return { tipo: "indisponivel", motivo: `A arena fecha as reservas pelo site ${textoAntecedencia(antecedencia)} antes do horário.` };
  }
  return { tipo: "livre" };
}

/** Seleção atual: uma quadra e horas seguidas. */
export interface Selecao {
  quadraId: string | null;
  horas: number[];
}

export const SELECAO_VAZIA: Selecao = { quadraId: null, horas: [] };

/**
 * Alterna um horário na seleção. Só vale hora seguida na mesma quadra; tocar fora da sequência
 * começa uma seleção nova. Tirar uma hora do meio corta a sequência dali em diante.
 *
 * @example
 * ```ts
 * let s = alternarHora(SELECAO_VAZIA, "q1", 19); // q1 [19]
 * s = alternarHora(s, "q1", 20);                  // q1 [19, 20]
 * s = alternarHora(s, "q2", 8);                   // q2 [8]
 * ```
 */
export function alternarHora(selecao: Selecao, quadraId: string, h: number): Selecao {
  if (selecao.quadraId !== quadraId) return { quadraId, horas: [h] };
  const hs = [...selecao.horas].sort((a, b) => a - b);
  if (hs.includes(h)) {
    if (h === hs[0]) hs.shift();
    else if (h === hs[hs.length - 1]) hs.pop();
    else hs.splice(hs.indexOf(h));
    return hs.length ? { quadraId, horas: hs } : SELECAO_VAZIA;
  }
  if (h === hs[0] - 1 || h === hs[hs.length - 1] + 1) return { quadraId, horas: [...hs, h].sort((a, b) => a - b) };
  return { quadraId, horas: [h] };
}

/** Quadra no formato do cálculo de preço do servidor (mesma regra dos dois lados). */
function quadraDePreco(q: QuadraPortal): Quadra {
  return {
    id: q.id,
    arenaId: "",
    numero: q.ordem,
    nome: q.nome,
    tipoPiso: q.tipoPiso,
    esportes: [],
    coberta: false,
    iluminacao: true,
    valorHoraPadrao: q.valorHoraPadrao,
    ordem: q.ordem,
    ativa: true,
    criadaEm: "",
  };
}

/** Preço de uma hora numa quadra e dia (mesma regra do checkout no servidor). */
export function precoDaHora(q: QuadraPortal, precos: QuadraPreco[], dia: string, h: number): number {
  return calcularPrecoReserva({ quadra: quadraDePreco(q), precos, data: dia, horarios: [hh(h)] }).valorTotal;
}

/** Itens, totais e sinal da seleção. */
export interface ResumoSelecao {
  quadra: QuadraPortal;
  horas: number[];
  itens: { h: number; valor: number }[];
  bruto: number;
  desconto: number;
  total: number;
  sinal: number;
  /** O que paga agora (sinal ou integral) */
  agora: number;
  /** O que fica para pagar na arena */
  resto: number;
  inicio: string;
  fim: string;
}

/**
 * Resumo da seleção. A hora grátis do Clube desconta a hora mais barata, até o teto.
 *
 * @param params.tetoHoraGratis Teto da hora grátis (null = não usar)
 * @param params.percentualSinal Percentual do sinal (ex.: 50)
 */
export function resumirSelecao(params: {
  quadra: QuadraPortal;
  horas: number[];
  dia: string;
  precos: QuadraPreco[];
  percentualSinal: number;
  integral: boolean;
  tetoHoraGratis: number | null;
}): ResumoSelecao {
  const { quadra, dia, precos, percentualSinal, integral, tetoHoraGratis } = params;
  const horas = [...params.horas].sort((a, b) => a - b);
  const itens = horas.map((h) => ({ h, valor: precoDaHora(quadra, precos, dia, h) }));
  const bruto = itens.reduce((s, i) => s + i.valor, 0);
  const desconto = tetoHoraGratis !== null && itens.length ? Math.min(Math.min(...itens.map((i) => i.valor)), tetoHoraGratis) : 0;
  const total = bruto - desconto;
  const sinal = Math.round(total * percentualSinal) / 100;
  const agora = integral ? total : sinal;
  return {
    quadra,
    horas,
    itens,
    bruto,
    desconto,
    total,
    sinal,
    agora,
    resto: total - agora,
    inicio: hh(horas[0]),
    fim: hh(horas[horas.length - 1] + 1),
  };
}
