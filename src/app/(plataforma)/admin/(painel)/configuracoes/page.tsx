"use client";

import { AdminConfiguracoesPage } from "@/components/admin/AdminConfiguracoesPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";

export default function PaginaConfiguracoes() {
  return (
    <LegadoEscuro>
      <AdminConfiguracoesPage />
    </LegadoEscuro>
  );
}
