/**
 * @file modulosServidor.ts
 * @description Checagem de módulos contratados (Feature Flags) nas rotas do servidor. A interface
 * esconde os módulos não contratados, mas a regra também vale para quem chama a API direto.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { temModuloAtivo, type ModuloArena } from "@/lib/arena/modulos";

/**
 * Indica se a arena contratou o módulo.
 *
 * @param arenaId Arena
 * @param modulo Módulo exigido
 * @returns true se o módulo está ativo (arena inexistente retorna false)
 */
export async function arenaTemModulo(arenaId: string, modulo: ModuloArena): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("arenas")
    .select("modulos_ativos")
    .eq("id", arenaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return temModuloAtivo((data?.modulos_ativos as string[] | null) ?? null, modulo);
}
