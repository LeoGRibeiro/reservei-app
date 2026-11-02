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
  exec: (sql: string) => Promise<unknown>;
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
    seeds: [join(RAIZ_SRC, "lib", "supabase", "seed-arena-belem.sql"), join(RAIZ_SRC, "..", "tests", "supabase-local", "cenario-ocupacao.sql")],
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

describe("tabelas do portal (migração 2026-10-30-b)", () => {
  beforeAll(async () => {
    await db.exec(`
      INSERT INTO public.eventos (id, arena_id, titulo, data_inicio, ativo) VALUES
        ('ev-ativo', 'arena-belem', 'Open', CURRENT_DATE + 20, true),
        ('ev-rascunho', 'arena-belem', 'Rascunho', CURRENT_DATE + 30, false)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.instagram_posts (id, arena_id, imagem_url, ativo) VALUES
        ('post-1', 'arena-belem', '/a.jpg', true), ('post-oculto', 'arena-belem', '/b.jpg', false)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.codigos_acesso (telefone, codigo_hash, provedor, expira_em)
        VALUES ('91999990000', 'x', 'demonstracao', NOW() + interval '10 minutes');`);
  });

  it("visitante lê só eventos e posts ativos", async () => {
    const eventos = await comoPapel("anon", "SELECT id FROM public.eventos WHERE id NOT LIKE 'arena-belem-%' ORDER BY id");
    expect(eventos.rows.map((r) => r.id)).toEqual(["ev-ativo"]);
    const posts = await comoPapel("anon", "SELECT id FROM public.instagram_posts WHERE id NOT LIKE 'arena-belem-%' ORDER BY id");
    expect(posts.rows.map((r) => r.id)).toEqual(["post-1"]);
  });

  it("visitante não altera conteúdo, eventos nem posts", async () => {
    for (const sql of [
      "UPDATE public.eventos SET titulo = 'x'",
      "DELETE FROM public.instagram_posts",
      "UPDATE public.arena_conteudo SET intro_reserva = 'x'",
    ]) {
      const { rows } = await comoPapel("anon", `WITH m AS (${sql} RETURNING 1) SELECT count(*)::int AS n FROM m`);
      expect(rows[0].n, sql).toBe(0);
    }
  });

  it("códigos de acesso são invisíveis para visitante e atleta (só o servidor)", async () => {
    await expect(comoPapel("anon", "SELECT * FROM public.codigos_acesso")).rejects.toThrow(/permission denied/);
    await expect(
      comoPapel("authenticated", "SELECT * FROM public.codigos_acesso", [], "00000000-0000-0000-0000-000000000001")
    ).rejects.toThrow(/permission denied/);
  });

  it("posição da foto só aceita porcentagens (nada de CSS livre)", async () => {
    await expect(
      db.query("UPDATE public.quadras SET foto_posicao = '50%; background:url(x)' WHERE id = 'arena-belem-q1'")
    ).rejects.toThrow(/quadras_foto_posicao_check/);
    await db.query("UPDATE public.quadras SET foto_posicao = '50% 62%' WHERE id = 'arena-belem-q1'");
  });

  it("botão da escolinha só abre link https e exige o link quando é do tipo link", async () => {
    const id = "arena-belem-esc-volei";
    for (const set of [
      "botao_tipo = 'link', botao_url = NULL",
      "botao_tipo = 'link', botao_url = 'javascript:alert(1)'",
      "botao_url = 'http://forms.gle/x'",
      "botao_tipo = 'telefone'",
    ]) {
      await expect(db.query(`UPDATE public.landing_page_schools SET ${set} WHERE id = '${id}'`), set).rejects.toThrow(/landing_page_schools_botao_check/);
    }
    await db.query(`UPDATE public.landing_page_schools SET botao_tipo = 'link', botao_url = 'https://forms.gle/x' WHERE id = '${id}'`);
    await db.query(`UPDATE public.landing_page_schools SET botao_tipo = 'whatsapp', botao_url = NULL, teacher_image_url = NULL, whatsapp_number = NULL WHERE id = '${id}'`);
  });

  it("reembolso só aceita os estados previstos", async () => {
    await expect(
      db.query("UPDATE public.reservas SET reembolso_status = 'qualquer' WHERE arena_id = 'arena-belem'")
    ).rejects.toThrow(/reservas_reembolso_status_check/);
  });

  describe("campos da plataforma em arenas (só o suporte altera)", () => {
    const DONO = "6f1c2a52-0000-4000-8000-00000000d0e0";

    beforeAll(async () => {
      await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'dono-trava@teste.local') ON CONFLICT DO NOTHING`, [DONO]);
      await db.query(
        `INSERT INTO public.arena_usuarios (arena_id, user_id, role, ativo) VALUES ('arena-belem', $1, 'proprietario', true)
         ON CONFLICT DO NOTHING`,
        [DONO]
      );
    });

    it("o dono altera nome e contatos da própria arena", async () => {
      const { rows } = await comoPapel(
        "authenticated",
        "WITH m AS (UPDATE public.arenas SET nome = nome, telefone = telefone WHERE id = 'arena-belem' RETURNING 1) SELECT count(*)::int AS n FROM m",
        [],
        DONO
      );
      expect(rows[0].n).toBe(1);
    });

    it.each([
      ["subdomínio", "slug = 'outra-arena'"],
      ["endereço antigo", "slug_anterior = 'qualquer'"],
      ["módulos contratados", "modulos_ativos = '{agendamento_core,ia_concierge}'"],
      ["arena ativa", "ativo = false"],
      ["convite", "token_convite = 'x'"],
    ])("o dono não altera %s", async (_rotulo, set) => {
      await expect(
        comoPapel("authenticated", `UPDATE public.arenas SET ${set} WHERE id = 'arena-belem'`, [], DONO)
      ).rejects.toThrow(/suporte da plataforma/);
    });

    it("o dono não liga o modo demonstração (sair dele pode)", async () => {
      const { rows } = await db.query("SELECT modo_pagamento FROM public.arenas WHERE id = 'arena-belem'");
      await db.query("UPDATE public.arenas SET modo_pagamento = 'manual' WHERE id = 'arena-belem'");
      await expect(
        comoPapel("authenticated", "UPDATE public.arenas SET modo_pagamento = 'simulado' WHERE id = 'arena-belem'", [], DONO)
      ).rejects.toThrow(/suporte da plataforma/);
      await db.query("UPDATE public.arenas SET modo_pagamento = 'simulado' WHERE id = 'arena-belem'");
      await comoPapel("authenticated", "UPDATE public.arenas SET modo_pagamento = 'manual' WHERE id = 'arena-belem'", [], DONO);
      await db.query("UPDATE public.arenas SET modo_pagamento = $1 WHERE id = 'arena-belem'", [rows[0].modo_pagamento]);
    });

    it("o servidor (service_role) troca o subdomínio e guarda o endereço antigo", async () => {
      await db.transaction(async (tx) => {
        await tx.query("SELECT set_config('request.jwt.claims', $1::text, true)", [JSON.stringify({ role: "service_role" })]);
        await tx.query("SET LOCAL ROLE service_role");
        await tx.query("UPDATE public.arenas SET slug_anterior = slug, slug = 'arena-belem-nova' WHERE id = 'arena-belem'");
      });
      const { rows } = await db.query("SELECT slug, slug_anterior FROM public.arenas WHERE id = 'arena-belem'");
      expect(rows[0]).toEqual({ slug: "arena-belem-nova", slug_anterior: "arena-belem" });
      await db.query("UPDATE public.arenas SET slug = 'arena-belem', slug_anterior = NULL WHERE id = 'arena-belem'");
    });

    it("dois endereços antigos iguais não convivem", async () => {
      await db.query("UPDATE public.arenas SET slug_anterior = 'endereco-velho' WHERE id = 'arena-belem'");
      await db.query(
        "INSERT INTO public.arenas (id, slug, nome) VALUES ('arena-trava-teste', 'arena-trava-teste', 'Teste') ON CONFLICT DO NOTHING"
      );
      await expect(
        db.query("UPDATE public.arenas SET slug_anterior = 'endereco-velho' WHERE id = 'arena-trava-teste'")
      ).rejects.toThrow(/idx_arenas_slug_anterior/);
      await db.query("UPDATE public.arenas SET slug_anterior = NULL WHERE id = 'arena-belem'");
      await db.query("DELETE FROM public.arenas WHERE id = 'arena-trava-teste'");
    });
  });

  it("pedidos de vaga e Clube entram na publicação do tempo real", async () => {
    const { rows } = await db.query(
      "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename"
    );
    expect(rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining(["reservas", "interesses_vagas", "fidelidade_selos", "fidelidade_vouchers"])
    );
  });
});
