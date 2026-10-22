/**
 * @module supabase/institucionalRepository
 *
 * Repositório tipado da galeria de fotos da landing page (`landing_page_gallery`) e do upload de
 * imagens no Supabase Storage. Com Supabase configurado, opera estritamente na arena ativa
 * (subdomínio) e propaga falhas do banco para a tela avisar o operador. Sem Supabase
 * (desenvolvimento offline), usa o LocalStorage com as fotos de demonstração.
 *
 * As escolinhas exibidas na landing vêm dos contratos do tipo "escolinha" (`contratos_recorrentes`).
 */

import { supabase, isSupabaseConfigured } from "./client";
import type {
  GaleriaItem,
  CriarGaleriaInput,
  AtualizarGaleriaInput,
} from "@/lib/institucional/types";
import { GALERIA_INICIAL } from "@/lib/institucional/dadosIniciais";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";
import { ARENA_PADRAO_ID } from "@/lib/arena/defaultArena";

const STORAGE_KEY_GALERIA = "reservei_landing_gallery";
const BUCKET_INSTITUCIONAL = "institucional";

/** Tamanho máximo aceito para imagens enviadas (5 MB). */
export const TAMANHO_MAXIMO_IMAGEM_BYTES = 5 * 1024 * 1024;

interface GaleriaDbRow {
  id: string;
  image_url: string;
  title: string;
  description: string;
  categoria?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
  created_at?: string;
}

/** Converte a linha do banco na entidade de domínio. */
function linhaParaGaleriaItem(row: GaleriaDbRow): GaleriaItem {
  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    description: row.description,
    categoria: (row.categoria as GaleriaItem["categoria"]) || "quadras",
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

/**
 * Resolve a arena ativa exigida pelas gravações do painel.
 *
 * @throws Error se o subdomínio não corresponde a nenhuma arena ativa
 */
async function exigirArenaAtiva(): Promise<string> {
  const arenaId = await obterArenaAtivaId();
  if (!arenaId) throw new Error("Arena não identificada para esta operação.");
  return arenaId;
}

/**
 * Lança o erro do Supabase (se houver) para que a tela avise o operador em vez de fingir que salvou.
 */
function lancarSeErro(error: { message: string } | null, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

/**
 * Lê itens de galeria do cache local (modo offline), migrando URLs legadas das fotos de demonstração.
 */
function getGaleriaLocal(): GaleriaItem[] {
  if (typeof window === "undefined") return [...GALERIA_INICIAL];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GALERIA);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_GALERIA, JSON.stringify(GALERIA_INICIAL));
      return [...GALERIA_INICIAL];
    }
    const parsed = JSON.parse(raw) as GaleriaItem[];
    let modificado = false;
    const atualizados = parsed.map((item) => {
      const base = GALERIA_INICIAL.find((g) => g.id === item.id);
      if (
        base &&
        (item.imageUrl.includes("1596727366422") || item.imageUrl.includes("1529900245534"))
      ) {
        modificado = true;
        return { ...item, imageUrl: base.imageUrl };
      }
      return item;
    });
    if (modificado) {
      localStorage.setItem(STORAGE_KEY_GALERIA, JSON.stringify(atualizados));
    }
    return atualizados;
  } catch {
    return [...GALERIA_INICIAL];
  }
}

/** Salva itens de galeria no cache local (modo offline). */
function setGaleriaLocal(itens: GaleriaItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_GALERIA, JSON.stringify(itens));
  } catch {}
}

/**
 * Busca as fotos da galeria da arena ativa. As fotos de demonstração só aparecem na arena demo:
 * uma arena real sem fotos exibe a galeria vazia (white-label), nunca imagens de outra arena.
 *
 * @returns Fotos ordenadas por `displayOrder`
 */
export async function listarGaleria(): Promise<GaleriaItem[]> {
  if (!isSupabaseConfigured()) {
    return getGaleriaLocal();
  }

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase
      .from("landing_page_gallery")
      .select("*")
      .eq("arena_id", arenaId)
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return arenaId === ARENA_PADRAO_ID ? [...GALERIA_INICIAL] : [];
    }

    return (data as GaleriaDbRow[]).map(linhaParaGaleriaItem);
  } catch {
    return [];
  }
}

