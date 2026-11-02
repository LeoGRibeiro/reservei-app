"use client";

import { AdminPagamentosPage } from "@/components/admin/AdminPagamentosPage";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

export default function PaginaRecebimento() {
  const { arenaSlug } = usePainel();
  return (
    <AdminPagamentosPage arenaSlug={arenaSlug} />
  );
}
