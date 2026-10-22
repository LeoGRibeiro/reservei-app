/**
 * @file route.ts
 * @description Checkout público de reservas.
 *
 * POST /api/reservas/checkout
 * Corpo: { arenaId, quadraId, data, horarios[], nomeCliente, whatsappCliente, esporte?, observacoes?,
 *          tipoPagamento?: "sinal" | "integral", voucherIds?: string[] }
 * Cabeçalho opcional: Authorization: Bearer <token do atleta> (vincula a reserva e libera vouchers)
 * Resposta 201: { sucesso: true, reserva, checkoutToken }
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { criarReservaCheckout, validarSolicitacaoCheckout } from "@/lib/reservas/checkoutServidorService";

export const dynamic = "force-dynamic";

/**
 * Cria a reserva (lock de 10 minutos) com preço e disponibilidade validados no servidor.
 */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo: unknown = await request.json().catch(() => null);
    const dados = validarSolicitacaoCheckout(corpo);
    const usuario = await obterUsuarioAutenticado(request);
    const resultado = await criarReservaCheckout(dados, usuario?.id ?? null);
    return NextResponse.json({ sucesso: true, ...resultado }, { status: 201 });
  } catch (err) {
    return responderErro(err, "checkout");
  }
}
