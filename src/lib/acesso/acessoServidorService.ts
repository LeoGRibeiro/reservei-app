/**
 * @file acessoServidorService.ts
 * @description Entrar e criar conta com código no WhatsApp, sem senha (somente servidor).
 *
 * Fluxo: o atleta pede o código (regras de envio por número e por IP), o provedor da arena entrega,
 * o atleta digita e o servidor confere (validade, uso único, tentativas). Conferido, o servidor cria
 * a conta quando é cadastro e abre a sessão no Supabase Auth: gera um link mágico pela API
 * administrativa (nenhum e-mail é enviado) e o troca pela sessão com `verifyOtp`. O navegador só recebe
 * os tokens da sessão. Decisão registrada em docs/ARCHITECTURE_DECISIONS.md (ADR do login por código).
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { emailSinteticoDoTelefone } from "@/lib/supabase/authService";
import { normalizarModoPagamento } from "@/lib/arena/arenaRepository";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { vincularReservaAoAtleta } from "@/lib/reservas/checkoutServidorService";
import { nomeProprio } from "@/lib/portal/formatos";
import { numerosDeTeste, provedorDaArena, type EnvioCodigoAcesso } from "./provedores";
import {
  INTERVALO_REENVIO_S,
  VALIDADE_CODIGO_MIN,
  conferirCodigo,
  hashCodigo,
  normalizarTelefone,
  podeEnviarCodigo,
  type RegistroCodigo,
} from "./regrasCodigo";

/** Para que o código foi pedido. */
export type ModoAcesso = "entrar" | "criar" | "concluir";

/** Sessão aberta para o navegador. */
export interface SessaoAberta {
  accessToken: string;
  refreshToken: string;
  /** Nome do atleta (para o aviso de boas-vindas) */
  nome: string;
}

type Linha = Record<string, unknown>;

const MODOS: ModoAcesso[] = ["entrar", "criar", "concluir"];

function validarModo(bruto: unknown): ModoAcesso {
  if (!MODOS.includes(bruto as ModoAcesso)) throw new ErroHttp("Pedido inválido.", 400);
  return bruto as ModoAcesso;
}

function validarTelefone(bruto: unknown): string {
  const telefone = normalizarTelefone(bruto);
  if (telefone.length < 10 || telefone.length > 11) throw new ErroHttp("WhatsApp inválido. Use DDD e número.", 400);
  return telefone;
}

/** Provedor da arena, ou erro se a arena não pode mandar código. */
async function provedorDaArenaOuErro(arenaId: unknown): Promise<EnvioCodigoAcesso> {
  if (typeof arenaId !== "string" || !arenaId) throw new ErroHttp("Arena não informada.", 400);
  const { data, error } = await supabaseAdmin.from("arenas").select("id, modo_pagamento, ativo").eq("id", arenaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.ativo === false) throw new ErroHttp("Arena não encontrada.", 404);
  const provedor = provedorDaArena(normalizarModoPagamento(data.modo_pagamento));
  if (!provedor) {
    throw new ErroHttp("Entrar pelo WhatsApp ainda não está disponível nesta arena. Você pode reservar sem conta.", 503);
  }
  return provedor;
}

/** Perfil do atleta pelo WhatsApp (ou null). */
async function perfilPorTelefone(telefone: string): Promise<Linha | null> {
  const { data, error } = await supabaseAdmin.from("usuarios").select("*").eq("telefone", telefone).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as Linha | undefined) ?? null;
}

/** Id da conta no Supabase Auth a partir do perfil. */
const idDaConta = (perfil: Linha): string => String(perfil.auth_user_id ?? perfil.id);

/**
 * O modo demonstração entra só em conta nova, em conta de demonstração ou em número de teste:
 * com o código fixo, entrar numa conta real seria entrar na conta de outra pessoa.
 */
