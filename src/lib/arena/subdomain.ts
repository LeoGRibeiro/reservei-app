/**
 * @file subdomain.ts
 * @description Utilitários para extração e resolução de subdomínios dinâmicos multi-tenant
 * (ex: 'central.reservei.com' -> 'central', 'arena-belem.localhost:3000' -> 'arena-belem').
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
 * Slug da arena servida quando o host não tem subdomínio de arena (domínio raiz, `localhost` puro ou
 * `*.vercel.app`). Permite operar uma arena inteira (portal e admin) num host sem domínio próprio.
 * Padrão: a arena de demonstração.
 */
export const SLUG_ARENA_RAIZ = process.env.NEXT_PUBLIC_ARENA_RAIZ_SLUG || "arena-demo";

/**
 * Resolve o slug da arena atendida por um host: o subdomínio, se houver, ou {@link SLUG_ARENA_RAIZ}.
 * Fonte única dessa regra para o navegador (portal, admin e serviços).
 *
 * @param hostValue Cabeçalho Host / `window.location.host`
 * @returns Slug da arena
 *
 * @example
 * ```ts
 * resolverSlugArenaDoHost("central.reservei.com"); // "central"
 * resolverSlugArenaDoHost("reserveei.vercel.app"); // SLUG_ARENA_RAIZ
 * ```
 */
export function resolverSlugArenaDoHost(hostValue?: string | null): string {
  return extrairSubdominio(hostValue) ?? SLUG_ARENA_RAIZ;
}

/**
 * Slug da arena da aba atual do navegador (no servidor, {@link SLUG_ARENA_RAIZ}).
 *
 * @returns Slug da arena ativa
 */
export function obterSlugArenaDoNavegador(): string {
  if (typeof window === "undefined") return SLUG_ARENA_RAIZ;
  return resolverSlugArenaDoHost(window.location.host);
}

/**
 * Indica se o host é o domínio raiz configurado (ou `localhost`), onde rotas `/{slug}` podem ser
 * redirecionadas para o subdomínio da arena. Em outros hosts (ex.: `*.vercel.app` sem domínio próprio)
 * o redirecionamento levaria a um domínio que não é da plataforma.
 *
 * @param hostValue Cabeçalho Host
 * @returns `true` se o host aceita subdomínios de arena
 *
 * @example
 * ```ts
 * hostEhDominioRaiz("reservei.com"); // true (com NEXT_PUBLIC_ROOT_DOMAIN=reservei.com)
 * hostEhDominioRaiz("reserveei.vercel.app"); // false
 * ```
 */
export function hostEhDominioRaiz(hostValue?: string | null): boolean {
  if (!hostValue) return false;
  const host = hostValue.split(":")[0].toLowerCase().trim();
  if (host === "localhost") return true;
  return host === DOMINIO_RAIZ_PADRAO || host === `www.${DOMINIO_RAIZ_PADRAO}`;
}

