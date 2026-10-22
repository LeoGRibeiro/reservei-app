/**
 * AdminShell — Orquestrador da área administrativa.
 * Gerencia autenticação, roteamento interno e layout com Sidebar.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminLogin } from "./AdminLogin";
import { useArena } from "@/hooks/useArena";
import { useSetupAdmin } from "@/hooks/useSetupAdmin";
import { AdminSetupWizard } from "./AdminSetupWizard";
import { AdminSidebar, viewDisponivel, type AdminView } from "./AdminSidebar";
import { AdminDashboardPage } from "./AdminDashboardPage";
import { AdminAgendaPage } from "./AdminAgendaPage";
import { AdminUsuariosPage } from "./AdminUsuariosPage";
import { AdminFinanceiroPage } from "./AdminFinanceiroPage";
import { AdminEscolinhasPage } from "./AdminEscolinhasPage";
import { AdminGruposPage } from "./AdminGruposPage";
import { AdminFidelidadePage } from "./AdminFidelidadePage";
import { AdminInstitucionalPage } from "./AdminInstitucionalPage";
import { AdminQuadrasPage } from "./AdminQuadrasPage";
import { AdminConfiguracoesPage } from "./AdminConfiguracoesPage";
import { AdminEquipePage } from "./AdminEquipePage";
import { AdminPagamentosPage } from "./AdminPagamentosPage";
import { PainelPagamentosAConfirmar } from "./PainelPagamentosAConfirmar";
import { AdminTrocaSenhaObrigatoria } from "./AdminTrocaSenhaObrigatoria";
import { precisaTrocarSenha } from "@/lib/supabase/adminAuthService";
import { podeExecutar } from "@/lib/admin/permissoes";

interface Props {
  initialView?: AdminView;
}

export function AdminShell({ initialView = "dashboard" }: Props) {
  const { autenticado, login, logout, arenaSlug, role, user } = useAdminAuth();
  const { arena, carregando: carregandoArena } = useArena(arenaSlug);
  // Token de convite do primeiro acesso (?token=...), lido uma única vez no cliente
  const [tokenConvite] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("token")
  );
  const { precisaSetup, tokenValido } = useSetupAdmin(arenaSlug, autenticado === false, tokenConvite);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<AdminView>(initialView);
  const router = useRouter();

  // null = verificando; só é consultado depois do login
  const [trocarSenha, setTrocarSenha] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Senha temporária (convite/redefinição): o painel só abre depois da troca
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

  // Redireciona para /admin/dashboard após login bem-sucedido
  useEffect(() => {
    if (autenticado && typeof window !== "undefined") {
      const pathAtual = window.location.pathname;
      if (pathAtual === "/admin") {
        router.replace("/admin/dashboard");
      }
    }
  }, [autenticado, router]);

  // ── Carregando (verificação da sessão Supabase e montagem no cliente) ─────────
  if (!mounted || autenticado === null || (autenticado === false && precisaSetup === null)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Arena sem nenhum operador → Setup Wizard (primeiro acesso) ───────────
  if (!autenticado && precisaSetup) {
    return (
      <AdminSetupWizard
        arenaSlug={arenaSlug}
        onSetupConcluido={login}
        token={tokenConvite}
        tokenValido={tokenValido}
      />
    );
  }

  // ── Não autenticado → Tela de login ──────────────────────────────────────
  if (!autenticado) {
    return <AdminLogin onLogin={login} arenaSlug={arenaSlug} />;
  }

  if (trocarSenha === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="inline-block w-6 h-6 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (trocarSenha) {
    return <AdminTrocaSenhaObrigatoria onConcluido={() => setTrocarSenha(false)} onSair={logout} />;
  }

  // Enquanto a arena carrega, nenhum módulo opcional é exibido (evita flash de abas indevidas)
  const modulosAtivos = carregandoArena ? undefined : arena.modulosAtivos;

  // Se a view atual pertence a um módulo desativado ou exige papel maior, volta ao dashboard
  const viewEfetiva: AdminView = viewDisponivel(view, modulosAtivos, role) ? view : "dashboard";

  // ── Autenticado → Layout principal ───────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-950">
      <AdminSidebar
        viewAtual={viewEfetiva}
        onChangeView={setView}
        onLogout={logout}
        modulosAtivos={modulosAtivos}
        role={role}
      />

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 lg:pt-0 pt-[57px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {(viewEfetiva === "dashboard" || viewEfetiva === "agenda") && (
            <PainelPagamentosAConfirmar arenaSlug={arenaSlug} />
          )}
          {viewEfetiva === "dashboard" && <AdminDashboardPage exibirReceita={podeExecutar(role, "ver_receita")} />}
          {viewEfetiva === "agenda" && <AdminAgendaPage />}
          {viewEfetiva === "quadras" && <AdminQuadrasPage />}
          {viewEfetiva === "usuarios" && (
            <AdminUsuariosPage arenaSlug={arenaSlug} podeRedefinirSenha={podeExecutar(role, "redefinir_senha_atleta")} />
          )}
          {viewEfetiva === "institucional" && <AdminInstitucionalPage />}
          {viewEfetiva === "escolinhas" && <AdminEscolinhasPage />}
          {viewEfetiva === "grupos" && <AdminGruposPage />}
          {viewEfetiva === "fidelidade" && <AdminFidelidadePage />}
          {viewEfetiva === "financeiro" && <AdminFinanceiroPage />}
          {viewEfetiva === "pagamentos" && <AdminPagamentosPage arenaSlug={arenaSlug} />}
          {viewEfetiva === "equipe" && <AdminEquipePage arenaSlug={arenaSlug} usuarioId={user?.id ?? null} />}
          {viewEfetiva === "configuracoes" && <AdminConfiguracoesPage />}
        </div>
      </main>
    </div>
  );
}
