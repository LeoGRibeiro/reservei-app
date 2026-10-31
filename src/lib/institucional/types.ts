/**
 * @module institucional/types
 *
 * Entidades e contratos de dados para o módulo institucional da Landing Page
 * e sua gestão no Painel Administrativo.
 *
 * Cobre a estrutura física do complexo (galeria de fotos) e as escolinhas
 * esportivas contínuas, conforme definido em SPEC/2026-10-06-lp-conteudo-institucional.md.
 */

/** Categorias possíveis para itens da galeria de fotos do complexo. */
export type CategoriaEstrutura = "quadras" | "bar" | "vestiarios" | "lazer";

/** Filtros de visualização para a galeria pública. */
export type FiltroCategoriaGaleria = "todas" | CategoriaEstrutura;

/**
 * Item de foto da estrutura física exibido na Landing Page.
 * Sincronizado com a tabela `landing_page_gallery` do Supabase.
 */
export interface GaleriaItem {
  /** Identificador único do item (ex: "gal_01") */
  id: string;
  /** URL pública da imagem (Supabase Storage, CDN ou imagem demonstrativa) */
  imageUrl: string;
  /** Título do espaço (ex: "Nossas Quadras de Saibro") */
  title: string;
  /** Descrição detalhada dos diferenciais do espaço */
  description: string;
  /** Categoria do ambiente para filtragem por abas */
  categoria: CategoriaEstrutura;
  /** Ordem numérica de exibição na galeria (menor primeiro) */
  displayOrder: number;
  /** Se o item está visível para os visitantes da Landing Page */
  isActive: boolean;
  /** Data/hora de cadastro em ISO 8601 */
  createdAt?: string;
}

/** Dados necessários para cadastrar um novo item na galeria. */
export interface CriarGaleriaInput {
  imageUrl: string;
  title: string;
  description: string;
  categoria: CategoriaEstrutura;
  displayOrder?: number;
  isActive?: boolean;
}

/** Dados para atualização parcial de um item da galeria. */
export interface AtualizarGaleriaInput {
  imageUrl?: string;
  title?: string;
  description?: string;
  categoria?: CategoriaEstrutura;
  displayOrder?: number;
  isActive?: boolean;
}
