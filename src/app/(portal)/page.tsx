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

interface PaginaInicialProps {
  searchParams: Promise<{ conta?: string }>;
}

export default async function PaginaInicial({ searchParams }: PaginaInicialProps) {
  const dados = await dadosDoPortal(await slugDaRequisicao());
  if (!dados) notFound();
  // /login e /cadastro redirecionam para cá com o diálogo de conta aberto
  const conta = (await searchParams).conta;
  return <PortalArena dados={dados} contaInicial={conta === "entrar" || conta === "criar" ? conta : undefined} />;
}
