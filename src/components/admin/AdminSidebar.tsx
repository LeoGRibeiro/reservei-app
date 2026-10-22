/**
 * Sidebar de navegação do painel administrativo.
 * Responsiva: collapsa em menu hambúrguer no mobile.
 * Abas de módulos opcionais (Feature Flags) só são exibidas se a arena contratou o módulo.
 */

"use client";

import { useState } from "react";
import { temModuloAtivo, type ModuloArena } from "@/lib/arena/modulos";
import {
  LayoutDashboard,
  CalendarDays,
  DollarSign,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight,
  Users,
  GraduationCap,
  UsersRound,
  Gift,
  Images,
  Layers,
  Settings,
} from "lucide-react";

export type AdminView =
  | "dashboard"
  | "agenda"
  | "quadras"
  | "usuarios"
  | "institucional"
  | "escolinhas"
  | "grupos"
  | "fidelidade"
  | "financeiro"
  | "configuracoes";

interface NavItem {
  id: AdminView;
  label: string;
  icon: React.ElementType;
  /** Módulo (Feature Flag) exigido para exibir a aba; ausente = aba do core */
  modulo?: ModuloArena;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda de Ocupação", icon: CalendarDays },
  { id: "quadras", label: "Gestão de Quadras", icon: Layers },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "institucional", label: "Institucional & LP", icon: Images },
  { id: "escolinhas", label: "Escolinhas", icon: GraduationCap, modulo: "escolinhas" },
  { id: "grupos", label: "Grupos", icon: UsersRound, modulo: "contratos" },
  { id: "fidelidade", label: "Fidelidade", icon: Gift, modulo: "fidelidade" },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

/**
 * Retorna o módulo (Feature Flag) exigido por uma view do painel.
 *
 * @param view View do painel administrativo
 * @returns Módulo exigido, ou undefined se a view pertence ao core
 */
export function moduloDaView(view: AdminView): ModuloArena | undefined {
  return NAV_ITEMS.find((item) => item.id === view)?.modulo;
}

/**
 * Indica se uma view está disponível para a arena conforme seus módulos ativos.
 *
 * @param view View do painel administrativo
 * @param modulosAtivos Módulos contratados pela arena
 * @returns `true` se a view é do core ou o módulo correspondente está ativo
 */
export function viewDisponivel(
  view: AdminView,
  modulosAtivos?: string[] | null
): boolean {
  const modulo = moduloDaView(view);
  return !modulo || temModuloAtivo(modulosAtivos, modulo);
}

interface Props {
  viewAtual: AdminView;
  onChangeView: (view: AdminView) => void;
  onLogout: () => void;
  /** Módulos contratados pela arena; abas de módulos não listados ficam ocultas */
  modulosAtivos?: string[] | null;
}

export function AdminSidebar({
  viewAtual,
  onChangeView,
  onLogout,
  modulosAtivos,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const itensVisiveis = NAV_ITEMS.filter((item) =>
    viewDisponivel(item.id, modulosAtivos)
  );

  function handleNav(view: AdminView) {
    onChangeView(view);
    setMobileOpen(false);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">Reservei</p>
            <p className="text-slate-500 text-xs mt-0.5">Painel Admin</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
          Navegação
        </p>
        {itensVisiveis.map((item) => {
          const Icon = item.icon;
          const ativo = viewAtual === item.id;
          return (
            <button
              key={item.id}
              id={`admin-nav-${item.id}`}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                ${
                  ativo
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent"
                }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${ativo ? "" : "group-hover:scale-110"}`}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {ativo && (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6 pt-3 border-t border-slate-700/50">
        <button
          id="admin-logout-btn"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4 flex-shrink-0 group-hover:-translate-x-0.5 transition-transform duration-200" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 bg-slate-900 border-r border-slate-700/50 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile: Topbar com hambúrguer ────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold text-white text-sm">Reservei Admin</span>
        </div>
        <button
          id="admin-menu-hamburguer"
          onClick={() => setMobileOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Mobile: Drawer overlay ────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-40 h-full w-72 bg-slate-900 border-r border-slate-700/50 transform transition-transform duration-300 ease-in-out pt-[57px]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
