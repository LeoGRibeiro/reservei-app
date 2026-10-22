/**
 * @file AdminLogin.tsx
 * @description Tela de login do painel administrativo. Autentica o operador com
 * e-mail corporativo e senha via Supabase Auth, exibindo a arena (tenant) acessada.
 */

"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { useArena } from "@/hooks/useArena";
import type { ResultadoLogin } from "@/hooks/useAdminAuth";

/**
 * Propriedades do componente {@link AdminLogin}.
 */
interface Props {
  /** Executa o login; retorna `success: false` com a mensagem de erro em caso de falha */
  onLogin: (email: string, senha: string) => Promise<ResultadoLogin>;
  /** Slug da arena acessada (subdomínio), usado para exibir o nome do complexo */
  arenaSlug: string;
}

/**
 * Formulário de login administrativo.
 *
 * @example
 * ```tsx
 * <AdminLogin onLogin={login} arenaSlug="central" />
 * ```
 */
export function AdminLogin({ onLogin, arenaSlug }: Props) {
  const { arena } = useArena(arenaSlug);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [shake, setShake] = useState(false);

  // Se a arena do slug não foi encontrada, o hook devolve a arena padrão: exibe o slug.
  const nomeArena = arena.slug === arenaSlug ? arena.nome : arenaSlug;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const resultado = await onLogin(email, senha);
    setCarregando(false);

    if (!resultado.success) {
      setErro(resultado.error ?? "Não foi possível autenticar. Tente novamente.");
      setSenha("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  const classeCampo = `w-full bg-slate-800 border rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all
    ${
      erro
        ? "border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
        : "border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
    }`;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background grid decorativo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow central */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      <div
        className={`relative w-full max-w-sm transition-all duration-300 ${shake ? "animate-shake" : ""}`}
      >
        {/* Card */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-8 pt-10 pb-8 text-center border-b border-slate-700/40">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Área Admin</h1>
            <p id="admin-login-arena" className="text-slate-400 text-sm">
              {nomeArena} · Gestão Interna
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-slate-300"
              >
                E-mail corporativo
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (erro) setErro(null);
                  }}
                  placeholder="voce@suaarena.com.br"
                  autoComplete="username"
                  className={classeCampo}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-senha"
                className="block text-sm font-medium text-slate-300"
              >
                Senha
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  id="admin-senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    if (erro) setErro(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`${classeCampo} pr-10`}
                  required
                />
                <button
                  type="button"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {mostrarSenha ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {erro && (
                <p
                  role="alert"
                  className="text-red-400 text-xs flex items-center gap-1.5 animate-fade-in"
                >
                  <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                  {erro}
                </p>
              )}
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={carregando || !email || !senha}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl py-3 text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {carregando ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Reservei · Painel Administrativo
        </p>
      </div>
    </div>
  );
}
