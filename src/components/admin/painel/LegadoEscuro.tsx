/**
 * @file LegadoEscuro.tsx
 * @description Moldura TEMPORÁRIA das telas antigas (tema escuro) dentro do painel novo (tema claro),
 * para continuarem legíveis até serem redesenhadas no Plano F. Remover junto com a última tela antiga.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano F)
 */

"use client";

import type { ReactNode } from "react";

export function LegadoEscuro({ children }: { children: ReactNode }) {
  return <div className="dark rounded-lg bg-slate-950 p-4 text-slate-100 sm:p-6 [color-scheme:dark] space-y-6">{children}</div>;
}
