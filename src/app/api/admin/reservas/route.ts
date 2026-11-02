/**
 * @file route.ts
 * @description Reserva feita pelo balcão (qualquer membro da equipe): preço pela tabela da quadra (ou
 * valor combinado), pagamento já recebido e ligação com a conta do cliente.
 *
 * POST /api/admin/reservas { arenaSlug, quadraId, data, horarios, nomeCliente, whatsappCliente, pagamento, forma?, ... }
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano E, item 6)
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { criarReservaBalcao, validarNovaReservaBalcao } from "@/lib/reservas/balcaoServidorService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""));
    const reserva = await criarReservaBalcao(membro, validarNovaReservaBalcao(corpo));
    return NextResponse.json({ sucesso: true, reserva }, { status: 201 });
  } catch (err) {
    return responderErro(err, "reserva-balcao-nova");
  }
}
