/**
 * @file route.ts
 * @description Endpoint do Super Admin para cadastrar novas arenas (onboarding assistido).
 *
 * POST /api/super-admin/arenas
 * Exige o cabeçalho `x-super-admin-secret` igual à variável de ambiente SUPER_ADMIN_SECRET.
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirSuperAdmin } from "@/lib/servidor/superAdmin";
import { ErroProvisionamento, criarArena, validarNovaArena } from "@/lib/admin/provisionamento";

export const dynamic = "force-dynamic";

/**
 * Cria a arena, as quadras iniciais e o convite de ativação do dono.
 */
export async function POST(request: NextRequest) {
  const negado = exigirSuperAdmin(request);
  if (negado) return negado;

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
