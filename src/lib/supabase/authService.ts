/**
 * @file authService.ts
 * @description Serviço de autenticação e perfil de atletas (clientes) do Reservei.
 *
 * O login continua sendo feito por WhatsApp + Senha, porém ancorado no **Supabase Auth**:
 * o número de WhatsApp (apenas dígitos) é mapeado para um e-mail sintético
 * (`<digitos>@auth.reservei.com.br`) usado como identidade. A senha nunca é gravada em
 * tabelas ou no `localStorage`; a sessão é mantida com tokens JWT pelo próprio Supabase.
 *
 * Quando o Supabase não está configurado (desenvolvimento/testes offline), um fallback
 * local armazena apenas um hash SHA-256 salgado da senha.
 */

import { supabase, isSupabaseConfigured } from "./client";
import { mascaraWhatsApp } from "@/lib/constants";
import type { UserProfile } from "./types";

const STORAGE_CURRENT_USER_KEY = "reservei_current_user";
const STORAGE_MOCK_USERS_DB = "reservei_users_db";

/** Domínio do e-mail sintético usado para mapear WhatsApp -> identidade do Supabase Auth. */
export const DOMINIO_EMAIL_SINTETICO = "auth.reservei.com.br";

const MSG_TELEFONE_DUPLICADO = "Este número de WhatsApp já possui uma conta cadastrada.";
const MSG_CREDENCIAIS_INVALIDAS = "WhatsApp ou senha incorretos.";
const MSG_SENHA_FRACA = "A senha informada é muito curta ou fraca. Use ao menos 6 caracteres.";
const MSG_FALHA_GENERICA = "Não foi possível concluir a operação. Tente novamente em instantes.";

interface StoredUserRow {
  id: string;
  nome: string;
  telefone: string;
  /** Hash SHA-256 (hex) da senha — usado somente no fallback local sem Supabase */
  senha_hash?: string;
  /** Salt aleatório (hex) do hash da senha */
  senha_salt?: string;
  /** @deprecated Legado: senha em texto puro. Migrada para hash no próximo login e nunca mais gravada. */
  senha?: string;
  data_nascimento?: string | null;
  criado_em?: string;
  bloqueado?: boolean;
  motivo_bloqueio?: string | null;
}

/**
 * Converte o WhatsApp informado pelo atleta no e-mail sintético usado no Supabase Auth.
 *
 * @param telefone WhatsApp com ou sem máscara (ex: '(91) 98123-4567')
 * @returns E-mail sintético (ex: '91981234567@auth.reservei.com.br')
 *
 * @example
 * ```ts
 * emailSinteticoDoTelefone("(91) 98123-4567"); // "91981234567@auth.reservei.com.br"
 * ```
 */
export function emailSinteticoDoTelefone(telefone: string): string {
  return `${telefone.replace(/\D/g, "")}@${DOMINIO_EMAIL_SINTETICO}`;
}

function getLocalUsers(): StoredUserRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_MOCK_USERS_DB);
    if (!raw) return [];
    const list: StoredUserRow[] = JSON.parse(raw);
    const valid = list.filter(
      (u) => Boolean(u && u.id && u.telefone && u.telefone.replace(/\D/g, "").length >= 8)
    );
    if (valid.length !== list.length) {
      saveLocalUsers(valid);
    }
    return valid;
  } catch {
    return [];
  }
}

function saveLocalUsers(users: StoredUserRow[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_MOCK_USERS_DB, JSON.stringify(users));
  } catch (err) {
    console.error("Erro ao salvar usuários locais:", err);
  }
}

