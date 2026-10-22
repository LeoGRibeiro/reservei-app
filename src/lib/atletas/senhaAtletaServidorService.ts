/**
 * @file senhaAtletaServidorService.ts
 * @description Redefinição assistida da senha de um atleta pela arena (somente servidor). O login do atleta é
 * por WhatsApp e não tem e-mail para recuperação: o atleta pede pelo WhatsApp da arena, e um gerente ou o
 * proprietário gera uma senha temporária (troca obrigatória no próximo acesso).
 *
 * Risco aceito (SPEC §5): a conta do atleta vale em todas as arenas da plataforma. Por isso a ação exige
 * gerente/proprietário, só vale para atletas com reserva na própria arena e fica auditada.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { gerarSenhaTemporaria } from "@/lib/servidor/senhaTemporaria";
import { registrarAuditoria } from "@/lib/servidor/auditoria";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";

/** Senha temporária para repassar ao atleta. */
export interface AcessoTemporarioAtleta {
  nome: string;
  telefone: string;
  senhaTemporaria: string;
}

/**
 * Verifica se o atleta já reservou nesta arena (pela conta ou pelo WhatsApp informado no checkout).
 */
async function atletaTemReservaNaArena(arenaId: string, usuarioId: string, telefone: string): Promise<boolean> {
  const filtroTelefone = telefone ? `,whatsapp_cliente.eq.${telefone}` : "";
  const { count, error } = await supabaseAdmin
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("arena_id", arenaId)
    .or(`user_id.eq.${usuarioId}${filtroTelefone}`);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Gera uma senha temporária para o atleta.
 *
 * @param membro Gerente ou proprietário autorizado
 * @param usuarioId Id do perfil do atleta (`usuarios.id`)
 * @returns Nome, telefone e senha temporária
 * @throws ErroHttp 404 (atleta inexistente), 403 (atleta sem reserva na arena)
 */
export async function redefinirSenhaAtleta(membro: MembroArena, usuarioId: string): Promise<AcessoTemporarioAtleta> {
  if (!/^[\w-]+$/.test(usuarioId)) throw new ErroHttp("Atleta inválido.", 400);

  const { data: perfil, error } = await supabaseAdmin
    .from("usuarios")
    .select("id, auth_user_id, nome, telefone")
    .eq("id", usuarioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!perfil?.auth_user_id) throw new ErroHttp("Este atleta não tem conta com senha.", 404);

  const telefone = String(perfil.telefone ?? "").replace(/\D/g, "");
  if (!(await atletaTemReservaNaArena(membro.arenaId, usuarioId, telefone))) {
    throw new ErroHttp("Só é possível redefinir a senha de atletas que já reservaram nesta arena.", 403);
  }

  const authId = String(perfil.auth_user_id);
  const { data: atual } = await supabaseAdmin.auth.admin.getUserById(authId);
  const senhaTemporaria = gerarSenhaTemporaria();
  const { error: erroUpdate } = await supabaseAdmin.auth.admin.updateUserById(authId, {
    password: senhaTemporaria,
    user_metadata: { ...(atual?.user?.user_metadata ?? {}), trocar_senha: true },
  });
  if (erroUpdate) throw new Error(erroUpdate.message);

  await registrarAuditoria({
    arenaId: membro.arenaId,
    autorId: membro.userId,
    acao: "atleta.redefinir_senha",
    alvoId: usuarioId,
  });

  return { nome: String(perfil.nome ?? ""), telefone, senhaTemporaria };
}
