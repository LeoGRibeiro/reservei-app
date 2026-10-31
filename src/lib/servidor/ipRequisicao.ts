/**
 * @file ipRequisicao.ts
 * @description IP de quem faz a requisição (primeiro da cadeia do proxy da Vercel), para limites por rede.
 */

/**
 * @param request Requisição recebida
 * @returns IP, ou null se não informado
 *
 * @example
 * ```ts
 * const ip = ipDaRequisicao(request); // "200.10.20.30"
 * ```
 */
export function ipDaRequisicao(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}