async function conferirContaDeDemonstracao(perfil: Linha | null, telefone: string): Promise<void> {
  if (!perfil || numerosDeTeste().has(telefone)) return;
  const { data } = await supabaseAdmin.auth.admin.getUserById(idDaConta(perfil));
  if (data?.user?.app_metadata?.conta_demo === true) return;
  throw new ErroHttp("Este WhatsApp tem uma conta real. Na demonstração, use outro número.", 403);
}

/** Regras de existência da conta para cada modo. */
async function conferirConta(modo: ModoAcesso, telefone: string, provedor: EnvioCodigoAcesso): Promise<Linha | null> {
  const perfil = await perfilPorTelefone(telefone);
  if (modo === "entrar" && !perfil) throw new ErroHttp("Não encontramos conta com esse WhatsApp. Crie sua conta.", 404);
  if (modo !== "entrar" && perfil) throw new ErroHttp("Esse WhatsApp já tem conta. Entre com ele.", 409);
  if (provedor.nome === "demonstracao") await conferirContaDeDemonstracao(perfil, telefone);
  return perfil;
}

function mapearRegistro(r: Linha): RegistroCodigo {
  return {
    id: Number(r.id),
    telefone: String(r.telefone),
    ip: r.ip ? String(r.ip) : null,
    codigoHash: String(r.codigo_hash),
    tentativas: Number(r.tentativas ?? 0),
    criadoEm: new Date(String(r.criado_em)),
    expiraEm: new Date(String(r.expira_em)),
    usadoEm: r.usado_em ? new Date(String(r.usado_em)) : null,
  };
}

async function registrosRecentes(coluna: "telefone" | "ip", valor: string, agora: Date): Promise<RegistroCodigo[]> {
  const desde = new Date(agora.getTime() - 3_600_000).toISOString();
  const { data, error } = await supabaseAdmin.from("codigos_acesso").select("*").eq(coluna, valor).gte("criado_em", desde);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapearRegistro(r as Linha));
}

/**
 * Pede um código de acesso.
 *
 * @param corpo `{ arenaId, telefone, modo }`
 * @param ip IP de quem pede (limite por rede)
 * @returns Segundos até poder pedir de novo
 * @throws ErroHttp 400 (dados), 403/404/409 (conta), 429 (limite), 503 (arena sem provedor)
 */
export async function solicitarCodigo(corpo: unknown, ip: string | null, agora: Date = new Date()): Promise<{ reenviarEmSegundos: number }> {
  const bruto = (corpo ?? {}) as Linha;
  const modo = validarModo(bruto.modo);
  const telefone = validarTelefone(bruto.telefone);
  const provedor = await provedorDaArenaOuErro(bruto.arenaId);
  await conferirConta(modo, telefone, provedor);

  const permissao = podeEnviarCodigo(await registrosRecentes("telefone", telefone, agora), ip ? await registrosRecentes("ip", ip, agora) : [], agora);
  if (!permissao.ok) throw new ErroHttp(permissao.motivo, 429);

  const codigo = provedor.gerarCodigo();
  const { error } = await supabaseAdmin.from("codigos_acesso").insert({
    arena_id: bruto.arenaId,
    telefone,
    ip,
    codigo_hash: hashCodigo(codigo, telefone),
    provedor: provedor.nome,
    criado_em: agora.toISOString(),
    expira_em: new Date(agora.getTime() + VALIDADE_CODIGO_MIN * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  await provedor.enviar(telefone, codigo);
  return { reenviarEmSegundos: INTERVALO_REENVIO_S };
}

/** Cria a conta (Supabase Auth + perfil em `usuarios`). */
async function criarConta(telefone: string, nome: string, nascimento: string | null, demonstracao: boolean): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: emailSinteticoDoTelefone(telefone),
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { nome },
    app_metadata: demonstracao ? { conta_demo: true } : {},
  });
  if (error || !data.user) throw new Error(error?.message ?? "Falha ao criar a conta.");
  const id = data.user.id;
  const { error: erroPerfil } = await supabaseAdmin
    .from("usuarios")
    .insert({ id, auth_user_id: id, nome, telefone, data_nascimento: nascimento });
  if (erroPerfil) {
    await supabaseAdmin.auth.admin.deleteUser(id);
    if (erroPerfil.code === "23505") throw new ErroHttp("Esse WhatsApp já tem conta. Entre com ele.", 409);
    throw new Error(erroPerfil.message);
  }
  return id;
}

