/**
 * @file cenario-prototipo.mjs
 * @description Dados do Supabase local para a comparação visual: a Arena Belém com os mesmos dados
 * do protótipo aprovado (`cenario-arena-belem.sql`, que vira o seed oficial na Fase 6) e o atleta de
 * demonstração Rafael, que o protótipo usa no modo "Cliente logado".
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Seeds aplicados depois do schema e das migrações. */
export const seeds = [join(AQUI, "..", "..", "src", "lib", "supabase", "seed-arena-belem.sql"), join(AQUI, "cenario-ocupacao.sql"), join(AQUI, "cenario-rafael.sql")];

/**
 * Dados extras do cenário (o atleta do protótipo entra aqui a partir da Fase 4).
 *
 * @param {import("@electric-sql/pglite").PGlite} _db Banco já com o seed
 */
export async function preparar(_db) {}
