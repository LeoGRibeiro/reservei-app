/**
 * @file adminAuthService.ts
 * @description Serviço de autenticação do painel administrativo baseado em Supabase Auth
 * com RBAC multi-tenant. Isola toda a comunicação com `supabase.auth` e com a tabela
 * `public.arena_usuarios`, devolvendo resultados tipados (sem lançar exceções à UI).
 *
 * Um usuário só é considerado administrador de uma arena quando possui um vínculo ativo
 * em `arena_usuarios` cuja arena corresponde ao slug (subdomínio) atualmente acessado.
 */

import { supabase, isSupabaseConfigured } from "./client";
import type { ArenaUsuarioComArenaRow } from "./types";
import type { ArenaUserRole } from "@/lib/arena/types";

/** Mensagem exibida quando o usuário autenticado não pertence à arena acessada. */
export const MSG_ACESSO_NAO_AUTORIZADO = "Acesso não autorizado para esta arena.";

/** Mensagem exibida para credenciais inválidas. */
export const MSG_CREDENCIAIS_INVALIDAS = "E-mail ou senha incorretos.";

/** Mensagem exibida quando o Supabase não está configurado no ambiente. */
export const MSG_SUPABASE_INDISPONIVEL =
  "Autenticação indisponível: o Supabase não está configurado neste ambiente.";

/** Mensagem genérica para falhas inesperadas. */
export const MSG_FALHA_GENERICA = "Não foi possível autenticar. Tente novamente.";

/**
 * Dados mínimos do usuário autenticado exigidos pelo painel.
 */
export interface AdminUsuario {
  /** UUID do usuário em `auth.users` */
  id: string;
  /** E-mail de login (pode ser nulo em provedores sem e-mail) */
  email: string | null;
}

/**
 * Sessão administrativa validada contra o vínculo `arena_usuarios`.
 */
export interface SessaoAdmin {
  /** Usuário autenticado */
  user: AdminUsuario;
  /** Perfil de acesso na arena acessada */
  role: ArenaUserRole;
  /** Identificador da arena vinculada */
  arenaId: string;
  /** Slug da arena vinculada */
  arenaSlug: string;
}

/**
 * Resultado de uma tentativa de login administrativo.
 */
export type ResultadoLoginAdmin =
  | { success: true; sessao: SessaoAdmin }
  | { success: false; error: string };

/**
 * Extrai o slug da arena do relacionamento embutido pelo PostgREST, que pode
 * ser devolvido como objeto único ou como array.
 */
function slugDoRelacionamento(arenas: ArenaUsuarioComArenaRow["arenas"]): string | null {
  if (!arenas) return null;
  if (Array.isArray(arenas)) return arenas[0]?.slug ?? null;
  return arenas.slug ?? null;
}

/**
 * Busca o vínculo ativo de um usuário com a arena identificada pelo slug.
 * Um mesmo usuário pode ser operador de várias arenas; apenas a arena acessada importa.
 *
 * @param userId UUID do usuário autenticado
 * @param arenaSlug Slug da arena acessada (subdomínio)
 * @returns Perfil e arena do vínculo, ou null se o usuário não pertence à arena
 * @throws Error se a consulta ao banco falhar
 */
export async function buscarVinculoNaArena(
  userId: string,
  arenaSlug: string
): Promise<{ role: ArenaUserRole; arenaId: string } | null> {
  const { data, error } = await supabase
    .from("arena_usuarios")
    .select("role, ativo, arena_id, arenas(slug)")
    .eq("user_id", userId)
    .eq("ativo", true);

  if (error) {
    throw new Error(error.message);
  }

  const vinculos = (data ?? []) as unknown as ArenaUsuarioComArenaRow[];
  const slugAlvo = arenaSlug.toLowerCase();
  const vinculo = vinculos.find(
    (v) => v.ativo && slugDoRelacionamento(v.arenas)?.toLowerCase() === slugAlvo
  );

  return vinculo ? { role: vinculo.role, arenaId: vinculo.arena_id } : null;
}

/**
 * Traduz um erro do Supabase Auth em mensagem amigável.
 */
function mensagemErroLogin(error: { message?: string; status?: number }): string {
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("invalid login credentials")) return MSG_CREDENCIAIS_INVALIDAS;
  if (msg.includes("email not confirmed")) return "E-mail ainda não confirmado.";
  if (error.status === 429 || msg.includes("rate limit")) {
    return "Muitas tentativas de acesso. Aguarde alguns instantes e tente novamente.";
  }
  return MSG_FALHA_GENERICA;
}

