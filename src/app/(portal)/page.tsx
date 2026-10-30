/**
 * @file page.tsx
 * @description Raiz do site: portal da arena do subdomínio (ou da arena raiz em hosts sem
 * subdomínio, como `projeto.vercel.app`). No domínio da plataforma, o proxy mostra a página comercial.
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PortalArena } from "@/components/portal-arena/PortalArena";
import { dadosDoPortal, metadadosDaArena, slugDaRequisicao, viewportDaArena } from "@/lib/portal/paginaPortal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return metadadosDaArena(await dadosDoPortal(await slugDaRequisicao()));
}

export async function generateViewport(): Promise<Viewport> {
  return viewportDaArena(await dadosDoPortal(await slugDaRequisicao()));
}

export default async function PaginaInicial() {
  const dados = await dadosDoPortal(await slugDaRequisicao());
  if (!dados) notFound();
  return <PortalArena dados={dados} />;
}
