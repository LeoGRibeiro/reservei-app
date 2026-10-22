/**
 * @file route.ts
 * @description Endpoint do Setup Wizard de primeiro acesso.
 *
 * - GET  /api/admin/setup?slug=<arena>&token=<convite> -> { precisaSetup, tokenValido }
 * - POST /api/admin/setup                               -> cria o primeiro administrador (proprietário)
 *
 * O POST exige o token de convite único gerado pelo Super Admin e só é aceito enquanto a arena
 * não possui nenhum operador ativo (HTTP 403 caso contrário). O token é invalidado após o uso.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/adminClient";
import {
  ErroProvisionamento,
  consultarEstadoSetup,
  criarPrimeiroAdministrador,
  validarSetupAdmin,
} from "@/lib/admin/provisionamento";

export const dynamic = "force-dynamic";

const MSG_NAO_CONFIGURADO =
  "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada. Contate o suporte.";

/**
 * Informa se a arena ainda precisa de configuração inicial (zero operadores ativos) e se o
 * token de convite informado é válido. Falhas retornam `precisaSetup: false` (login normal).
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!slug) {
    return NextResponse.json({ error: "Parâmetro 'slug' é obrigatório." }, { status: 400 });
  }
  if (!isAdminClientConfigured()) {
    return NextResponse.json({ precisaSetup: false, tokenValido: false });
  }

  try {
    return NextResponse.json(await consultarEstadoSetup(slug, token));
  } catch (err) {
    console.error("[API setup] Falha ao consultar necessidade de setup:", err);
    return NextResponse.json({ precisaSetup: false, tokenValido: false });
  }
}

/**
 * Cria o primeiro administrador da arena.
 */
export async function POST(request: NextRequest) {
  if (!isAdminClientConfigured()) {
    return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 });
  }

  try {
    const corpo: unknown = await request.json().catch(() => null);
    const dados = validarSetupAdmin(corpo);
    await criarPrimeiroAdministrador(dados);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ErroProvisionamento) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[API setup] Erro inesperado ao criar administrador:", err);
    return NextResponse.json(
      { error: "Não foi possível concluir a configuração. Tente novamente." },
      { status: 500 }
    );
  }
}
