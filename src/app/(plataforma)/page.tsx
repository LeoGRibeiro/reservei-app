/**
 * @file page.tsx
 * @description Página raiz da aplicação.
 * - Subdomínio de arena (cabeçalho 'x-arena-slug' do proxy): portal da arena.
 * - Domínio raiz da plataforma configurado (NEXT_PUBLIC_ROOT_DOMAIN): página comercial do produto.
 * - Hosts sem domínio próprio (ex.: projeto.vercel.app): portal da arena raiz (NEXT_PUBLIC_ARENA_RAIZ_SLUG).
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { PortalCliente } from "@/components/portal/PortalCliente";
import { PaginaComercial } from "@/components/comercial/PaginaComercial";
import { ArenaRepository } from "@/lib/arena/arenaRepository";
import { hostEhDominioRaiz, SLUG_ARENA_RAIZ } from "@/lib/arena/subdomain";
import { NOME_PRODUTO, SLOGAN_PRODUTO } from "@/lib/marca";

export const dynamic = "force-dynamic";

/** O host é o domínio próprio da plataforma (e não localhost nem *.vercel.app). */
async function ehDominioDaPlataforma(): Promise<boolean> {
  const host = (await headers()).get("host");
  return Boolean(process.env.NEXT_PUBLIC_ROOT_DOMAIN) && hostEhDominioRaiz(host) && !host?.startsWith("localhost");
}

/** Slug da arena atendida nesta requisição. */
async function slugDaRequisicao(): Promise<string> {
  return (await headers()).get("x-arena-slug") || SLUG_ARENA_RAIZ;
}

/**
 * Metadados contextuais: da arena (com `noindex` em demonstrações) ou da plataforma.
 */
export async function generateMetadata(): Promise<Metadata> {
  if (await ehDominioDaPlataforma()) {
    return { title: `${NOME_PRODUTO} · ${SLOGAN_PRODUTO}` };
  }

  const arena = await ArenaRepository.buscarPorSlug(await slugDaRequisicao()).catch(() => null);
  if (arena) {
    return {
      title: `${arena.nome} · Agendamento de Quadras Online`,
      description: `Agende sua quadra na ${arena.nome} (${arena.cidade} - ${arena.estado}). Horários em tempo real e confirmação rápida.`,
      // Demonstrações não devem aparecer em buscadores como se fossem o canal oficial da arena
      robots: arena.modoPagamento === "simulado" ? { index: false, follow: false } : undefined,
    };
  }

  return { title: `${NOME_PRODUTO} · ${SLOGAN_PRODUTO}` };
}

export default async function Home() {
  if (await ehDominioDaPlataforma()) return <PaginaComercial />;

  const slugSubdominio = (await headers()).get("x-arena-slug") || undefined;
  return <PortalCliente arenaSlug={slugSubdominio} />;
}
