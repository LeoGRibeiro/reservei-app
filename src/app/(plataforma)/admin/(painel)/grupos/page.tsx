"use client";

import { AdminGruposPage } from "@/components/admin/AdminGruposPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";

export default function PaginaGrupos() {
  return (
    <LegadoEscuro>
      <AdminGruposPage />
    </LegadoEscuro>
  );
}
