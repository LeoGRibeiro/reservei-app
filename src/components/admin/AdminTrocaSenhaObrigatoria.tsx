/**
 * @file AdminTrocaSenhaObrigatoria.tsx
 * @description Tela exibida no primeiro acesso de quem entrou com senha temporária (convite da equipe ou
 * redefinição assistida). O painel só é liberado depois que a pessoa cria a própria senha.
 */

"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { validarSenhaForte } from "@/lib/constants";
import { definirSenhaDefinitiva } from "@/lib/supabase/adminAuthService";

interface Props {
  /** Chamado quando a senha definitiva foi salva */
  onConcluido: () => void;
  /** Permite sair sem trocar a senha */
  onSair: () => void;
}

export function AdminTrocaSenhaObrigatoria({ onConcluido, onSair }: Props) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const validacao = validarSenhaForte(senha);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    toast.success("Senha criada. Bem-vindo ao painel!");
    onConcluido();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-black text-white">Crie sua senha</h1>
        </div>
        <p className="text-sm text-slate-400">
          Você entrou com uma senha temporária. Para continuar, defina uma senha só sua.
        </p>
        <div>
          <label htmlFor="nova-senha" className="block text-xs font-semibold text-slate-400 mb-1">
            Nova senha
          </label>
          <input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <ul className="mt-2 space-y-0.5 text-[11px]">
            <li className={validacao.regras.minimo ? "text-emerald-400" : "text-slate-500"}>• Pelo menos 6 caracteres</li>
            <li className={validacao.regras.maiuscula ? "text-emerald-400" : "text-slate-500"}>• Uma letra maiúscula</li>
            <li className={validacao.regras.especial ? "text-emerald-400" : "text-slate-500"}>• Um caractere especial</li>
          </ul>
        </div>
        <div>
          <label htmlFor="confirmar-senha" className="block text-xs font-semibold text-slate-400 mb-1">
            Confirme a nova senha
          </label>
          <input
            id="confirmar-senha"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold"
        >
          {salvando ? "Salvando..." : "Salvar e entrar"}
        </button>
        <button type="button" onClick={onSair} className="w-full text-xs text-slate-500 hover:text-slate-300">
          Sair
        </button>
      </form>
    </div>
  );
}
