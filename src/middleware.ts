/**
 * @file middleware.ts
 * @description Middleware do Next.js para interceptação e resolução de subdomínios dinâmicos
 * multi-tenant (ex: 'arena-tal.reservei.com' -> reescrita interna para '/arena-tal').
 */

import { NextResponse, type NextRequest } from "next/server";
import { extrairSubdominio } from "@/lib/arena/subdomain";

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
 * Middleware central de resolução de Tenants por Subdomínio.
 * 
 * @param request Objeto da requisição Next.js
 * @returns Resposta reescrita com contexto de tenant ou próximo handler
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const subdominio = extrairSubdominio(host);
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);

  if (subdominio) {
    // Propaga o slug da arena via cabeçalho customizado para Server Components e APIs
    requestHeaders.set("x-arena-slug", subdominio);

    // Caso o cliente acesse a home do subdomínio ('leopoldina.reservei.com/'),
    // reescreve internamente para a rota dinâmica '/leopoldina' de forma transparente
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = `/${subdominio}`;
      return NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders,
        },
      });
    }

    // Se estiver acessando outra página (ex: '/minha-conta', '/login'),
    // mantém a URL e propaga o cabeçalho
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
