/**
 * @file route.ts
 * @description Redefinição assistida da senha de um atleta (gerente ou proprietário).
 *
 * POST /api/admin/atletas/senha { arenaSlug, usuarioId } -> { sucesso, acesso: { nome, telefone, senhaTemporaria } }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { redefinirSenhaAtleta } from "@/lib/atletas/senhaAtletaServidorService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""), "redefinir_senha_atleta");
    const acesso = await redefinirSenhaAtleta(membro, String(corpo.usuarioId ?? ""));
    return NextResponse.json({ sucesso: true, acesso });
  } catch (err) {
    return responderErro(err, "atleta-senha");
  }
}
