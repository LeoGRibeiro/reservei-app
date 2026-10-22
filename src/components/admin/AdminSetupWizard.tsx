/**
 * @file AdminSetupWizard.tsx
 * @description Tela de configuração inicial: cria o primeiro administrador (proprietário)
 * de uma arena que ainda não possui nenhum operador e já o autentica no painel.
 */

"use client";

import { NOME_PRODUTO } from "@/lib/marca";
import { useState } from "react";
import { useArena } from "@/hooks/useArena";
import type { ResultadoLogin } from "@/hooks/useAdminAuth";

/** Tamanho mínimo da senha (igual ao exigido pelo servidor). */
const SENHA_MINIMA = 6;

/**
 * Propriedades do componente {@link AdminSetupWizard}.
 */
interface Props {
  /** Slug da arena acessada (subdomínio) */
  arenaSlug: string;
  /** Autentica o administrador recém-criado (normalmente `login` de `useAdminAuth`) */
  onSetupConcluido: (email: string, senha: string) => Promise<ResultadoLogin>;
  /** Token de convite lido da URL (`?token=...`); null se ausente */
  token: string | null;
  /** O servidor confirmou que o token confere com o convite pendente da arena */
  tokenValido: boolean;
}

/**
 * Formulário de criação do primeiro administrador.
 *
 * @example
 * ```tsx
 * <AdminSetupWizard arenaSlug="central" onSetupConcluido={login} token={token} tokenValido={ok} />
 * ```
 *
 * Sem token válido, exibe apenas a tela de acesso restrito (o formulário não é renderizado).
 */
export function AdminSetupWizard({ arenaSlug, onSetupConcluido, token, tokenValido }: Props) {
  const { arena } = useArena(arenaSlug);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const nomeArena = arena.slug === arenaSlug ? arena.nome : arenaSlug;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);
    try {
      const resposta = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arenaSlug, token, nome, email, senha }),
      });
      const corpo: { error?: string } = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        setErro(corpo.error ?? "Não foi possível criar o administrador.");
        return;
      }

      const login = await onSetupConcluido(email, senha);
      if (!login.success) {
        setErro(login.error ?? "Administrador criado, mas não foi possível entrar. Faça login.");
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  const classeCampo =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500";
  const classeRotulo = "block text-sm font-medium text-slate-300 mb-1";

  if (!token || !tokenValido) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-xl p-6 space-y-3 text-center">
          <div aria-hidden="true" className="text-3xl">
            🔒
          </div>
          <h1 className="text-lg font-bold text-white">Acesso Restrito · {nomeArena}</h1>
          <p className="text-slate-400 text-sm">
            Para realizar a configuração inicial desta arena, utilize o link de convite exclusivo
            enviado pela equipe {NOME_PRODUTO}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-xl p-6 space-y-4"
      >
        <div>
          <h1 className="text-lg font-bold text-white">
            Configuração Inicial do Administrador · {nomeArena}
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Esta arena ainda não possui uma conta de proprietário cadastrada. Defina as
            credenciais do primeiro administrador para iniciar.
          </p>
        </div>

        <div>
          <label htmlFor="setup-nome" className={classeRotulo}>
            Nome Completo
          </label>
          <input
            id="setup-nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            className={classeCampo}
            required
          />
        </div>

        <div>
          <label htmlFor="setup-email" className={classeRotulo}>
            E-mail Profissional
          </label>
          <input
            id="setup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className={classeCampo}
            required
          />
        </div>

        <div>
          <label htmlFor="setup-senha" className={classeRotulo}>
            Senha
          </label>
          <input
            id="setup-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            minLength={SENHA_MINIMA}
            className={classeCampo}
            required
          />
        </div>

        <div>
          <label htmlFor="setup-confirmacao" className={classeRotulo}>
            Confirmar Senha
          </label>
          <input
            id="setup-confirmacao"
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="new-password"
            className={classeCampo}
            required
          />
        </div>

        {erro && (
          <p role="alert" className="text-red-400 text-sm">
            {erro}
          </p>
        )}

        <button
          id="setup-submit-btn"
          type="submit"
          disabled={carregando}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2"
        >
          {carregando ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              Criando...
            </>
          ) : (
            "Criar Administrador e Acessar Painel"
          )}
        </button>
      </form>
    </div>
  );
}
