// @vitest-environment node
/**
 * @file schemaPglite.test.ts
 * @description Roda o `schema.sql`, todas as migrações (duas vezes, para provar a idempotência) e o
 * seed da Arena Belém num Postgres real em memória (PGlite) e confere as regras de RLS como um
 * visitante (anon) e como um atleta (authenticated) as veriam.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
// @ts-expect-error módulo JS de infraestrutura de teste (sem tipos)
import { criarBanco, RAIZ_SRC } from "../../supabase-local/banco.mjs";

type Linha = Record<string, unknown>;
interface Banco {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Linha[] }>;
  transaction: <T>(fn: (tx: Banco) => Promise<T>) => Promise<T>;
}

let db: Banco;

/** Executa uma consulta com o papel e as claims de um JWT, como a API do Supabase faria. */
async function comoPapel(papel: "anon" | "authenticated", sql: string, params: unknown[] = [], sub?: string) {
  return db.transaction(async (tx) => {
    await tx.query("SELECT set_config('request.jwt.claims', $1::text, true)", [JSON.stringify({ role: papel, sub })]);
    await tx.query(`SET LOCAL ROLE ${papel}`);
    return tx.query(sql, params);
  });
}

beforeAll(async () => {
  db = await criarBanco({
    aplicarMigracoesDuasVezes: true,
    seeds: [join(RAIZ_SRC, "lib", "supabase", "seed-arena-belem.sql")],
  });
}, 120_000);

describe("schema + migrações no Postgres real (PGlite)", () => {
  it("não deixa nenhuma policy com USING (true) ou WITH CHECK (true) no schema public", async () => {
    const { rows } = await db.query(
      `SELECT tablename, policyname FROM pg_policies
        WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true')`
    );
    expect(rows).toEqual([]);
  });

  it("visitante não altera a galeria, as escolinhas nem a fidelidade de nenhuma arena", async () => {
    for (const sql of [
      "UPDATE public.landing_page_gallery SET title = 'x'",
      "UPDATE public.landing_page_schools SET sport_name = 'x'",
      "UPDATE public.fidelidade_campanha SET nome = 'x'",
      "DELETE FROM public.fidelidade_vouchers",
    ]) {
      const { rows } = await comoPapel("anon", `WITH m AS (${sql} RETURNING 1) SELECT count(*)::int AS n FROM m`);
      expect(rows[0].n, sql).toBe(0);
    }
  });

  it("visitante não lê pedidos de vaga (nome e telefone de atletas)", async () => {
    await db.query(
      `INSERT INTO public.interesses_vagas (id, reserva_id, usuario_id, nome_usuario, telefone_usuario)
       SELECT 'int-teste', id, 'u1', 'Ana', '91999990000' FROM public.reservas WHERE arena_id = 'arena-belem' LIMIT 1
       ON CONFLICT (id) DO NOTHING`
    );
    const { rows } = await comoPapel("anon", "SELECT count(*)::int AS n FROM public.interesses_vagas");
    expect(rows[0].n).toBe(0);
  });

  it("visitante enxerga a grade pública da arena sem dados pessoais", async () => {
    const { rows } = await comoPapel("anon", "SELECT * FROM public.grade_publica('arena-belem', CURRENT_DATE, CURRENT_DATE + 30)");
    expect(rows.length).toBeGreaterThan(0);
    const avulsa = rows.find((r) => r.tipo_reserva === "avulsa" && !r.permite_vagas);
    expect(avulsa?.nome_cliente ?? null).toBeNull();
    expect(avulsa?.whatsapp_cliente ?? null).toBeNull();
  });

  it("visitante não lê a tabela de reservas diretamente", async () => {
    const { rows } = await comoPapel("anon", "SELECT count(*)::int AS n FROM public.reservas");
    expect(rows[0].n).toBe(0);
  });
});
