/**
 * @file page.tsx
 * @description Portal de uma arena pelo slug (o proxy reescreve a home do subdomínio para cá).
 * Slug inexistente ou arena inativa responde 404 (nunca mostra outra arena).
 */

import type { Metadata, Viewport } from "next";
import { PortalArena } from "@/components/portal-arena/PortalArena";
import { arenaNaoEncontrada, dadosDoPortal, metadadosDaArena, viewportDaArena } from "@/lib/portal/paginaPortal";

export const dynamic = "force-dynamic";

interface PaginaArenaProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PaginaArenaProps): Promise<Metadata> {
  return metadadosDaArena(await dadosDoPortal((await params).slug));
}

export async function generateViewport({ params }: PaginaArenaProps): Promise<Viewport> {
  return viewportDaArena(await dadosDoPortal((await params).slug));
}

export default async function PaginaArena({ params }: PaginaArenaProps) {
  const { slug } = await params;
  const dados = await dadosDoPortal(slug);
  if (!dados) return arenaNaoEncontrada(slug);
  return <PortalArena dados={dados} />;
}