/**
 * Encerra a sessão do Supabase Auth sem propagar falhas.
 */
export async function sairAdministrador(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[AdminAuth] Erro ao encerrar sessão no Supabase:", err);
  }
}

/**
 * Autentica um operador com e-mail e senha e valida seu vínculo com a arena acessada.
 * Se as credenciais forem válidas mas o usuário não pertencer à arena, a sessão é
 * imediatamente encerrada.
 *
 * @param email E-mail corporativo do operador
 * @param senha Senha do operador
 * @param arenaSlug Slug da arena acessada (subdomínio)
 * @returns Sessão administrativa em caso de sucesso, ou mensagem de erro
 *
 * @example
 * ```ts
 * const res = await autenticarAdministrador("dono@arena.com", "segredo", "arena-central");
 * if (res.success) console.log(res.sessao.role);
 * ```
 */
export async function autenticarAdministrador(
  email: string,
  senha: string,
  arenaSlug: string
): Promise<ResultadoLoginAdmin> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: MSG_SUPABASE_INDISPONIVEL };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error || !data.user) {
      return { success: false, error: error ? mensagemErroLogin(error) : MSG_FALHA_GENERICA };
    }

    const vinculo = await buscarVinculoNaArena(data.user.id, arenaSlug);

    if (!vinculo) {
      await sairAdministrador();
      return { success: false, error: MSG_ACESSO_NAO_AUTORIZADO };
    }

    return {
      success: true,
      sessao: {
        user: { id: data.user.id, email: data.user.email ?? null },
        role: vinculo.role,
        arenaId: vinculo.arenaId,
        arenaSlug,
      },
    };
  } catch (err) {
    console.error("[AdminAuth] Falha ao autenticar administrador:", err);
    await sairAdministrador();
    return { success: false, error: MSG_FALHA_GENERICA };
  }
}

/**
 * Restaura a sessão administrativa persistida pelo Supabase Auth (se existir e se
 * o usuário ainda possuir vínculo ativo com a arena acessada).
 * Não encerra a sessão quando não há vínculo: ela pode pertencer a um atleta.
 *
 * @param arenaSlug Slug da arena acessada (subdomínio)
 * @returns Sessão administrativa válida ou null
 */
export async function restaurarSessaoAdministrador(
  arenaSlug: string
): Promise<SessaoAdmin | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;

    const vinculo = await buscarVinculoNaArena(user.id, arenaSlug);
    if (!vinculo) return null;

    return {
      user: { id: user.id, email: user.email ?? null },
      role: vinculo.role,
      arenaId: vinculo.arenaId,
      arenaSlug,
    };
  } catch (err) {
    console.error("[AdminAuth] Falha ao restaurar sessão administrativa:", err);
    return null;
  }
}

/**
 * Registra um callback para ser notificado quando a sessão for encerrada
 * (logout manual, expiração do token ou logout em outra aba).
 *
 * @param aoSair Callback executado no evento `SIGNED_OUT`
 * @returns Função para cancelar a inscrição
 */
export function observarSaidaAdministrador(aoSair: () => void): () => void {
  if (!isSupabaseConfigured()) return () => {};

  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") aoSair();
  });

  return () => data.subscription.unsubscribe();
}

/**
 * Indica se o usuário logado ainda usa uma senha temporária (convite ou redefinição assistida).
 *
 * @returns `true` quando `user_metadata.trocar_senha` está ativo
 */
export async function precisaTrocarSenha(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.user_metadata?.trocar_senha === true;
  } catch {
    return false;
  }
}

/**
 * Define a senha definitiva do usuário logado e encerra a pendência de troca.
 *
 * @param novaSenha Senha já validada pelas regras de senha forte
 * @returns `null` em caso de sucesso ou mensagem de erro amigável
 *
 * @example
 * ```ts
 * const erro = await definirSenhaDefinitiva("Nova@Senha1");
 * if (erro) toast.error(erro);
 * ```
 */
export async function definirSenhaDefinitiva(novaSenha: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return MSG_SUPABASE_INDISPONIVEL;
  try {
    const { error } = await supabase.auth.updateUser({ password: novaSenha, data: { trocar_senha: false } });
    if (!error) return null;
    if (error.message.toLowerCase().includes("different from the old")) {
      return "A nova senha precisa ser diferente da senha temporária.";
    }
    return "Não foi possível salvar a nova senha. Tente novamente.";
  } catch {
    return MSG_FALHA_GENERICA;
  }
}
