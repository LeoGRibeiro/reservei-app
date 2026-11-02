"use client";

import { AdminInstitucionalPage } from "@/components/admin/AdminInstitucionalPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";

export default function PaginaSite() {
  return (
    <LegadoEscuro>
      <AdminInstitucionalPage />
    </LegadoEscuro>
  );
}
