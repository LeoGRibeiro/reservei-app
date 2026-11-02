/**
 * @file ContextoPainel.tsx
 * @description Dados da sessão do painel compartilhados por todas as telas: arena, papel, usuário e
 * sair. Preenchido pelo {@link PainelAdmin} depois do login.
 *
 * @example
 * ```tsx
 * const { arena, role, pode } = usePainel();
 * if (pode("ver_receita")) ...
 * ```
 */

"use client";

import { createContext, useContext } from "react";
import type { Arena, ArenaUserRole } from "@/lib/arena/types";
import type { AdminUsuario } from "@/lib/supabase/adminAuthService";
import type { AcaoAdmin } from "@/lib/admin/permissoes";

export interface ContextoPainelValor {
  arena: Arena;
  arenaSlug: string;
  role: ArenaUserRole | null;
  user: AdminUsuario | null;
  /** O papel atual pode executar a ação sensível */
  pode: (acao: AcaoAdmin) => boolean;
  sair: () => Promise<void>;
  /** Recarrega a arena (depois de salvar configurações) */
  recarregarArena: () => Promise<void>;
}

export const ContextoPainel = createContext<ContextoPainelValor | null>(null);

/**
 * Sessão do painel. Só pode ser usado dentro do {@link PainelAdmin}.
 *
 * @throws Error fora do painel
 */
export function usePainel(): ContextoPainelValor {
  const valor = useContext(ContextoPainel);
  if (!valor) throw new Error("usePainel precisa estar dentro do PainelAdmin.");
  return valor;
}
