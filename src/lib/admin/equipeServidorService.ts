/**
 * @file equipeServidorService.ts
 * @description Casos de uso (somente servidor) da gestão de equipe de uma arena: listar membros, convidar
 * gerentes e operadores, alterar papel, ativar/desativar e redefinir senha.
 *
 * Regras (SPEC/2026-10-22-mvp-go-live.md §4):
 * - O proprietário é único (índice `idx_arena_usuarios_proprietario_unico`) e não é alterado por aqui.
 * - Ninguém altera o próprio vínculo.
 * - Convites e redefinições geram senha temporária com troca obrigatória no primeiro acesso
 *   (`user_metadata.trocar_senha = true`).
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import type { ArenaUserRole } from "@/lib/arena/types";
import { PAPEIS_CONVIDAVEIS, isPapelArena } from "./permissoes";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { gerarSenhaTemporaria } from "@/lib/servidor/senhaTemporaria";
import { registrarAuditoria } from "@/lib/servidor/auditoria";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";

/** Membro da equipe exibido na tela Equipe. */
export interface MembroEquipe {
  userId: string;
  nome: string;
  email: string;
  role: ArenaUserRole;
  ativo: boolean;
  criadoEm: string;
  /** Ainda não trocou a senha temporária */
  senhaPendente: boolean;
}

/** Dados de um convite validado. */
export interface ConviteEquipeInput {
  nome: string;
  email: string;
  role: ArenaUserRole;
}

/** Alteração de vínculo validada. */
export interface AlteracaoMembroInput {
  userId: string;
  role?: ArenaUserRole;
  ativo?: boolean;
}

