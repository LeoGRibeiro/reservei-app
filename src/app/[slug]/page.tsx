/**
 * @file page.tsx
 * @description Rota dinâmica multi-tenant para renderizar o portal de reservas
 * de uma arena específica a partir do slug (ou subdomínio reescrito pelo middleware).
 * Ex: 'arena-belem.reservei.com' -> '/arena-belem'
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalCliente } from "@/components/portal/PortalCliente";
import { ArenaRepository } from "@/lib/arena/arenaRepository";

interface ArenaPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Geração dinâmica de metadados SEO específicos para a arena acessada.
 */
export async function generateMetadata({
  params,
}: ArenaPageProps): Promise<Metadata> {
  const { slug } = await params;
  const arena = await ArenaRepository.buscarPorSlug(slug);

  if (!arena) {
    return {
      title: "Arena não encontrada · Reservei",
      description: "O complexo esportivo solicitado não foi localizado na plataforma.",
    };
  }

  return {
    title: `${arena.nome} · Agendamento de Quadras Online`,
    description: `Agende quadras de Beach Tennis, Society, Futsal ou Vôlei na ${arena.nome} em ${arena.cidade} - ${arena.estado}. Horários em tempo real e confirmação instantânea via Pix.`,
  };
}

export const dynamic = "force-dynamic";

/**
 * Página dinâmica da Arena. Slug inexistente ou arena inativa responde 404 (nunca exibe outra arena).
 */
export default async function ArenaPage({ params }: ArenaPageProps) {
  const { slug } = await params;
  const arena = await ArenaRepository.buscarPorSlug(slug);
  if (!arena) notFound();
  return <PortalCliente arenaSlug={slug} />;
}
