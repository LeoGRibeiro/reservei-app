"use client";

import { AdminEquipePage } from "@/components/admin/AdminEquipePage";
import { usePainel } from "@/components/admin/painel/ContextoPainel";

export default function PaginaEquipe() {
  const { arenaSlug, user } = usePainel();
  return (
    <AdminEquipePage arenaSlug={arenaSlug} usuarioId={user?.id ?? null} />
  );
}
