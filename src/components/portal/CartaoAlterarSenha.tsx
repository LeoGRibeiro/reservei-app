/**
 * @file CartaoAlterarSenha.tsx
 * @description Troca de senha do atleta na Minha Conta. Aparece aberto e em destaque quando o atleta entrou
 * com uma senha temporária gerada pela arena; nos demais casos fica recolhido num link discreto.
 */

"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { validarSenhaForte } from "@/lib/constants";
import { definirSenhaDefinitiva, precisaTrocarSenha } from "@/lib/supabase/adminAuthService";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const CLASSE_INPUT =
  "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500";

export function CartaoAlterarSenha() {
  const [obrigatoria, setObrigatoria] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let ativo = true;
    precisaTrocarSenha().then((precisa) => {
      if (ativo && precisa) {
        setObrigatoria(true);
        setAberto(true);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (!isSupabaseConfigured()) return null;

  if (!aberto) {
    return (
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setAberto(true)}
          className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-1"
        >
          <KeyRound className="w-3.5 h-3.5" /> Alterar senha
        </button>
      </div>
    );
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const validacao = validarSenhaForte(senha);
    if (!validacao.valido) {
      toast.error(validacao.erros[0]);
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    const erro = await definirSenhaDefinitiva(senha);
    setSalvando(false);
    if (erro) {
      toast.error(erro);
      return;
    }
    toast.success("Senha alterada.");
    setObrigatoria(false);
    setAberto(false);
    setSenha("");
    setConfirmacao("");
  };

  return (
    <form
      onSubmit={handleSalvar}
      className={`mb-6 rounded-2xl p-5 space-y-3 border ${
        obrigatoria ? "bg-amber-500/5 border-amber-500/30" : "bg-slate-900 border-slate-800"
      }`}
    >
      <h2 className="text-sm font-bold text-white flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-emerald-400" />
        {obrigatoria ? "Crie uma nova senha" : "Alterar senha"}
      </h2>
      {obrigatoria && (
        <p className="text-xs text-amber-200">
          Você entrou com uma senha temporária enviada pela arena. Crie uma senha só sua para continuar seguro.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="password"
          aria-label="Nova senha"
          placeholder="Nova senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={CLASSE_INPUT}
        />
        <input
          type="password"
          aria-label="Confirme a nova senha"
          placeholder="Confirme a nova senha"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className={CLASSE_INPUT}
        />
      </div>
      <p className="text-[11px] text-slate-500">Mínimo de 6 caracteres, com uma letra maiúscula e um caractere especial.</p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
        >
          {salvando ? "Salvando..." : "Salvar nova senha"}
        </button>
        {!obrigatoria && (
          <button type="button" onClick={() => setAberto(false)} className="px-4 py-2 text-sm text-slate-400">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
