/**
 * @file route.ts
 * @description Gestão de equipe da arena (somente proprietário).
 *
 * - GET  /api/admin/equipe?arena=<slug>                                   -> { sucesso, membros }
 * - POST /api/admin/equipe { arenaSlug, acao: "convidar", nome, email, role } -> { sucesso, credencial }
 * - POST /api/admin/equipe { arenaSlug, acao: "alterar", userId, role?, ativo? } -> { sucesso }
 * - POST /api/admin/equipe { arenaSlug, acao: "redefinir_senha", userId }  -> { sucesso, credencial }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import {
  alterarMembro,
  convidarMembro,
  listarEquipe,
  redefinirSenhaMembro,
  validarAlteracao,
  validarConvite,
} from "@/lib/admin/equipeServidorService";

export const dynamic = "force-dynamic";

/** Lista os membros da equipe. */
export async function GET(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const membro = await exigirMembroArena(
      request,
      request.nextUrl.searchParams.get("arena") ?? "",
      "gerenciar_equipe"
    );
    return NextResponse.json({ sucesso: true, membros: await listarEquipe(membro.arenaId) });
  } catch (err) {
    return responderErro(err, "equipe:listar");
  }
}

/** Convida, altera ou redefine a senha de um membro. */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const autor = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""), "gerenciar_equipe");

    switch (corpo.acao) {
      case "convidar": {
        const credencial = await convidarMembro(autor, validarConvite(corpo));
        return NextResponse.json({ sucesso: true, credencial }, { status: 201 });
      }
      case "alterar": {
        await alterarMembro(autor, validarAlteracao(corpo));
        return NextResponse.json({ sucesso: true });
      }
      case "redefinir_senha": {
        const userId = typeof corpo.userId === "string" ? corpo.userId : "";
        if (!userId) throw new ErroHttp("Membro não informado.", 400);
        const credencial = await redefinirSenhaMembro(autor, userId);
        return NextResponse.json({ sucesso: true, credencial });
      }
      default:
        throw new ErroHttp("Ação inválida.", 400);
    }
  } catch (err) {
    return responderErro(err, "equipe");
  }
}
