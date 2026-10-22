/**
 * @file page.tsx
 * @description Destino do link de redefinição de senha enviado por e-mail (dono e equipe). O Supabase abre
 * uma sessão de recuperação a partir do link; com ela, a pessoa define a nova senha e entra no painel.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { sairAdministrador } from "@/lib/supabase/adminAuthService";
import { AdminTrocaSenhaObrigatoria } from "@/components/admin/AdminTrocaSenhaObrigatoria";

/** Tempo máximo esperando o Supabase processar o link antes de considerá-lo inválido. */
const ESPERA_SESSAO_MS = 4000;

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"verificando" | "pronto" | "invalido">("verificando");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ambiente sem Supabase: nada a verificar
      setEstado("invalido");
      return;
    }

    let ativo = true;
    const marcarPronto = () => ativo && setEstado("pronto");

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY" || sessao) marcarPronto();
    });
    supabase.auth.getSession().then(({ data: atual }) => {
      if (atual.session) marcarPronto();
    });
    const limite = setTimeout(() => {
      if (ativo) setEstado((e) => (e === "verificando" ? "invalido" : e));
    }, ESPERA_SESSAO_MS);

    return () => {
      ativo = false;
      clearTimeout(limite);
      data.subscription.unsubscribe();
    };
  }, []);

  if (estado === "verificando") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (estado === "invalido") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-black text-white">Link inválido ou expirado</h1>
          <p className="text-sm text-slate-400">
            Peça um novo link em “Esqueci minha senha” na tela de login. Os links valem por pouco tempo e só podem ser
            usados uma vez.
          </p>
          <button
            onClick={() => router.replace("/admin")}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold"
          >
            Ir para o login
          </button>
        </div>
      </main>
    );
  }

  return (
    <AdminTrocaSenhaObrigatoria
      descricao="Defina a nova senha de acesso ao painel."
      onConcluido={() => router.replace("/admin/dashboard")}
      onSair={async () => {
        await sairAdministrador();
        router.replace("/admin");
      }}
    />
  );
}
