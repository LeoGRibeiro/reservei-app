import { NOME_PRODUTO } from "@/lib/marca";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

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
      </body>
    </html>
  );
}
