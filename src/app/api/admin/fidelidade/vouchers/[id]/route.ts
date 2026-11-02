/**
 * @file route.ts
 * @description Liberar ou recusar a hora grátis do Clube que bateu a meta ("em análise"). Só o dono
 * ou o gerente da arena; o atleta só vê o voucher depois de liberado.
 *
 * POST /api/admin/fidelidade/vouchers/{id} { arenaSlug, decisao: "liberar" | "recusar", motivo? }
 *   -> { sucesso, voucher }
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §10
 */

import { NextResponse, type NextRequest } from "next/server";
import { exigirClienteAdministrativo, responderErro } from "@/lib/servidor/respostaApi";
import { exigirMembroArena } from "@/lib/servidor/autorizacaoArena";
import { analisarVoucher, validarDecisaoVoucher } from "@/lib/fidelidade/fidelidadeServidorService";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const indisponivel = exigirClienteAdministrativo();
  if (indisponivel) return indisponivel;

  try {
    const { id } = await params;
    const corpo = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const membro = await exigirMembroArena(request, String(corpo.arenaSlug ?? ""), "analisar_voucher");
    const decisao = validarDecisaoVoucher(corpo);
    const voucher = await analisarVoucher(membro, id, decisao);
    return NextResponse.json({ sucesso: true, voucher });
  } catch (err) {
    return responderErro(err, "fidelidade-analisar-voucher");
  }
}
