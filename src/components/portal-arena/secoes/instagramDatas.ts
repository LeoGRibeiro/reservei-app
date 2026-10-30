/**
 * @file instagramDatas.ts
 * @description Datas dos posts do Instagram: o dia da publicação no fuso da arena (para contar dias
 * de calendário, como "há 3 dias").
 */

import { hojeNoFusoArena } from "@/lib/portal/agenda";

export { haQuanto } from "@/lib/portal/formatos";

/**
 * Dia (AAAA-MM-DD) de um instante no fuso da arena.
 *
 * @example
 * ```ts
 * hojeDe("2026-10-31T01:00:00Z", "America/Belem"); // "2026-10-30"
 * ```
 */
export function hojeDe(instanteIso: string, fuso: string): string {
  const d = new Date(instanteIso);
  return Number.isNaN(d.getTime()) ? instanteIso.slice(0, 10) : hojeNoFusoArena(d, fuso);
}
