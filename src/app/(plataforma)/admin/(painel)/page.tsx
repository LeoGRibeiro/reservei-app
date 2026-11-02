"use client";

import { AdminDashboardPage } from "@/components/admin/AdminDashboardPage";
import { PainelPagamentosAConfirmar } from "@/components/admin/PainelPagamentosAConfirmar";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

/** Hoje: o que acontece na arena agora. */
export default function PaginaHoje() {
  const { arenaSlug, pode } = usePainel();
  return (
    <LegadoEscuro>
      <PainelPagamentosAConfirmar arenaSlug={arenaSlug} />
      <AdminDashboardPage exibirReceita={pode("ver_receita")} />
    </LegadoEscuro>
  );
}
