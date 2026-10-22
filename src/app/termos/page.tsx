/**
 * @file page.tsx
 * @description Termos de Uso do portal de reservas da arena.
 */

import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/legal/DocumentoLegal";
import { obterArenaDoDocumento } from "@/lib/legal/arenaDoDocumento";
import { montarTermosDeUso } from "@/lib/legal/termos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Termos de Uso" };

export default async function TermosPage() {
  const arena = await obterArenaDoDocumento();
  return <DocumentoLegal titulo="Termos de Uso" nomeArena={arena.nome} secoes={montarTermosDeUso(arena)} />;
}
