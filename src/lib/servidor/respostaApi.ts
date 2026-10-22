/**
 * @file respostaApi.ts
 * @description Padronização das respostas de erro das rotas de API.
 */

import { NextResponse } from "next/server";
import { isAdminClientConfigured } from "@/lib/supabase/adminClient";
import { ErroHttp } from "./autenticacaoServidor";

/**
 * Converte um erro em resposta JSON: erros de negócio mantêm a mensagem e o status;
 * erros inesperados viram 500 sem vazar detalhes internos.
 *
 * @param err Erro capturado
 * @param contexto Rótulo para o log do servidor
 * @returns Resposta JSON `{ sucesso: false, erro }`
 */
export function responderErro(err: unknown, contexto: string): NextResponse {
  if (err instanceof ErroHttp) {
    return NextResponse.json({ sucesso: false, erro: err.message }, { status: err.status });
  }
  console.error(`[API ${contexto}] Erro inesperado:`, err);
  return NextResponse.json(
    { sucesso: false, erro: "Não foi possível concluir a operação. Tente novamente." },
    { status: 500 }
  );
}

/**
 * Resposta 503 quando o servidor não tem a chave service role (ambiente mal configurado).
 *
 * @returns Resposta de erro, ou null se o cliente administrativo está disponível
 */
export function exigirClienteAdministrativo(): NextResponse | null {
  if (isAdminClientConfigured()) return null;
  return NextResponse.json(
    { sucesso: false, erro: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada." },
    { status: 503 }
  );
}
