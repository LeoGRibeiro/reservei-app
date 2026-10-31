/**
 * @file route.ts
 * @description Confere o código de acesso e abre a sessão (criando a conta, quando é cadastro).
 *
 * POST /api/acesso/verificar
 * Corpo: { arenaId, telefone, codigo, modo, nome?, nascimento?, reservaId?, checkoutToken? }
 * Resposta: { sucesso: true, accessToken, refreshToken } — o navegador chama `supabase.auth.setSession`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { verificarCodigo } from "@/lib/acesso/acessoServidorService";

export const dynamic = "force-dynamic";

/**
 * Entra ou cria a conta com o código.
 */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;
  try {
    const corpo: unknown = await request.json().catch(() => null);
    const sessao = await verificarCodigo(corpo);
    return NextResponse.json({ sucesso: true, ...sessao });
  } catch (err) {
    return responderErro(err, "acesso-verificar");
  }
}
