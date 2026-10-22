/**
 * @file route.ts
 * @description Acompanhamento e desistência de um checkout, autorizados pelo token secreto do checkout.
 *
 * GET    /api/reservas/:id?token=<checkoutToken>  -> { sucesso, status, expiraEm, valorSinal, valorPendente }
 * DELETE /api/reservas/:id?token=<checkoutToken>  -> { sucesso, liberado }  (libera o lock em_processamento)
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { cancelarLockDoCheckout, carregarReservaDoCheckout } from "@/lib/reservas/checkoutServidorService";

export const dynamic = "force-dynamic";

/**
 * Status atual da reserva do checkout (usado pela tela do Pix para detectar a confirmação).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const { id } = await ctx.params;
    const reserva = await carregarReservaDoCheckout(id, request.nextUrl.searchParams.get("token") ?? "");
    return NextResponse.json({
      sucesso: true,
      status: reserva.status,
      expiraEm: reserva.expira_em ?? null,
      valorSinal: Number(reserva.valor_sinal ?? 0),
      valorPendente: Number(reserva.valor_pendente ?? 0),
    });
  } catch (err) {
    return responderErro(err, "reserva-status");
  }
}

/**
 * Libera o horário de um checkout abandonado.
 */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const { id } = await ctx.params;
    const liberado = await cancelarLockDoCheckout(id, request.nextUrl.searchParams.get("token") ?? "");
    return NextResponse.json({ sucesso: true, liberado });
  } catch (err) {
    return responderErro(err, "reserva-cancelar-lock");
  }
}
