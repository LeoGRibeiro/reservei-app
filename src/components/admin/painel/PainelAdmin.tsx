/**
 * @file PainelAdmin.tsx
 * @description Moldura do painel administrativo (layout das rotas `/admin/*`): confere a sessão,
 * mostra primeiro acesso, login ou troca obrigatória de senha, carrega a arena (e o catálogo de
 * quadras) uma única vez e desenha a barra superior com o nome da arena e o menu agrupado. Telas fora
 * do papel do usuário ou de módulos não contratados não abrem.
 *
 * O visual é neutro e igual para todas as arenas; a única marca da arena é o nome no topo.
 *
 * @see SPEC/2026-11-02-admin-revisao.md §3 e Plano B
 */

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useArena } from "@/hooks/useArena";
import { useSetupAdmin } from "@/hooks/useSetupAdmin";
import { precisaTrocarSenha } from "@/lib/supabase/adminAuthService";
import { podeExecutar, ROTULO_PAPEL } from "@/lib/admin/permissoes";
import { GRUPOS_MENU, viewDisponivel, viewDoCaminho } from "@/lib/admin/navegacao";
import { construirUrlArena } from "@/lib/arena/subdomain";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminSetupWizard } from "@/components/admin/AdminSetupWizard";
import { AdminTrocaSenhaObrigatoria } from "@/components/admin/AdminTrocaSenhaObrigatoria";
import { ContextoPainel, type ContextoPainelValor } from "./ContextoPainel";
import { classeBotao, EstadoVazio } from "@/components/admin/ui";

function TelaCarregando() {
  return (
    <div className="painel flex min-h-screen items-center justify-center">
      <span aria-label="Carregando" className="size-5 rounded-full border-2 border-painel-linha-forte border-t-painel-destaque animate-spin" />
    </div>
  );
}

/**
 * Menu lateral agrupado. Itens de módulos não contratados ou acima do papel não aparecem.
 */
function MenuLateral({ modulos, role, aoNavegar }: { modulos?: string[]; role: ContextoPainelValor["role"]; aoNavegar?: () => void }) {
  const caminho = usePathname();
  const atual = viewDoCaminho(caminho);
  return (
    <nav aria-label="Menu do painel" className="space-y-5 px-3 py-4">
      {GRUPOS_MENU.map((grupo) => {
        const itens = grupo.itens.filter((i) => viewDisponivel(i.id, modulos, role));
        if (itens.length === 0) return null;
        return (
          <div key={grupo.titulo}>
            <p className="px-3 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-painel-suave">{grupo.titulo}</p>
            <ul className="space-y-0.5">
              {itens.map((item) => {
                const ativo = item.id === atual;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={aoNavegar}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "block rounded-md border-l-[3px] px-3 py-2 text-sm transition-colors",
                        ativo
                          ? "border-l-painel-destaque bg-painel-destaque-suave font-semibold text-painel-destaque-forte"
                          : "border-l-transparent text-painel-tinta hover:bg-painel-elevada"
                      )}
                    >
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Layout do painel com sessão. Recebe a tela (`children`) da rota atual.
 */
export function PainelAdmin({ children }: { children: ReactNode }) {
  const { autenticado, login, logout, arenaSlug, role, user } = useAdminAuth();
  const { arena, carregando: carregandoArena, recarregar } = useArena(arenaSlug);
  const [tokenConvite] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("token")
  );
  const { precisaSetup, tokenValido } = useSetupAdmin(arenaSlug, autenticado === false, tokenConvite);
  const [trocarSenha, setTrocarSenha] = useState<boolean | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const caminho = usePathname();

  // Senha temporária (convite ou redefinição): o painel só abre depois da troca
  useEffect(() => {
    if (!autenticado) return;
    let ativo = true;
    precisaTrocarSenha().then((precisa) => {
      if (ativo) setTrocarSenha(precisa);
    });
    return () => {
      ativo = false;
    };
  }, [autenticado]);

  const sair = useCallback(async () => {
    await logout();
  }, [logout]);

  const contexto = useMemo<ContextoPainelValor>(
    () => ({
      arena,
      arenaSlug,
      role,
      user,
      pode: (acao) => podeExecutar(role, acao),
      sair,
      recarregarArena: recarregar,
    }),
    [arena, arenaSlug, role, user, sair, recarregar]
  );

  if (autenticado === null || (autenticado === false && precisaSetup === null)) return <TelaCarregando />;

  if (!autenticado && precisaSetup) {
    return <AdminSetupWizard arenaSlug={arenaSlug} onSetupConcluido={login} token={tokenConvite} tokenValido={tokenValido} />;
  }
  if (!autenticado) return <AdminLogin onLogin={login} arenaSlug={arenaSlug} />;
  if (trocarSenha === null || carregandoArena) return <TelaCarregando />;
  if (trocarSenha) return <AdminTrocaSenhaObrigatoria onConcluido={() => setTrocarSenha(false)} onSair={logout} />;

  const modulos = arena.modulosAtivos;
  const view = viewDoCaminho(caminho);
  const permitida = !view || viewDisponivel(view, modulos, role);
  const urlSite = construirUrlArena(arena.slug || arenaSlug);

  return (
    <ContextoPainel.Provider value={contexto}>
      <div className="painel min-h-screen">
        {/* Barra superior: nome da arena sempre visível */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-painel-linha bg-painel-superficie px-4">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            className="rounded-md p-1.5 text-painel-suave hover:bg-painel-elevada lg:hidden"
          >
            {menuAberto ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-painel-tinta">{arena.nome}</p>
            <p className="hidden truncate text-xs text-painel-suave sm:block">
              {role ? ROTULO_PAPEL[role] : "Painel"}
              {user?.email ? ` · ${user.email}` : ""}
            </p>
          </div>
          {/* Link comum (recarga completa): o portal usa outro CSS */}
          <a href={urlSite} target="_blank" rel="noopener noreferrer" className={classeBotao("fantasma", "sm", "hidden sm:inline-flex")}>
            <ExternalLink className="size-3.5" /> Ver site
          </a>
          <button type="button" onClick={sair} className={classeBotao("fantasma", "sm")}>
            <LogOut className="size-3.5" /> Sair
          </button>
        </header>

        <div className="flex">
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-painel-linha bg-painel-superficie lg:block">
            <MenuLateral modulos={modulos} role={role} />
          </aside>

          {menuAberto && (
            <div className="fixed inset-0 top-16 z-20 lg:hidden" onClick={() => setMenuAberto(false)}>
              <div className="absolute inset-0 bg-stone-900/30" />
              <aside className="relative h-full w-64 overflow-y-auto border-r border-painel-linha bg-painel-superficie" onClick={(e) => e.stopPropagation()}>
                <MenuLateral modulos={modulos} role={role} aoNavegar={() => setMenuAberto(false)} />
                <a href={urlSite} target="_blank" rel="noopener noreferrer" className="mx-6 block py-2 text-sm text-painel-suave">
                  Ver site
                </a>
              </aside>
            </div>
          )}

          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
              {permitida ? (
                children
              ) : (
                <EstadoVazio
                  titulo="Esta área não está disponível"
                  descricao="Ela não faz parte do seu perfil de acesso ou do plano contratado pela arena."
                  acao={
                    <Link href="/admin" className={classeBotao("secundario")}>
                      Voltar para Hoje
                    </Link>
                  }
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </ContextoPainel.Provider>
  );
}
