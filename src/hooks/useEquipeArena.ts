/**
 * @file useEquipeArena.ts
 * @description Hook da tela Equipe: carrega os membros da arena e expõe convite, alteração de papel,
 * ativação/desativação e redefinição de senha (rotas `/api/admin/equipe`, somente proprietário).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { chamarApi } from "@/lib/api/clienteApi";
import type { ArenaUserRole } from "@/lib/arena/types";
import type { CredencialTemporaria, MembroEquipe } from "@/lib/admin/equipeServidorService";

/** Resultado de uma ação da equipe. */
export interface ResultadoAcaoEquipe {
  ok: boolean;
  erro?: string;
  /** Credencial temporária (convite e redefinição) */
  credencial?: CredencialTemporaria;
}

export interface UseEquipeArenaRetorno {
  membros: MembroEquipe[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  convidar: (dados: { nome: string; email: string; role: ArenaUserRole }) => Promise<ResultadoAcaoEquipe>;
  alterar: (userId: string, patch: { role?: ArenaUserRole; ativo?: boolean }) => Promise<ResultadoAcaoEquipe>;
  redefinirSenha: (userId: string) => Promise<ResultadoAcaoEquipe>;
}

/**
 * Gestão de equipe da arena.
 *
 * @param arenaSlug Slug da arena ativa
 * @returns Membros e ações
 *
 * @example
 * ```tsx
 * const { membros, convidar } = useEquipeArena(arenaSlug);
 * const res = await convidar({ nome: "Ana", email: "ana@arena.com", role: "operador" });
 * ```
 */
export function useEquipeArena(arenaSlug: string): UseEquipeArenaRetorno {
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const res = await chamarApi<{ membros: MembroEquipe[] }>(
      `/api/admin/equipe?arena=${encodeURIComponent(arenaSlug)}`
    );
    if (res.ok && res.dados) {
      setMembros(res.dados.membros);
      setErro(null);
    } else {
      setErro(res.erro ?? "Não foi possível carregar a equipe.");
    }
    setCarregando(false);
  }, [arenaSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial a partir da API
    void recarregar();
  }, [recarregar]);

  const executar = useCallback(
    async (corpo: Record<string, unknown>): Promise<ResultadoAcaoEquipe> => {
      const res = await chamarApi<{ credencial?: CredencialTemporaria }>("/api/admin/equipe", {
        method: "POST",
        corpo: { arenaSlug, ...corpo },
      });
      if (!res.ok) return { ok: false, erro: res.erro };
      await recarregar();
      return { ok: true, credencial: res.dados?.credencial };
    },
    [arenaSlug, recarregar]
  );

  return {
    membros,
    carregando,
    erro,
    recarregar,
    convidar: (dados) => executar({ acao: "convidar", ...dados }),
    alterar: (userId, patch) => executar({ acao: "alterar", userId, ...patch }),
    redefinirSenha: (userId) => executar({ acao: "redefinir_senha", userId }),
  };
}
