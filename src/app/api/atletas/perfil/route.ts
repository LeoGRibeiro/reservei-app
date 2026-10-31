/**
 * @file route.ts
 * @description "Meus dados" do atleta logado.
 *
 * PATCH /api/atletas/perfil   (Authorization: Bearer <token do atleta>)
 * Corpo: { nome, telefone, nascimento? }  — trocar o WhatsApp troca também o login.
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { atualizarPerfil, validarPerfil } from "@/lib/atletas/perfilAtletaServidorService";

export const dynamic = "force-dynamic";

/**
 * Atualiza nome, WhatsApp e nascimento.
 */
export async function PATCH(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;
  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Entre na sua conta." }, { status: 401 });
  try {
    await atualizarPerfil(usuario.id, validarPerfil(await request.json().catch(() => null)));
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    return responderErro(err, "atletas-perfil");
  }
}
