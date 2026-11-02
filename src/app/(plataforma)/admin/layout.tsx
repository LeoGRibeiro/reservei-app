import { NOME_PRODUTO } from "@/lib/marca";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { arenaNaoEncontrada } from "@/lib/portal/paginaPortal";
import { ArenaRepository } from "@/lib/arena/arenaRepository";

export const metadata: Metadata = {
  title: `${NOME_PRODUTO} · Admin`,
  description: "Painel administrativo do Complexo Esportivo.",
};

/**
 * Layout do painel administrativo. Em subdomínio de arena inexistente ou inativa, responde 404 em vez
 * de abrir o login de outra arena; no endereço antigo de uma arena que trocou de subdomínio, redireciona.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const slug = (await headers()).get("x-arena-slug");
  if (slug && !(await ArenaRepository.buscarPorSlug(slug))) await arenaNaoEncontrada(slug, "/admin");
  return <>{children}</>;
}
