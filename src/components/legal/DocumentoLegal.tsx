/**
 * @file DocumentoLegal.tsx
 * @description Layout dos documentos legais (Termos de Uso e Política de Privacidade) do portal da arena.
 */

import Link from "next/link";
import type { SecaoLegal } from "@/lib/legal/termos";
import { VERSAO_TERMOS } from "@/lib/legal/termos";

interface Props {
  titulo: string;
  nomeArena: string;
  secoes: SecaoLegal[];
}

export function DocumentoLegal({ titulo, nomeArena, secoes }: Props) {
  const versao = VERSAO_TERMOS.split("-").reverse().join("/");
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 px-4 py-10">
      <article className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <Link href="/" className="text-xs text-emerald-400 hover:text-emerald-300">
            ← Voltar para as reservas
          </Link>
          <h1 className="text-2xl font-black text-white">{titulo}</h1>
          <p className="text-xs text-slate-500">
            {nomeArena} · versão de {versao}
          </p>
        </header>
        {secoes.map((secao) => (
          <section key={secao.titulo} className="space-y-2">
            <h2 className="text-base font-bold text-white">{secao.titulo}</h2>
            {secao.paragrafos.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-slate-300">
                {p}
              </p>
            ))}
          </section>
        ))}
        <footer className="pt-4 border-t border-slate-800 text-xs text-slate-500 flex gap-4">
          <Link href="/termos" className="hover:text-slate-300">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:text-slate-300">
            Política de Privacidade
          </Link>
        </footer>
      </article>
    </main>
  );
}
