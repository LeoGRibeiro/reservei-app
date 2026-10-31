/**
 * @file route.ts
 * @description Pede o código de acesso pelo WhatsApp (entrar, criar conta ou confirmar o WhatsApp
 * depois de reservar sem conta).
 *
 * POST /api/acesso/codigo
 * Corpo: { arenaId, telefone, modo: "entrar" | "criar" | "concluir" }
 * Resposta: { sucesso: true, reenviarEmSegundos }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { solicitarCodigo } from "@/lib/acesso/acessoServidorService";
import { ipDaRequisicao } from "@/lib/servidor/ipRequisicao";

export const dynamic = "force-dynamic";

/**
 * Gera, guarda (só o hash) e entrega o código, respeitando os limites de envio.
 */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;
  try {
    const corpo: unknown = await request.json().catch(() => null);
    const resultado = await solicitarCodigo(corpo, ipDaRequisicao(request));
    return NextResponse.json({ sucesso: true, ...resultado });
  } catch (err) {
    return responderErro(err, "acesso-codigo");
  }
}
