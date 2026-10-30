/**
 * @file page.tsx
 * @description Regras e dúvidas da arena do subdomínio (regras, cancelamento e chuva, perguntas frequentes).
 */

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { PaginaRegras } from "@/components/portal-arena/regras/PaginaRegras";
import { hojeNoFusoArena } from "@/lib/portal/agenda";
import { dadosDoPortal, metadadosDaArena, slugDaRequisicao, viewportDaArena } from "@/lib/portal/paginaPortal";
import { FUSO_PADRAO_ARENA } from "@/lib/datas/fusoHorario";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const dados = await dadosDoPortal(await slugDaRequisicao());
  return metadadosDaArena(dados, dados ? `Regras e dúvidas · ${dados.arena.nome}` : undefined);
}

export async function generateViewport(): Promise<Viewport> {
  return viewportDaArena(await dadosDoPortal(await slugDaRequisicao()));
}

export default async function Regras() {
  const dados = await dadosDoPortal(await slugDaRequisicao());
  if (!dados) notFound();
  return <PaginaRegras dados={dados} ano={Number(hojeNoFusoArena(new Date(), FUSO_PADRAO_ARENA).slice(0, 4))} />;
}
