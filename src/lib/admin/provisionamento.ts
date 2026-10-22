/**
 * @file provisionamento.ts
 * @description Casos de uso de provisionamento (somente servidor): criação do primeiro
 * administrador de uma arena (Setup Wizard) e cadastro de novas arenas (Super Admin).
 * Todas as operações usam o cliente service role, portanto NUNCA devem ser importadas
 * por código client-side.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { MODULOS_PADRAO, isModuloArena, type ModuloArena } from "@/lib/arena/modulos";
import {
  ROTAS_RAIZ_RESERVADAS,
  SUBDOMINIOS_RESERVADOS,
  construirUrlArena,
} from "@/lib/arena/subdomain";

/** Tamanho mínimo da senha exigido pelo Supabase Auth. */
export const SENHA_MINIMA = 6;

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Erro de negócio com código HTTP sugerido (mapeado pelas rotas de API).
 */
export class ErroProvisionamento extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ErroProvisionamento";
  }
}

// ─── Setup do primeiro administrador ──────────────────────────────────────────

/** Mensagem para token de convite ausente, incorreto ou já utilizado. */
export const MSG_TOKEN_INVALIDO = "Token de convite inválido ou expirado";

/** Mensagem quando a arena já tem proprietário/operador ativo. */
export const MSG_ARENA_JA_CONFIGURADA = "Esta arena já possui administrador ativo";

/**
 * Compara dois tokens em tempo constante.
 */
