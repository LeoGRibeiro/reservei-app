/**
 * @module arena/bloqueioQuadra
 *
 * Quadra inteira fechada por um período (reforma, evento): de uma data até outra, ou "até eu
 * liberar". A mesma regra vale no painel (Agenda e Quadras), no portal (grade) e no checkout do
 * servidor; o banco repete a regra no trigger `impedir_reserva_quadra_fechada`.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8.4
 */

/** Período de fechamento gravado na quadra. */
export interface BloqueioQuadra {
  /** Primeiro dia fechado (YYYY-MM-DD) */
  bloqueioInicio?: string | null;
  /** Último dia fechado (inclusive); vazio = "até eu liberar" */
  bloqueioFim?: string | null;
  /** Motivo (ex.: "Reforma do piso") */
  bloqueioMotivo?: string | null;
}

/** Tamanho máximo do motivo (mesmo limite do banco). */
export const MOTIVO_BLOQUEIO_MAX = 120;

/** Motivos sugeridos no painel. */
export const MOTIVOS_FECHAMENTO = ["Reforma", "Manutenção do piso", "Evento", "Torneio", "Outro"] as const;

/**
 * Indica se a quadra está fechada numa data.
 *
 * @example
 * ```ts
 * quadraFechadaEm({ bloqueioInicio: "2026-11-10", bloqueioFim: "2026-11-12" }, "2026-11-11"); // true
 * quadraFechadaEm({ bloqueioInicio: "2026-11-10" }, "2027-01-01"); // true (até liberar)
 * ```
 */
export function quadraFechadaEm(q: BloqueioQuadra | null | undefined, data: string): boolean {
  if (!q?.bloqueioInicio) return false;
  return data >= q.bloqueioInicio && (!q.bloqueioFim || data <= q.bloqueioFim);
}

/**
 * Texto curto do período: "de 10/11 a 12/11", "a partir de 10/11 (até liberar)".
 */
export function textoPeriodoFechamento(q: BloqueioQuadra): string {
  if (!q.bloqueioInicio) return "";
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  if (!q.bloqueioFim) return `a partir de ${dm(q.bloqueioInicio)} (até liberar)`;
  if (q.bloqueioFim === q.bloqueioInicio) return `em ${dm(q.bloqueioInicio)}`;
  return `de ${dm(q.bloqueioInicio)} a ${dm(q.bloqueioFim)}`;
}

/**
 * Motivo para o atleta no site ("Quadra fechada nesta data: Reforma.").
 */
export function motivoFechamentoParaAtleta(q: BloqueioQuadra): string {
  const motivo = q.bloqueioMotivo?.trim();
  return motivo ? `Quadra fechada nesta data: ${motivo}.` : "Quadra fechada nesta data.";
}

/** Erros do formulário de fechamento. */
export interface ErrosFechamento {
  inicio?: string;
  fim?: string;
  motivo?: string;
}

/**
 * Valida o fechamento antes de gravar.
 *
 * @param dados Período e motivo (`fim` vazio = até liberar)
 * @param hoje Data de hoje (YYYY-MM-DD) no fuso da arena
 * @returns Erros por campo (vazio = válido)
 */
export function validarFechamento(dados: { inicio: string; fim: string; motivo: string }, hoje: string): ErrosFechamento {
  const erros: ErrosFechamento = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.inicio)) erros.inicio = "Escolha o primeiro dia fechado.";
  else if (dados.inicio < hoje) erros.inicio = "O fechamento começa hoje ou depois.";
  if (dados.fim && dados.fim < dados.inicio) erros.fim = "O último dia precisa ser igual ou depois do primeiro.";
  if (!dados.motivo.trim()) erros.motivo = "Diga o motivo (ex.: reforma, evento).";
  else if (dados.motivo.trim().length > MOTIVO_BLOQUEIO_MAX) erros.motivo = `Use até ${MOTIVO_BLOQUEIO_MAX} caracteres.`;
  return erros;
}
