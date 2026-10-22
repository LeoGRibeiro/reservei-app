/**
 * @file route.ts
 * @description Webhook do Asaas por arena (registrado automaticamente ao conectar a conta da arena).
 *
 * POST /api/webhooks/pagamentos/asaas/{arenaId}
 * Segurança: o cabeçalho `asaas-access-token` precisa ser o token gerado para ESTA arena, e só reservas
 * desta arena podem ser confirmadas. O token de uma arena nunca confirma reservas de outra.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/adminClient";
import { AsaasGateway } from "@/lib/pagamento/gateways/asaasGateway";
import { carregarCredencialAsaas } from "@/lib/pagamento/credenciaisArenaRepository";
import { processarConfirmacaoPagamento } from "@/lib/pagamento/confirmacaoServidorService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arenaId: string }> }) {
  if (!isAdminClientConfigured()) {
    return NextResponse.json({ status: "rejected", motivo: "Servidor sem credenciais." }, { status: 503 });
  }

  const { arenaId } = await params;
  let credencial;
  try {
    credencial = await carregarCredencialAsaas(arenaId);
  } catch (err) {
    console.error(`[Webhook Asaas] Falha ao carregar credencial da arena '${arenaId}':`, err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
  if (!credencial) {
    return NextResponse.json({ status: "rejected", motivo: "Arena sem Asaas conectado." }, { status: 404 });
  }

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const gateway = new AsaasGateway(credencial.apiKey, credencial.sandbox, credencial.webhookToken);
  const evento = corpo ? gateway.normalizarWebhook(request.headers, corpo) : null;

  if (!evento) {
    // Token inválido ou evento que não interessa: 200 evita reenvios infinitos do Asaas
    return NextResponse.json({ status: "ignored" });
  }

  if (evento.evento !== "PAGAMENTO_CONFIRMADO") {
    return NextResponse.json({ status: "processed", evento: evento.evento });
  }

  const resultado = await processarConfirmacaoPagamento(evento.txid, evento.valorPago, evento.dataPagamento, {
    arenaId,
  });
  return NextResponse.json({ status: "success", processado: resultado.sucesso, reservaId: resultado.reservaId });
}
