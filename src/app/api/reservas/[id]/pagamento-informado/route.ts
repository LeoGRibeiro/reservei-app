/**
 * @file route.ts
 * @description O atleta avisa que pagou o Pix manual ("Já paguei"): o horário fica segurado até a arena
 * conferir o extrato.
 *
 * POST /api/reservas/{id}/pagamento-informado { checkoutToken } -> { sucesso, expiraEm }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { informarPagamentoManual } from "@/lib/pagamento/pagamentoManualServidorService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const { id } = await params;
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const token = typeof corpo.checkoutToken === "string" ? corpo.checkoutToken : "";
    const { expiraEm } = await informarPagamentoManual(id, token);
    return NextResponse.json({ sucesso: true, expiraEm });
  } catch (err) {
    return responderErro(err, "pagamento-informado");
  }
}
