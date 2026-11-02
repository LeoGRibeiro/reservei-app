"use client";

import { AdminPagamentosPage } from "@/components/admin/AdminPagamentosPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

export default function PaginaRecebimento() {
  const { arenaSlug } = usePainel();
  return (
    <LegadoEscuro>
      <AdminPagamentosPage arenaSlug={arenaSlug} />
    </LegadoEscuro>
  );
}
