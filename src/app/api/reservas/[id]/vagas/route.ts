/**
 * @file route.ts
 * @description Abertura e fechamento de vagas na partida do próprio atleta (mural de vagas).
 *
 * POST /api/reservas/:id/vagas   (Authorization: Bearer <token do atleta>)
 * Corpo: { vagasAbertas: number }  (0 fecha as vagas)
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { atualizarVagasDoAtleta } from "@/lib/reservas/reservasAtletaServidorService";

export const dynamic = "force-dynamic";

/**
 * Atualiza as vagas abertas da reserva do atleta.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Entre na sua conta." }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const corpo = (await request.json().catch(() => null)) as { vagasAbertas?: unknown } | null;
    const resultado = await atualizarVagasDoAtleta(id, usuario.id, Number(corpo?.vagasAbertas));
    return NextResponse.json({ sucesso: true, ...resultado });
  } catch (err) {
    return responderErro(err, "reserva-vagas");
  }
}
