/**
 * @file arenasPlataforma.ts
 * @description Gestão das arenas pelo Super Admin (somente servidor): listar e alterar os campos que
 * só a plataforma controla (subdomínio, módulos contratados, arena ativa e modo demonstração). O banco
 * barra essas colunas para o dono (trigger `proteger_campos_plataforma_arena`); aqui o cliente
 * service role passa pela trava.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano A)
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { isModuloArena, normalizarModulosAtivos, type ModuloArena } from "@/lib/arena/modulos";
import { construirUrlArena } from "@/lib/arena/subdomain";
import { ErroProvisionamento, validarSlugArena } from "@/lib/admin/provisionamento";
import { pagamentoSimuladoHabilitado } from "@/lib/pagamento/simulacao";
import { registrarAuditoria } from "@/lib/servidor/auditoria";

/** Arena como o Super Admin vê na lista. */
export interface ArenaPlataforma {
  id: string;
  nome: string;
  slug: string;
  /** Endereço anterior, que redireciona para o atual */
  slugAnterior: string | null;
  url: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  modulos: ModuloArena[];
  modoPagamento: string;
  /** O dono já ativou o acesso (primeiro login concluído) */
  donoAtivado: boolean;
  /** E-mail do proprietário, quando já existe */
  emailDono: string | null;
  criadaEm: string;
}

/** Alterações aceitas pelo Super Admin (campos ausentes ficam como estão). */
export interface AlteracaoArenaPlataforma {
  slug?: string;
  modulos?: ModuloArena[];
  ativo?: boolean;
  /** Liga (true) ou desliga (false) o pagamento simulado de demonstração */
  modoDemonstracao?: boolean;
}

type Linha = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : "");

function linhaParaArenaPlataforma(row: Linha, emailDono: string | null): ArenaPlataforma {
  const slug = texto(row.slug);
  return {
    id: texto(row.id),
    nome: texto(row.nome),
    slug,
    slugAnterior: texto(row.slug_anterior) || null,
    url: construirUrlArena(slug),
    cidade: texto(row.cidade),
    estado: texto(row.estado),
    ativo: row.ativo !== false,
    modulos: normalizarModulosAtivos(row.modulos_ativos),
    modoPagamento: texto(row.modo_pagamento) || "manual",
    donoAtivado: !!row.setup_concluido_em || !!emailDono,
    emailDono,
    criadaEm: texto(row.criado_em),
  };
}

/**
 * Valida o corpo do PATCH do Super Admin.
 *
 * @param input Corpo bruto
 * @returns Alterações normalizadas (o módulo `agendamento_core` é sempre mantido)
 * @throws ErroProvisionamento 400 se algum campo for inválido ou se nada foi enviado
 *
 * @example
 * ```ts
 * validarAlteracaoArena({ slug: "Arena-Nova", ativo: true }); // { slug: "arena-nova", ativo: true }
 * ```
 */
export function validarAlteracaoArena(input: unknown): AlteracaoArenaPlataforma {
  const bruto = (input ?? {}) as Record<string, unknown>;
  const alteracao: AlteracaoArenaPlataforma = {};

  if (bruto.slug !== undefined) {
    alteracao.slug = validarSlugArena(texto(bruto.slug));
  }
  if (bruto.modulos !== undefined) {
    if (!Array.isArray(bruto.modulos)) throw new ErroProvisionamento("Módulos inválidos.", 400);
    const desconhecido = bruto.modulos.find((m) => !isModuloArena(m));
    if (desconhecido !== undefined) throw new ErroProvisionamento(`Módulo desconhecido: ${String(desconhecido)}.`, 400);
    alteracao.modulos = Array.from(new Set<ModuloArena>(["agendamento_core", ...(bruto.modulos as ModuloArena[])]));
  }
  if (bruto.ativo !== undefined) {
    if (typeof bruto.ativo !== "boolean") throw new ErroProvisionamento("Status inválido.", 400);
    alteracao.ativo = bruto.ativo;
  }
  if (bruto.modoDemonstracao !== undefined) {
    if (typeof bruto.modoDemonstracao !== "boolean") throw new ErroProvisionamento("Modo demonstração inválido.", 400);
    alteracao.modoDemonstracao = bruto.modoDemonstracao;
  }

  if (Object.keys(alteracao).length === 0) throw new ErroProvisionamento("Nada para alterar.", 400);
  return alteracao;
}

