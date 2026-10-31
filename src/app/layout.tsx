/**
 * @file layout.tsx
 * @description Layout raiz: só `<html>` e `<body>`. Cada grupo de rotas carrega o próprio CSS:
 * - `(plataforma)`: painel, super-admin, página comercial e páginas legais (Tailwind + sonner);
 * - `(portal)`: site público da arena (CSS próprio, portado do protótipo, sem Tailwind).
 * Assim o preflight do Tailwind não altera o portal, e o CSS do portal não vaza para o painel.
 */

import { NOME_PRODUTO } from "@/lib/marca";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${NOME_PRODUTO} · Reservas de quadras`,
  description: "Plataforma de gestão e agendamento de quadras esportivas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-950 text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
