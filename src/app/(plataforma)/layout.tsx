/**
 * @file layout.tsx
 * @description Layout das páginas da plataforma (painel, super-admin, página comercial e páginas
 * legais): carrega o Tailwind (`globals.css`) e os avisos do `sonner`.
 *
 * Links destas páginas para o portal da arena devem ser `<a>` comuns (recarga completa): na navegação
 * do lado do cliente o CSS já carregado continua na página, e o preflight do Tailwind alteraria o portal.
 */

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export default function LayoutPlataforma({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "bg-slate-800 border border-slate-700 text-white",
            title: "text-white font-semibold",
            description: "text-slate-400",
            success: "!border-emerald-500/50",
            error: "!border-red-500/50",
          },
        }}
      />
    </>
  );
}
