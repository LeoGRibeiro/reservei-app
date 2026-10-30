// @vitest-environment node
/**
 * @file portalRepository.test.ts
 * @description Carrega o portal da arena de exemplo do Supabase local (schema, migrações e seed reais,
 * com RLS de visitante) e confere as regras de visibilidade das seções.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
// @ts-expect-error módulo JS de infraestrutura de teste (sem tipos)
import { iniciarSupabaseLocal } from "../../supabase-local/servidor.mjs";
// @ts-expect-error módulo JS de infraestrutura de teste (sem tipos)
import { RAIZ_SRC } from "../../supabase-local/banco.mjs";
import type { DadosPortal } from "@/lib/portal/types";

let local: { url: string; chaves: { anon: string }; db: { exec: (s: string) => Promise<unknown> }; fechar: () => Promise<void> };
let carregar: (slug: string) => Promise<DadosPortal | null>;
let visiveis: typeof import("@/lib/portal/visibilidade");

beforeAll(async () => {
  local = await iniciarSupabaseLocal({ porta: 54371, seeds: [join(RAIZ_SRC, "lib", "supabase", "seed-arena-exemplo.sql")] });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", local.url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", local.chaves.anon);
  vi.resetModules();
  carregar = (await import("@/lib/portal/portalRepository")).carregarDadosPortal;
  visiveis = await import("@/lib/portal/visibilidade");
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await local?.fechar();
});

describe("carregarDadosPortal (arena de exemplo)", () => {
  it("devolve null para arena inexistente", async () => {
    expect(await carregar("nao-existe")).toBeNull();
  });

  it("carrega todas as seções da arena de exemplo", async () => {
    const d = await carregar("arena-exemplo");
    expect(d).not.toBeNull();
    const dados = d as DadosPortal;
    expect(dados.arena.nome).toBe("Arena Exemplo");
    expect(dados.arena.endereco).toBe("Rua do Exemplo, 100");
    expect(dados.quadras.map((q) => q.nome)).toEqual(["Quadra de Areia 1", "Quadra de Areia 2", "Society"]);
    expect(dados.precos.length).toBe(3);
    expect(dados.conteudo.destaquesEstrutura).toHaveLength(3);
    expect(dados.escolinhas.map((e) => e.turmas.length)).toEqual([2, 1]);
    expect(dados.eventos.map((e) => e.status).sort()).toEqual(["em_andamento", "encerrado", "inscricoes"]);
    expect(dados.galeria).toHaveLength(4);
    expect(dados.instagram.posts[0].fixado).toBe(true);
    expect(dados.instagram.perfil?.contagemSimulada).toBe(true);
    expect(dados.clube?.valorTeto).toBe(100);
    expect(dados.tema.marca).toBe("#26313f");
  });

  it("todas as seções e itens de menu aparecem com módulos e dados", async () => {
    const dados = (await carregar("arena-exemplo")) as DadosPortal;
    const secoes = visiveis.secoesVisiveis(dados);
    expect(secoes).toEqual({ escolinhas: true, eventos: true, clube: true, estrutura: true, instagram: true, partidas: true });
    expect(visiveis.itensDoMenu(secoes).map((i) => i.rotulo)).toEqual([
      "Reservar", "Escolinhas", "Campeonatos", "Estrutura", "Contato",
    ]);
  });

  it("seção some sem o módulo, mesmo com dados; e some sem dados, mesmo com o módulo", async () => {
    await local.db.exec("UPDATE public.arenas SET modulos_ativos = '{agendamento_core,escolinhas}' WHERE id = 'arena-exemplo'");
    await local.db.exec("UPDATE public.landing_page_schools SET is_active = false WHERE arena_id = 'arena-exemplo'");
    const dados = (await carregar("arena-exemplo")) as DadosPortal;
    const secoes = visiveis.secoesVisiveis(dados);
    expect(secoes.eventos).toBe(false);
    expect(secoes.instagram).toBe(false);
    expect(secoes.clube).toBe(false);
    expect(secoes.escolinhas).toBe(false);
    expect(visiveis.itensDoMenu(secoes).map((i) => i.rotulo)).toEqual(["Reservar", "Estrutura", "Contato"]);
  });
});
