/**
 * @file asaasContaService.ts
 * @description Conexão da conta Asaas da própria arena (somente servidor, somente proprietário).
 *
 * Fluxo de "Conectar Asaas" (SPEC/2026-10-22-mvp-go-live.md §3.2):
 * 1. Valida a chave chamando `GET /myAccount` (identifica sandbox pelo prefixo `$aact_hmlg_`).
 * 2. Registra na conta da arena o webhook `/api/webhooks/pagamentos/asaas/{arenaId}` com um token aleatório.
 * 3. Grava a chave e o token cifrados e muda `arenas.modo_pagamento` para `asaas`.
 * O dono não precisa configurar nada no painel do Asaas.
 */

import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { registrarAuditoria } from "@/lib/servidor/auditoria";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";
import {
  carregarCredencialAsaas,
  removerCredencialAsaas,
  salvarCredencialAsaas,
} from "./credenciaisArenaRepository";

const URL_PRODUCAO = "https://api.asaas.com/v3";
const URL_SANDBOX = "https://sandbox.asaas.com/api/v3";

/** Eventos do Asaas que o Reservei processa. */
const EVENTOS_WEBHOOK = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED"];

/**
 * Identifica se a chave é do ambiente de testes do Asaas (sandbox/homologação).
 *
 * @param apiKey Chave informada
 * @returns `true` para chaves `$aact_hmlg_...`
 */
export function chaveAsaasEhSandbox(apiKey: string): boolean {
  return apiKey.startsWith("$aact_hmlg_");
}

/**
 * Valida o formato da chave de API do Asaas.
 *
 * @param bruta Valor colado pelo dono
 * @returns Chave limpa
 * @throws ErroHttp 400 se não parecer uma chave do Asaas
 */
export function validarChaveAsaas(bruta: unknown): string {
  const chave = typeof bruta === "string" ? bruta.trim() : "";
  if (!/^\$aact_[A-Za-z0-9_:$.\-=]{20,}$/.test(chave)) {
    throw new ErroHttp("Chave inválida. Copie a chave completa em Asaas → Integrações → Chave de API (começa com $aact_).", 400);
  }
  return chave;
}

/** Chamada à API do Asaas com a chave da arena. */
async function chamarAsaas(
  baseUrl: string,
  apiKey: string,
  caminho: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; dados: Record<string, unknown> }> {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", access_token: apiKey, "User-Agent": "Reservei" },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: resposta.ok, status: resposta.status, dados };
}

/** Primeira mensagem de erro devolvida pelo Asaas. */
function mensagemAsaas(dados: Record<string, unknown>): string {
  const erros = dados.errors as Array<{ description?: string }> | undefined;
  return erros?.[0]?.description ?? "";
}

/**
 * Conecta a conta Asaas da arena.
 *
 * @param membro Proprietário autorizado
 * @param apiKey Chave já validada por {@link validarChaveAsaas}
 * @param origem Origem pública do site (ex.: 'https://arena.reservei.com.br'), usada na URL do webhook
 * @returns Nome do titular da conta e se é sandbox
 * @throws ErroHttp 400 (chave recusada pelo Asaas), 502 (falha ao registrar webhook)
 */
export async function conectarAsaas(
  membro: MembroArena,
  apiKey: string,
  origem: string
): Promise<{ contaNome: string; sandbox: boolean }> {
  const sandbox = chaveAsaasEhSandbox(apiKey);
  const baseUrl = sandbox ? URL_SANDBOX : URL_PRODUCAO;

  const conta = await chamarAsaas(baseUrl, apiKey, "/myAccount");
  if (!conta.ok) {
    throw new ErroHttp("O Asaas recusou esta chave. Confira se copiou a chave completa e se ela está ativa.", 400);
  }
  const contaNome = String(conta.dados.name || conta.dados.company || "Conta Asaas");

  // Reconexão: remove o webhook anterior desta arena para não receber eventos em dobro
  const anterior = await carregarCredencialAsaas(membro.arenaId).catch(() => null);
  if (anterior?.webhookId && anterior.apiKey === apiKey) {
    await chamarAsaas(baseUrl, apiKey, `/webhooks/${anterior.webhookId}`, { method: "DELETE" }).catch(() => undefined);
  }

  const webhookToken = randomBytes(30).toString("base64url");
  const webhook = await chamarAsaas(baseUrl, apiKey, "/webhooks", {
    method: "POST",
    body: {
      name: "Reservei - Reservas",
      url: `${origem.replace(/\/$/, "")}/api/webhooks/pagamentos/asaas/${encodeURIComponent(membro.arenaId)}`,
      email: membro.email ?? undefined,
      enabled: true,
      interrupted: false,
      authToken: webhookToken,
      sendType: "SEQUENTIALLY",
      events: EVENTOS_WEBHOOK,
    },
  });
  if (!webhook.ok || !webhook.dados.id) {
    const detalhe = mensagemAsaas(webhook.dados);
    throw new ErroHttp(
      `A chave é válida, mas o Asaas não aceitou registrar o aviso de pagamentos${detalhe ? `: ${detalhe}` : "."} Tente novamente em instantes.`,
      502
    );
  }

  await salvarCredencialAsaas({
    arenaId: membro.arenaId,
    apiKey,
    sandbox,
    webhookToken,
    webhookId: String(webhook.dados.id),
    contaNome,
  });

  const { error } = await supabaseAdmin.from("arenas").update({ modo_pagamento: "asaas" }).eq("id", membro.arenaId);
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "pagamento.credencial_conectada",
    detalhes: { provedor: "asaas", sandbox, contaNome },
  });

  return { contaNome, sandbox };
}

/**
 * Desconecta o Asaas: remove o webhook da conta da arena, apaga a credencial e volta ao Pix manual.
 * Bloqueado enquanto houver cobrança Asaas em aberto (o webhook ainda é necessário para confirmá-la).
 *
 * @param membro Proprietário autorizado
 * @throws ErroHttp 409 se houver cobranças em aberto
 */
export async function desconectarAsaas(membro: MembroArena): Promise<void> {
  const { count, error: erroAbertas } = await supabaseAdmin
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("arena_id", membro.arenaId)
    .eq("status", "em_processamento")
    .eq("gateway_provedor", "asaas")
    .gt("expira_em", new Date().toISOString());
  if (erroAbertas) throw new Error(erroAbertas.message);
  if ((count ?? 0) > 0) {
    throw new ErroHttp("Há pagamentos Pix em andamento nesta conta. Tente desconectar em alguns minutos.", 409);
  }

  const credencial = await carregarCredencialAsaas(membro.arenaId).catch(() => null);
  if (credencial?.webhookId) {
    const baseUrl = credencial.sandbox ? URL_SANDBOX : URL_PRODUCAO;
    await chamarAsaas(baseUrl, credencial.apiKey, `/webhooks/${credencial.webhookId}`, { method: "DELETE" }).catch(
      () => undefined
    );
  }

  await removerCredencialAsaas(membro.arenaId);
  const { error } = await supabaseAdmin.from("arenas").update({ modo_pagamento: "manual" }).eq("id", membro.arenaId);
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "pagamento.credencial_removida",
    detalhes: { provedor: "asaas" },
  });
}
