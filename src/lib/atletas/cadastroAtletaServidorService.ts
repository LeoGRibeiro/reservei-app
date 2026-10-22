/**
 * @file cadastroAtletaServidorService.ts
 * @description Cadastro de atletas (WhatsApp + senha) executado no servidor.
 *
 * O login do atleta usa um e-mail sintético (`<whatsapp>@auth.reservei.com.br`). O cadastro público
 * do Supabase (`auth.signUp`) recusa esse endereço porque o domínio não recebe e-mails; pela API
 * administrativa (`auth.admin.createUser`) a conta nasce confirmada e sem envio de e-mail, e o perfil
 * em `usuarios` é criado na mesma operação. O navegador apenas faz o login em seguida.
 */

import { VERSAO_TERMOS } from "@/lib/legal/termos";
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { emailSinteticoDoTelefone } from "@/lib/supabase/authService";
import { validarSenhaForte } from "@/lib/constants";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";

/** Dados validados do cadastro. */
export interface DadosCadastroAtleta {
  nome: string;
  telefone: string;
  senha: string;
  dataNascimento: string | null;
  /** Aceite dos Termos de Uso e da Política de Privacidade (dado no cadastro ou no checkout) */
  aceiteTermos?: boolean;
}

export const MSG_TELEFONE_DUPLICADO = "Este número de WhatsApp já possui uma conta cadastrada.";

/**
 * Valida e normaliza o corpo do cadastro.
 *
 * @param input Corpo JSON recebido
 * @returns Dados normalizados (telefone só com dígitos)
 * @throws ErroHttp 400 com a primeira regra violada
 */
export function validarCadastroAtleta(input: unknown): DadosCadastroAtleta {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const nome = typeof bruto.nome === "string" ? bruto.nome.trim().slice(0, 120) : "";
  const telefone = typeof bruto.telefone === "string" ? bruto.telefone.replace(/\D/g, "") : "";
  const senha = typeof bruto.senha === "string" ? bruto.senha : "";
  const data = typeof bruto.dataNascimento === "string" ? bruto.dataNascimento.trim() : "";

  if (nome.length < 3) throw new ErroHttp("Informe seu nome completo.", 400);
  if (telefone.length < 10 || telefone.length > 11) throw new ErroHttp("Informe um WhatsApp válido com DDD.", 400);
  const forca = validarSenhaForte(senha);
  if (!forca.valido || senha.length > 72) throw new ErroHttp(forca.erros[0] ?? "Senha inválida.", 400);
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroHttp("Data de nascimento inválida.", 400);

  return { nome, telefone, senha, dataNascimento: data || null, aceiteTermos: bruto.aceiteTermos === true };
}

/** Indica se o erro do Supabase Auth significa usuário já existente. */
function erroUsuarioExistente(erro: { code?: string; message?: string; status?: number }): boolean {
  const msg = (erro.message ?? "").toLowerCase();
  return erro.code === "email_exists" || erro.code === "user_already_exists" || msg.includes("already");
}

/**
 * Cria a conta do atleta no Supabase Auth (já confirmada) e o perfil em `usuarios`.
 *
 * @param dados Dados validados por {@link validarCadastroAtleta}
 * @returns Id do usuário criado
 * @throws ErroHttp 409 se o WhatsApp já tem conta
 */
export async function cadastrarAtleta(dados: DadosCadastroAtleta): Promise<{ userId: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: emailSinteticoDoTelefone(dados.telefone),
    password: dados.senha,
    email_confirm: true,
    user_metadata: { nome: dados.nome },
  });

  if (error || !data.user) {
    if (error && erroUsuarioExistente(error)) throw new ErroHttp(MSG_TELEFONE_DUPLICADO, 409);
    throw new Error(error?.message ?? "Falha ao criar a conta.");
  }

  const userId = data.user.id;
  const perfil = {
    id: userId,
    auth_user_id: userId,
    nome: dados.nome,
    telefone: dados.telefone,
    data_nascimento: dados.dataNascimento,
  };
  const aceite = dados.aceiteTermos
    ? { termos_aceitos_em: new Date().toISOString(), termos_versao: VERSAO_TERMOS }
    : {};
  let { error: erroPerfil } = await supabaseAdmin.from("usuarios").insert({ ...perfil, ...aceite });
  // Banco sem a Fase 8 (colunas do aceite ausentes): grava o perfil sem elas em vez de falhar o cadastro
  if (erroPerfil?.code === "PGRST204" && dados.aceiteTermos) {
    ({ error: erroPerfil } = await supabaseAdmin.from("usuarios").insert(perfil));
  }

  if (erroPerfil) {
    // Sem perfil a conta fica inconsistente: desfaz a identidade criada
    await supabaseAdmin.auth.admin.deleteUser(userId);
    if (erroPerfil.code === "23505") throw new ErroHttp(MSG_TELEFONE_DUPLICADO, 409);
    throw new Error(erroPerfil.message);
  }

  return { userId };
}
