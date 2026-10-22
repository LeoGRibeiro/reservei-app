/**
 * @file supabaseMock.ts
 * @description Mock encadeável do cliente Supabase para testes de casos de uso do servidor.
 *
 * Toda chamada de filtro (`eq`, `in`, `or`, `lt`, `order`, `limit`...) é registrada e devolve a
 * própria consulta; o resultado é decidido pela função `resolver` no `await` (ou em
 * `maybeSingle`/`single`), a partir da tabela, da operação, do payload e dos filtros aplicados.
 */

/** Uma consulta registrada pelo mock. */
export interface ConsultaRegistrada {
  tabela: string;
  operacao: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filtros: Array<[string, ...unknown[]]>;
  /** true quando terminou em maybeSingle()/single() */
  unica: boolean;
}

/** Resultado no formato do PostgREST. */
export interface ResultadoMock {
  data?: unknown;
  error?: { message: string } | null;
}

/** Valor de um filtro `eq` aplicado (atalho para os resolvers). */
export function filtroEq(consulta: ConsultaRegistrada, coluna: string): unknown {
  return consulta.filtros.find((f) => f[0] === "eq" && f[1] === coluna)?.[2];
}

/**
 * Cria um cliente Supabase falso.
 *
 * @param resolver Decide o resultado de cada consulta
 * @returns Cliente com `from()`, a lista de consultas executadas e um `auth.getUser` configurável
 */
export function criarSupabaseMock(resolver: (consulta: ConsultaRegistrada) => ResultadoMock) {
  const consultas: ConsultaRegistrada[] = [];

  function construir(tabela: string, operacao: ConsultaRegistrada["operacao"], payload?: unknown) {
    const registro: ConsultaRegistrada = { tabela, operacao, payload, filtros: [], unica: false };
    consultas.push(registro);

    const resolver_ = () => Promise.resolve({ data: null, error: null, ...resolver(registro) });
    const consulta: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(consulta, {
      get(_alvo, prop: string) {
        if (prop === "then") {
          return (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => resolver_().then(ok, falha);
        }
        if (prop === "maybeSingle" || prop === "single") {
          return () => {
            registro.unica = true;
            return resolver_();
          };
        }
        return (...args: unknown[]) => {
          if (prop !== "select") registro.filtros.push([prop, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  }

  const cliente = {
    from: (tabela: string) => ({
      select: () => construir(tabela, "select"),
      insert: (payload: unknown) => construir(tabela, "insert", payload),
      update: (payload: unknown) => construir(tabela, "update", payload),
      upsert: (payload: unknown) => construir(tabela, "upsert", payload),
      delete: () => construir(tabela, "delete"),
    }),
    auth: {
      getUser: async (_token: string): Promise<{ data: { user: { id: string; email: string } | null }; error: unknown }> => ({
        data: { user: null },
        error: null,
      }),
    },
  };

  return { cliente, consultas };
}
