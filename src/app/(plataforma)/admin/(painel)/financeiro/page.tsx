"use client";

import { Suspense } from "react";
import { PaginaFinanceiro } from "@/components/admin/financeiro/PaginaFinanceiro";
import { Carregando } from "@/components/admin/ui";

/** Financeiro: números do mês calculados no banco e lista de reservas. */
export default function Financeiro() {
  return (
    <Suspense fallback={<Carregando />}>
      <PaginaFinanceiro />
    </Suspense>
  );
}
