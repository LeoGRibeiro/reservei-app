/**
 * @file not-found.tsx
 * @description Página 404 global: subdomínio de arena inexistente/inativa ou rota desconhecida.
 */

import Link from "next/link";
import { DOMINIO_RAIZ_PADRAO } from "@/lib/arena/subdomain";
import { NOME_PRODUTO } from "@/lib/marca";

export default function NaoEncontrado() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <p className="text-5xl" aria-hidden>
          🏟️
        </p>
        <h1 className="text-2xl font-black">Arena não encontrada</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          O endereço acessado não corresponde a nenhuma arena ativa no {NOME_PRODUTO}. Confira o link enviado
          pela arena ou fale com ela pelo WhatsApp.
        </p>
        <Link
          href={`https://${DOMINIO_RAIZ_PADRAO}`}
          className="inline-block px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm"
        >
          Conhecer o {NOME_PRODUTO}
        </Link>
      </div>
    </main>
  );
}
