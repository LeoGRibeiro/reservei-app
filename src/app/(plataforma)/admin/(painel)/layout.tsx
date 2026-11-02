/**
 * @file layout.tsx
 * @description Layout das telas do painel (`/admin`, `/admin/agenda`, ...): sessão, nome da arena no
 * topo e menu agrupado. Montado só no navegador (a sessão do Supabase vive no navegador).
 */

"use client";

import dynamic from "next/dynamic";

const PainelAdmin = dynamic(() => import("@/components/admin/painel/PainelAdmin").then((m) => m.PainelAdmin), {
  ssr: false,
  loading: () => <div className="painel min-h-screen" />,
});

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  return <PainelAdmin>{children}</PainelAdmin>;
}