/** Abre a sessão da conta: link mágico gerado pela API administrativa trocado pela sessão. */
async function abrirSessao(telefone: string): Promise<Omit<SessaoAberta, "nome">> {
  const email = emailSinteticoDoTelefone(telefone);
  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link.properties?.hashed_token) throw new Error(error?.message ?? "Falha ao abrir a sessão.");
  const anonimo = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: erroSessao } = await anonimo.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: link.properties.verification_type === "signup" ? "signup" : "magiclink",
  });
  if (erroSessao || !data.session) throw new Error(erroSessao?.message ?? "Falha ao abrir a sessão.");
  return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
}

/**
 * Confere o código e entra (ou cria a conta e entra).
 *
 * @param corpo `{ arenaId, telefone, codigo, modo, nome?, nascimento?, reservaId?, checkoutToken? }`
 *   (`concluir`: conta criada depois de reservar sem conta; a reserva passa para a conta)
 * @returns Tokens da sessão
 * @throws ErroHttp 400/401/429 (código) e os erros de {@link solicitarCodigo}
 */
export async function verificarCodigo(corpo: unknown, agora: Date = new Date()): Promise<SessaoAberta> {
  const bruto = (corpo ?? {}) as Linha;
  const modo = validarModo(bruto.modo);
  const telefone = validarTelefone(bruto.telefone);
  const codigo = String(bruto.codigo ?? "").replace(/\D/g, "");
  if (codigo.length !== 6) throw new ErroHttp("Digite os 6 números do código.", 400);
  const nome = nomeProprio(String(bruto.nome ?? "")).slice(0, 120);
  if (modo !== "entrar" && nome.split(" ").filter(Boolean).length < 2) throw new ErroHttp("Informe seu nome completo.", 400);
  const nascimento = typeof bruto.nascimento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto.nascimento) ? bruto.nascimento : null;

  const provedor = await provedorDaArenaOuErro(bruto.arenaId);
  const { data: ultimos, error } = await supabaseAdmin
    .from("codigos_acesso")
    .select("*")
    .eq("telefone", telefone)
    .order("criado_em", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const registro = ultimos?.[0] ? mapearRegistro(ultimos[0] as Linha) : null;

  const conferido = conferirCodigo(registro, codigo, agora);
  if (!conferido.ok) {
    if (registro) await supabaseAdmin.from("codigos_acesso").update({ tentativas: registro.tentativas + 1 }).eq("id", registro.id);
    throw new ErroHttp(conferido.motivo, conferido.esgotou ? 429 : 401);
  }
  // Uso único: marca antes de criar a conta, para um segundo envio do mesmo código falhar
  await supabaseAdmin.from("codigos_acesso").update({ usado_em: agora.toISOString() }).eq("id", (registro as RegistroCodigo).id);

  const perfil = await conferirConta(modo, telefone, provedor);
  const userId = perfil ? idDaConta(perfil) : await criarConta(telefone, nome, nascimento, provedor.nome === "demonstracao");

  if (modo === "concluir" && typeof bruto.reservaId === "string" && typeof bruto.checkoutToken === "string") {
    await vincularReservaAoAtleta(bruto.reservaId, bruto.checkoutToken, userId).catch((err) => {
      console.warn("[acesso] Conta criada, mas a reserva não foi vinculada:", err);
    });
  }
  return { ...(await abrirSessao(telefone)), nome: perfil ? String(perfil.nome ?? "") : nome };
}
