/**
 * @file route.ts
 * @description Super Admin: nova senha temporária para o proprietário de uma arena.
 *
 * POST /api/super-admin/acesso { slug } (cabeçalho x-super-admin-secret) -> { email, senhaTemporaria }
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirSuperAdmin } from "@/lib/servidor/superAdmin";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { redefinirSenhaProprietario } from "@/lib/admin/acessoProprietarioService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const negado = exigirSuperAdmin(request);
  if (negado) return negado;

  try {
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const acesso = await redefinirSenhaProprietario(String(corpo.slug ?? ""));
    return NextResponse.json(acesso);
  } catch (err) {
    if (err instanceof ErroHttp) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[API super-admin acesso] Erro inesperado:", err);
    return NextResponse.json({ error: "Não foi possível redefinir a senha." }, { status: 500 });
  }
}
