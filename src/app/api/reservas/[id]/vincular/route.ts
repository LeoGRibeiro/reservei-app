/**
 * @file route.ts
 * @description Vincula a reserva recém-feita à conta que o visitante acabou de criar.
 *
 * POST /api/reservas/:id/vincular   (Authorization: Bearer <token do atleta>)
 * Corpo: { checkoutToken }
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { vincularReservaAoAtleta } from "@/lib/reservas/checkoutServidorService";

export const dynamic = "force-dynamic";

/**
 * Vincula a reserva ao atleta autenticado, desde que ele apresente o token do checkout.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Entre na sua conta." }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const corpo = (await request.json().catch(() => null)) as { checkoutToken?: unknown } | null;
    const token = typeof corpo?.checkoutToken === "string" ? corpo.checkoutToken : "";
    await vincularReservaAoAtleta(id, token, usuario.id);
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    return responderErro(err, "reserva-vincular");
  }
}
