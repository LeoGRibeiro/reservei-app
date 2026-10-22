/**
 * @file clienteApi.ts
 * @description Cliente HTTP do navegador para as rotas de API do Reservei. Anexa automaticamente o
 * token de acesso do Supabase Auth (`Authorization: Bearer`) quando há sessão, para que o servidor
 * identifique o atleta sem confiar em ids enviados no corpo da requisição.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

/** Resultado normalizado de uma chamada de API. */
export interface RespostaApi<T> {
  /** true quando o servidor respondeu 2xx com `sucesso !== false` */
  ok: boolean;
  /** Código HTTP (0 em falha de rede) */
  status: number;
  /** Corpo JSON da resposta */
  dados: T | null;
  /** Mensagem amigável de erro, quando houver */
  erro?: string;
}

/**
 * Obtém o token de acesso da sessão atual do Supabase Auth.
 *
 * @returns Access token JWT ou null se não houver sessão
 */
export async function obterTokenSessao(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Executa uma requisição JSON para uma rota de API interna.
 *
 * @param url Caminho da rota (ex: "/api/reservas/checkout")
 * @param opcoes Método e corpo (serializado como JSON)
 * @returns Resposta normalizada; nunca lança exceção
 *
 * @example
 * ```ts
 * const res = await chamarApi<{ sucesso: boolean }>("/api/fidelidade/sincronizar", { method: "POST" });
 * if (!res.ok) toast.error(res.erro);
 * ```
 */
export async function chamarApi<T extends object>(
  url: string,
  opcoes: { method?: "GET" | "POST" | "DELETE"; corpo?: unknown } = {}
): Promise<RespostaApi<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await obterTokenSessao();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const resposta = await fetch(url, {
      method: opcoes.method ?? "GET",
      headers,
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    });
    const dados = (await resposta.json().catch(() => null)) as (T & { sucesso?: boolean; erro?: string }) | null;
    const ok = resposta.ok && dados?.sucesso !== false;
    return {
      ok,
      status: resposta.status,
      dados,
      erro: ok ? undefined : dados?.erro ?? "Não foi possível concluir a operação. Tente novamente.",
    };
  } catch {
    return { ok: false, status: 0, dados: null, erro: "Falha de conexão. Verifique sua internet e tente novamente." };
  }
}