/**
 * Extrai o subdomínio / slug da arena a partir do cabeçalho Host da requisição HTTP.
 * 
 * Suporta:
 * - Subdomínios em produção: 'arena-x.reservei.com' -> 'arena-x'
 * - Subdomínios com extensões compostas: 'arena-x.reservei.com.br' -> 'arena-x'
 * - Desenvolvimento local: 'arena-x.localhost:3000' -> 'arena-x'
 * - Vercel / domínios alternativos: 'arena-x.reservei.app' -> 'arena-x'
 * 
 * @param hostValue Valor bruto do cabeçalho Host (ex: 'central.reservei.com:443')
 * @returns Slug extraído do subdomínio ou null caso seja o domínio raiz/reservado
 * 
 * @example
 * ```ts
 * extrairSubdominio('arena-central.reservei.com'); // 'arena-central'
 * extrairSubdominio('arena-central.localhost:3000'); // 'arena-central'
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

  // 1. Tratamento para desenvolvimento local (ex: 'central.localhost')
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

  // Domínios da própria Vercel (produção 'projeto.vercel.app' e previews) não suportam subdomínios por
  // arena: o primeiro rótulo é o nome do projeto/deploy, nunca o slug de uma arena.
  if (hostLimpo.endsWith(".vercel.app")) {
    return null;
  }

  // 2. Tratamento para domínios reais (ex: 'central.reservei.com' ou 'central.reservei.com.br')
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
 * @param slug Identificador textual da arena (ex: 'arena-central')
 * @param protocolo 'http' ou 'https' (padrão: inferido pelo ambiente)
 * @returns URL completa (ex: 'https://arena-central.reservei.com')
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

  // Sem domínio próprio, a arena raiz é servida no endereço de produção da Vercel (ex.: projeto.vercel.app)
  if (!process.env.NEXT_PUBLIC_ROOT_DOMAIN && slug === SLUG_ARENA_RAIZ) {
    const hostVercel =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (hostVercel) return `${proto}://${hostVercel}`;
  }

  return `${proto}://${slug}.${DOMINIO_RAIZ_PADRAO}`;
}

/**
 * Primeiros segmentos de caminho do domínio raiz que pertencem à própria aplicação
 * (e não a uma arena) e, portanto, nunca devem ser redirecionados para um subdomínio.
 */
export const ROTAS_RAIZ_RESERVADAS = new Set([
  "login",
  "cadastro",
  "admin",
  "super-admin",
  "minha-conta",
  "termos",
  "privacidade",
  "para-arenas",
  "api",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
]);

/** Formato válido de slug de arena: minúsculas, números e hífens internos. */
const REGEX_SLUG_ARENA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Identifica, a partir do caminho de uma requisição ao domínio raiz, se o primeiro
 * segmento representa o slug de uma arena (ex: '/central/qualquer' -> 'central').
 *
 * @param pathname Caminho da URL (ex: '/central')
 * @returns Slug em minúsculas ou null se o caminho pertence à aplicação / não parece um slug
 *
 * @example
 * ```ts
 * extrairSlugDoCaminho('/central'); // 'central'
 * extrairSlugDoCaminho('/admin/dashboard'); // null
 * extrairSlugDoCaminho('/'); // null
 * ```
 */
export function extrairSlugDoCaminho(pathname: string): string | null {
  const primeiroSegmento = pathname.split("/").filter(Boolean)[0]?.toLowerCase();

  if (!primeiroSegmento) return null;
  if (SUBDOMINIOS_RESERVADOS.has(primeiroSegmento)) return null;
  if (ROTAS_RAIZ_RESERVADAS.has(primeiroSegmento)) return null;
  if (!REGEX_SLUG_ARENA.test(primeiroSegmento)) return null;

  return primeiroSegmento;
}

/**
 * Calcula a URL de destino do redirecionamento permanente (301) de uma rota por
 * caminho no domínio raiz para o subdomínio oficial da arena, preservando o restante
 * do caminho e a query string.
 *
 * @param pathname Caminho da URL requisitada (ex: '/central/agenda')
 * @param search Query string com '?' inicial, se houver (ex: '?data=2026-10-21')
 * @returns URL absoluta de destino ou null se não houver redirecionamento a aplicar
 *
 * @example
 * ```ts
 * resolverRedirecionamentoPorCaminho('/central'); // 'https://central.reservei.com/'
 * resolverRedirecionamentoPorCaminho('/central/agenda', '?x=1'); // 'https://central.reservei.com/agenda?x=1'
 * resolverRedirecionamentoPorCaminho('/login'); // null
 * ```
 */
export function resolverRedirecionamentoPorCaminho(
  pathname: string,
  search: string = ""
): string | null {
  const slug = extrairSlugDoCaminho(pathname);
  if (!slug) return null;

  const segmentos = pathname.split("/").filter(Boolean);
  const restante = `/${segmentos.slice(1).join("/")}`;

  return new URL(`${restante}${search}`, construirUrlArena(slug)).toString();
}
