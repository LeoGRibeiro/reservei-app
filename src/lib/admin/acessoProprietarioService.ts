/**
 * @file acessoProprietarioService.ts
 * @description Redefinição assistida da senha do proprietário pelo Super Admin (somente servidor), para quando
 * o dono perde o acesso e o e-mail de recuperação não chega.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { gerarSenhaTemporaria } from "@/lib/servidor/senhaTemporaria";
import { registrarAuditoria } from "@/lib/servidor/auditoria";
import { resolverArenaIdPorSlug } from "@/lib/servidor/autorizacaoArena";

/** Credencial temporária do proprietário. */
export interface AcessoProprietario {
  email: string;
  senhaTemporaria: string;
}

/**
 * Gera uma senha temporária para o proprietário da arena (troca obrigatória no próximo acesso).
 *
 * @param slug Slug da arena
 * @returns E-mail e senha temporária
 * @throws ErroHttp 404 (arena ou proprietário inexistente)
 */
export async function redefinirSenhaProprietario(slug: string): Promise<AcessoProprietario> {
  const arenaId = await resolverArenaIdPorSlug(slug);

  const { data: vinculo, error } = await supabaseAdmin
    .from("arena_usuarios")
    .select("user_id")
    .eq("arena_id", arenaId)
    .eq("role", "proprietario")
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!vinculo) throw new ErroHttp("Esta arena ainda não tem proprietário. Use o link de convite.", 404);

  const userId = String(vinculo.user_id);
  const { data: atual, error: erroBusca } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (erroBusca || !atual?.user) throw new ErroHttp("Conta do proprietário não encontrada.", 404);

  const senhaTemporaria = gerarSenhaTemporaria();
  const { error: erroUpdate } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: senhaTemporaria,
    user_metadata: { ...(atual.user.user_metadata ?? {}), trocar_senha: true },
  });
  if (erroUpdate) throw new Error(erroUpdate.message);

  await registrarAuditoria({
    arenaId,
    autorId: null,
    acao: "superadmin.redefinir_senha_proprietario",
    alvoId: userId,
  });

  return { email: atual.user.email ?? "", senhaTemporaria };
}
