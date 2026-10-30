/**
 * @file page.tsx
 * @description Página comercial do produto para donos de arenas.
 */

import type { Metadata } from "next";
import { PaginaComercial } from "@/components/comercial/PaginaComercial";
import { NOME_PRODUTO, SLOGAN_PRODUTO } from "@/lib/marca";

export const metadata: Metadata = {
  title: `${NOME_PRODUTO} · ${SLOGAN_PRODUTO}`,
  description:
    "Site de reservas com a marca da arena, Pix do sinal direto na conta da arena, agenda do balcão, mensalistas e financeiro.",
};

export default function ParaArenasPage() {
  return <PaginaComercial />;
}
