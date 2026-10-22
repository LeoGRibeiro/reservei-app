/**
 * @file route.ts
 * @description Cadastro de atleta (WhatsApp + senha).
 *
 * POST /api/atletas/cadastro
 * Corpo: { nome, telefone, senha, dataNascimento? }
 * Resposta 201: { sucesso: true }  — o navegador faz o login em seguida.
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { cadastrarAtleta, validarCadastroAtleta } from "@/lib/atletas/cadastroAtletaServidorService";

export const dynamic = "force-dynamic";

/**
 * Cria a conta do atleta já confirmada e o perfil correspondente.
 */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const corpo: unknown = await request.json().catch(() => null);
    await cadastrarAtleta(validarCadastroAtleta(corpo));
    return NextResponse.json({ sucesso: true }, { status: 201 });
  } catch (err) {
    return responderErro(err, "atletas-cadastro");
  }
}
