/**
 * @module institucional/institucionalHelpers
 *
 * Funções puras de filtro e validação da galeria de fotos da estrutura.
 * As regras das escolinhas do site ficam em `./escolinhasSite`.
 */

import type { GaleriaItem, FiltroCategoriaGaleria, CriarGaleriaInput } from "./types";

/**
 * Filtra e ordena itens da galeria de fotos.
 *
 * @param itens Lista de fotos da galeria
 * @param filtro Categoria selecionada ("todas", "quadras", "bar", etc.)
 * @param apenasAtivos Se true, omite fotos inativas (para exibição pública)
 */
export function filtrarGaleria(
  itens: readonly GaleriaItem[],
  filtro: FiltroCategoriaGaleria = "todas",
  apenasAtivos = true
): GaleriaItem[] {
  return itens
    .filter((item) => (apenasAtivos ? item.isActive : true))
    .filter((item) => (filtro === "todas" ? true : item.categoria === filtro))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Valida os campos obrigatórios para cadastro ou edição de foto na galeria.
 */
export function validarItemGaleria(input: CriarGaleriaInput): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  if (!input.title || input.title.trim().length < 3) {
    erros.push("O título do espaço deve ter pelo menos 3 caracteres.");
  }
  if (!input.description || input.description.trim().length < 5) {
    erros.push("A descrição deve conter no mínimo 5 caracteres.");
  }
  if (!input.imageUrl || !input.imageUrl.trim().startsWith("http")) {
    erros.push("Informe uma URL de imagem válida (começando com http/https).");
  }
  if (!["quadras", "bar", "vestiarios", "lazer"].includes(input.categoria)) {
    erros.push("Selecione uma categoria válida para o ambiente.");
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}
