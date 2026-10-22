/**
 * @file useAdminAuth.ts
 * @description Hook de autenticação do painel administrativo com Supabase Auth e RBAC
 * multi-tenant. A sessão é gerenciada nativamente pelo Supabase (tokens JWT); nenhuma
 * senha ou flag de autenticação é gravada em `localStorage` pela aplicação.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { obterSlugArenaDoNavegador } from "@/lib/arena/subdomain";
import type { ArenaUserRole } from "@/lib/arena/types";
import {
  autenticarAdministrador,
  restaurarSessaoAdministrador,
  observarSaidaAdministrador,
  sairAdministrador,
  type AdminUsuario,
  type SessaoAdmin,
} from "@/lib/supabase/adminAuthService";

/**
 * Resultado de uma tentativa de login administrativo.
 */
export interface ResultadoLogin {
  /** Indica se o login foi concluído e o vínculo com a arena validado */
  success: boolean;
  /** Mensagem de erro amigável quando `success` é falso */
  error?: string;
}

/**
 * Retorno do hook {@link useAdminAuth}.
 */
export interface UseAdminAuthRetorno {
  /** `null` enquanto a sessão é verificada; depois `true`/`false` */
  autenticado: boolean | null;
  /** Usuário autenticado (ou null) */
  user: AdminUsuario | null;
  /** Perfil de acesso na arena atual (ou null) */
  role: ArenaUserRole | null;
  /** Identificador da arena vinculada (ou null) */
  arenaId: string | null;
  /** Slug da arena acessada, resolvido do subdomínio */
  arenaSlug: string;
  /** Autentica com e-mail e senha e valida o vínculo com a arena atual */
  login: (email: string, senha: string) => Promise<ResultadoLogin>;
  /** Encerra a sessão e reseta o estado */
  logout: () => Promise<void>;
}

/**
 * Hook de autenticação administrativa.
 *
 * @param arenaSlugForcado Slug da arena a validar (opcional; por padrão, o do subdomínio)
 * @returns Estado da sessão e ações `login`/`logout`
 *
 * @example
 * ```tsx
 * const { autenticado, login, logout, role } = useAdminAuth();
 * const res = await login("dono@arena.com", "senha");
 * if (!res.success) toast.error(res.error);
 * ```
 */
export function useAdminAuth(arenaSlugForcado?: string): UseAdminAuthRetorno {
  const arenaSlug = useMemo(
    () => arenaSlugForcado ?? obterSlugArenaDoNavegador(),
    [arenaSlugForcado]
  );
  const [sessao, setSessao] = useState<SessaoAdmin | null>(null);
  const [autenticado, setAutenticado] = useState<boolean | null>(null); // null = carregando

  // Restaura a sessão persistida pelo Supabase e observa logouts (expiração, outras abas)
  useEffect(() => {
    let ativo = true;

    restaurarSessaoAdministrador(arenaSlug).then((restaurada) => {
      if (!ativo) return;
      setSessao(restaurada);
      setAutenticado(Boolean(restaurada));
    });

    const cancelar = observarSaidaAdministrador(() => {
      if (!ativo) return;
      setSessao(null);
      setAutenticado(false);
    });

    return () => {
      ativo = false;
      cancelar();
    };
  }, [arenaSlug]);

  const login = useCallback(
    async (email: string, senha: string): Promise<ResultadoLogin> => {
      const resultado = await autenticarAdministrador(email, senha, arenaSlug);

      if (!resultado.success) {
        return { success: false, error: resultado.error };
      }

      setSessao(resultado.sessao);
      setAutenticado(true);
      return { success: true };
    },
    [arenaSlug]
  );

  const logout = useCallback(async (): Promise<void> => {
    await sairAdministrador();
    setSessao(null);
    setAutenticado(false);
  }, []);

  return {
    autenticado,
    user: sessao?.user ?? null,
    role: sessao?.role ?? null,
    arenaId: sessao?.arenaId ?? null,
    arenaSlug,
    login,
    logout,
  };
}
