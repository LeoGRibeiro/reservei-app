/**
 * @module arena/precosNoSite
 *
 * Como os preços da quadra aparecem no site, para o painel mostrar ao dono exatamente o que o
 * atleta vê. O card da quadra no site mostra o preço da hora das **10h** como "de dia" e o das
 * **19h** como "à noite" (mesma regra de `CardQuadra`); cada horário reservado usa a tarifa que
 * cobre aquela hora (`calcularPrecoReserva`, a mesma do checkout).
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8.3
 */

import { calcularPrecoReserva } from "./arenaService";
import type { Quadra, QuadraPreco } from "./types";
import { reais } from "@/lib/portal/formatos";

/** Hora usada como "de dia" no card do site. */
export const HORA_DIA_SITE = "10:00";
/** Hora usada como "à noite" no card do site. */
export const HORA_NOITE_SITE = "19:00";

/** Datas de referência (fixas) para segunda-feira e sábado. */
const SEGUNDA = "2026-01-05";
const SABADO = "2026-01-10";

/** Preço "de dia" e "à noite" de um dia da semana. */
export interface PrecoDiaNoite {
  dia: number;
  noite: number;
}

/**
 * Preço de dia e de noite numa data (o mesmo cálculo do checkout).
 */
export function precoDiaNoite(quadra: Quadra, precos: QuadraPreco[], data: string): PrecoDiaNoite {
  const preco = (h: string) => calcularPrecoReserva({ quadra, precos, data, horarios: [h] }).valorTotal;
  return { dia: preco(HORA_DIA_SITE), noite: preco(HORA_NOITE_SITE) };
}

/** Texto de um par: "R$ 80 de dia · R$ 100 à noite" ou "R$ 80 a hora". */
export function textoDiaNoite(p: PrecoDiaNoite): string {
  return p.dia === p.noite ? `${reais(p.dia)} a hora` : `${reais(p.dia)} de dia · ${reais(p.noite)} à noite`;
}

/**
 * Linhas do que o site mostra: uma só quando a semana e o fim de semana custam igual; senão duas.
 *
 * @example
 * ```ts
 * resumoPrecosNoSite(quadra, precos);
 * // ["Seg a sex: R$ 80 de dia · R$ 100 à noite", "Sáb e dom: R$ 90 de dia · R$ 100 à noite"]
 * ```
 */
export function resumoPrecosNoSite(quadra: Quadra, precos: QuadraPreco[]): string[] {
  const semana = precoDiaNoite(quadra, precos, SEGUNDA);
  const fimDeSemana = precoDiaNoite(quadra, precos, SABADO);
  if (semana.dia === fimDeSemana.dia && semana.noite === fimDeSemana.noite) return [textoDiaNoite(semana)];
  return [`Seg a sex: ${textoDiaNoite(semana)}`, `Sáb e dom: ${textoDiaNoite(fimDeSemana)}`];
}

/**
 * Efeito de uma tarifa no card do site, em palavras.
 *
 * @example
 * ```ts
 * efeitoDaTarifa({ horaInicio: "18:00", horaFim: "23:00" }); // "vira o preço “à noite” do site"
 * ```
 */
export function efeitoDaTarifa(t: Pick<QuadraPreco, "horaInicio" | "horaFim">): string {
  const cobre = (h: string) => t.horaInicio <= h && h < t.horaFim;
  const dia = cobre(HORA_DIA_SITE);
  const noite = cobre(HORA_NOITE_SITE);
  if (dia && noite) return "vira os dois preços do site (de dia e à noite)";
  if (noite) return "vira o preço “à noite” do site";
  if (dia) return "vira o preço “de dia” do site";
  return "não aparece no card do site, mas vale na hora de reservar";
}
