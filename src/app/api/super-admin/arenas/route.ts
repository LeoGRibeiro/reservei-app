/**
 * @file route.ts
 * @description Endpoint do Super Admin para cadastrar novas arenas (onboarding assistido).
 *
 * POST /api/super-admin/arenas
 * Exige o cabeçalho `x-super-admin-secret` igual à variável de ambiente SUPER_ADMIN_SECRET.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/adminClient";
import { ErroProvisionamento, criarArena, validarNovaArena } from "@/lib/admin/provisionamento";

export const dynamic = "force-dynamic";

/**
 * Compara dois segredos em tempo constante.
 */
function segredoConfere(informado: string, esperado: string): boolean {
  const a = Buffer.from(informado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cria uma nova arena (e suas quadras iniciais).
 */
export async function POST(request: NextRequest) {
  const esperado = process.env.SUPER_ADMIN_SECRET || "";

  if (!esperado) {
    return NextResponse.json(
      { error: "SUPER_ADMIN_SECRET não está configurada no servidor." },
      { status: 503 }
    );
  }
  if (!segredoConfere(request.headers.get("x-super-admin-secret") ?? "", esperado)) {
    return NextResponse.json({ error: "Senha de Super Admin inválida." }, { status: 401 });
  }
  if (!isAdminClientConfigured()) {
    return NextResponse.json(
      { error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." },
      { status: 503 }
    );
  }

  try {
    const corpo: unknown = await request.json().catch(() => null);
    const dados = validarNovaArena(corpo);
    const resultado = await criarArena(dados);
    return NextResponse.json({ success: true, sucesso: true, ...resultado }, { status: 201 });
  } catch (err) {
    if (err instanceof ErroProvisionamento) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[API super-admin] Erro inesperado ao criar arena:", err);
    return NextResponse.json({ error: "Não foi possível criar a arena." }, { status: 500 });
  }
}
