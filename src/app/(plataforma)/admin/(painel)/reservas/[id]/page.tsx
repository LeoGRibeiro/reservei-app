"use client";

import { use } from "react";
import { DetalheReserva } from "@/components/admin/reservas/DetalheReserva";

/** Detalhe de uma reserva: pagamento, ações do balcão e histórico. */
export default function PaginaReserva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DetalheReserva reservaId={id} />;
}
