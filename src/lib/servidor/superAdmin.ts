/**
 * @file superAdmin.ts
 * @description Autorização das rotas do Super Admin da plataforma (somente servidor): segredo estático
 * `SUPER_ADMIN_SECRET` no cabeçalho `x-super-admin-secret`, comparado em tempo constante.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/adminClient";

function segredoConfere(informado: string, esperado: string): boolean {
  const a = Buffer.from(informado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Valida o segredo do Super Admin e a disponibilidade do cliente administrativo.
 *
 * @param request Requisição recebida
 * @returns Resposta de erro (401/503), ou null se autorizado
 *
 * @example
 * ```ts
 * const negado = exigirSuperAdmin(request);
 * if (negado) return negado;
 * ```
 */
export function exigirSuperAdmin(request: Request): NextResponse | null {
  const esperado = process.env.SUPER_ADMIN_SECRET || "";
  if (!esperado) {
    return NextResponse.json({ error: "SUPER_ADMIN_SECRET não está configurada no servidor." }, { status: 503 });
  }
  if (!segredoConfere(request.headers.get("x-super-admin-secret") ?? "", esperado)) {
    return NextResponse.json({ error: "Senha de Super Admin inválida." }, { status: 401 });
  }
  if (!isAdminClientConfigured()) {
    return NextResponse.json({ error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." }, { status: 503 });
  }
  return null;
}
