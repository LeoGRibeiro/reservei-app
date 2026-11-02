import { permanentRedirect } from "next/navigation";

/** Endereço antigo do detalhe da reserva. */
export default async function PaginaReservaAntiga({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(`/admin/reservas/${encodeURIComponent(id)}`);
}
