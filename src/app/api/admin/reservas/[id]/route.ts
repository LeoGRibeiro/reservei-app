/**
 * @file route.ts
 * @description Ações do balcão sobre uma reserva (qualquer membro da equipe da arena): quitar o
 * restante, cancelar registrando o sinal, remarcar, marcar comparecimento e registrar devolução.
 *
 * POST /api/admin/reservas/{id} { arenaSlug, acao, ... } -> { sucesso, reserva }
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano E)
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { executarAcaoBalcao, validarAcaoBalcao } from "@/lib/reservas/balcaoServidorService";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const { id } = await params;
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""));
    const acao = validarAcaoBalcao(corpo);
    const reserva = await executarAcaoBalcao(membro, id, acao);
    return NextResponse.json({ sucesso: true, reserva });
  } catch (err) {
    return responderErro(err, "reserva-balcao");
  }
}
