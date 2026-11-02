"use client";

import { AdminEscolinhasPage } from "@/components/admin/AdminEscolinhasPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";

export default function PaginaEscolinhas() {
  return (
    <LegadoEscuro>
      <AdminEscolinhasPage />
    </LegadoEscuro>
  );
}
