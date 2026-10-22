/**
 * @file useSetupAdmin.ts
 * @description Hook que consulta se a arena atual ainda precisa do Setup Wizard
 * (zero operadores ativos em `arena_usuarios`) e se o token de convite da URL é válido.
 */

"use client";

import { useEffect, useState } from "react";

/**
 * Retorno do hook {@link useSetupAdmin}.
 */
export interface UseSetupAdminRetorno {
  /** `null` enquanto consulta; depois `true`/`false` */
  precisaSetup: boolean | null;
  /** O token informado confere com o convite pendente da arena */
  tokenValido: boolean;
}

/**
 * Consulta `GET /api/admin/setup?slug=<arena>&token=<convite>` quando habilitado.
 *
 * @param arenaSlug Slug da arena acessada
 * @param habilitado Só consulta quando verdadeiro (ex.: usuário ainda não autenticado)
 * @param token Token de convite lido da URL (`?token=...`), se houver
 * @returns Estado do setup. Qualquer falha de rede resulta em `precisaSetup: false`
 *          (exibe o login normal).
 *
 * @example
 * ```tsx
 * const { precisaSetup, tokenValido } = useSetupAdmin("arena-central", autenticado === false, token);
 * ```
 */
export function useSetupAdmin(
  arenaSlug: string,
  habilitado: boolean,
  token: string | null = null
): UseSetupAdminRetorno {
  const [estado, setEstado] = useState<UseSetupAdminRetorno>({
    precisaSetup: null,
    tokenValido: false,
  });

  useEffect(() => {
    if (!habilitado) return;

    let ativo = true;
    const params = new URLSearchParams({ slug: arenaSlug });
    if (token) params.set("token", token);

    fetch(`/api/admin/setup?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { precisaSetup: false, tokenValido: false }))
      .then((corpo: { precisaSetup?: boolean; tokenValido?: boolean }) => {
        if (ativo) {
          setEstado({
            precisaSetup: Boolean(corpo.precisaSetup),
            tokenValido: Boolean(corpo.tokenValido),
          });
        }
      })
      .catch(() => {
        if (ativo) setEstado({ precisaSetup: false, tokenValido: false });
      });

    return () => {
      ativo = false;
    };
  }, [arenaSlug, habilitado, token]);

  return estado;
}
