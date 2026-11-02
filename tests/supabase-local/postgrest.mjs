/**
 * @file postgrest.mjs
 * @description Subconjunto do PostgREST sobre o PGlite, suficiente para o supabase-js do projeto:
 * select (com embed muitos-para-um), filtros, or/and, order, limit/offset, insert/upsert, update,
 * delete e rpc. Cada requisição roda numa transação com o papel do JWT (anon, authenticated ou
 * service_role) e `request.jwt.claims`, então o RLS do schema real é aplicado de verdade.
 * Todo valor vindo da URL entra como texto e é convertido explicitamente para o tipo da coluna.
 */

const OPERADORES = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
  cs: "@>",
  cd: "<@",
  ov: "&&",
};
const PARAMS_RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"]);
const PAPEIS = new Set(["anon", "authenticated", "service_role"]);

/** Erro com status HTTP e corpo no formato do PostgREST. */
export class ErroPostgrest extends Error {
  constructor(status, code, message, details = null, hint = null) {
    super(message);
    this.status = status;
    this.corpo = { code, message, details, hint };
  }
}

const ident = (nome) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome)) throw new ErroPostgrest(400, "PGRST100", `Identificador inválido: ${nome}`);
  return `"${nome}"`;
};

/** Divide por vírgula respeitando parênteses e aspas. */
function dividir(texto) {
  const partes = [];
  let nivel = 0;
  let aspas = false;
  let atual = "";
  for (const c of texto) {
    if (c === '"') aspas = !aspas;
    if (!aspas && c === "(") nivel++;
    if (!aspas && c === ")") nivel--;
    if (c === "," && nivel === 0 && !aspas) {
      partes.push(atual);
      atual = "";
    } else atual += c;
  }
  if (atual) partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

const tirarAspas = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

/**
 * Monta uma condição SQL a partir de `coluna` e `op.valor` (ex.: `eq.10`, `not.is.null`, `in.(a,b)`).
 *
 * @param {string} coluna Coluna
 * @param {string} expr Expressão PostgREST
 * @param {unknown[]} params Lista de parâmetros (recebe os valores)
 * @param {string} alias Alias da tabela
 * @param {Map<string,string>} tipos Tipo SQL de cada coluna da tabela
 * @returns {string} Condição SQL
 */
function condicao(coluna, expr, params, alias, tipos) {
  let negar = false;
  let resto = expr;
  if (resto.startsWith("not.")) {
    negar = true;
    resto = resto.slice(4);
  }
  const ponto = resto.indexOf(".");
  const op = resto.slice(0, ponto);
  const valor = resto.slice(ponto + 1);
  const col = `${alias}.${ident(coluna)}`;
  const tipo = tipos.get(coluna) ?? "text";
  const p = (v) => {
    params.push(v);
    return `$${params.length}::text`;
  };
  let sql;
  if (op === "is") {
    const lit = { null: "NULL", true: "TRUE", false: "FALSE", unknown: "UNKNOWN" }[valor.toLowerCase()];
    if (!lit) throw new ErroPostgrest(400, "PGRST100", `Valor inválido para is: ${valor}`);
    sql = `${col} IS ${lit}`;
  } else if (op === "in") {
    const itens = dividir(valor.replace(/^\(/, "").replace(/\)$/, "")).map(tirarAspas);
    const literal = `{${itens.map((i) => `"${i.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
    sql = `${col} = ANY(CAST(${p(literal)} AS ${tipo}[]))`;
  } else if (op === "like" || op === "ilike") {
    sql = `${col}::text ${OPERADORES[op]} ${p(valor.replaceAll("*", "%"))}`;
  } else if (OPERADORES[op]) {
    sql = `${col} ${OPERADORES[op]} CAST(${p(valor)} AS ${tipo})`;
  } else {
    throw new ErroPostgrest(400, "PGRST100", `Operador não suportado: ${op}`);
  }
  return negar ? `NOT (${sql})` : sql;
}

/** Converte `or=(a.eq.1,b.is.null)` em SQL. */
function grupoLogico(texto, juncao, params, alias, tipos) {
  const interno = texto.replace(/^\(/, "").replace(/\)$/, "");
  const conds = dividir(interno).map((item) => {
    const aninhado = item.match(/^(not\.)?(or|and)\((.*)\)$/);
    if (aninhado) {
      const sql = grupoLogico(`(${aninhado[3]})`, aninhado[2].toUpperCase(), params, alias, tipos);
      return aninhado[1] ? `NOT ${sql}` : sql;
    }
    const ponto = item.indexOf(".");
    return condicao(item.slice(0, ponto), item.slice(ponto + 1), params, alias, tipos);
  });
  return `(${conds.join(` ${juncao} `)})`;
}

/** WHERE a partir dos parâmetros da URL. */
function montarWhere(busca, params, alias, tipos) {
  const conds = [];
  for (const [chave, valor] of busca) {
    if (chave === "or") conds.push(grupoLogico(valor, "OR", params, alias, tipos));
    else if (chave === "and") conds.push(grupoLogico(valor, "AND", params, alias, tipos));
    else if (!PARAMS_RESERVADOS.has(chave)) conds.push(condicao(chave, valor, params, alias, tipos));
  }
  return conds.length ? `WHERE ${conds.join(" AND ")}` : "";
}

/** ORDER BY a partir de `order=col.desc.nullslast,col2`. */
function montarOrdem(texto, alias) {
  if (!texto) return "";
  const itens = dividir(texto).map((item) => {
    const [col, ...mods] = item.split(".");
    const dir = mods.includes("desc") ? "DESC" : "ASC";
    const nulls = mods.includes("nullsfirst") ? " NULLS FIRST" : mods.includes("nullslast") ? " NULLS LAST" : "";
    return `${alias}.${ident(col)} ${dir}${nulls}`;
  });
  return `ORDER BY ${itens.join(", ")}`;
}

/** Tipo SQL de cada coluna de uma tabela do schema public. */
async function tiposDaTabela(tx, tabela) {
  const { rows } = await tx.query(
    `SELECT a.attname AS col, format_type(a.atttypid, a.atttypmod) AS tipo
       FROM pg_attribute a
      WHERE a.attrelid = to_regclass('public.' || $1::text) AND a.attnum > 0 AND NOT a.attisdropped`,
    [tabela]
  );
  return new Map(rows.map((r) => [r.col, r.tipo]));
}

/** Colunas da chave primária (alvo padrão do upsert). */
async function chavePrimaria(tx, tabela) {
  const { rows } = await tx.query(
    `SELECT a.attname AS col FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = to_regclass('public.' || $1::text) AND i.indisprimary`,
    [tabela]
  );
  return rows.map((r) => r.col);
}

/**
 * Lista de colunas do SELECT, com embed muitos-para-um (`arenas(slug)`) resolvido pela FK.
 */
async function montarColunas(tx, tabela, select, alias) {
  if (!select || select === "*") return `${alias}.*`;
  const partes = [];
  for (const item of dividir(select)) {
    const embed = item.match(/^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/);
    if (!embed) {
      const [col, rotulo] = item.includes(":") ? item.split(":").reverse() : [item, null];
      partes.push(col === "*" ? `${alias}.*` : `${alias}.${ident(col)}${rotulo ? ` AS ${ident(rotulo)}` : ""}`);
      continue;
    }
    const [, rotulo, alvo, colunasAlvo] = embed;
    const { rows } = await tx.query(
      `SELECT la.attname AS local, ra.attname AS remoto
         FROM pg_constraint c
         JOIN pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
         JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
        WHERE c.contype = 'f' AND c.conrelid = to_regclass('public.' || $1::text)
          AND c.confrelid = to_regclass('public.' || $2::text) LIMIT 1`,
      [tabela, alvo]
    );
    if (!rows[0]) throw new ErroPostgrest(400, "PGRST200", `Sem relação entre ${tabela} e ${alvo}`);
    const cols = colunasAlvo === "*" ? "*" : dividir(colunasAlvo).map(ident).join(", ");
    const sub = `(SELECT row_to_json(e) FROM (SELECT ${cols} FROM public.${ident(alvo)}
      WHERE ${ident(rows[0].remoto)} = ${alias}.${ident(rows[0].local)}) e)`;
    partes.push(`${sub} AS ${ident(rotulo ?? alvo)}`);
  }
  return partes.join(", ");
}

/** Lê o papel e as claims do JWT da requisição (sem verificar assinatura: ambiente de teste). */
export function claimsDoCabecalho(cabecalhos) {
  const bruto = cabecalhos.authorization?.replace(/^Bearer\s+/i, "") || cabecalhos.apikey || "";
  try {
    const claims = JSON.parse(Buffer.from(bruto.split(".")[1], "base64url").toString("utf8"));
    return PAPEIS.has(claims.role) ? claims : { role: "anon" };
  } catch {
    return { role: "anon" };
  }
}

/** Converte erro do Postgres no status e código que o PostgREST usaria. */
function traduzirErro(err, papel) {
  if (err instanceof ErroPostgrest) return err;
  const code = err.code ?? "XX000";
  if (code === "42P01") return new ErroPostgrest(404, "PGRST205", err.message);
  if (code === "42883") return new ErroPostgrest(404, "PGRST202", err.message);
  if (code === "42703") return new ErroPostgrest(400, "PGRST204", err.message);
  if (code === "23505" || code === "23503") return new ErroPostgrest(409, code, err.message, err.detail ?? null);
  if (code === "42501") return new ErroPostgrest(papel === "anon" ? 401 : 403, code, err.message);
  return new ErroPostgrest(400, code, err.message, err.detail ?? null);
}

/**
 * Monta o SQL da chamada RPC com os argumentos convertidos para os tipos da assinatura.
 */
async function montarRpc(tx, nome, args, params) {
  const { rows: info } = await tx.query(
    `SELECT p.proretset AS conjunto, t.typtype AS tipo, p.proargnames AS nomes,
            ARRAY(SELECT format_type(x, NULL) FROM unnest(p.proargtypes) x) AS tipos
       FROM pg_proc p JOIN pg_type t ON t.oid = p.prorettype
      WHERE p.proname = $1::text AND p.pronamespace = 'public'::regnamespace LIMIT 1`,
    [nome]
  );
  if (!info[0]) throw new ErroPostgrest(404, "PGRST202", `Função ${nome} não encontrada`);
  const tiposArgs = new Map((info[0].nomes ?? []).map((n, i) => [n, info[0].tipos[i]]));
  const nomes = Object.keys(args);
  for (const k of nomes) {
    const v = args[k];
    params.push(v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const chamada = `public.${ident(nome)}(${nomes
    .map((k, i) => `${ident(k)} => CAST($${i + 1}::text AS ${tiposArgs.get(k) ?? "text"})`)
    .join(", ")})`;
  return info[0].conjunto || info[0].tipo === "c"
    ? `SELECT COALESCE(json_agg(r), '[]'::json) AS dados FROM ${chamada} r`
    : `SELECT to_json(${chamada}) AS dados`;
}

/**
 * Executa uma requisição REST e devolve `{ status, corpo, cabecalhos, mudancas }`.
 * `mudancas` lista as linhas gravadas, para o Realtime local transmitir.
 *
 * @param {import("@electric-sql/pglite").PGlite} db Banco
 * @param {{ metodo: string, caminho: string, busca: URLSearchParams, cabecalhos: Record<string,string>, corpo: unknown }} req
 */
export async function executarRest(db, req) {
  const claims = claimsDoCabecalho(req.cabecalhos);
  const papel = claims.role;
  const prefer = req.cabecalhos.prefer ?? "";
  const objetoUnico = (req.cabecalhos.accept ?? "").includes("vnd.pgrst.object");
  const rpc = req.caminho.startsWith("rpc/");
  const nome = rpc ? req.caminho.slice(4) : req.caminho;

  try {
    ident(nome);
    return await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claims', $1::text, true)", [JSON.stringify(claims)]);
      await tx.query(`SET LOCAL ROLE ${papel}`);
      const params = [];
      let sql;
      let tipo = req.metodo;

      if (rpc) {
        const args = req.corpo && typeof req.corpo === "object" ? req.corpo : Object.fromEntries(req.busca);
        sql = await montarRpc(tx, nome, args, params);
        tipo = "RPC";
      } else if (req.metodo === "GET" || req.metodo === "HEAD") {
        const where = montarWhere(req.busca, params, "t", await tiposDaTabela(tx, nome));
        const colunas = await montarColunas(tx, nome, req.busca.get("select"), "t");
        const limite = req.busca.get("limit") ? `LIMIT ${Number(req.busca.get("limit"))}` : "";
        const desloc = req.busca.get("offset") ? `OFFSET ${Number(req.busca.get("offset"))}` : "";
        sql = `SELECT COALESCE(json_agg(x), '[]'::json) AS dados,
                      (SELECT count(*)::int FROM public.${ident(nome)} t ${where}) AS total
                 FROM (SELECT ${colunas} FROM public.${ident(nome)} t ${where}
                       ${montarOrdem(req.busca.get("order"), "t")} ${limite} ${desloc}) x`;
      } else if (req.metodo === "POST") {
        const linhas = Array.isArray(req.corpo) ? req.corpo : [req.corpo];
        const cols = req.busca.get("columns")?.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1")) ?? [...new Set(linhas.flatMap((l) => Object.keys(l ?? {})))];
        params.push(JSON.stringify(linhas));
        const lista = cols.map(ident).join(", ");
        let conflito = "";
        if (prefer.includes("resolution=")) {
          const alvo = (req.busca.get("on_conflict")?.split(",") ?? (await chavePrimaria(tx, nome))).map(ident).join(", ");
          conflito = prefer.includes("ignore-duplicates")
            ? `ON CONFLICT (${alvo}) DO NOTHING`
            : `ON CONFLICT (${alvo}) DO UPDATE SET ${cols.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`;
        }
        sql = `WITH g AS (INSERT INTO public.${ident(nome)} (${lista})
                 SELECT ${lista} FROM json_populate_recordset(NULL::public.${ident(nome)}, $1::text::json) ${conflito}
                 RETURNING *)
               SELECT COALESCE(json_agg(g), '[]'::json) AS dados FROM g`;
        tipo = "INSERT";
      } else if (req.metodo === "PATCH") {
        const cols = Object.keys(req.corpo ?? {}).map(ident);
        params.push(JSON.stringify(req.corpo ?? {}));
        const where = montarWhere(req.busca, params, "t", await tiposDaTabela(tx, nome));
        const alvo = cols.length === 1 ? cols[0] : `(${cols.join(", ")})`;
        sql = `WITH g AS (UPDATE public.${ident(nome)} t SET ${alvo} =
                 (SELECT ${cols.join(", ")} FROM json_populate_record(NULL::public.${ident(nome)}, $1::text::json))
                 ${where} RETURNING t.*)
               SELECT COALESCE(json_agg(g), '[]'::json) AS dados FROM g`;
        tipo = "UPDATE";
      } else if (req.metodo === "DELETE") {
        const where = montarWhere(req.busca, params, "t", await tiposDaTabela(tx, nome));
        sql = `WITH g AS (DELETE FROM public.${ident(nome)} t ${where} RETURNING t.*)
               SELECT COALESCE(json_agg(g), '[]'::json) AS dados FROM g`;
        tipo = "DELETE";
      } else {
        throw new ErroPostgrest(405, "PGRST117", `Método ${req.metodo} não suportado`);
      }

      const { rows } = await tx.query(sql, params);
      let dados = rows[0]?.dados ?? null;
      const total = rows[0]?.total;
      const mudancas = ["INSERT", "UPDATE", "DELETE"].includes(tipo) ? { tipo, tabela: nome, linhas: dados } : null;

      if (objetoUnico) {
        const lista = Array.isArray(dados) ? dados : [dados];
        if (lista.length !== 1) {
          throw new ErroPostgrest(406, "PGRST116", "JSON object requested, multiple (or no) rows returned",
            `The result contains ${lista.length} rows`);
        }
        dados = lista[0];
      }

      const cabecalhos = {};
      if (Array.isArray(dados)) {
        cabecalhos["content-range"] = `0-${Math.max(dados.length - 1, 0)}/${prefer.includes("count=") ? (total ?? dados.length) : "*"}`;
      }
      const escrita = tipo === "INSERT" || tipo === "UPDATE" || tipo === "DELETE";
      const minimo = escrita && !prefer.includes("return=representation");
      const status = tipo === "INSERT" ? 201 : minimo ? 204 : 200;
      return { status, corpo: minimo || req.metodo === "HEAD" ? null : dados, cabecalhos, mudancas };
    });
  } catch (err) {
    const e = traduzirErro(err, papel);
    return { status: e.status, corpo: e.corpo, cabecalhos: {}, mudancas: null };
  }
}
