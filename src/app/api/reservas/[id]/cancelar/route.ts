/**
 * @file route.ts
 * @description Cancelamento de reserva pelo próprio atleta.
 *
 * POST /api/reservas/:id/cancelar   (Authorization: Bearer <token do atleta>)
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { cancelarReservaDoAtleta } from "@/lib/reservas/reservasAtletaServidorService";

export const dynamic = "force-dynamic";

/**
 * Cancela a reserva se pertencer ao atleta e a partida ainda não tiver começado.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Entre na sua conta." }, { status: 401 });

  try {
    const { id } = await ctx.params;
    await cancelarReservaDoAtleta(id, usuario.id);
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    return responderErro(err, "reserva-cancelar");
  }
}
