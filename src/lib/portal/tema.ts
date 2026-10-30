/**
 * @file tema.ts
 * @description Cores do portal por arena (`arenas.tema`). São 7 cores com nome de papel; as demais
 * (texto, linhas, vermelho, verde de "pago") são fixas no template (`portal-arena.css`).
 *
 * SPEC/2026-10-30-implementacao-template-portal.md §2.
 */

import type { CSSProperties } from "react";

/** As 7 cores de marca de uma arena. */
export interface TemaArena {
  /** Cor principal (topo, botões azuis, canhotos) */
  marca: string;
  /** Marca mais escura (hover, rodapé, menu do celular) */
  marcaEscura: string;
  /** Marca bem clara (fundos de seleção e de aula) */
  marcaClara: string;
  /** Cor de destaque (botão principal, horário selecionado) */
  destaque: string;
  /** Destaque no hover */
  destaqueHover: string;
  /** Fundo suave das seções e cartões */
  fundoSuave: string;
  /** Cor do "papel" dos tickets e diálogos */
  papel: string;
}

/** Tema neutro do template, usado quando a arena ainda não tem tema ou ele é inválido. */
export const TEMA_NEUTRO: TemaArena = {
  marca: "#26313f",
  marcaEscura: "#18202a",
  marcaClara: "#e6e9ee",
  destaque: "#f0b429",
  destaqueHover: "#dc9f12",
  fundoSuave: "#f3f2ee",
  papel: "#fffefb",
};

/** Nome da variável CSS de cada cor (ver `portal-arena.css`). */
export const VARIAVEIS_TEMA: Record<keyof TemaArena, string> = {
  marca: "--pa-marca",
  marcaEscura: "--pa-marca-escura",
  marcaClara: "--pa-marca-clara",
  destaque: "--pa-destaque",
  destaqueHover: "--pa-destaque-hover",
  fundoSuave: "--pa-fundo-suave",
  papel: "--pa-papel",
};

/** Chaves aceitas no JSON do banco (snake_case) para cada cor. */
const CHAVES_BANCO: Record<keyof TemaArena, string> = {
  marca: "marca",
  marcaEscura: "marca_escura",
  marcaClara: "marca_clara",
  destaque: "destaque",
  destaqueHover: "destaque_hover",
  fundoSuave: "fundo_suave",
  papel: "papel",
};

const COR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Converte o `arenas.tema` (jsonb) num tema completo. Cores ausentes ou inválidas (qualquer coisa que
 * não seja `#rgb`/`#rrggbb`) caem no tema neutro: o valor vai para um atributo `style`, então nada
 * além de uma cor hexadecimal é aceito.
 *
 * @param bruto Valor da coluna (objeto, string JSON ou nulo)
 * @returns Tema pronto para {@link variaveisDoTema}
 *
 * @example
 * ```ts
 * normalizarTema({ marca: "#1e2d6b", destaque: "#f4b41a" }).marca; // "#1e2d6b"
 * normalizarTema({ marca: "red;background:url(x)" }).marca; // TEMA_NEUTRO.marca
 * ```
 */
export function normalizarTema(bruto: unknown): TemaArena {
  let obj: Record<string, unknown> = {};
  if (typeof bruto === "string") {
    try {
      const parsed: unknown = JSON.parse(bruto);
      if (parsed && typeof parsed === "object") obj = parsed as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (bruto && typeof bruto === "object") {
    obj = bruto as Record<string, unknown>;
  }

  const tema = { ...TEMA_NEUTRO };
  for (const chave of Object.keys(TEMA_NEUTRO) as (keyof TemaArena)[]) {
    const valor = obj[chave] ?? obj[CHAVES_BANCO[chave]];
    if (typeof valor === "string" && COR_HEX.test(valor.trim())) tema[chave] = valor.trim().toLowerCase();
  }
  return tema;
}

/**
 * Variáveis CSS do tema para o `style` da raiz `.pa`.
 *
 * @param tema Tema normalizado
 * @returns Objeto de estilo com as 7 variáveis `--pa-*`
 *
 * @example
 * ```tsx
 * <div className="pa" style={variaveisDoTema(tema)}>...</div>
 * ```
 */
export function variaveisDoTema(tema: TemaArena): CSSProperties {
  const estilo: Record<string, string> = {};
  for (const chave of Object.keys(VARIAVEIS_TEMA) as (keyof TemaArena)[]) {
    estilo[VARIAVEIS_TEMA[chave]] = tema[chave];
  }
  return estilo as CSSProperties;
}