/**
 * Cadastra uma nova foto na galeria da arena ativa.
 *
 * @param input Dados da foto
 * @returns Foto criada
 * @throws Error se o banco recusar a gravação
 */
export async function criarGaleriaItem(input: CriarGaleriaInput): Promise<GaleriaItem> {
  const novoItem: GaleriaItem = {
    id: `gal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    imageUrl: input.imageUrl,
    title: input.title,
    description: input.description,
    categoria: input.categoria,
    displayOrder: input.displayOrder ?? 99,
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const arenaId = await exigirArenaAtiva();
    const { error } = await supabase.from("landing_page_gallery").insert({
      id: novoItem.id,
      arena_id: arenaId,
      image_url: novoItem.imageUrl,
      title: novoItem.title,
      description: novoItem.description,
      categoria: novoItem.categoria,
      display_order: novoItem.displayOrder,
      is_active: novoItem.isActive,
    });
    lancarSeErro(error, "Falha ao salvar a foto");
    return novoItem;
  }

  setGaleriaLocal([...getGaleriaLocal(), novoItem]);
  return novoItem;
}

/**
 * Atualiza um item da galeria de fotos.
 *
 * @param id Identificador da foto
 * @param input Campos a alterar
 * @returns Foto atualizada, ou null se não encontrada
 * @throws Error se o banco recusar a gravação
 */
export async function atualizarGaleriaItem(
  id: string,
  input: AtualizarGaleriaInput
): Promise<GaleriaItem | null> {
  if (isSupabaseConfigured()) {
    const payload: Record<string, unknown> = {};
    if (input.imageUrl !== undefined) payload.image_url = input.imageUrl;
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.categoria !== undefined) payload.categoria = input.categoria;
    if (input.displayOrder !== undefined) payload.display_order = input.displayOrder;
    if (input.isActive !== undefined) payload.is_active = input.isActive;

    const { data, error } = await supabase
      .from("landing_page_gallery")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    lancarSeErro(error, "Falha ao atualizar a foto");
    return data ? linhaParaGaleriaItem(data as GaleriaDbRow) : null;
  }

  const locais = getGaleriaLocal();
  const index = locais.findIndex((i) => i.id === id);
  if (index === -1) return null;

  const atualizado: GaleriaItem = {
    ...locais[index],
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
    ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };

  locais[index] = atualizado;
  setGaleriaLocal(locais);
  return atualizado;
}

/**
 * Exclui um item da galeria.
 *
 * @param id Identificador da foto
 * @returns true quando removida
 * @throws Error se o banco recusar a exclusão
 */
export async function excluirGaleriaItem(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from("landing_page_gallery").delete().eq("id", id);
    lancarSeErro(error, "Falha ao remover a foto");
    return true;
  }

  setGaleriaLocal(getGaleriaLocal().filter((i) => i.id !== id));
  return true;
}

/**
 * Faz upload de imagem para o bucket `institucional`, numa pasta da arena ativa.
 * Só aceita imagens de até 5 MB. Sem Supabase (offline), devolve uma URL temporária em memória.
 *
 * @param arquivo Arquivo selecionado no input file
 * @param pasta Subpasta interna (ex: "galeria" ou "professores")
 * @returns URL pública gerada, ou mensagem de erro
 *
 * @example
 * ```ts
 * const res = await uploadImagemInstitucional(file, "galeria");
 * if (res.success) setImagem(res.url);
 * ```
 */
export async function uploadImagemInstitucional(
  arquivo: File,
  pasta: "galeria" | "professores" = "galeria"
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!arquivo.type.startsWith("image/")) {
    return { success: false, error: "Envie um arquivo de imagem (JPG, PNG ou WebP)." };
  }
  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM_BYTES) {
    return { success: false, error: "A imagem deve ter no máximo 5 MB." };
  }

  if (!isSupabaseConfigured()) {
    return { success: true, url: URL.createObjectURL(arquivo) };
  }

  try {
    const arenaId = await exigirArenaAtiva();
    const extensao = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
    const nomeArquivo = `${arenaId}/${pasta}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_INSTITUCIONAL)
      .upload(nomeArquivo, arquivo, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      return { success: false, error: `Não foi possível enviar a imagem: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage.from(BUCKET_INSTITUCIONAL).getPublicUrl(nomeArquivo);
    return { success: true, url: urlData.publicUrl };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro no upload da imagem.",
    };
  }
}
