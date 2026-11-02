/**
 * @file route.ts
 * @description Super Admin: altera os campos da plataforma de uma arena (subdomínio, módulos
 * contratados, arena ativa e modo demonstração). O dono não consegue mudar esses campos: o banco
 * barra (trigger `proteger_campos_plataforma_arena`).
 *
 * PATCH /api/super-admin/arenas/{id} { slug?, modulos?, ativo?, modoDemonstracao? }
 * Exige o cabeçalho `x-super-admin-secret`.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano A)
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirSuperAdmin } from "@/lib/servidor/superAdmin";
import { ErroProvisionamento } from "@/lib/admin/provisionamento";
import { alterarArenaPlataforma, validarAlteracaoArena } from "@/lib/admin/arenasPlataforma";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const negado = exigirSuperAdmin(request);
  if (negado) return negado;

  try {
    const { id } = await params;
    const alteracao = validarAlteracaoArena(await request.json().catch(() => null));
    const arena = await alterarArenaPlataforma(id, alteracao);
    return NextResponse.json({ arena });
  } catch (err) {
    if (err instanceof ErroProvisionamento) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[API super-admin] Erro inesperado ao alterar arena:", err);
    return NextResponse.json({ error: "Não foi possível alterar a arena." }, { status: 500 });
  }
}
