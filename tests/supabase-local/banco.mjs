/**
 * @file banco.mjs
 * @description Monta um Postgres local em memória (PGlite) com o schema real do projeto:
 * stubs do Supabase, `schema.sql`, migrações (em ordem) e seeds opcionais.
 *
 * Uso exclusivo de testes (comparação visual e ponta a ponta). Nunca aponta para o banco de produção.
 */

import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_SRC = join(AQUI, "..", "..", "src");
const PASTA_SUPABASE = join(RAIZ_SRC, "lib", "supabase");

/**
 * Importa um pacote instalado em `src/node_modules` (a pasta `tests/` não tem node_modules próprio).
 *
 * @param {string} pacote Nome do pacote
 * @returns {Promise<any>} Módulo importado
 */
export async function importarDoSrc(pacote) {
  const requireDoSrc = createRequire(join(RAIZ_SRC, "package.json"));
  return import(pathToFileURL(requireDoSrc.resolve(pacote)).href);
}

const { PGlite } = await importarDoSrc("@electric-sql/pglite");

/** Lê um arquivo SQL do projeto. */
export function lerSql(caminho) {
  return readFileSync(caminho, "utf8");
}

/** Migrações em ordem alfabética (o nome começa pela data). */
export function listarMigracoes() {
  const pasta = join(PASTA_SUPABASE, "migracoes");
  return readdirSync(pasta)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(pasta, f));
}

/**
 * Cria o banco local já com o schema e as migrações aplicados.
 *
 * @param {{ seeds?: string[], aplicarMigracoesDuasVezes?: boolean }} [opcoes]
 *   `seeds`: caminhos de arquivos SQL extras (ex.: seed da Arena Belém);
 *   `aplicarMigracoesDuasVezes`: prova a idempotência rodando cada migração de novo.
 * @returns {Promise<PGlite>} Instância pronta
 *
 * @example
 * const db = await criarBanco({ seeds: [caminhoSeed] });
 * const { rows } = await db.query("select count(*) from public.arenas");
 */
export async function criarBanco(opcoes = {}) {
  const db = new PGlite();
  await db.exec(lerSql(join(AQUI, "stubs.sql")));
  await db.exec(lerSql(join(PASTA_SUPABASE, "schema.sql")));
  for (const migracao of listarMigracoes()) {
    await db.exec(lerSql(migracao));
    if (opcoes.aplicarMigracoesDuasVezes) await db.exec(lerSql(migracao));
  }
  for (const seed of opcoes.seeds ?? []) {
    await db.exec(lerSql(seed));
  }
  // Tabelas e funções criadas depois dos default privileges também ficam acessíveis aos papéis da API
  await db.exec(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  `);
  return db;
}
