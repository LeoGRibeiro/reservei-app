/**
 * @file servidor.mjs
 * @description Supabase local para testes automatizados: PGlite + REST (PostgREST), Auth (GoTrue)
 * e Realtime num único servidor HTTP. O schema, as migrações e os seeds são os arquivos reais do
 * projeto, e o RLS vale de verdade (cada requisição roda com o papel do JWT).
 *
 * Uso: `node tests/supabase-local/servidor.mjs` (porta em SUPABASE_LOCAL_PORTA, padrão 54329).
 * Cenários extras (dados dos testes) entram por `SUPABASE_LOCAL_CENARIO=<arquivo .mjs>`, que deve
 * exportar `async function preparar(db)`.
 */

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { criarBanco, importarDoSrc } from "./banco.mjs";
import { executarRest } from "./postgrest.mjs";
import { criarAuth, CHAVES } from "./gotrue.mjs";
import { criarRealtime } from "./realtime.mjs";

const moduloWs = await importarDoSrc("ws");
const WebSocketServer = moduloWs.WebSocketServer ?? moduloWs.default.WebSocketServer;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD",
  "access-control-expose-headers": "content-range, x-supabase-api-version",
};

/** Lê o corpo JSON da requisição. */
async function lerCorpo(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  const texto = Buffer.concat(partes).toString("utf8");
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return Object.fromEntries(new URLSearchParams(texto));
  }
}

/**
 * Sobe o Supabase local.
 *
 * @param {{ porta?: number, seeds?: string[], preparar?: (db: any) => Promise<void> }} [opcoes]
 * @returns {Promise<{ url: string, chaves: typeof CHAVES, db: any, fechar: () => Promise<void> }>}
 */
export async function iniciarSupabaseLocal(opcoes = {}) {
  const db = await criarBanco({ seeds: opcoes.seeds });
  if (opcoes.preparar) await opcoes.preparar(db);
  const auth = criarAuth(db);
  const wss = new WebSocketServer({ noServer: true });
  const realtime = criarRealtime(wss);

  // O PGlite atende uma consulta por vez: as requisições entram numa fila
  let fila = Promise.resolve();
  const emFila = (tarefa) => {
    const resultado = fila.then(tarefa, tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  };

  const servidor = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    const cabecalhos = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const corpo = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) ? await lerCorpo(req) : null;
    let resposta;
    try {
      if (url.pathname.startsWith("/rest/v1/")) {
        resposta = await emFila(() =>
          executarRest(db, { metodo: req.method, caminho: url.pathname.slice(9), busca: url.searchParams, cabecalhos, corpo })
        );
        if (resposta.mudancas && resposta.status < 300) realtime.transmitir(resposta.mudancas);
      } else if (url.pathname.startsWith("/auth/v1/")) {
        resposta = await emFila(() =>
          auth({ metodo: req.method, caminho: url.pathname.slice(9), busca: url.searchParams, cabecalhos, corpo })
        );
      } else {
        resposta = { status: 404, corpo: { message: `Rota não suportada: ${url.pathname}` } };
      }
    } catch (err) {
      resposta = { status: 500, corpo: { message: String(err?.message ?? err) } };
    }
    const extras = resposta.cabecalhos ?? {};
    if (resposta.corpo === null || resposta.corpo === undefined) {
      res.writeHead(resposta.status, { ...CORS, ...extras });
      res.end();
      return;
    }
    res.writeHead(resposta.status, { ...CORS, ...extras, "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(resposta.corpo));
  });

  servidor.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/realtime/v1/websocket")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  const porta = opcoes.porta ?? 54329;
  await new Promise((ok) => servidor.listen(porta, "127.0.0.1", ok));
  return {
    url: `http://127.0.0.1:${porta}`,
    chaves: CHAVES,
    db,
    fechar: () =>
      new Promise((ok) => {
        wss.clients.forEach((c) => c.terminate());
        servidor.close(() => ok());
      }),
  };
}

// Execução direta: sobe o servidor e mantém o processo vivo
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cenario = process.env.SUPABASE_LOCAL_CENARIO;
  const modulo = cenario ? await import(pathToFileURL(cenario).href) : null;
  const local = await iniciarSupabaseLocal({
    porta: Number(process.env.SUPABASE_LOCAL_PORTA ?? 54329),
    seeds: modulo?.seeds,
    preparar: modulo?.preparar,
  });
  console.log(`[supabase-local] pronto em ${local.url}`);
}
