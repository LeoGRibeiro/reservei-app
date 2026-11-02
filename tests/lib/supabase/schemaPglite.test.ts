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

  it("horário de grupo aparece como reserva comum: sem nome, sem WhatsApp e sem turma (nunca 'Aula')", async () => {
    await db.query(
      `INSERT INTO public.contratos_recorrentes (id, arena_id, tipo, nome, responsavel_nome, contato_whatsapp, quadra_id,
         dias_semana, hora_inicio, hora_fim, data_inicio, meses, escolinha_id, ativo)
       VALUES ('ctr-grupo-pg', 'arena-belem', 'grupo', 'Pelada do Marcos', 'Marcos', '91988887777', 'arena-belem-q1',
         '{2}', '21:00', '22:00', '2031-04-01', 1, 'esc-qualquer', true)`
    );
    await db.query(
      `INSERT INTO public.reservas (id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
         cpf_cliente, valor_total, valor_sinal, valor_pendente, status, tipo_reserva, contrato_id, criada_em)
       VALUES ('rsv-grupo-pg', 'arena-belem', 'arena-belem-q1', '2031-04-01', '{21:00}', '21:00', '22:00', 'Pelada do Marcos',
         '91988887777', '', 100, 0, 100, 'confirmada', 'grupo', 'ctr-grupo-pg', now())`
    );
    const { rows } = await comoPapel("anon", "SELECT * FROM public.grade_publica('arena-belem', '2031-04-01', '2031-04-01')");
    const grupo = rows.find((r) => r.id === "rsv-grupo-pg");
    expect(grupo).toBeDefined();
    expect(grupo?.tipo_reserva).toBe("grupo");
    expect(grupo?.nome_cliente ?? null).toBeNull();
    expect(grupo?.whatsapp_cliente ?? null).toBeNull();
    // Mesmo com escolinha_id no contrato, grupo não vira turma de escolinha
    expect(grupo?.escolinha_id ?? null).toBeNull();
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

  describe("trava contra reserva dupla e números do painel (migração 2026-11-02-b)", () => {
    const DIA = "2031-03-10";
    const inserir = (id: string, horarios: string[], extra = "") =>
      db.query(
        `INSERT INTO public.reservas (id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
           cpf_cliente, valor_total, valor_sinal, valor_pendente, status, criada_em ${extra ? ", " + extra.split("=")[0] : ""})
         VALUES ($1, 'arena-belem', 'arena-belem-q1', '${DIA}', $2, $3, '23:00', 'Ana Souza', '(91) 99999-0001', '', 100, 50, 50, 'pendente', now()
           ${extra ? ", " + extra.split("=")[1] : ""})`,
        [id, horarios, horarios[0]]
      );

    it("não deixa gravar duas reservas no mesmo horário da mesma quadra", async () => {
      await inserir("dup-1", ["19:00", "20:00"]);
      await expect(inserir("dup-2", ["20:00"])).rejects.toThrow(/Horário já ocupado/);
      await inserir("dup-3", ["21:00"]);
    });

    it("Pix com prazo vencido ou reserva cancelada liberam o horário", async () => {
      await db.query(
        `UPDATE public.reservas SET status = 'em_processamento', expira_em = now() - interval '1 minute' WHERE id = 'dup-3'`
      );
      await inserir("dup-4", ["21:00"]);
      await db.query("UPDATE public.reservas SET status = 'cancelada' WHERE id = 'dup-1'");
      await inserir("dup-5", ["19:00"]);
    });

    it("remarcar para um horário ocupado é barrado; quitar quem já ocupava não", async () => {
      await expect(db.query("UPDATE public.reservas SET horarios = '{19:00}' WHERE id = 'dup-4'")).rejects.toThrow(/Horário já ocupado/);
      await db.query("UPDATE public.reservas SET status = 'confirmada', valor_pendente = 0 WHERE id = 'dup-4'");
    });

    it("reativar uma reserva cancelada cujo horário foi ocupado é barrado", async () => {
      await expect(db.query("UPDATE public.reservas SET status = 'pendente' WHERE id = 'dup-1'")).rejects.toThrow(/Horário já ocupado/);
    });

    it("resumo_financeiro soma só o período, separa recebido e a receber e ignora canceladas", async () => {
      const { rows } = await db.query("SELECT public.resumo_financeiro('arena-belem', $1, $1) AS r", [DIA]);
      const r = rows[0].r as Record<string, unknown>;
      // dup-4 quitada (100 recebido) + dup-5 sinal pago (50 recebido, 50 a receber); dup-1 cancelada
      expect(r).toMatchObject({ reservas: 2, recebido: 150, a_receber: 50, canceladas: 1 });
      expect(r.por_quadra).toEqual([{ quadra_id: "arena-belem-q1", reservas: 2, recebido: 150, a_receber: 50 }]);
    });

    it("clientes_da_arena agrupa pelo WhatsApp com ou sem o 55 e guarda os outros nomes", async () => {
      await db.query(
        `UPDATE public.reservas SET whatsapp_cliente = '5591999990001', nome_cliente = 'Ana S.' WHERE id = 'dup-5'`
      );
      const { rows } = await db.query("SELECT * FROM public.clientes_da_arena('arena-belem') WHERE telefone = '91999990001'");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ reservas: 2, canceladas: 1 });
      expect([rows[0].nome, ...(rows[0].outros_nomes as string[])].sort()).toEqual(["Ana S.", "Ana Souza"]);
    });

    it("visitante não chama as funções do painel", async () => {
      await expect(comoPapel("anon", "SELECT public.resumo_financeiro('arena-belem', CURRENT_DATE, CURRENT_DATE)")).rejects.toThrow(/permission denied/);
    });
  });

  describe("quadra fechada por período (migração 2026-11-02-f)", () => {
    const reservar = (id: string, data: string, tipo = "avulsa") =>
      db.query(
        `INSERT INTO public.reservas (id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
           cpf_cliente, valor_total, valor_sinal, valor_pendente, status, tipo_reserva, criada_em)
         VALUES ($1, 'arena-belem', 'arena-belem-q2', $2, '{19:00}', '19:00', '20:00', 'Bia', '91999990002', '', 100, 50, 50, 'pendente', $3, now())`,
        [id, data, tipo]
      );
    const fechar = (inicio: string | null, fim: string | null, motivo: string | null) =>
      db.query("UPDATE public.quadras SET bloqueio_inicio = $1, bloqueio_fim = $2, bloqueio_motivo = $3 WHERE id = 'arena-belem-q2'", [inicio, fim, motivo]);

    it("reserva antiga no período continua; reserva nova é barrada com o motivo", async () => {
      await reservar("fech-antiga", "2032-05-10");
      await fechar("2032-05-09", "2032-05-12", "Reforma do piso");
      await expect(reservar("fech-nova", "2032-05-11")).rejects.toThrow(/Quadra fechada nesta data \(Reforma do piso\)/);
      // Fora do período, segue normal
      await reservar("fech-depois", "2032-05-13");
      // A reserva antiga pode ser quitada sem esbarrar na trava
      await db.query("UPDATE public.reservas SET status = 'confirmada', valor_pendente = 0 WHERE id = 'fech-antiga'");
    });

    it("bloqueio de horário do painel passa; reativar uma cancelada no período é barrado", async () => {
      await reservar("fech-bloqueio", "2032-05-11", "manutencao_bloqueio");
      await db.query("UPDATE public.reservas SET status = 'cancelada' WHERE id = 'fech-antiga'");
      await expect(db.query("UPDATE public.reservas SET status = 'pendente' WHERE id = 'fech-antiga'")).rejects.toThrow(/Quadra fechada/);
    });

    it("'até eu liberar' fecha qualquer data futura; reabrir libera", async () => {
      await fechar("2032-06-01", null, "Evento");
      await expect(reservar("fech-longe", "2033-01-20")).rejects.toThrow(/Quadra fechada/);
      await fechar(null, null, null);
      await reservar("fech-reaberta", "2033-01-20");
    });

    it("período invertido ou motivo longo demais são recusados", async () => {
      await expect(fechar("2032-07-10", "2032-07-01", "X")).rejects.toThrow(/quadras_bloqueio_periodo_check/);
      await expect(fechar(null, "2032-07-01", null)).rejects.toThrow(/quadras_bloqueio_periodo_check/);
      await expect(fechar("2032-07-01", null, "x".repeat(121))).rejects.toThrow(/quadras_bloqueio_motivo_check/);
    });
  });

  describe("hora grátis com aprovação do dono (migração 2026-11-02-g)", () => {
    const OPERADOR = "6f1c2a52-0000-4000-8000-00000000f1d0";
    const ATLETA = "6f1c2a52-0000-4000-8000-00000000a7a0";
    const voucher = (id: string, status: string, motivo: string | null = null) =>
      db.query(
        `INSERT INTO public.fidelidade_vouchers (id, arena_id, codigo, usuario_id, valor_teto, status, expira_em, motivo_analise)
         VALUES ($1, 'arena-belem', $1, $2, 100, $3, CURRENT_DATE + 30, $4)`,
        [id, ATLETA, status, motivo]
      );

    beforeAll(async () => {
      await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'operador-fid@teste.local') ON CONFLICT DO NOTHING`, [OPERADOR]);
      await db.query(
        `INSERT INTO public.arena_usuarios (arena_id, user_id, role, ativo) VALUES ('arena-belem', $1, 'operador', true) ON CONFLICT DO NOTHING`,
        [OPERADOR]
      );
      await voucher("fid-analise", "em_analise");
    });

    it("aceita os status novos e exige motivo na recusa", async () => {
      await voucher("fid-recusado", "recusado", "Horas de reservas canceladas");
      await expect(voucher("fid-recusa-sem-motivo", "recusado")).rejects.toThrow(/fidelidade_vouchers_recusa_check/);
      await expect(voucher("fid-status-errado", "liberado")).rejects.toThrow(/fidelidade_vouchers_status_check/);
    });

    it("a equipe lê, mas não libera pela API (só o servidor grava)", async () => {
      const lidos = await comoPapel("authenticated", "SELECT count(*)::int AS n FROM public.fidelidade_vouchers WHERE id = 'fid-analise'", [], OPERADOR);
      expect(lidos.rows[0].n).toBe(1);
      const alterados = await comoPapel(
        "authenticated",
        "WITH m AS (UPDATE public.fidelidade_vouchers SET status = 'disponivel' WHERE id = 'fid-analise' RETURNING 1) SELECT count(*)::int AS n FROM m",
        [],
        OPERADOR
      );
      expect(alterados.rows[0].n).toBe(0);
      const { rows } = await db.query("SELECT status FROM public.fidelidade_vouchers WHERE id = 'fid-analise'");
      expect(rows[0].status).toBe("em_analise");
    });

    it("o atleta lê os próprios vouchers e não altera", async () => {
      const lidos = await comoPapel("authenticated", "SELECT count(*)::int AS n FROM public.fidelidade_vouchers WHERE id = 'fid-analise'", [], ATLETA);
      expect(lidos.rows[0].n).toBe(1);
      const alterados = await comoPapel(
        "authenticated",
        "WITH m AS (UPDATE public.fidelidade_vouchers SET status = 'disponivel' WHERE id = 'fid-analise' RETURNING 1) SELECT count(*)::int AS n FROM m",
        [],
        ATLETA
      );
      expect(alterados.rows[0].n).toBe(0);
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
