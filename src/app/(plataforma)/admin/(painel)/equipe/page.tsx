"use client";

import { AdminEquipePage } from "@/components/admin/AdminEquipePage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

export default function PaginaEquipe() {
  const { arenaSlug, user } = usePainel();
  return (
    <LegadoEscuro>
      <AdminEquipePage arenaSlug={arenaSlug} usuarioId={user?.id ?? null} />
    </LegadoEscuro>
  );
}
