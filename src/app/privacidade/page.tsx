/**
 * @file page.tsx
 * @description Política de Privacidade (LGPD) do portal de reservas da arena.
 */

import type { Metadata } from "next";
import { DocumentoLegal } from "@/components/legal/DocumentoLegal";
import { obterArenaDoDocumento } from "@/lib/legal/arenaDoDocumento";
import { montarPoliticaPrivacidade } from "@/lib/legal/termos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default async function PrivacidadePage() {
  const arena = await obterArenaDoDocumento();
  return (
    <DocumentoLegal titulo="Política de Privacidade" nomeArena={arena.nome} secoes={montarPoliticaPrivacidade(arena)} />
  );
}
