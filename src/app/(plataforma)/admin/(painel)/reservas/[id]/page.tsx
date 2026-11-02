"use client";

import { use } from "react";
import { AdminReservaDetalhes } from "@/components/admin/AdminReservaDetalhes";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";

export default function PaginaReserva({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <LegadoEscuro>
      <AdminReservaDetalhes reservaId={id} />
    </LegadoEscuro>
  );
}