function tokensConferem(informado: string, esperado: string | null | undefined): boolean {
  if (!informado || !esperado) return false;
  // Convites gravados antes da Fase 8 ainda podem estar em texto puro
  const comparavel = esperado.length === TAMANHO_HASH_CONVITE ? hashTokenConvite(informado) : informado;
  const a = Buffer.from(comparavel);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Tamanho do hash SHA-256 em hexadecimal. */
const TAMANHO_HASH_CONVITE = 64;

/**
 * Hash SHA-256 (hex) do token de convite. O banco guarda só o hash: a linha de `arenas` é legível
 * publicamente (portal), e o token puro permitiria a qualquer visitante assumir uma arena recém-criada.
 *
 * @param token Token de convite em texto puro
 * @returns Hash hexadecimal de 64 caracteres
 */
export function hashTokenConvite(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Monta o link de ativação do proprietário (primeiro acesso).
 *
 * @param slug Slug da arena
 * @param token Token de convite
 * @returns URL absoluta (ex: 'https://central.reservei.com/admin?token=...')
 */
export function montarUrlConvite(slug: string, token: string): string {
  return `${construirUrlArena(slug)}/admin?token=${encodeURIComponent(token)}`;
}

/** Dados do formulário do Setup Wizard. */
export interface SetupAdminInput {
  arenaSlug: string;
  /** Token de convite único gerado no cadastro da arena */
  token: string;
  nome: string;
  email: string;
  senha: string;
}

/**
 * Valida os campos do Setup Wizard.
 *
 * @param input Corpo bruto da requisição
 * @returns Dados normalizados
 * @throws ErroProvisionamento (400) se algum campo for inválido
 */
export function validarSetupAdmin(input: unknown): SetupAdminInput {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const arenaSlug = typeof bruto.arenaSlug === "string" ? bruto.arenaSlug.trim().toLowerCase() : "";
  const token = typeof bruto.token === "string" ? bruto.token.trim() : "";
  const nome = typeof bruto.nome === "string" ? bruto.nome.trim() : "";
  const email = typeof bruto.email === "string" ? bruto.email.trim().toLowerCase() : "";
  const senha = typeof bruto.senha === "string" ? bruto.senha : "";

  if (!arenaSlug || !nome || !email || !senha) {
    throw new ErroProvisionamento("Preencha todos os campos obrigatórios.", 400);
  }
  if (!REGEX_EMAIL.test(email)) {
    throw new ErroProvisionamento("Informe um e-mail válido.", 400);
  }
  if (senha.length < SENHA_MINIMA) {
    throw new ErroProvisionamento(`A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`, 400);
  }

  return { arenaSlug, token, nome, email, senha };
}

/** Dados mínimos da arena usados no fluxo de setup. */
interface ArenaSetup {
  id: string;
  tokenConvite: string | null;
}

/**
 * Busca uma arena ativa pelo slug (id e token de convite pendente).
 */
async function buscarArenaParaSetup(slug: string): Promise<ArenaSetup | null> {
  const { data, error } = await supabaseAdmin
    .from("arenas")
    .select("id, token_convite")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: String(data.id), tokenConvite: data.token_convite ? String(data.token_convite) : null };
}

/**
 * Conta os operadores ativos de uma arena.
 */
async function contarOperadoresAtivos(arenaId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("arena_usuarios")
    .select("id", { count: "exact", head: true })
    .eq("arena_id", arenaId)
    .eq("ativo", true);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Estado do primeiro acesso de uma arena.
 */
export interface EstadoSetup {
  /** A arena existe e não possui nenhum operador ativo */
  precisaSetup: boolean;
  /** O token informado confere com o convite pendente (sempre false se não precisa de setup) */
  tokenValido: boolean;
}

/**
 * Consulta se a arena precisa do Setup Wizard e se o token de convite informado é válido.
 *
 * @param slug Slug da arena (subdomínio)
 * @param token Token de convite recebido na URL (opcional)
 * @returns Estado do setup
 */
export async function consultarEstadoSetup(slug: string, token: string = ""): Promise<EstadoSetup> {
  const arena = await buscarArenaParaSetup(slug.trim().toLowerCase());
  if (!arena) return { precisaSetup: false, tokenValido: false };

  if ((await contarOperadoresAtivos(arena.id)) > 0) {
    return { precisaSetup: false, tokenValido: false };
  }

  return { precisaSetup: true, tokenValido: tokensConferem(token.trim(), arena.tokenConvite) };
}

/**
 * Cria o primeiro administrador (proprietário) de uma arena, mediante token de convite único.
 *
 * Ordem das operações (à prova de concorrência):
 * 1. Rejeita se a arena já tem operador ativo (403).
 * 2. "Consome" o token de forma atômica (UPDATE condicional): só uma requisição concorrente vence.
 * 3. Cria o usuário em `auth.users` (e-mail auto-confirmado) e o vínculo em `arena_usuarios`.
 * 4. Se 3 falhar, desfaz o usuário e devolve o token para que o convite possa ser reutilizado.
 *
 * @param input Dados já validados por {@link validarSetupAdmin}
 * @returns ID do usuário criado
 * @throws ErroProvisionamento 404 (arena inexistente), 403 (já tem administrador / token inválido), 409 (e-mail em uso)
 */
export async function criarPrimeiroAdministrador(
  input: SetupAdminInput
): Promise<{ userId: string }> {
  const arena = await buscarArenaParaSetup(input.arenaSlug);
  if (!arena) {
    throw new ErroProvisionamento("Arena não encontrada ou inativa.", 404);
  }

  if ((await contarOperadoresAtivos(arena.id)) > 0) {
    throw new ErroProvisionamento(MSG_ARENA_JA_CONFIGURADA, 403);
  }

  if (!tokensConferem(input.token, arena.tokenConvite)) {
    throw new ErroProvisionamento(MSG_TOKEN_INVALIDO, 403);
  }

  // Consome o convite atomicamente: apenas uma chamada concorrente encontra o token ainda presente
  const { data: consumida, error: erroConsumo } = await supabaseAdmin
    .from("arenas")
    .update({ token_convite: null, setup_concluido_em: new Date().toISOString() })
    .eq("id", arena.id)
    .eq("token_convite", arena.tokenConvite)
    .select("id");

  if (erroConsumo) throw new Error(erroConsumo.message);
  if (!consumida || consumida.length === 0) {
    throw new ErroProvisionamento(MSG_TOKEN_INVALIDO, 403);
  }

  /** Devolve o convite quando algo falha depois de consumido. */
  const restaurarConvite = async () => {
    await supabaseAdmin
      .from("arenas")
      .update({ token_convite: arena.tokenConvite, setup_concluido_em: null })
      .eq("id", arena.id);
  };

  const { data: criado, error: erroUsuario } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.senha,
    email_confirm: true,
    user_metadata: { nome: input.nome },
  });

  if (erroUsuario || !criado?.user) {
    await restaurarConvite();
    const msg = (erroUsuario?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      throw new ErroProvisionamento("Este e-mail já está em uso. Utilize outro e-mail.", 409);
    }
    throw new Error(erroUsuario?.message ?? "Falha ao criar usuário.");
  }

  const userId = criado.user.id;
  const { error: erroVinculo } = await supabaseAdmin.from("arena_usuarios").insert({
    arena_id: arena.id,
    user_id: userId,
    role: "proprietario",
    ativo: true,
  });

  if (erroVinculo) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await restaurarConvite();
    throw new Error(erroVinculo.message);
  }

  return { userId };
}

// ─── Cadastro de arenas (Super Admin) ─────────────────────────────────────────