/** E-mail do proprietário ativo de cada arena (uma consulta por arena com dono; a lista é pequena). */
async function emailsDosDonos(arenaIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (arenaIds.length === 0) return emails;
  const { data, error } = await supabaseAdmin
    .from("arena_usuarios")
    .select("arena_id, user_id")
    .in("arena_id", arenaIds)
    .eq("role", "proprietario")
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  await Promise.all(
    ((data ?? []) as Linha[]).map(async (v) => {
      const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(texto(v.user_id));
      if (usuario?.user?.email) emails.set(texto(v.arena_id), usuario.user.email);
    })
  );
  return emails;
}

/**
 * Lista todas as arenas da plataforma (ativas e inativas), da mais nova para a mais antiga.
 *
 * @returns Arenas com dono e módulos
 */
export async function listarArenasPlataforma(): Promise<ArenaPlataforma[]> {
  const { data, error } = await supabaseAdmin.from("arenas").select("*").order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as Linha[];
  const emails = await emailsDosDonos(linhas.map((l) => texto(l.id)));
  return linhas.map((l) => linhaParaArenaPlataforma(l, emails.get(texto(l.id)) ?? null));
}

/**
 * Garante que o subdomínio não é usado (nem como endereço atual, nem como antigo) por outra arena.
 *
 * @param slug Subdomínio desejado
 * @param arenaId Arena que vai usá-lo (ignorada na checagem); omitida na criação
 * @throws ErroProvisionamento 409 se outra arena já usa o endereço
 */
export async function garantirSlugLivre(slug: string, arenaId?: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("arenas")
    .select("id")
    .or(`slug.eq.${slug},slug_anterior.eq.${slug}`);
  if (error) throw new Error(error.message);
  if (((data ?? []) as Linha[]).some((l) => texto(l.id) !== arenaId)) {
    throw new ErroProvisionamento("Este endereço já é (ou já foi) usado por outra arena.", 409);
  }
}

/**
 * Aplica as alterações do Super Admin numa arena. Trocar o subdomínio guarda o anterior em
 * `slug_anterior` (o endereço antigo passa a redirecionar). Desligar o modo demonstração volta para o
 * Asaas, se conectado, ou para o Pix direto.
 *
 * @param arenaId Arena
 * @param alteracao Dados já validados por {@link validarAlteracaoArena}
 * @returns Arena atualizada
 * @throws ErroProvisionamento 404 (arena inexistente), 409 (endereço em uso ou demonstração indisponível)
 */
export async function alterarArenaPlataforma(arenaId: string, alteracao: AlteracaoArenaPlataforma): Promise<ArenaPlataforma> {
  const { data: atual, error } = await supabaseAdmin.from("arenas").select("*").eq("id", arenaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!atual) throw new ErroProvisionamento("Arena não encontrada.", 404);

  const payload: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  const slugAtual = texto(atual.slug);

  if (alteracao.slug !== undefined && alteracao.slug !== slugAtual) {
    await garantirSlugLivre(alteracao.slug, arenaId);
    payload.slug = alteracao.slug;
    payload.slug_anterior = slugAtual;
  }
  if (alteracao.modulos !== undefined) payload.modulos_ativos = alteracao.modulos;
  if (alteracao.ativo !== undefined) payload.ativo = alteracao.ativo;
  if (alteracao.modoDemonstracao === true && atual.modo_pagamento !== "simulado") {
    if (!pagamentoSimuladoHabilitado()) {
      throw new ErroProvisionamento("O pagamento simulado está desligado neste servidor (PAGAMENTO_SIMULADO_HABILITADO).", 409);
    }
    payload.modo_pagamento = "simulado";
  }
  if (alteracao.modoDemonstracao === false && atual.modo_pagamento === "simulado") {
    const { data: credencial } = await supabaseAdmin
      .from("arena_credenciais_pagamento")
      .select("arena_id")
      .eq("arena_id", arenaId)
      .maybeSingle();
    payload.modo_pagamento = credencial ? "asaas" : "manual";
  }

  const { data: salva, error: erroUpdate } = await supabaseAdmin
    .from("arenas")
    .update(payload)
    .eq("id", arenaId)
    .select("*")
    .single();
  if (erroUpdate) {
    if (erroUpdate.code === "23505") throw new ErroProvisionamento("Este endereço já é (ou já foi) usado por outra arena.", 409);
    throw new Error(erroUpdate.message);
  }

  await registrarAuditoria({
    arenaId,
    autorId: null,
    acao: "superadmin.alterar_arena",
    detalhes: {
      ...alteracao,
      ...(payload.slug_anterior ? { slugAnterior: payload.slug_anterior } : {}),
      ...(payload.modo_pagamento ? { modoPagamento: payload.modo_pagamento } : {}),
    },
  });

  const emails = await emailsDosDonos([arenaId]);
  return linhaParaArenaPlataforma(salva as Linha, emails.get(arenaId) ?? null);
}
