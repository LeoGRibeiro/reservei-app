/**
 * @file credenciaisArenaRepository.ts
 * @description Acesso (somente servidor) à tabela `arena_credenciais_pagamento`, que não tem policies de
 * RLS: nem visitantes nem operadores da arena conseguem lê-la pelo navegador. A chave de API é gravada
 * cifrada ({@link cifrarCredencial}) e só é decifrada no momento de falar com o gateway.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { cifrarCredencial, decifrarCredencial } from "./criptografiaCredenciais";

/** Credencial Asaas decifrada, pronta para uso pelo gateway. */
export interface CredencialAsaas {
  arenaId: string;
  apiKey: string;
  sandbox: boolean;
  /** Token que o Asaas envia no cabeçalho `asaas-access-token` dos webhooks desta arena */
  webhookToken: string;
  /** Id do webhook registrado na conta Asaas da arena (para removê-lo ao desconectar) */
  webhookId: string | null;
  /** Nome do titular da conta Asaas (exibido no painel) */
  contaNome: string | null;
  validadaEm: string | null;
}

/** Dados exibíveis da conexão (sem segredos). */
export interface ResumoCredencialAsaas {
  contaNome: string | null;
  sandbox: boolean;
  validadaEm: string | null;
}

/**
 * Carrega e decifra a credencial Asaas de uma arena.
 *
 * @param arenaId Arena
 * @returns Credencial, ou null se a arena não conectou o Asaas
 */
export async function carregarCredencialAsaas(arenaId: string): Promise<CredencialAsaas | null> {
  const { data, error } = await supabaseAdmin
    .from("arena_credenciais_pagamento")
    .select("*")
    .eq("arena_id", arenaId)
    .eq("provedor", "asaas")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    arenaId,
    apiKey: decifrarCredencial(String(data.api_key_cifrada)),
    sandbox: Boolean(data.sandbox),
    webhookToken: decifrarCredencial(String(data.webhook_token_cifrado)),
    webhookId: data.webhook_id ? String(data.webhook_id) : null,
    contaNome: data.conta_nome ? String(data.conta_nome) : null,
    validadaEm: data.validada_em ? String(data.validada_em) : null,
  };
}

/**
 * Resumo da conexão Asaas da arena, sem decifrar nada.
 *
 * @param arenaId Arena
 * @returns Resumo, ou null se não houver conexão
 */
export async function resumirCredencialAsaas(arenaId: string): Promise<ResumoCredencialAsaas | null> {
  const { data, error } = await supabaseAdmin
    .from("arena_credenciais_pagamento")
    .select("conta_nome, sandbox, validada_em")
    .eq("arena_id", arenaId)
    .eq("provedor", "asaas")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    contaNome: data.conta_nome ? String(data.conta_nome) : null,
    sandbox: Boolean(data.sandbox),
    validadaEm: data.validada_em ? String(data.validada_em) : null,
  };
}

/**
 * Grava (ou substitui) a credencial Asaas da arena, cifrando a chave e o token do webhook.
 *
 * @param credencial Dados em texto puro
 */
export async function salvarCredencialAsaas(credencial: Omit<CredencialAsaas, "validadaEm">): Promise<void> {
  const { error } = await supabaseAdmin.from("arena_credenciais_pagamento").upsert(
    {
      arena_id: credencial.arenaId,
      provedor: "asaas",
      api_key_cifrada: cifrarCredencial(credencial.apiKey),
      webhook_token_cifrado: cifrarCredencial(credencial.webhookToken),
      webhook_id: credencial.webhookId,
      sandbox: credencial.sandbox,
      conta_nome: credencial.contaNome,
      validada_em: new Date().toISOString(),
    },
    { onConflict: "arena_id,provedor" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Remove a credencial Asaas da arena.
 *
 * @param arenaId Arena
 */
export async function removerCredencialAsaas(arenaId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("arena_credenciais_pagamento")
    .delete()
    .eq("arena_id", arenaId)
    .eq("provedor", "asaas");
  if (error) throw new Error(error.message);
}
