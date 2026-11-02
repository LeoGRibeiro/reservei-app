/**
 * @file AdminLogin.tsx
 * @description Tela de login do painel administrativo. Autentica o operador com
 * e-mail corporativo e senha via Supabase Auth, exibindo a arena (tenant) acessada.
 */

"use client";

import { NOME_PRODUTO } from "@/lib/marca";
import { solicitarRecuperacaoSenha } from "@/lib/supabase/adminAuthService";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
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
  const [recuperando, setRecuperando] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);

  // Se a arena do slug não foi encontrada, o hook devolve a arena padrão: exibe o slug.
  const nomeArena = arena.slug === arenaSlug ? arena.nome : arenaSlug;

  async function handleRecuperar() {
    setRecuperando(true);
    const falha = await solicitarRecuperacaoSenha(email, `${window.location.origin}/admin/redefinir-senha`);
    setRecuperando(false);
    if (falha) {
      setErro(falha);
      return;
    }
    setErro(null);
    setLinkEnviado(true);
  }

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

  const classeCampo = `w-full bg-painel-elevada border rounded-md pl-10 pr-4 py-3 text-sm text-painel-tinta placeholder:text-painel-apagada outline-none transition-all
    ${
      erro
        ? "border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
        : "border-painel-linha focus:border-painel-destaque focus:ring-2 focus:ring-painel-foco/20"
    }`;

  return (
    <div className="painel min-h-screen bg-painel-fundo flex items-center justify-center p-4">
      <div
        className={`relative w-full max-w-sm transition-all duration-300 ${shake ? "animate-shake" : ""}`}
      >
        {/* Card */}
        <div className="bg-painel-superficie border border-painel-linha rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-painel-superficie px-8 pt-8 pb-6 text-center border-b border-painel-linha">
            <h1 className="text-xl font-semibold text-painel-tinta mb-1">Entrar no painel</h1>
            <p id="admin-login-arena" className="text-painel-suave text-sm">
              {nomeArena}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-painel-tinta"
              >
                E-mail
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-painel-suave group-focus-within:text-painel-destaque transition-colors" />
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
                className="block text-sm font-medium text-painel-tinta"
              >
                Senha
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-painel-suave group-focus-within:text-painel-destaque transition-colors" />
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-painel-suave hover:text-painel-tinta transition-colors"
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
                  className="text-red-700 text-xs flex items-center gap-1.5"
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
              className="w-full bg-painel-destaque hover:bg-painel-destaque-forte disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-md py-3 text-sm transition-all duration-200 flex items-center justify-center gap-2"
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

            <div className="text-center">
              {linkEnviado ? (
                <p role="status" className="text-xs text-painel-destaque">
                  Se este e-mail tiver acesso, enviamos um link para criar uma nova senha. Confira também o spam.
                  Não chegou? Peça ao proprietário uma nova senha na tela Equipe.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleRecuperar}
                  disabled={recuperando || !email}
                  title={!email ? "Digite seu e-mail acima" : undefined}
                  className="text-xs text-painel-suave hover:text-painel-destaque disabled:opacity-50 transition-colors"
                >
                  {recuperando ? "Enviando link..." : "Esqueci minha senha"}
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-painel-apagada text-xs mt-6">
          {NOME_PRODUTO} · Painel Administrativo
        </p>
      </div>
    </div>
  );
}
