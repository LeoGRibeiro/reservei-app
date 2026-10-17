/**
 * @file subdomain.ts
 * @description Utilitários para extração e resolução de subdomínios dinâmicos multi-tenant
 * (ex: 'leopoldina.reservei.com' -> 'leopoldina', 'arena-belem.localhost:3000' -> 'arena-belem').
 */

/**
 * Subdomínios reservados do sistema que não devem ser interpretados como slugs de arenas.
 */
export const SUBDOMINIOS_RESERVADOS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "assets",
  "static",
  "cdn",
  "auth",
  "test",
  "dev",
  "staging",
]);

/**
 * Domínio raiz padrão configurável via variável de ambiente.
 * Padrão: 'reservei.com'
 */
export const DOMINIO_RAIZ_PADRAO =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || "reservei.com";

/**
 * Extrai o subdomínio / slug da arena a partir do cabeçalho Host da requisição HTTP.
 * 
 * Suporta:
 * - Subdomínios em produção: 'arena-x.reservei.com' -> 'arena-x'
 * - Subdomínios com extensões compostas: 'arena-x.reservei.com.br' -> 'arena-x'
 * - Desenvolvimento local: 'arena-x.localhost:3000' -> 'arena-x'
 * - Vercel / domínios alternativos: 'arena-x.reservei.app' -> 'arena-x'
 * 
 * @param hostValue Valor bruto do cabeçalho Host (ex: 'leopoldina.reservei.com:443')
 * @returns Slug extraído do subdomínio ou null caso seja o domínio raiz/reservado
 * 
 * @example
 * ```ts
 * extrairSubdominio('praia-leopoldina.reservei.com'); // 'praia-leopoldina'
 * extrairSubdominio('praia-leopoldina.localhost:3000'); // 'praia-leopoldina'
 * extrairSubdominio('www.reservei.com'); // null
 * extrairSubdominio('localhost:3000'); // null
 * ```
 */
export function extrairSubdominio(hostValue?: string | null): string | null {
  if (!hostValue) return null;

  // Remove a porta (ex: ':3000') e converte para minúsculas
  const hostLimpo = hostValue.split(":")[0].toLowerCase().trim();

  // Ignora endereços IP diretos
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostLimpo)) {
    return null;
  }

  // 1. Tratamento para desenvolvimento local (ex: 'leopoldina.localhost')
  if (hostLimpo.endsWith(".localhost") || hostLimpo.includes(".localhost.")) {
    const partes = hostLimpo.split(".localhost");
    const sub = partes[0].trim();
    if (sub && !SUBDOMINIOS_RESERVADOS.has(sub)) {
      return sub;
    }
    return null;
  }

  // Se for apenas 'localhost', não há subdomínio
  if (hostLimpo === "localhost") {
    return null;
  }

  // 2. Tratamento para domínios reais (ex: 'leopoldina.reservei.com' ou 'leopoldina.reservei.com.br')
  const partes = hostLimpo.split(".");

  // Para 'reservei.com' (2 partes) ou 'localhost' (1 parte), não há subdomínio
  if (partes.length < 3) {
    return null;
  }

  // Se terminar em '.com.br', o domínio raiz possui 3 partes (ex: reservei.com.br)
  const isComBr = hostLimpo.endsWith(".com.br");
  const minimoPartesComSubdominio = isComBr ? 4 : 3;

  if (partes.length < minimoPartesComSubdominio) {
    return null;
  }

  // O subdomínio é a primeira parte da esquerda
  const candidatoSubdominio = partes[0].trim();

  if (!candidatoSubdominio || SUBDOMINIOS_RESERVADOS.has(candidatoSubdominio)) {
    return null;
  }

  return candidatoSubdominio;
}

/**
 * Constrói a URL completa pública para uma arena com base no seu slug.
 * 
 * @param slug Identificador textual da arena (ex: 'praia-leopoldina')
 * @param protocolo 'http' ou 'https' (padrão: inferido pelo ambiente)
 * @returns URL completa (ex: 'https://praia-leopoldina.reservei.com')
 */
export function construirUrlArena(
  slug: string,
  protocolo?: "http" | "https"
): string {
  const isDev = process.env.NODE_ENV === "development";
  const proto = protocolo || (isDev ? "http" : "https");

  if (isDev) {
    return `${proto}://${slug}.localhost:3000`;
  }

  return `${proto}://${slug}.${DOMINIO_RAIZ_PADRAO}`;
}
