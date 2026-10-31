/**
 * @file perfilAtletaServidorService.ts
 * @description "Meus dados" do atleta (somente servidor): editar nome, WhatsApp e nascimento e excluir
 * a conta. O WhatsApp é o login (e-mail sintético no Supabase Auth), então trocá-lo atualiza os dois.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { emailSinteticoDoTelefone } from "@/lib/supabase/authService";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { nomeProprio } from "@/lib/portal/formatos";
import { normalizarTelefone } from "@/lib/acesso/regrasCodigo";

/** Dados editáveis do perfil. */
export interface DadosPerfil {
  nome: string;
  telefone: string;
  nascimento: string | null;
}

/**
 * Valida o corpo de "Meus dados".
 *
 * @throws ErroHttp 400 com a primeira regra violada
 */
export function validarPerfil(corpo: unknown): DadosPerfil {
  const bruto = (corpo ?? {}) as Record<string, unknown>;
  const nome = nomeProprio(String(bruto.nome ?? "")).slice(0, 120);
  if (nome.split(" ").filter(Boolean).length < 2) throw new ErroHttp("Informe seu nome completo.", 400);
  const telefone = normalizarTelefone(bruto.telefone);
  if (telefone.length < 10 || telefone.length > 11) throw new ErroHttp("WhatsApp inválido. Use DDD e número.", 400);
  const nascimento = typeof bruto.nascimento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto.nascimento) ? bruto.nascimento : null;
  return { nome, telefone, nascimento };
}

/**
 * Atualiza o perfil do atleta. Se o WhatsApp mudou, confere que ninguém usa o número novo e troca o
 * login no Supabase Auth.
 *
 * @throws ErroHttp 404 (perfil) ou 409 (número já usado)
 */
export async function atualizarPerfil(userId: string, dados: DadosPerfil): Promise<void> {
  const { data: perfil, error } = await supabaseAdmin
    .from("usuarios")
    .select("*")
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .limit(1);
  if (error) throw new Error(error.message);
  const atual = perfil?.[0];
  if (!atual) throw new ErroHttp("Conta não encontrada.", 404);

  if (String(atual.telefone).replace(/\D/g, "") !== dados.telefone) {
    const { data: dono } = await supabaseAdmin.from("usuarios").select("id").eq("telefone", dados.telefone).limit(1);
    if (dono?.length) throw new ErroHttp("Esse WhatsApp já é usado por outra conta.", 409);
    const { error: erroAuth } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: emailSinteticoDoTelefone(dados.telefone) });
    if (erroAuth) throw new Error(erroAuth.message);
  }

  const { error: erroPerfil } = await supabaseAdmin
    .from("usuarios")
    .update({ nome: dados.nome, telefone: dados.telefone, data_nascimento: dados.nascimento })
    .eq("id", atual.id);
  if (erroPerfil) throw new Error(erroPerfil.message);
}

/**
 * Exclui a conta: perfil, carimbos, horas grátis, pedidos de vaga e o acesso. As reservas continuam
 * valendo na arena (com o nome e o WhatsApp de quem reservou), só deixam de estar ligadas à conta.
 */
export async function excluirConta(userId: string): Promise<void> {
  const passos: [string, PromiseLike<{ error: { message: string } | null }>][] = [
    ["reservas", supabaseAdmin.from("reservas").update({ user_id: null }).eq("user_id", userId)],
    ["carimbos", supabaseAdmin.from("fidelidade_selos").delete().eq("usuario_id", userId)],
    ["horas grátis", supabaseAdmin.from("fidelidade_vouchers").delete().eq("usuario_id", userId)],
    ["pedidos", supabaseAdmin.from("interesses_vagas").delete().eq("usuario_id", userId)],
    ["perfil", supabaseAdmin.from("usuarios").delete().or(`auth_user_id.eq.${userId},id.eq.${userId}`)],
  ];
  for (const [rotulo, passo] of passos) {
    const { error } = await passo;
    if (error) throw new Error(`${rotulo}: ${error.message}`);
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
