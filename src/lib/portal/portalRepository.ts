/**
 * @file portalRepository.ts
 * @description Carrega no servidor tudo o que o portal público mostra de uma arena, por `arena_id`:
 * arena, tema, textos, quadras, preços, escolinhas, eventos, estrutura, Instagram e Clube.
 *
 * Usa a chave pública (anon), então só enxerga o que o RLS libera para visitantes. Cada tabela é
 * lida com tratamento próprio: uma tabela ausente (banco sem a migração do portal) ou uma falha
 * pontual deixam só aquela seção vazia, e a seção some da página.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { mapearLinhaParaPreco } from "@/lib/arena/arenaRepository";
import type { QuadraPreco } from "@/lib/arena/types";
import { normalizarTema } from "./tema";
import {
  mapearArenaPortal,
  mapearClube,
  mapearConteudo,
  mapearEscolinha,
  mapearEvento,
  mapearFotoEstrutura,
  mapearPerfilInstagram,
  mapearPost,
  mapearQuadraPortal,
} from "./mapeadores";
import { DIAS_A_FRENTE, hojeNoFusoArena, mapearLinhaGrade } from "./agenda";
import { somarDias } from "./formatos";
import type { DadosPortal } from "./types";
import { FUSO_PADRAO_ARENA } from "@/lib/datas/fusoHorario";

type Linha = Record<string, unknown>;

/** Fotos do bento da Estrutura (as 4 primeiras ativas). */
export const FOTOS_ESTRUTURA = 4;
/** Posts da grade do Instagram (8 no computador; o CSS esconde 2 no celular). */
export const POSTS_INSTAGRAM = 8;

let clientePublico: SupabaseClient | null = null;

/** Cliente com a chave pública, sem sessão (cada requisição do servidor é anônima). */
function cliente(): SupabaseClient {
  if (!clientePublico) {
    clientePublico = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return clientePublico;
}

/** Resultado de uma leitura do Supabase. */
interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/**
 * Executa uma leitura e devolve as linhas, ou `padrao` em caso de erro (com log no servidor).
 * Tabela inexistente (PGRST205/42P01) é esperada antes da migração e não gera alerta.
 */
async function ler<T>(rotulo: string, consulta: PromiseLike<Resposta>, padrao: T): Promise<T> {
  try {
    const { data, error } = await consulta;
    if (error) {
      if (error.code !== "PGRST205" && error.code !== "42P01") {
        console.warn(`[portalRepository] ${rotulo}: ${error.message}`);
      }
      return padrao;
    }
    return (data ?? padrao) as T;
  } catch (err) {
    console.error(`[portalRepository] ${rotulo}: falha inesperada`, err);
    return padrao;
  }
}

/**
 * Carrega os dados do portal de uma arena ativa.
 *
 * @param slug Slug da arena (subdomínio)
 * @param agora Instante de referência do primeiro desenho
 * @returns Dados do portal, ou null se a arena não existe ou está inativa
 *
 * @example
 * ```ts
 * const dados = await carregarDadosPortal("minha-arena");
 * if (!dados) notFound();
 * ```
 */
export async function carregarDadosPortal(slug: string, agora: Date = new Date()): Promise<DadosPortal | null> {
  if (!slug || !isSupabaseConfigured()) return null;
  const db = cliente();

  const linhaArena = await ler<Linha | null>(
    "arena",
    db.from("arenas").select("*").eq("slug", slug).eq("ativo", true).maybeSingle(),
    null
  );
  if (!linhaArena) return null;
  const arena = mapearArenaPortal(linhaArena);
  const id = arena.id;
  const linkInstagram = arena.instagram ? `https://www.instagram.com/${arena.instagram}/` : "";

  const hoje = hojeNoFusoArena(agora, FUSO_PADRAO_ARENA);
  const [quadras, precos, conteudo, escolinhas, eventos, galeria, posts, perfil, campanha, grade] = await Promise.all([
    ler<Linha[]>("quadras", db.from("quadras").select("*").eq("arena_id", id).eq("ativa", true).order("ordem"), []),
    ler<Linha[]>("preços", db.from("quadras_precos").select("*").eq("arena_id", id).eq("ativo", true), []),
    ler<Linha | null>("conteúdo", db.from("arena_conteudo").select("*").eq("arena_id", id).maybeSingle(), null),
    ler<Linha[]>(
      "escolinhas",
      db.from("landing_page_schools").select("*").eq("arena_id", id).eq("is_active", true).order("ordem").order("created_at"),
      []
    ),
    ler<Linha[]>(
      "eventos",
      db.from("eventos").select("*").eq("arena_id", id).eq("ativo", true).order("ordem").order("data_inicio"),
      []
    ),
    ler<Linha[]>(
      "galeria",
      db
        .from("landing_page_gallery")
        .select("*")
        .eq("arena_id", id)
        .eq("is_active", true)
        .order("display_order")
        .limit(FOTOS_ESTRUTURA),
      []
    ),
    ler<Linha[]>(
      "instagram",
      db
        .from("instagram_posts")
        .select("*")
        .eq("arena_id", id)
        .eq("ativo", true)
        .order("fixado", { ascending: false })
        .order("publicado_em", { ascending: false })
        .limit(POSTS_INSTAGRAM),
      []
    ),
    ler<Linha | null>("perfil do instagram", db.from("instagram_perfil").select("*").eq("arena_id", id).maybeSingle(), null),
    ler<Linha[]>("clube", db.from("fidelidade_campanha").select("*").eq("arena_id", id).eq("ativo", true).limit(1), []),
    ler<Linha[]>(
      "grade",
      db.rpc("grade_publica", { p_arena_id: id, p_data_inicio: hoje, p_data_fim: somarDias(hoje, DIAS_A_FRENTE) }),
      []
    ),
  ]);

  return {
    arena,
    tema: normalizarTema(linhaArena.tema),
    conteudo: mapearConteudo(conteudo),
    quadras: quadras.map(mapearQuadraPortal),
    precos: precos.map(mapearLinhaParaPreco) as QuadraPreco[],
    escolinhas: escolinhas.map((e) => mapearEscolinha(e, arena.whatsappDigitos)),
    eventos: eventos.map(mapearEvento),
    galeria: galeria.map(mapearFotoEstrutura),
    instagram: { perfil: mapearPerfilInstagram(perfil), posts: posts.map((p) => mapearPost(p, linkInstagram)) },
    clube: mapearClube(campanha[0]),
    grade: grade.map(mapearLinhaGrade),
    agoraIso: agora.toISOString(),
  };
}

/** Descarta o cliente memoizado. Uso exclusivo de testes. */
export function redefinirClientePortalParaTestes(): void {
  clientePublico = null;
}
