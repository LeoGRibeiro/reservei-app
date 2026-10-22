/**
 * @file page.tsx
 * @description Página raiz da aplicação. Detecta se a requisição originou de um subdomínio
 * (via cabeçalho 'x-arena-slug' injetado pelo middleware) ou do domínio central padrão.
 */

import { NOME_PRODUTO, SLOGAN_PRODUTO } from "@/lib/marca";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PortalCliente } from "@/components/portal/PortalCliente";
import { ArenaRepository } from "@/lib/arena/arenaRepository";

export const dynamic = "force-dynamic";

/**
 * Metadados contextuais baseados no subdomínio da requisição.
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const slugSubdominio = headersList.get("x-arena-slug");

  if (slugSubdominio) {
    const arena = await ArenaRepository.buscarPorSlug(slugSubdominio);
    if (arena) {
      return {
        title: `${arena.nome} · Agendamento de Quadras Online`,
        description: `Agende sua quadra esportiva na ${arena.nome} (${arena.cidade} - ${arena.estado}). Horários em tempo real e confirmação rápida.`,
      };
    }
  }

  return {
    title: `${NOME_PRODUTO} · ${SLOGAN_PRODUTO}`,
    description:
      "Agende sua quadra esportiva online de forma rápida e segura. Beach Tennis, Futsal, Society, Vôlei e mais.",
  };
}

/**
 * Componente da página inicial.
 */
export default async function Home() {
  const headersList = await headers();
  const slugSubdominio = headersList.get("x-arena-slug") || undefined;

  return <PortalCliente arenaSlug={slugSubdominio} />;
}
