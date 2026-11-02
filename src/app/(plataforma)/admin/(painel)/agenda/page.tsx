"use client";

import { Suspense } from "react";
import { PaginaAgenda } from "@/components/admin/agenda/PaginaAgenda";
import { Carregando } from "@/components/admin/ui";

/** Agenda: dia por quadra e mês. */
export default function Agenda() {
  return (
    <Suspense fallback={<Carregando />}>
      <PaginaAgenda />
    </Suspense>
  );
}