/** Credencial temporária devolvida uma única vez ao proprietário. */
export interface CredencialTemporaria {
  userId: string;
  email: string;
  senhaTemporaria: string;
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida o corpo de um convite.
 *
 * @param input Corpo bruto
 * @returns Convite normalizado
 * @throws ErroHttp 400
 */
export function validarConvite(input: unknown): ConviteEquipeInput {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const nome = typeof bruto.nome === "string" ? bruto.nome.trim().slice(0, 120) : "";
  const email = typeof bruto.email === "string" ? bruto.email.trim().toLowerCase() : "";
  const role = bruto.role;

  if (nome.length < 2) throw new ErroHttp("Informe o nome do membro.", 400);
  if (!REGEX_EMAIL.test(email)) throw new ErroHttp("Informe um e-mail válido.", 400);
  if (!isPapelArena(role) || !PAPEIS_CONVIDAVEIS.includes(role)) {
    throw new ErroHttp("Escolha o perfil Gerente ou Operador de balcão.", 400);
  }
  return { nome, email, role };
}

/**
 * Valida o corpo de uma alteração de vínculo.
 *
 * @param input Corpo bruto
 * @returns Alteração normalizada
 * @throws ErroHttp 400
 */
export function validarAlteracao(input: unknown): AlteracaoMembroInput {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const userId = typeof bruto.userId === "string" ? bruto.userId.trim() : "";
  if (!userId) throw new ErroHttp("Membro não informado.", 400);

  const alteracao: AlteracaoMembroInput = { userId };
  if (bruto.role !== undefined) {
    if (!isPapelArena(bruto.role) || !PAPEIS_CONVIDAVEIS.includes(bruto.role)) {
      throw new ErroHttp("Perfil inválido.", 400);
    }
    alteracao.role = bruto.role;
  }
  if (bruto.ativo !== undefined) {
    if (typeof bruto.ativo !== "boolean") throw new ErroHttp("Situação inválida.", 400);
    alteracao.ativo = bruto.ativo;
  }
  if (alteracao.role === undefined && alteracao.ativo === undefined) {
    throw new ErroHttp("Nada para alterar.", 400);
  }
  return alteracao;
}

/**
 * Lista os membros (ativos e inativos) da arena.
 *
 * @param arenaId Arena
 * @returns Membros ordenados por papel e nome
 */
export async function listarEquipe(arenaId: string): Promise<MembroEquipe[]> {
  const { data, error } = await supabaseAdmin
    .from("arena_usuarios")
    .select("user_id, role, ativo, criado_em")
    .eq("arena_id", arenaId);

  if (error) throw new Error(error.message);

  const membros = await Promise.all(
    (data ?? []).map(async (vinculo): Promise<MembroEquipe> => {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(String(vinculo.user_id));
      const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
      return {
        userId: String(vinculo.user_id),
        nome: typeof meta.nome === "string" && meta.nome ? meta.nome : u?.user?.email ?? "Sem nome",
        email: u?.user?.email ?? "",
        role: isPapelArena(vinculo.role) ? vinculo.role : "operador",
        ativo: Boolean(vinculo.ativo),
        criadoEm: String(vinculo.criado_em ?? ""),
        senhaPendente: meta.trocar_senha === true,
      };
    })
  );

  const ordem: Record<ArenaUserRole, number> = { proprietario: 0, gerente: 1, operador: 2 };
  return membros.sort((a, b) => ordem[a.role] - ordem[b.role] || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Convida um gerente ou operador: cria a conta com senha temporária e o vínculo com a arena.
 *
 * @param autor Proprietário autorizado
 * @param convite Dados validados
 * @returns Credencial temporária para o proprietário repassar
 * @throws ErroHttp 409 se o e-mail já tiver conta
 */
export async function convidarMembro(
  autor: MembroArena,
  convite: ConviteEquipeInput
): Promise<CredencialTemporaria> {
  const senhaTemporaria = gerarSenhaTemporaria();

  const { data: criado, error: erroUsuario } = await supabaseAdmin.auth.admin.createUser({
    email: convite.email,
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { nome: convite.nome, trocar_senha: true },
  });

  if (erroUsuario || !criado?.user) {
    const msg = (erroUsuario?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      throw new ErroHttp(
        "Este e-mail já tem uma conta no sistema. Use outro e-mail ou fale com o suporte para vincular a conta existente.",
        409
      );
    }
    throw new Error(erroUsuario?.message ?? "Falha ao criar usuário.");
  }

  const userId = criado.user.id;
  const { error: erroVinculo } = await supabaseAdmin.from("arena_usuarios").insert({
    arena_id: autor.arenaId,
    user_id: userId,
    role: convite.role,
    ativo: true,
  });

  if (erroVinculo) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(erroVinculo.message);
  }

  await registrarAuditoria({
    arenaId: autor.arenaId,
    autorId: autor.userId,
    acao: "equipe.convite",
    alvoId: userId,
    detalhes: { email: convite.email, role: convite.role },
  });

  return { userId, email: convite.email, senhaTemporaria };
}

/**
 * Carrega o vínculo de um membro da arena, aplicando as regras de quem pode ser alterado.
 */
async function carregarVinculoAlteravel(autor: MembroArena, userId: string): Promise<{ role: ArenaUserRole }> {
  if (userId === autor.userId) {
    throw new ErroHttp("Você não pode alterar o seu próprio acesso.", 403);
  }

  const { data, error } = await supabaseAdmin
    .from("arena_usuarios")
    .select("role")
    .eq("arena_id", autor.arenaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !isPapelArena(data.role)) throw new ErroHttp("Membro não encontrado nesta arena.", 404);
  if (data.role === "proprietario") {
    throw new ErroHttp("O acesso do proprietário não pode ser alterado pela tela de equipe.", 403);
  }
  return { role: data.role };
}

/**
 * Altera o papel e/ou a situação (ativo) de um membro.
 *
 * @param autor Proprietário autorizado
 * @param alteracao Dados validados
 */
export async function alterarMembro(autor: MembroArena, alteracao: AlteracaoMembroInput): Promise<void> {
  const atual = await carregarVinculoAlteravel(autor, alteracao.userId);

  const patch: Record<string, unknown> = {};
  if (alteracao.role !== undefined) patch.role = alteracao.role;
  if (alteracao.ativo !== undefined) patch.ativo = alteracao.ativo;

  const { error } = await supabaseAdmin
    .from("arena_usuarios")
    .update(patch)
    .eq("arena_id", autor.arenaId)
    .eq("user_id", alteracao.userId);

  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: autor.arenaId,
    autorId: autor.userId,
    acao: "equipe.alteracao",
    alvoId: alteracao.userId,
    detalhes: { de: atual.role, ...patch },
  });
}

/**
 * Gera nova senha temporária para um membro da equipe (troca obrigatória no próximo acesso).
 *
 * @param autor Proprietário autorizado
 * @param userId Membro alvo
 * @returns Credencial temporária
 */
export async function redefinirSenhaMembro(autor: MembroArena, userId: string): Promise<CredencialTemporaria> {
  await carregarVinculoAlteravel(autor, userId);

  const { data: atual, error: erroBusca } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (erroBusca || !atual?.user) throw new ErroHttp("Membro não encontrado.", 404);

  const senhaTemporaria = gerarSenhaTemporaria();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: senhaTemporaria,
    user_metadata: { ...(atual.user.user_metadata ?? {}), trocar_senha: true },
  });
  if (error) throw new Error(error.message);

  await registrarAuditoria({
    arenaId: autor.arenaId,
    autorId: autor.userId,
    acao: "equipe.redefinir_senha",
    alvoId: userId,
  });

  return { userId, email: atual.user.email ?? "", senhaTemporaria };
}
