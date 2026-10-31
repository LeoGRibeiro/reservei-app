/**
 * @file route.ts
 * @description Exclusão da conta do atleta logado.
 *
 * DELETE /api/atletas/conta   (Authorization: Bearer <token do atleta>)
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { excluirConta } from "@/lib/atletas/perfilAtletaServidorService";

export const dynamic = "force-dynamic";

/**
 * Apaga perfil, carimbos, horas grátis, pedidos e o acesso. As reservas continuam valendo na arena.
 */
export async function DELETE(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;
  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Entre na sua conta." }, { status: 401 });
  try {
    await excluirConta(usuario.id);
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    return responderErro(err, "atletas-conta");
  }
}
