/**
 * @file autenticacaoServidor.ts
 * @description Identificação do usuário autenticado nas rotas de API (somente servidor).
 *
 * O navegador envia `Authorization: Bearer <access_token>` do Supabase Auth; o servidor valida o
 * token junto ao Supabase. Ids de usuário enviados no corpo da requisição nunca são confiáveis.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";

/** Usuário autenticado extraído do token. */
export interface UsuarioAutenticado {
  /** UUID do usuário em `auth.users` */
  id: string;
  /** E-mail (sintético `<whatsapp>@auth.reservei.com.br` para atletas) */
  email: string | null;
}

/**
 * Valida o token Bearer da requisição e retorna o usuário correspondente.
 *
 * @param request Requisição recebida pela rota
 * @returns Usuário autenticado, ou null se não houver token válido
 *
 * @example
 * ```ts
 * const usuario = await obterUsuarioAutenticado(request);
 * if (!usuario) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
 * ```
 */
export async function obterUsuarioAutenticado(request: Request): Promise<UsuarioAutenticado | null> {
  const cabecalho = request.headers.get("authorization") ?? "";
  const token = cabecalho.toLowerCase().startsWith("bearer ") ? cabecalho.slice(7).trim() : "";
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * Erro de negócio com código HTTP sugerido, usado pelos casos de uso do servidor.
 */
export class ErroHttp extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ErroHttp";
  }
}
