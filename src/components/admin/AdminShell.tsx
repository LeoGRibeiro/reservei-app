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

// Placeholder pages para futuras specs
function PlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
        <span className="text-3xl">🚧</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{titulo}</h2>
      <p className="text-slate-400 text-sm max-w-xs">
        Esta seção está planejada e será implementada na próxima especificação.
      </p>
    </div>
  );
}

interface Props {
  initialView?: AdminView;
}

export function AdminShell({ initialView = "dashboard" }: Props) {
  const { autenticado, login, logout, arenaSlug } = useAdminAuth();
  const { arena, carregando: carregandoArena } = useArena(arenaSlug);
  // Token de convite do primeiro acesso (?token=...), lido uma única vez no cliente
  const [tokenConvite] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("token")
  );
  const { precisaSetup, tokenValido } = useSetupAdmin(arenaSlug, autenticado === false, tokenConvite);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<AdminView>(initialView);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Enquanto a arena carrega, nenhum módulo opcional é exibido (evita flash de abas indevidas)
  const modulosAtivos = carregandoArena ? undefined : arena.modulosAtivos;

  // Se a view atual pertence a um módulo desativado, volta ao dashboard
  const viewEfetiva: AdminView = viewDisponivel(view, modulosAtivos) ? view : "dashboard";

  // ── Autenticado → Layout principal ───────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-slate-950">
      <AdminSidebar
        viewAtual={viewEfetiva}
        onChangeView={setView}
        onLogout={logout}
        modulosAtivos={modulosAtivos}
      />

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 lg:pt-0 pt-[57px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {viewEfetiva === "dashboard" && <AdminDashboardPage />}
          {viewEfetiva === "agenda" && <AdminAgendaPage />}
          {viewEfetiva === "quadras" && <AdminQuadrasPage />}
          {viewEfetiva === "usuarios" && <AdminUsuariosPage />}
          {viewEfetiva === "institucional" && <AdminInstitucionalPage />}
          {viewEfetiva === "escolinhas" && <AdminEscolinhasPage />}
          {viewEfetiva === "grupos" && <AdminGruposPage />}
          {viewEfetiva === "fidelidade" && <AdminFidelidadePage />}
          {viewEfetiva === "financeiro" && <AdminFinanceiroPage />}
          {viewEfetiva === "configuracoes" && <AdminConfiguracoesPage />}
        </div>
      </main>
    </div>
  );
}
