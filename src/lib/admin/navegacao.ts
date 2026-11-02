/**
 * @module admin/navegacao
 *
 * Mapa do painel: cada tela tem endereço próprio (`/admin/agenda`, `/admin/financeiro`...), grupo no
 * menu, módulo exigido (Feature Flag) e papel mínimo (via `permissoes`). Fonte única para o menu, a
 * proteção das rotas e os links internos.
 *
 * @see SPEC/2026-11-02-admin-revisao.md §3.1 e Plano B
 */

import { temModuloAtivo, type ModuloArena } from "@/lib/arena/modulos";
import { podeAcessarView, type AdminView } from "@/lib/admin/permissoes";
import type { ArenaUserRole } from "@/lib/arena/types";

export type { AdminView };

/** Item do menu lateral. */
export interface ItemMenu {
  id: AdminView;
  rotulo: string;
  href: string;
  /** Módulo (Feature Flag) exigido; ausente = tela do core */
  modulo?: ModuloArena;
}

/** Grupo do menu lateral. */
export interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

export const GRUPOS_MENU: GrupoMenu[] = [
  {
    titulo: "Operação",
    itens: [
      { id: "dashboard", rotulo: "Hoje", href: "/admin" },
      { id: "agenda", rotulo: "Agenda", href: "/admin/agenda" },
      { id: "usuarios", rotulo: "Clientes", href: "/admin/clientes" },
    ],
  },
  {
    titulo: "Turmas e fixos",
    itens: [
      { id: "escolinhas", rotulo: "Escolinhas", href: "/admin/escolinhas", modulo: "escolinhas" },
      { id: "grupos", rotulo: "Grupos", href: "/admin/grupos", modulo: "contratos" },
    ],
  },
  {
    titulo: "Dinheiro",
    itens: [{ id: "financeiro", rotulo: "Financeiro", href: "/admin/financeiro" }],
  },
  {
    titulo: "Arena",
    itens: [
      { id: "quadras", rotulo: "Quadras e preços", href: "/admin/quadras" },
      { id: "institucional", rotulo: "Site", href: "/admin/site" },
      { id: "fidelidade", rotulo: "Fidelidade", href: "/admin/fidelidade", modulo: "fidelidade" },
    ],
  },
  {
    titulo: "Ajustes",
    itens: [
      { id: "equipe", rotulo: "Equipe", href: "/admin/equipe" },
      { id: "pagamentos", rotulo: "Recebimento", href: "/admin/recebimento" },
      { id: "configuracoes", rotulo: "Configurações", href: "/admin/configuracoes" },
    ],
  },
];

const ITENS = GRUPOS_MENU.flatMap((g) => g.itens);

/**
 * Módulo (Feature Flag) exigido por uma tela.
 *
 * @param view Tela do painel
 * @returns Módulo exigido, ou undefined se a tela é do core
 */
export function moduloDaView(view: AdminView): ModuloArena | undefined {
  return ITENS.find((item) => item.id === view)?.modulo;
}

/**
 * Indica se uma tela está disponível conforme os módulos da arena e o papel do usuário.
 *
 * @param view Tela do painel
 * @param modulosAtivos Módulos contratados pela arena
 * @param role Papel do usuário; omitido = não filtra por papel
 * @returns `true` se a tela é do core (ou o módulo está ativo) e o papel permite
 */
export function viewDisponivel(view: AdminView, modulosAtivos?: string[] | null, role?: ArenaUserRole | null): boolean {
  const modulo = moduloDaView(view);
  const moduloOk = !modulo || temModuloAtivo(modulosAtivos, modulo);
  return moduloOk && (role === undefined || podeAcessarView(role, view));
}

/**
 * Tela do painel correspondente a um caminho. O detalhe da reserva pertence à Agenda.
 *
 * @param caminho `pathname` (ex.: "/admin/financeiro", "/admin/reservas/abc")
 * @returns Tela, ou null fora do painel
 *
 * @example
 * ```ts
 * viewDoCaminho("/admin"); // "dashboard"
 * viewDoCaminho("/admin/reservas/r1"); // "agenda"
 * ```
 */
export function viewDoCaminho(caminho: string): AdminView | null {
  const limpo = caminho.replace(/\/+$/, "") || "/";
  if (limpo === "/admin") return "dashboard";
  if (limpo.startsWith("/admin/reservas/")) return "agenda";
  const item = ITENS.find((i) => i.href !== "/admin" && (limpo === i.href || limpo.startsWith(`${i.href}/`)));
  return item?.id ?? null;
}

/** Endereço de uma tela do painel. */
export function hrefDaView(view: AdminView): string {
  return ITENS.find((i) => i.id === view)?.href ?? "/admin";
}

/** Endereço do detalhe de uma reserva. */
export function hrefReserva(id: string): string {
  return `/admin/reservas/${encodeURIComponent(id)}`;
}
