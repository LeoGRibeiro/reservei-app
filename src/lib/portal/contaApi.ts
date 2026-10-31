/**
 * @file contaApi.ts
 * @description Ações da conta do atleta pelo navegador: código de acesso (pedir, conferir e abrir a
 * sessão), "Meus dados", excluir conta e o andamento dos pedidos de vaga na partida do atleta.
 */

import { chamarApi, type RespostaApi } from "@/lib/api/clienteApi";
import { supabase } from "@/lib/supabase/client";
import type { PedidoVaga } from "./contaAtleta";

export type ModoAcesso = "entrar" | "criar" | "concluir";

/**
 * Pede o código de acesso pelo WhatsApp.
 *
 * @returns Segundos até poder pedir de novo, ou o erro amigável do servidor
 */
export function pedirCodigo(arenaId: string, telefone: string, modo: ModoAcesso): Promise<RespostaApi<{ reenviarEmSegundos: number }>> {
  return chamarApi("/api/acesso/codigo", { method: "POST", corpo: { arenaId, telefone, modo } });
}

/** Dados para conferir o código. */
export interface ConferenciaCodigo {
  arenaId: string;
  telefone: string;
  codigo: string;
  modo: ModoAcesso;
  nome?: string;
  nascimento?: string;
  /** Reserva feita sem conta que passa para a conta nova (modo `concluir`) */
  reservaId?: string;
  checkoutToken?: string;
}

/**
 * Confere o código e abre a sessão no navegador.
 *
 * @returns Nome do atleta, ou o erro amigável do servidor
 */
export async function entrarComCodigo(dados: ConferenciaCodigo): Promise<{ ok: true; nome: string } | { ok: false; erro: string }> {
  const r = await chamarApi<{ accessToken: string; refreshToken: string; nome: string }>("/api/acesso/verificar", {
    method: "POST",
    corpo: dados,
  });
  if (!r.ok || !r.dados) return { ok: false, erro: r.erro ?? "Não foi possível entrar. Tente de novo." };
  const { error } = await supabase.auth.setSession({ access_token: r.dados.accessToken, refresh_token: r.dados.refreshToken });
  if (error) return { ok: false, erro: "Não foi possível entrar. Tente de novo." };
  return { ok: true, nome: r.dados.nome };
}

/** Salva "Meus dados" (trocar o WhatsApp troca também o login). */
export function salvarPerfil(dados: { nome: string; telefone: string; nascimento: string }): Promise<RespostaApi<object>> {
  return chamarApi("/api/atletas/perfil", { method: "PATCH", corpo: dados });
}

/** Exclui a conta e encerra a sessão. */
export async function excluirMinhaConta(): Promise<RespostaApi<object>> {
  const r = await chamarApi<object>("/api/atletas/conta", { method: "DELETE" });
  if (r.ok) await supabase.auth.signOut().catch(() => undefined);
  return r;
}

/**
 * Atualiza o andamento de um pedido na partida do atleta (RLS: só o organizador da partida).
 *
 * @param status `contatado` (já chamou) ou `combinado` (entrou na partida)
 */
export async function marcarPedido(id: string, status: Extract<PedidoVaga["status"], "contatado" | "combinado">): Promise<boolean> {
  try {
    const { error } = await supabase.from("interesses_vagas").update({ status }).eq("id", id);
    if (error) console.warn(`[contaApi] pedido ${id}: ${error.message}`);
    return !error;
  } catch (err) {
    console.error("[contaApi] pedido: falha inesperada", err);
    return false;
  }
}
