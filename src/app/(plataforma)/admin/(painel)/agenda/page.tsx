"use client";

import { AdminAgendaPage } from "@/components/admin/AdminAgendaPage";
import { PainelPagamentosAConfirmar } from "@/components/admin/PainelPagamentosAConfirmar";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

export default function PaginaAgenda() {
  const { arenaSlug } = usePainel();
  return (
    <LegadoEscuro>
      <PainelPagamentosAConfirmar arenaSlug={arenaSlug} />
      <AdminAgendaPage />
    </LegadoEscuro>
  );
}
