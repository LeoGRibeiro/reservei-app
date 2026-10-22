/**
 * @file autorizacaoArena.ts
 * @description Autorização das rotas administrativas (somente servidor): confirma que o usuário do token
 * Bearer é membro ativo da arena informada e que o papel dele permite a ação.
 *
 * O slug da arena vem do cliente, mas não é confiado: sem vínculo ativo em `arena_usuarios` a requisição
 * é recusada, então informar a arena de outra pessoa não dá acesso a nada.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { podeExecutar, isPapelArena, type AcaoAdmin } from "@/lib/admin/permissoes";
import type { ArenaUserRole } from "@/lib/arena/types";
import { ErroHttp, obterUsuarioAutenticado } from "./autenticacaoServidor";

/** Membro autenticado e autorizado de uma arena. */
export interface MembroArena {
  /** UUID do usuário em `auth.users` */
  userId: string;
  /** E-mail do usuário */
  email: string | null;
  /** Arena em que a ação acontece */
  arenaId: string;
  /** Papel do usuário nessa arena */
  role: ArenaUserRole;
}

/**
 * Resolve o id de uma arena ativa pelo slug.
 *
 * @param slug Slug da arena
 * @returns Id da arena
 * @throws ErroHttp 404 se a arena não existir ou estiver inativa
 */
export async function resolverArenaIdPorSlug(slug: string): Promise<string> {
  const limpo = slug.trim().toLowerCase();
  if (!limpo) throw new ErroHttp("Informe a arena.", 400);

  const { data, error } = await supabaseAdmin
    .from("arenas")
    .select("id")
    .eq("slug", limpo)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new ErroHttp("Arena não encontrada.", 404);
  return String(data.id);
}

/**
 * Exige que a requisição venha de um membro ativo da arena com permissão para a ação.
 *
 * @param request Requisição com `Authorization: Bearer <token>`
 * @param arenaSlug Slug da arena alvo
 * @param acao Ação exigida (omitida = basta ser membro ativo)
 * @returns Membro autorizado
 * @throws ErroHttp 401 (sem sessão), 403 (sem vínculo ou papel insuficiente), 404 (arena)
 *
 * @example
 * ```ts
 * const membro = await exigirMembroArena(request, corpo.arenaSlug, "gerenciar_equipe");
 * ```
 */
export async function exigirMembroArena(
  request: Request,
  arenaSlug: string,
  acao?: AcaoAdmin
): Promise<MembroArena> {
  const usuario = await obterUsuarioAutenticado(request);
  if (!usuario) throw new ErroHttp("Sua sessão expirou. Faça login novamente.", 401);

  const arenaId = await resolverArenaIdPorSlug(arenaSlug);

  const { data, error } = await supabaseAdmin
    .from("arena_usuarios")
    .select("role")
    .eq("arena_id", arenaId)
    .eq("user_id", usuario.id)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !isPapelArena(data.role)) {
    throw new ErroHttp("Você não tem acesso a esta arena.", 403);
  }

  const role = data.role;
  if (acao && !podeExecutar(role, acao)) {
    throw new ErroHttp("Seu perfil de acesso não permite esta ação.", 403);
  }

  return { userId: usuario.id, email: usuario.email, arenaId, role };
}
