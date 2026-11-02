"use client";

import { AdminFinanceiroPage } from "@/components/admin/AdminFinanceiroPage";
import { LegadoEscuro } from "@/components/admin/painel/LegadoEscuro";

export default function PaginaFinanceiro() {
  return (
    <LegadoEscuro>
      <AdminFinanceiroPage />
    </LegadoEscuro>
  );
}
