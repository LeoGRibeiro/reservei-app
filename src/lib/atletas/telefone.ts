/**
 * @module atletas/telefone
 *
 * WhatsApp brasileiro: forma nacional (DDD + número) e as variações com que o mesmo número pode ter
 * sido gravado (só dígitos, com 55, com máscara). Puro: usado no navegador e no servidor.
 */

/**
 * Número nacional só com dígitos (tira o 55 do país).
 *
 * @example
 * ```ts
 * telefoneNacional("+55 (91) 98498-2865"); // "91984982865"
 * ```
 */
export function telefoneNacional(telefone: string): string {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/**
 * Formas em que o mesmo WhatsApp pode ter sido gravado numa reserva.
 *
 * @param telefone WhatsApp em qualquer formato
 * @returns Variações sem repetição (vazio se o número for inválido)
 *
 * @example
 * ```ts
 * variacoesDoTelefone("(91) 98498-2865"); // ["91984982865", "5591984982865", "(91) 98498-2865"]
 * ```
 */
export function variacoesDoTelefone(telefone: string): string[] {
  const d = telefoneNacional(telefone);
  if (d.length < 10) return [];
  const mascara = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return Array.from(new Set([d, `55${d}`, mascara]));
}
