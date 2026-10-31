/**
 * @file fonte.ts
 * @description Fonte do portal: Archivo variável (eixos wdth 62–125 e wght 100–900), igual ao
 * protótipo, servida pelo próprio Next (`next/font`) em vez do CSS do Google Fonts.
 */

import { Archivo } from "next/font/google";

/** Archivo com a variável CSS `--font-archivo` (usada por `--font` em `portal-arena.css`). */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
