/**
 * @file route.ts
 * @description Decisão do balcão sobre um Pix manual informado pelo atleta (qualquer membro da equipe).
 *
 * POST /api/admin/pagamentos/manual { arenaSlug, reservaId, acao: "confirmar" | "recusar", motivo? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { confirmarPagamentoManual, recusarPagamentoManual } from "@/lib/pagamento/pagamentoManualServidorService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""));
    const reservaId = typeof corpo.reservaId === "string" ? corpo.reservaId : "";
    if (!reservaId) throw new ErroHttp("Reserva não informada.", 400);

    if (corpo.acao === "confirmar") {
      await confirmarPagamentoManual(membro, reservaId);
    } else if (corpo.acao === "recusar") {
      const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim() : "";
      if (motivo.length < 3) throw new ErroHttp("Informe o motivo da recusa.", 400);
      await recusarPagamentoManual(membro, reservaId, motivo);
    } else {
      throw new ErroHttp("Ação inválida.", 400);
    }
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    return responderErro(err, "pagamento-manual");
  }
}
