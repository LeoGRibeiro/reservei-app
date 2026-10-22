/**
 * @file permissoes.ts
 * @description Matriz de acesso do painel administrativo por papel (RBAC). Fonte única usada pela
 * sidebar, pelo `AdminShell` e pelas rotas de API. Ver SPEC/2026-10-22-mvp-go-live.md §4.
 *
 * O banco aplica a mesma hierarquia nas escritas sensíveis (RLS de `arenas`, `quadras` e
 * `quadras_precos`); esta matriz decide o que cada papel enxerga.
 */

import type { ArenaUserRole } from "@/lib/arena/types";

/** Telas do painel administrativo. */
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
  | "pagamentos"
  | "equipe"
  | "configuracoes";

/** Ações sensíveis verificadas fora da navegação (interface e servidor). */
export type AcaoAdmin =
  /** Ver receita consolidada (KPIs de sinais recebidos) */
  | "ver_receita"
  /** Convidar, alterar papel e desativar membros da equipe */
  | "gerenciar_equipe"
  /** Conectar Asaas / configurar Pix da arena */
  | "configurar_pagamentos"
  /** Redefinir a senha de um atleta da arena */
  | "redefinir_senha_atleta";

/** Ordem hierárquica: cada papel herda o acesso dos anteriores. */
const NIVEL: Record<ArenaUserRole, number> = { operador: 1, gerente: 2, proprietario: 3 };

/** Papel mínimo para acessar cada tela. */
const PAPEL_MINIMO_VIEW: Record<AdminView, ArenaUserRole> = {
  dashboard: "operador",
  agenda: "operador",
  usuarios: "operador",
  grupos: "operador",
  escolinhas: "operador",
  quadras: "gerente",
  institucional: "gerente",
  fidelidade: "gerente",
  financeiro: "gerente",
  pagamentos: "proprietario",
  equipe: "proprietario",
  configuracoes: "proprietario",
};

/** Papel mínimo para cada ação sensível. */
const PAPEL_MINIMO_ACAO: Record<AcaoAdmin, ArenaUserRole> = {
  ver_receita: "gerente",
  redefinir_senha_atleta: "gerente",
  gerenciar_equipe: "proprietario",
  configurar_pagamentos: "proprietario",
};

/** Rótulos exibidos na interface. */
export const ROTULO_PAPEL: Record<ArenaUserRole, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  operador: "Operador de balcão",
};

/** Descrição curta do que cada papel faz (tela Equipe). */
export const DESCRICAO_PAPEL: Record<ArenaUserRole, string> = {
  proprietario: "Acesso total, inclusive pagamentos, equipe e configurações.",
  gerente: "Tudo da operação, quadras, preços e financeiro. Sem pagamentos e equipe.",
  operador: "Agenda, reservas de balcão, bloqueios e atletas. Sem valores consolidados.",
};

/** Papéis que podem ser atribuídos por convite (o proprietário é único e definido no onboarding). */
export const PAPEIS_CONVIDAVEIS: ArenaUserRole[] = ["gerente", "operador"];

/**
 * Verifica se um valor é um papel conhecido.
 *
 * @param valor Valor a validar
 * @returns `true` se for um {@link ArenaUserRole}
 */
export function isPapelArena(valor: unknown): valor is ArenaUserRole {
  return valor === "proprietario" || valor === "gerente" || valor === "operador";
}

function atende(role: ArenaUserRole | null | undefined, minimo: ArenaUserRole): boolean {
  if (!role || !isPapelArena(role)) return false;
  return NIVEL[role] >= NIVEL[minimo];
}

/**
 * Indica se o papel pode abrir uma tela do painel.
 *
 * @param role Papel do usuário na arena
 * @param view Tela desejada
 * @returns `true` se permitido
 *
 * @example
 * ```ts
 * podeAcessarView("operador", "financeiro"); // false
 * podeAcessarView("gerente", "financeiro"); // true
 * ```
 */
export function podeAcessarView(role: ArenaUserRole | null | undefined, view: AdminView): boolean {
  return atende(role, PAPEL_MINIMO_VIEW[view]);
}

/**
 * Indica se o papel pode executar uma ação sensível.
 *
 * @param role Papel do usuário na arena
 * @param acao Ação desejada
 * @returns `true` se permitido
 *
 * @example
 * ```ts
 * podeExecutar("gerente", "gerenciar_equipe"); // false
 * ```
 */
export function podeExecutar(role: ArenaUserRole | null | undefined, acao: AcaoAdmin): boolean {
  return atende(role, PAPEL_MINIMO_ACAO[acao]);
}
