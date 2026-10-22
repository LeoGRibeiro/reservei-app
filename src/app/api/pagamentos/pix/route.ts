/**
 * @file route.ts
 * @description Endpoint de emissão segura de cobrança Pix.
 *
 * POST /api/pagamentos/pix
 * Corpo: { reservaId, tipoPagamento?: "sinal" | "integral", expiracaoMinutos?, nomeCliente?, whatsappCliente? }
 * Resposta: { sucesso: true, cobranca: PixCobranca }
 *
 * O valor cobrado é lido do banco (nunca do corpo) e os metadados do Pix são gravados com o
 * cliente service role, pois o RLS impede UPDATE em `reservas` pelo navegador.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/adminClient";
import {
  ErroPixServidor,
  emitirPixParaReserva,
  validarSolicitacaoPix,
} from "@/lib/pagamento/pixServidorService";

export const dynamic = "force-dynamic";

/**
 * Emite a cobrança Pix de uma reserva.
 */
export async function POST(request: NextRequest) {
  if (!isAdminClientConfigured()) {
    return NextResponse.json(
      { sucesso: false, erro: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." },
      { status: 503 }
    );
  }

  try {
    const corpo: unknown = await request.json().catch(() => null);
    const solicitacao = validarSolicitacaoPix(corpo);
    const cobranca = await emitirPixParaReserva(solicitacao);
    return NextResponse.json({ sucesso: true, cobranca });
  } catch (err) {
    if (err instanceof ErroPixServidor) {
      return NextResponse.json({ sucesso: false, erro: err.message }, { status: err.status });
    }
    console.error("[API pix] Erro inesperado ao emitir cobrança:", err);
    return NextResponse.json(
      { sucesso: false, erro: "Não foi possível gerar o Pix. Tente novamente." },
      { status: 500 }
    );
  }
}
