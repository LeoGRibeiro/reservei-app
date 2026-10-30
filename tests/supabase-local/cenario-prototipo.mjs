/**
 * @file cenario-prototipo.mjs
 * @description Dados do Supabase local para a comparação visual: o seed oficial da Arena Belém
 * (mesmos dados do protótipo aprovado) e o atleta de demonstração Rafael, que o protótipo usa no
 * modo "Cliente logado".
 */

import { join } from "node:path";
import { RAIZ_SRC } from "./banco.mjs";

/** Seeds aplicados depois do schema e das migrações. */
export const seeds = [join(RAIZ_SRC, "lib", "supabase", "seed-arena-belem.sql")];

/**
 * Dados extras do cenário (o atleta do protótipo entra aqui a partir da Fase 4).
 *
 * @param {import("@electric-sql/pglite").PGlite} _db Banco já com o seed
 */
export async function preparar(_db) {}
