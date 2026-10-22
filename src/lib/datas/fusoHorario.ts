/**
 * @file fusoHorario.ts
 * @description Cálculos de data/hora no fuso das arenas, independentes do fuso do servidor.
 * Na Vercel o servidor roda em UTC; sem isto, "hoje" e "horário já passou" ficariam 3h adiantados
 * em Belém (UTC-3).
 */

/** Fuso padrão das arenas (configurável por NEXT_PUBLIC_FUSO_HORARIO). */
export const FUSO_PADRAO_ARENA = process.env.NEXT_PUBLIC_FUSO_HORARIO || "America/Belem";

interface PartesData {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Decompõe um instante nas partes de calendário vistas no fuso informado. */
function partesNoFuso(instante: Date, fuso: string): PartesData {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return { ano: valor("year"), mes: valor("month"), dia: valor("day"), hora: valor("hour"), minuto: valor("minute") };
}

/**
 * Data de hoje (YYYY-MM-DD) no fuso da arena.
 *
 * @param fuso Fuso IANA (padrão: America/Belem)
 * @param agora Instante de referência (útil em testes)
 * @returns Data no formato 'YYYY-MM-DD'
 *
 * @example
 * ```ts
 * hojeNoFuso("America/Belem", new Date("2026-10-22T01:00:00Z")); // "2026-10-21"
 * ```
 */
export function hojeNoFuso(fuso: string = FUSO_PADRAO_ARENA, agora: Date = new Date()): string {
  const p = partesNoFuso(agora, fuso);
  return `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

/**
 * Converte data + hora de parede no fuso da arena para o instante absoluto correspondente.
 *
 * @param data Data 'YYYY-MM-DD'
 * @param hora Hora 'HH:mm'
 * @param fuso Fuso IANA (padrão: America/Belem)
 * @returns Instante (Date) equivalente
 *
 * @example
 * ```ts
 * instanteNoFuso("2026-10-21", "20:00", "America/Belem").toISOString(); // "2026-10-21T23:00:00.000Z"
 * ```
 */
export function instanteNoFuso(data: string, hora: string, fuso: string = FUSO_PADRAO_ARENA): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const comoUtc = Date.UTC(ano, mes - 1, dia, h || 0, m || 0);
  // Diferença entre o relógio do fuso e o UTC naquele instante (ex.: -180 min em Belém)
  const p = partesNoFuso(new Date(comoUtc), fuso);
  const relogioNoFuso = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
  const deslocamento = relogioNoFuso - comoUtc;
  return new Date(comoUtc - deslocamento);
}

/**
 * Soma dias a uma data 'YYYY-MM-DD' (aritmética de calendário, sem fuso).
 *
 * @param data Data base
 * @param dias Quantidade de dias (pode ser negativa)
 * @returns Nova data 'YYYY-MM-DD'
 */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}
