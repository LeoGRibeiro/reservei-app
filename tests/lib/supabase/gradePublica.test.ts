/**
 * @file gradePublica.test.ts
 * @description Testes da leitura da grade pública sanitizada (função `grade_publica`, LGPD), do
 * escopo estrito pela arena ativa e da mescla com as reservas visíveis ao usuário atual.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  arenaId: "a1" as string | null,
  reservas: { data: [] as unknown[], error: null as { message: string } | null },
  grade: { data: [] as unknown[], error: null as { message: string } | null },
  filtros: [] as string[],
  rpc: [] as Array<{ funcao: string; args: Record<string, unknown> }>,
  /** Páginas devolvidas em sequência (quando definido, substitui `reservas`) */
  paginas: null as unknown[][] | null,
  ranges: [] as Array<[number, number]>,
}));

function cadeia(resultado: () => unknown) {
  const c = {
    eq: (col: string, v: string) => (mocks.filtros.push(`eq:${col}:${v}`), c),
    gte: (col: string, v: string) => (mocks.filtros.push(`gte:${col}:${v}`), c),
    lte: (col: string, v: string) => (mocks.filtros.push(`lte:${col}:${v}`), c),
    order: () => c,
    range: (de: number, ate: number) => {
      mocks.ranges.push([de, ate]);
      if (mocks.paginas) return Promise.resolve({ data: mocks.paginas.shift() ?? [], error: null });
      return Promise.resolve(resultado());
    },
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado()).then(resolve),
  };
  return c;
}

vi.mock("@/lib/arena/arenaAtiva", () => ({
  obterArenaAtivaId: () => Promise.resolve(mocks.arenaId),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: () => ({ select: () => cadeia(() => mocks.reservas) }),
    rpc: (funcao: string, args: Record<string, unknown>) => {
      mocks.rpc.push({ funcao, args });
      return Promise.resolve(mocks.grade);
    },
  },
}));

import {
  fetchGradePublicaSupabase,
  fetchReservasPeriodoSupabase,
  fetchReservasPorMesSupabase,
} from "@/lib/supabase/reservasService";

const slot = (id: string) => ({
  id,
  arena_id: "a1",
  quadra_id: "q1",
  data: "2026-10-30",
  horarios: ["20:00"],
  hora_inicio: "20:00",
  hora_fim: "21:00",
  status: "confirmada",
});

describe("grade pública (função grade_publica)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.arenaId = "a1";
    mocks.reservas = { data: [], error: null };
    mocks.grade = { data: [], error: null };
    mocks.filtros = [];
    mocks.rpc = [];
    mocks.paginas = null;
    mocks.ranges = [];
  });

  it("converte os slots em reservas sem dados pessoais, sempre na arena ativa", async () => {
    mocks.grade = { data: [slot("r1")], error: null };

    const [r] = await fetchGradePublicaSupabase();

    expect(r).toMatchObject({ id: "r1", quadraId: "q1", status: "confirmada", nomeCliente: "", cpfCliente: "" });
    expect(mocks.rpc).toEqual([
      { funcao: "grade_publica", args: { p_arena_id: "a1", p_data_inicio: null, p_data_fim: null } },
    ]);
  });

  it("retorna lista vazia quando a função falha", async () => {
    mocks.grade = { data: [], error: { message: "function does not exist" } };

    expect(await fetchGradePublicaSupabase()).toEqual([]);
  });

  it("não consulta nada quando o subdomínio não corresponde a uma arena", async () => {
    mocks.arenaId = null;

    expect(await fetchGradePublicaSupabase()).toEqual([]);
    expect(await fetchReservasPeriodoSupabase("2026-10-01", "2026-10-31")).toEqual([]);
    expect(mocks.rpc).toHaveLength(0);
  });

  it("filtra as reservas pela arena ativa e mescla slots de terceiros sem duplicar ids", async () => {
    mocks.reservas = { data: [{ ...slot("minha"), nome_cliente: "Eu" }], error: null };
    mocks.grade = { data: [slot("minha"), slot("de-terceiro")], error: null };

    const todas = await fetchReservasPeriodoSupabase("2026-10-01", "2026-10-31");

    expect(todas?.map((r) => r.id)).toEqual(["minha", "de-terceiro"]);
    expect(todas?.find((r) => r.id === "minha")?.nomeCliente).toBe("Eu");
    expect(mocks.filtros).toContain("eq:arena_id:a1");
  });

  it("aplica o intervalo do mês também na grade pública", async () => {
    mocks.grade = { data: [slot("x")], error: null };

    const todas = await fetchReservasPorMesSupabase(2026, 10);

    expect(todas?.map((r) => r.id)).toEqual(["x"]);
    expect(mocks.filtros).toContain("gte:data:2026-10-01");
    expect(mocks.filtros).toContain("lte:data:2026-10-31");
    expect(mocks.rpc[0].args).toEqual({ p_arena_id: "a1", p_data_inicio: "2026-10-01", p_data_fim: "2026-10-31" });
  });

  it("mantém o retorno nulo quando a consulta principal falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.reservas = { data: [], error: { message: "erro" } };

    expect(await fetchReservasPeriodoSupabase("2026-10-01", "2026-10-31")).toBeNull();
  });

  it("lê em páginas de 1.000 até o fim (passa do limite do Supabase sem perder linhas)", async () => {
    const pagina = (n: number, prefixo: string) => Array.from({ length: n }, (_, i) => slot(`${prefixo}-${i}`));
    mocks.paginas = [pagina(1000, "a"), pagina(1000, "b"), pagina(5, "c")];

    const todas = await fetchReservasPeriodoSupabase("2026-10-01", "2026-12-31", { incluirGradePublica: false });

    expect(todas).toHaveLength(2005);
    expect(mocks.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(mocks.rpc).toHaveLength(0);
  });

  it("filtra por quadra também na grade pública", async () => {
    mocks.grade = { data: [slot("q1-slot"), { ...slot("q2-slot"), quadra_id: "q2" }], error: null };

    const todas = await fetchReservasPeriodoSupabase("2026-10-30", "2026-10-30", { quadraId: "q1" });

    expect(todas?.map((r) => r.id)).toEqual(["q1-slot"]);
    expect(mocks.filtros).toContain("eq:quadra_id:q1");
  });
});
