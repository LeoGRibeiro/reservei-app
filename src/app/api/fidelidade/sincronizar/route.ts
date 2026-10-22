/**
 * @file route.ts
 * @description Emissão de selos e vouchers de fidelidade do atleta autenticado.
 *
 * POST /api/fidelidade/sincronizar   (Authorization: Bearer <token do atleta>)
 * Corpo: { arenaId }
 * Resposta: { sucesso: true, voucherGerado: VoucherFidelidade | null, novosSelos: number }
 */

import { NextResponse, type NextRequest } from "next/server";
import { obterUsuarioAutenticado } from "@/lib/servidor/autenticacaoServidor";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { sincronizarFidelidadeServidor } from "@/lib/fidelidade/fidelidadeServidorService";

export const dynamic = "force-dynamic";

/**
 * Contabiliza as partidas concluídas do atleta na arena e emite o voucher quando a meta é atingida.
 */
export async function POST(request: NextRequest) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Entre na sua conta." }, { status: 401 });

  try {
    const corpo = (await request.json().catch(() => null)) as { arenaId?: unknown } | null;
    const arenaId = typeof corpo?.arenaId === "string" ? corpo.arenaId.trim() : "";
    if (!arenaId) return NextResponse.json({ sucesso: false, erro: "Arena não informada." }, { status: 400 });

    const resultado = await sincronizarFidelidadeServidor(usuario.id, arenaId);
    return NextResponse.json({ sucesso: true, ...resultado });
  } catch (err) {
    return responderErro(err, "fidelidade-sincronizar");
  }
}