function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gera um salt aleatório de 16 bytes em hexadecimal. */
function gerarSalt(): string {
  return bytesParaHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Calcula SHA-256(salt + senha) em hexadecimal (fallback local; nunca persiste a senha pura). */
async function hashSenhaLocal(senha: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${senha}`));
  return bytesParaHex(new Uint8Array(digest));
}

/** Converte um registro da tabela `usuarios` no perfil de domínio. */
function perfilDeLinha(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ""),
    telefone: mascaraWhatsApp(String(row.telefone ?? "")),
    dataNascimento: (row.data_nascimento as string | null | undefined) ?? null,
    criadoEm: row.criado_em ? String(row.criado_em) : undefined,
    bloqueado: row.bloqueado === undefined || row.bloqueado === null ? undefined : Boolean(row.bloqueado),
    motivo_bloqueio: (row.motivo_bloqueio as string | null | undefined) ?? null,
  };
}

function salvarSessaoLocal(perfil: UserProfile) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(perfil));
  }
}

/**
 * Cadastro via servidor (`POST /api/atletas/cadastro`): a conta é criada já confirmada pela API
 * administrativa do Supabase, junto com o perfil em `usuarios`, e em seguida o navegador entra.
 *
 * O `auth.signUp` público não é usado porque o Supabase recusa o e-mail sintético
 * (`<whatsapp>@auth.reservei.com.br`) como endereço inválido.
 */
async function cadastrarViaSupabaseAuth(
  nome: string,
  digits: string,
  senha: string,
  dataNascimento?: string
): Promise<{ user: UserProfile | null; error?: string }> {
  try {
    const resposta = await fetch("/api/atletas/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, telefone: digits, senha, dataNascimento: dataNascimento || null }),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { sucesso?: boolean; erro?: string };

    if (!resposta.ok || !corpo.sucesso) {
      if (resposta.status === 409) return { user: null, error: MSG_TELEFONE_DUPLICADO };
      if (resposta.status === 400) return { user: null, error: corpo.erro ?? MSG_SENHA_FRACA };
      console.warn("[Auth] Falha no cadastro:", corpo.erro);
      return { user: null, error: MSG_FALHA_GENERICA };
    }

    return loginViaSupabaseAuth(digits, senha);
  } catch (err) {
    console.warn("[Auth] Falha de conexão no cadastro:", err);
    return { user: null, error: MSG_FALHA_GENERICA };
  }
}

/** Cadastro no fallback local (sem Supabase): guarda apenas hash salgado da senha. */
async function cadastrarLocal(
  nome: string,
  digits: string,
  senha: string,
  dataNascimento?: string
): Promise<{ user: UserProfile | null; error?: string }> {
  const users = getLocalUsers();
  const existe = users.find((u) => u.telefone.replace(/\D/g, "") === digits);
  if (existe) {
    return { user: null, error: MSG_TELEFONE_DUPLICADO };
  }

  const salt = gerarSalt();
  const novoUsuario: StoredUserRow = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome,
    telefone: digits,
    senha_salt: salt,
    senha_hash: await hashSenhaLocal(senha, salt),
    data_nascimento: dataNascimento || null,
    criado_em: new Date().toISOString(),
  };

  users.push(novoUsuario);
  saveLocalUsers(users);

  const perfil: UserProfile = {
    id: novoUsuario.id,
    nome: novoUsuario.nome,
    telefone: mascaraWhatsApp(digits),
    dataNascimento: novoUsuario.data_nascimento,
    criadoEm: novoUsuario.criado_em,
    bloqueado: novoUsuario.bloqueado,
    motivo_bloqueio: novoUsuario.motivo_bloqueio,
  };

  salvarSessaoLocal(perfil);
  return { user: perfil };
}

/**
 * Cria cadastro de usuário com Nome, Telefone (WhatsApp) e Senha.
 * Com Supabase configurado usa o Supabase Auth (`signUp`) + perfil em `usuarios`;
 * caso contrário usa o fallback local seguro (hash salgado).
 *
 * @param nome Nome completo do atleta
 * @param telefone WhatsApp com ou sem máscara
 * @param senha Senha escolhida (nunca persistida em texto puro)
 * @param dataNascimento Data de nascimento (opcional, 'YYYY-MM-DD')
 * @returns Perfil criado ou mensagem de erro amigável
 *
 * @example
 * ```ts
 * const { user, error } = await cadastrarUsuarioSupabase("Ana", "(91) 98123-4567", "segredo1");
 * ```
 */
export async function cadastrarUsuarioSupabase(
  nome: string,
  telefone: string,
  senha: string,
  dataNascimento?: string
): Promise<{ user: UserProfile | null; error?: string }> {
  const digits = telefone.replace(/\D/g, "");

  if (isSupabaseConfigured()) {
    return cadastrarViaSupabaseAuth(nome, digits, senha, dataNascimento);
  }

  return cadastrarLocal(nome, digits, senha, dataNascimento);
}

/**
 * Login via Supabase Auth com o e-mail sintético derivado do WhatsApp.
 * Se o usuário existir no Auth mas não possuir perfil em `usuarios`, o perfil é recriado.
 */
async function loginViaSupabaseAuth(
  digits: string,
  senha: string
): Promise<{ user: UserProfile | null; error?: string }> {
  try {
    const { data: sessao, error } = await supabase.auth.signInWithPassword({
      email: emailSinteticoDoTelefone(digits),
      password: senha,
    });

    if (error || !sessao.user) {
      const credenciaisInvalidas = (error?.message ?? "").toLowerCase().includes("invalid login credentials");
      return { user: null, error: credenciaisInvalidas || !error ? MSG_CREDENCIAIS_INVALIDAS : MSG_FALHA_GENERICA };
    }

    const authUser = sessao.user;
    const { data: existente } = await supabase
      .from("usuarios")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    let linha = existente;
    if (!linha) {
      const nomeMeta = (authUser.user_metadata as { nome?: string } | undefined)?.nome;
      const { data: criado, error: erroPerfil } = await supabase
        .from("usuarios")
        .insert([{ id: authUser.id, auth_user_id: authUser.id, nome: nomeMeta || "Cliente", telefone: digits }])
        .select()
        .single();

      if (erroPerfil || !criado) {
        await supabase.auth.signOut();
        console.warn("[Auth] Perfil de usuário indisponível:", erroPerfil?.message);
        return { user: null, error: MSG_FALHA_GENERICA };
      }
      linha = criado;
    }

    const perfil = perfilDeLinha(linha);
    salvarSessaoLocal(perfil);
    return { user: perfil };
  } catch (err) {
    console.warn("[Auth] Falha ao consultar Supabase:", err);
    return { user: null, error: MSG_FALHA_GENERICA };
  }
}

/** Login no fallback local (sem Supabase); migra senhas legadas em texto puro para hash. */
async function loginLocal(
  digits: string,
  senha: string
): Promise<{ user: UserProfile | null; error?: string }> {
  const users = getLocalUsers();
  const index = users.findIndex((u) => u.telefone.replace(/\D/g, "") === digits);
  const encontrado = index >= 0 ? users[index] : undefined;

  let autenticado = false;
  if (encontrado?.senha_hash && encontrado.senha_salt) {
    autenticado = (await hashSenhaLocal(senha, encontrado.senha_salt)) === encontrado.senha_hash;
  } else if (encontrado?.senha !== undefined) {
    // Registro legado com senha em texto puro: valida e migra para hash, descartando o texto puro
    autenticado = encontrado.senha === senha;
    if (autenticado) {
      const salt = gerarSalt();
      const { senha: _legado, ...semSenha } = encontrado;
      void _legado;
      users[index] = { ...semSenha, senha_salt: salt, senha_hash: await hashSenhaLocal(senha, salt) };
      saveLocalUsers(users);
    }
  }

  if (!encontrado || !autenticado) {
    return { user: null, error: MSG_CREDENCIAIS_INVALIDAS };
  }

  const perfil: UserProfile = {
    id: encontrado.id,
    nome: encontrado.nome,
    telefone: mascaraWhatsApp(encontrado.telefone),
    dataNascimento: encontrado.data_nascimento,
    criadoEm: encontrado.criado_em,
    bloqueado: encontrado.bloqueado,
    motivo_bloqueio: encontrado.motivo_bloqueio,
  };

  salvarSessaoLocal(perfil);
  return { user: perfil };
}

/**
 * Realiza login com WhatsApp e Senha (Supabase Auth ou fallback local sem Supabase).
 *
 * @param telefone WhatsApp com ou sem máscara
 * @param senha Senha do atleta
 * @returns Perfil autenticado ou mensagem de erro amigável
 */
export async function loginUsuarioSupabase(
  telefone: string,
  senha: string
): Promise<{ user: UserProfile | null; error?: string }> {
  const digits = telefone.replace(/\D/g, "");

  if (isSupabaseConfigured()) {
    return loginViaSupabaseAuth(digits, senha);
  }

  return loginLocal(digits, senha);
}

/**
 * Obtém usuário logado atualmente (ou null).
 * Com Supabase configurado, a sessão do Supabase Auth é a fonte da verdade: se ela
 * expirou ou foi encerrada, o cache local do perfil é descartado.
 */
export async function obterUsuarioAtual(): Promise<UserProfile | null> {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (!raw) return null;
    let user: UserProfile = JSON.parse(raw);

    if (isSupabaseConfigured()) {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) {
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        return null;
      }
    }

    // Consulta em tempo real com o Supabase se configurado
    if (isSupabaseConfigured() && user.id) {
      try {
        const { data } = await supabase
          .from("usuarios")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (data) {
          user = {
            id: data.id,
            nome: data.nome || user.nome,
            telefone: mascaraWhatsApp(data.telefone || user.telefone),
            dataNascimento: data.data_nascimento || user.dataNascimento,
            criadoEm: data.criado_em || user.criadoEm,
            bloqueado: data.bloqueado !== undefined ? Boolean(data.bloqueado) : user.bloqueado,
            motivo_bloqueio:
              data.motivo_bloqueio !== undefined ? data.motivo_bloqueio : user.motivo_bloqueio,
          };
          localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
        }
      } catch (err) {
        console.warn("[Auth] Erro ao sincronizar sessão com Supabase:", err);
      }
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Desconecta o usuário
 */
export async function logoutUsuarioSupabase(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[Auth] Erro ao deslogar do Supabase:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    } catch {}
  }
}

/**
 * Atualiza os dados de perfil do usuário
 */
export async function atualizarPerfilSupabase(
  userId: string,
  dados: Partial<Omit<UserProfile, "id" | "criadoEm">>
): Promise<UserProfile | null> {
  const digits = dados.telefone ? dados.telefone.replace(/\D/g, "") : undefined;

  // Atualiza no Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from("usuarios")
        .update({
          ...(dados.nome ? { nome: dados.nome } : {}),
          ...(digits ? { telefone: digits } : {}),
          ...(dados.dataNascimento !== undefined ? { data_nascimento: dados.dataNascimento } : {}),
          ...(dados.bloqueado !== undefined ? { bloqueado: dados.bloqueado } : {}),
          ...(dados.motivo_bloqueio !== undefined ? { motivo_bloqueio: dados.motivo_bloqueio } : {}),
        })
        .eq("id", userId);
    } catch (err) {
      console.warn("[Auth] Erro ao atualizar no Supabase:", err);
    }
  }

  // Atualiza no LocalStorage
  if (typeof window !== "undefined") {
    try {
      // 1. Atualiza na base de usuários cadastrados locais
      const users = getLocalUsers();
      let index = users.findIndex((u) => u.id === userId);
      if (index === -1 && digits) {
        index = users.findIndex((u) => u.telefone.replace(/\D/g, "") === digits);
      }
      let updatedUser: UserProfile | null = null;

      if (index >= 0) {
        users[index] = {
          ...users[index],
          ...(dados.nome ? { nome: dados.nome } : {}),
          ...(digits ? { telefone: digits } : {}),
          ...(dados.dataNascimento !== undefined ? { data_nascimento: dados.dataNascimento } : {}),
          ...(dados.bloqueado !== undefined ? { bloqueado: dados.bloqueado } : {}),
          ...(dados.motivo_bloqueio !== undefined ? { motivo_bloqueio: dados.motivo_bloqueio } : {}),
        };
        saveLocalUsers(users);
        updatedUser = {
          id: users[index].id,
          nome: users[index].nome,
          telefone: mascaraWhatsApp(users[index].telefone),
          dataNascimento: users[index].data_nascimento,
          criadoEm: users[index].criado_em,
          bloqueado: users[index].bloqueado,
          motivo_bloqueio: users[index].motivo_bloqueio,
        };
      } else {
        // Tenta recuperar os dados completos antes de salvar no armazenamento local
        let nomeRecuperado = dados.nome;
        let telRecuperado = digits;
        let nascimentoRecuperado = dados.dataNascimento;
        let criadoEmRecuperado = new Date().toISOString();

        const rawCur = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
        if (rawCur) {
          const cur: UserProfile = JSON.parse(rawCur);
          if (cur.id === userId) {
            nomeRecuperado = nomeRecuperado || cur.nome;
            telRecuperado = telRecuperado || cur.telefone.replace(/\D/g, "");
            nascimentoRecuperado =
              nascimentoRecuperado !== undefined ? nascimentoRecuperado : cur.dataNascimento;
            criadoEmRecuperado = cur.criadoEm || criadoEmRecuperado;
          }
        }

        // Apenas salva no armazenamento local se houver um número de telefone válido
        if (telRecuperado && telRecuperado.length >= 8) {
          const novoLocal: StoredUserRow = {
            id: userId,
            nome: nomeRecuperado || "Cliente",
            telefone: telRecuperado,
            data_nascimento: nascimentoRecuperado || null,
            bloqueado: dados.bloqueado,
            motivo_bloqueio: dados.motivo_bloqueio,
            criado_em: criadoEmRecuperado,
          };
          users.push(novoLocal);
          saveLocalUsers(users);
          updatedUser = {
            id: novoLocal.id,
            nome: novoLocal.nome,
            telefone: mascaraWhatsApp(novoLocal.telefone),
            dataNascimento: novoLocal.data_nascimento,
            criadoEm: novoLocal.criado_em,
            bloqueado: novoLocal.bloqueado,
            motivo_bloqueio: novoLocal.motivo_bloqueio,
          };
        }
      }

      // 2. Se for o usuário atualmente ativo na sessão, atualiza também a sessão ativa
      const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (raw) {
        const current: UserProfile = JSON.parse(raw);
        const curDigits = current.telefone ? current.telefone.replace(/\D/g, "") : "";
        if (current.id === userId || (digits && curDigits === digits)) {
          const updatedSession: UserProfile = {
            ...current,
            ...(dados.nome ? { nome: dados.nome } : {}),
            ...(dados.telefone ? { telefone: mascaraWhatsApp(dados.telefone) } : {}),
            ...(dados.dataNascimento !== undefined ? { dataNascimento: dados.dataNascimento } : {}),
            ...(dados.bloqueado !== undefined ? { bloqueado: dados.bloqueado } : {}),
            ...(dados.motivo_bloqueio !== undefined ? { motivo_bloqueio: dados.motivo_bloqueio } : {}),
          };
          localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedSession));
          if (!updatedUser) updatedUser = updatedSession;
        }
      }

      if (updatedUser) return updatedUser;
    } catch (err) {
      console.error("Erro ao atualizar usuário local:", err);
    }
  }

  return null;
}

/**
 * Exclui a conta do usuário permanentemente (LGPD)
 */
export async function excluirContaSupabase(userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("usuarios").delete().eq("id", userId);
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[Auth] Erro ao deletar no Supabase:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (raw) {
        const cur: UserProfile = JSON.parse(raw);
        if (cur.id === userId) {
          localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        }
      }
      const users = getLocalUsers().filter((u) => u.id !== userId);
      saveLocalUsers(users);
    } catch {}
  }

  return true;
}

/**
 * Lista todos os usuários cadastrados (Supabase e armazenamento local sincronizado).
 */
export async function listarUsuariosCadastrados(): Promise<UserProfile[]> {
  const usersById = new Map<string, UserProfile>();
  const idByPhone = new Map<string, string>(); // digits -> id

  // 1. Armazenamento Local
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_MOCK_USERS_DB);
      if (raw) {
        const list: StoredUserRow[] = JSON.parse(raw);
        // Filtra e limpa registros corrompidos ou sem telefone
        const validList = list.filter(
          (u) => Boolean(u && u.id && u.telefone && u.telefone.replace(/\D/g, "").length >= 8)
        );
        if (validList.length !== list.length) {
          saveLocalUsers(validList);
        }

        for (const u of validList) {
          const digits = u.telefone.replace(/\D/g, "");
          const profile: UserProfile = {
            id: u.id,
            nome: u.nome,
            telefone: mascaraWhatsApp(u.telefone),
            dataNascimento: u.data_nascimento,
            criadoEm: u.criado_em,
            bloqueado: Boolean(u.bloqueado),
            motivo_bloqueio: u.motivo_bloqueio || null,
          };
          usersById.set(u.id, profile);
          if (digits) idByPhone.set(digits, u.id);
        }
      }

      const rawCur = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (rawCur) {
        const cur: UserProfile = JSON.parse(rawCur);
        const digits = cur.telefone ? cur.telefone.replace(/\D/g, "") : "";
        if (digits && digits.length >= 8) {
          if (!usersById.has(cur.id) && !idByPhone.has(digits)) {
            usersById.set(cur.id, cur);
            idByPhone.set(digits, cur.id);
          }
        }
      }
    } catch {}
  }

  // 2. Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from("usuarios").select("*");
      if (!error && data) {
        for (const row of data) {
          const digits = String(row.telefone).replace(/\D/g, "");
          if (!digits || digits.length < 8) continue;

          const existingId = idByPhone.get(digits) || row.id;
          const localMatch = usersById.get(existingId) || usersById.get(row.id);

          const profile: UserProfile = {
            id: row.id,
            nome: row.nome || localMatch?.nome || "Cliente",
            telefone: mascaraWhatsApp(row.telefone || localMatch?.telefone || ""),
            dataNascimento: row.data_nascimento || localMatch?.dataNascimento,
            criadoEm: row.criado_em || localMatch?.criadoEm,
            bloqueado:
              row.bloqueado !== undefined && row.bloqueado !== null
                ? Boolean(row.bloqueado)
                : Boolean(localMatch?.bloqueado),
            motivo_bloqueio:
              row.motivo_bloqueio !== undefined && row.motivo_bloqueio !== null
                ? row.motivo_bloqueio
                : (localMatch?.motivo_bloqueio || null),
          };

          if (existingId && existingId !== row.id) {
            usersById.delete(existingId);
          }
          usersById.set(row.id, profile);
          idByPhone.set(digits, row.id);
        }
      }
    } catch {}
  }

  return Array.from(usersById.values());
}

/**
 * Retorna mapa síncrono de telefones cadastrados (apenas dígitos) -> userId
 * baseado no cache local atual.
 */
export function getTelefonesCadastradosLocal(): Map<string, string> {
  const map = new Map<string, string>();
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(STORAGE_MOCK_USERS_DB);
    if (raw) {
      const list: StoredUserRow[] = JSON.parse(raw);
      for (const u of list) {
        const digits = u.telefone.replace(/\D/g, "");
        if (digits && digits.length >= 8) map.set(digits, u.id);
      }
    }
    const rawCur = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (rawCur) {
      const cur: UserProfile = JSON.parse(rawCur);
      const digits = cur.telefone ? cur.telefone.replace(/\D/g, "") : "";
      if (digits && digits.length >= 8 && !map.has(digits)) map.set(digits, cur.id);
    }
  } catch {}
  return map;
}

/**
 * Verifica se um telefone pertence a um usuário bloqueado
 */
export async function isTelefoneBloqueado(telefone: string): Promise<boolean> {
  const digits = telefone.replace(/\D/g, "");
  if (!digits || digits.length < 8) return false;

  // 1. Tenta checar diretamente no Supabase em tempo real
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("bloqueado")
        .eq("telefone", digits)
        .maybeSingle();

      if (!error && data && data.bloqueado !== undefined && data.bloqueado !== null) {
        return Boolean(data.bloqueado);
      }
    } catch {}
  }

  // 2. Fallback sincronizado
  const todos = await listarUsuariosCadastrados();
  const encontrado = todos.find((u) => u.telefone.replace(/\D/g, "") === digits);
  return Boolean(encontrado?.bloqueado);
}

/**
 * Bloqueia ou desbloqueia um usuário preservando os dados cadastrais
 */
export async function toggleBloqueioUsuario(
  userId: string,
  bloqueado: boolean,
  motivo?: string,
  dadosAtuais?: { nome?: string; telefone?: string; dataNascimento?: string | null }
): Promise<boolean> {
  try {
    await atualizarPerfilSupabase(userId, {
      bloqueado,
      motivo_bloqueio: motivo || null,
      ...(dadosAtuais?.nome ? { nome: dadosAtuais.nome } : {}),
      ...(dadosAtuais?.telefone ? { telefone: dadosAtuais.telefone } : {}),
      ...(dadosAtuais?.dataNascimento !== undefined ? { dataNascimento: dadosAtuais.dataNascimento } : {}),
    });
    return true;
  } catch (err) {
    console.error("Erro ao alterar bloqueio:", err);
    return false;
  }
}
