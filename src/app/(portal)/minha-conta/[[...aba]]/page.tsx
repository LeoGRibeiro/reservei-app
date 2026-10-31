/**
 * @file page.tsx
 * @description Minha conta do atleta, com endereço próprio por aba: `/minha-conta` (Reservas),
 * `/minha-conta/clube` e `/minha-conta/dados`. É o mesmo portal da arena, aberto na visão da conta.
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PortalArena } from "@/components/portal-arena/PortalArena";
import type { AbaConta } from "@/components/portal-arena/conta/AreaAtleta";
import { dadosDoPortal, metadadosDaArena, slugDaRequisicao, viewportDaArena } from "@/lib/portal/paginaPortal";

export const dynamic = "force-dynamic";

interface PaginaContaProps {
  params: Promise<{ aba?: string[] }>;
}

const ABAS: AbaConta[] = ["reservas", "clube", "dados"];

export async function generateMetadata(): Promise<Metadata> {
  const dados = await dadosDoPortal(await slugDaRequisicao());
  return { ...metadadosDaArena(dados, dados ? `Minha conta · ${dados.arena.nome}` : undefined), robots: { index: false, follow: false } };
}

export async function generateViewport(): Promise<Viewport> {
  return viewportDaArena(await dadosDoPortal(await slugDaRequisicao()));
}

export default async function MinhaConta({ params }: PaginaContaProps) {
  const dados = await dadosDoPortal(await slugDaRequisicao());
  if (!dados) notFound();
  const pedida = (await params).aba?.[0] as AbaConta | undefined;
  const aba = pedida && ABAS.includes(pedida) ? pedida : "reservas";
  return <PortalArena dados={dados} visaoInicial="conta" abaInicial={aba} />;
}
