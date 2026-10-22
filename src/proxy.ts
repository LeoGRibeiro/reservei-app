/**
 * @file proxy.ts
 * @description Proxy do Next.js 16 (antigo middleware) para resolução estrita de subdomínios multi-tenant.
 *
 * - Acesso por caminho no domínio raiz (ex: 'reservei.com/arena-central') é redirecionado
 *   permanentemente (HTTP 301) para o subdomínio oficial ('arena-central.reservei.com').
 * - Acesso por subdomínio propaga o slug da arena no cabeçalho 'x-arena-slug' e reescreve
 *   a home ('/') internamente para a página da arena.
 *
 * A proteção das rotas '/admin' é feita no cliente (`useAdminAuth`) e, de forma definitiva,
 * pelas políticas RLS do PostgreSQL: a sessão do Supabase Auth reside no navegador e não
 * é visível ao middleware.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  extrairSubdominio,
  hostEhDominioRaiz,
  resolverRedirecionamentoPorCaminho,
} from "@/lib/arena/subdomain";

export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas exceto arquivos estáticos, rotas internas do Next e APIs:
     * - _next/static (scripts e estilos)
     * - _next/image (imagens otimizadas)
     * - favicon.ico e arquivos de mídia com extensão
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

/**
 * Proxy central de resolução de Tenants por Subdomínio.
 *
 * @param request Objeto da requisição Next.js
 * @returns Redirecionamento 301, resposta reescrita com contexto de tenant ou próximo handler
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const subdominio = extrairSubdominio(host);
  const { pathname, search } = request.nextUrl;

  // 1. Acesso por caminho no domínio raiz (ex: 'reservei.com/arena-central'):
  // redireciona 301 para o subdomínio oficial da arena. Só no domínio raiz configurado: em outros hosts
  // (ex.: 'projeto.vercel.app' sem domínio próprio) o destino seria um domínio que não é da plataforma.
  if (!subdominio && hostEhDominioRaiz(host)) {
    const destino = resolverRedirecionamentoPorCaminho(pathname, search);
    if (destino) {
      return NextResponse.redirect(destino, 301);
    }
  }

  const requestHeaders = new Headers(request.headers);

  // 2. Acesso via subdomínio de arena (ex: 'arena-central.reservei.com')
  if (subdominio) {
    // Propaga o slug da arena via cabeçalho customizado para Server Components e APIs
    requestHeaders.set("x-arena-slug", subdominio);

    // Home do subdomínio: reescreve internamente para a rota dinâmica da arena
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = `/${subdominio}`;
      return NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  // Demais páginas (ex: '/minha-conta', '/admin'): mantém a URL e propaga os cabeçalhos
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
