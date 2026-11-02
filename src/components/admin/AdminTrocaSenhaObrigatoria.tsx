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
  /** Texto explicativo (padrão: primeiro acesso com senha temporária) */
  descricao?: string;
}

export function AdminTrocaSenhaObrigatoria({
  onConcluido,
  onSair,
  descricao = "Você entrou com uma senha temporária. Para continuar, defina uma senha só sua.",
}: Props) {
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
    <div className="painel min-h-screen bg-painel-fundo flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-painel-superficie border border-painel-linha rounded-lg p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-painel-destaque-suave border border-painel-destaque text-painel-destaque flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-semibold text-painel-tinta">Crie sua senha</h1>
        </div>
        <p className="text-sm text-painel-suave">{descricao}</p>
        <div>
          <label htmlFor="nova-senha" className="block text-xs font-semibold text-painel-suave mb-1">
            Nova senha
          </label>
          <input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
          />
          <ul className="mt-2 space-y-0.5 text-[11px]">
            <li className={validacao.regras.minimo ? "text-painel-destaque" : "text-painel-suave"}>• Pelo menos 6 caracteres</li>
            <li className={validacao.regras.maiuscula ? "text-painel-destaque" : "text-painel-suave"}>• Uma letra maiúscula</li>
            <li className={validacao.regras.especial ? "text-painel-destaque" : "text-painel-suave"}>• Um caractere especial</li>
          </ul>
        </div>
        <div>
          <label htmlFor="confirmar-senha" className="block text-xs font-semibold text-painel-suave mb-1">
            Confirme a nova senha
          </label>
          <input
            id="confirmar-senha"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="w-full bg-painel-superficie border border-painel-linha rounded-md px-3 py-2 text-painel-tinta text-sm focus:outline-none focus:border-painel-destaque"
          />
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="w-full px-4 py-2.5 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte disabled:opacity-50 text-white text-sm font-bold"
        >
          {salvando ? "Salvando..." : "Salvar e entrar"}
        </button>
        <button type="button" onClick={onSair} className="w-full text-xs text-painel-suave hover:text-painel-tinta">
          Sair
        </button>
      </form>
    </div>
  );
}
