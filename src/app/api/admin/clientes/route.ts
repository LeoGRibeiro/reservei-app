/**
 * @file route.ts
 * @description Bloquear ou liberar um cliente nesta arena (gerente ou dono).
 *
 * POST /api/admin/clientes { arenaSlug, acao: "bloquear" | "desbloquear", telefone, motivo? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { executarAcaoCliente, validarAcaoCliente } from "@/lib/clientes/clientesServidorService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""), "bloquear_cliente");
    await executarAcaoCliente(membro, validarAcaoCliente(corpo));
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    return responderErro(err, "clientes");
  }
}