/** Dados do formulário de nova arena. */
export interface NovaArenaInput {
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  whatsapp: string;
  modulos: ModuloArena[];
  quantidadeQuadras: number;
}

/** Limite superior de quadras criadas automaticamente no onboarding. */
export const MAX_QUADRAS_INICIAIS = 20;

/**
 * Valida os campos do formulário de nova arena.
 *
 * @param input Corpo bruto da requisição
 * @returns Dados normalizados (o módulo `agendamento_core` é sempre incluído)
 * @throws ErroProvisionamento (400) se algum campo for inválido
 */
export function validarNovaArena(input: unknown): NovaArenaInput {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const nome = texto(bruto.nome);
  const slug = texto(bruto.slug).toLowerCase();
  const cidade = texto(bruto.cidade);
  const estado = texto(bruto.estado).toUpperCase();
  const whatsapp = texto(bruto.whatsapp);
  const quantidade = Number(bruto.quantidadeQuadras ?? 3);

  if (!nome || !slug || !cidade || !estado || !whatsapp) {
    throw new ErroProvisionamento("Preencha nome, slug, cidade, estado e WhatsApp.", 400);
  }
  if (!REGEX_SLUG.test(slug)) {
    throw new ErroProvisionamento(
      "Slug inválido. Use apenas letras minúsculas, números e hífens.",
      400
    );
  }
  if (SUBDOMINIOS_RESERVADOS.has(slug) || ROTAS_RAIZ_RESERVADAS.has(slug) || slug === "super-admin") {
    throw new ErroProvisionamento("Este slug é reservado pelo sistema.", 400);
  }
  if (!/^[A-Z]{2}$/.test(estado)) {
    throw new ErroProvisionamento("Estado deve ser a sigla com 2 letras (ex: PA).", 400);
  }
  if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > MAX_QUADRAS_INICIAIS) {
    throw new ErroProvisionamento(
      `Quantidade de quadras deve ser um inteiro entre 0 e ${MAX_QUADRAS_INICIAIS}.`,
      400
    );
  }

  const informados = Array.isArray(bruto.modulos) ? bruto.modulos : [...MODULOS_PADRAO];
  const modulos = Array.from(
    new Set<ModuloArena>(["agendamento_core", ...informados.filter(isModuloArena)])
  );

  return { nome, slug, cidade, estado, whatsapp, modulos, quantidadeQuadras: quantidade };
}

/**
 * Cria a arena e suas quadras iniciais. Se a criação das quadras falhar, a arena é removida.
 *
 * @param input Dados já validados por {@link validarNovaArena}
 * @returns Identificador, slug, quadras criadas, token de convite e link de ativação do proprietário
 * @throws ErroProvisionamento 409 se o slug já existir
 */
export async function criarArena(
  input: NovaArenaInput
): Promise<{
  arenaId: string;
  slug: string;
  quadrasCriadas: number;
  tokenConvite: string;
  urlConvite: string;
}> {
  const arenaId = crypto.randomUUID();
  const tokenConvite = crypto.randomUUID();

  const { error: erroArena } = await supabaseAdmin.from("arenas").insert({
    id: arenaId,
    slug: input.slug,
    nome: input.nome,
    telefone: input.whatsapp,
    whatsapp: input.whatsapp,
    cidade: input.cidade,
    estado: input.estado,
    ativo: true,
    modulos_ativos: input.modulos,
    token_convite: hashTokenConvite(tokenConvite),
  });

  if (erroArena) {
    if (erroArena.code === "23505") {
      throw new ErroProvisionamento("Já existe uma arena com este slug.", 409);
    }
    throw new Error(erroArena.message);
  }

  if (input.quantidadeQuadras > 0) {
    const quadras = Array.from({ length: input.quantidadeQuadras }, (_, i) => ({
      id: `${arenaId}-q${i + 1}`,
      arena_id: arenaId,
      numero: i + 1,
      nome: `Quadra ${i + 1}`,
      tipo_piso: "areia",
      esportes: ["Futsal", "Vôlei"],
      valor_hora_padrao: 90,
      ordem: i + 1,
      ativa: true,
    }));

    const { error: erroQuadras } = await supabaseAdmin.from("quadras").insert(quadras);
    if (erroQuadras) {
      await supabaseAdmin.from("arenas").delete().eq("id", arenaId);
      throw new Error(erroQuadras.message);
    }
  }

  return {
    arenaId,
    slug: input.slug,
    quadrasCriadas: input.quantidadeQuadras,
    tokenConvite,
    urlConvite: montarUrlConvite(input.slug, tokenConvite),
  };
}
