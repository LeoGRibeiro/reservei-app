/**
 * @file storage.mjs
 * @description Storage do Supabase local (só para testes e demonstração local): envio de arquivo
 * (`POST /storage/v1/object/{bucket}/{caminho}`, multipart como o supabase-js manda) e leitura
 * pública (`GET /storage/v1/object/public/{bucket}/{caminho}`).
 *
 * Regras iguais às do Supabase:
 * - o bucket precisa existir (`storage.buckets`);
 * - tamanho e tipo de arquivo respeitam `file_size_limit` e `allowed_mime_types` do bucket;
 * - a gravação passa pelas policies reais de `storage.objects` (o INSERT roda com o papel e as
 *   claims do JWT da requisição), então "quem pode enviar" é o mesmo do banco de produção.
 *
 * Os bytes ficam em memória (o banco local também é em memória).
 */

import { randomUUID } from "node:crypto";
import { claimsDoCabecalho } from "./postgrest.mjs";

/**
 * Extrai o arquivo de um corpo multipart/form-data (a parte com `filename` ou nome vazio).
 *
 * @param {Buffer} corpo Corpo bruto
 * @param {string} tipo Cabeçalho content-type (com o boundary)
 * @returns {{ dados: Buffer, tipo: string } | null}
 */
export function extrairArquivoMultipart(corpo, tipo) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(tipo);
  if (!m) return null;
  const separador = Buffer.from(`--${m[1] ?? m[2]}`);
  let inicio = corpo.indexOf(separador);
  while (inicio !== -1) {
    const proximo = corpo.indexOf(separador, inicio + separador.length);
    if (proximo === -1) break;
    const parte = corpo.subarray(inicio + separador.length + 2, proximo - 2); // tira \r\n do início e do fim
    const fimCabecalho = parte.indexOf("\r\n\r\n");
    if (fimCabecalho !== -1) {
      const cabecalho = parte.subarray(0, fimCabecalho).toString("utf8");
      const ehArquivo = /filename=/i.test(cabecalho) || /name=""/i.test(cabecalho);
      if (ehArquivo) {
        const tipoParte = /content-type:\s*([^\r\n]+)/i.exec(cabecalho)?.[1]?.trim() ?? "application/octet-stream";
        return { dados: Buffer.from(parte.subarray(fimCabecalho + 4)), tipo: tipoParte };
      }
    }
    inicio = proximo;
  }
  return null;
}

/**
 * Cria o Storage local.
 *
 * @param {import("@electric-sql/pglite").PGlite} db Banco local
 * @returns {(req: { metodo: string, caminho: string, cabecalhos: Record<string, string>, corpo: Buffer | null }) => Promise<{ status: number, corpo?: unknown, binario?: Buffer, cabecalhos?: Record<string, string> }>}
 */
export function criarStorage(db) {
  /** @type {Map<string, { dados: Buffer, tipo: string }>} */
  const arquivos = new Map();
  const erro = (status, message) => ({ status, corpo: { statusCode: String(status), error: message, message } });

  return async function storage({ metodo, caminho, cabecalhos, corpo }) {
    // Leitura pública
    const publico = /^object\/public\/([^/]+)\/(.+)$/.exec(caminho);
    if (metodo === "GET" && publico) {
      const [, bucket, nome] = publico;
      const { rows } = await db.query("SELECT public FROM storage.buckets WHERE id = $1", [bucket]);
      const arquivo = arquivos.get(`${bucket}/${decodeURIComponent(nome)}`);
      if (!rows[0]?.public || !arquivo) return erro(404, "Object not found");
      return { status: 200, binario: arquivo.dados, cabecalhos: { "content-type": arquivo.tipo, "cache-control": "max-age=3600" } };
    }

    // Envio
    const envio = /^object\/([^/]+)\/(.+)$/.exec(caminho);
    if ((metodo === "POST" || metodo === "PUT") && envio) {
      const [, bucket, nomeBruto] = envio;
      const nome = decodeURIComponent(nomeBruto);
      const { rows } = await db.query("SELECT file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = $1", [bucket]);
      if (!rows[0]) return erro(404, "Bucket not found");
      const tipoCorpo = cabecalhos["content-type"] ?? "";
      const arquivo = /multipart\/form-data/i.test(tipoCorpo)
        ? extrairArquivoMultipart(corpo ?? Buffer.alloc(0), tipoCorpo)
        : { dados: corpo ?? Buffer.alloc(0), tipo: tipoCorpo || "application/octet-stream" };
      if (!arquivo) return erro(400, "No file in request");
      const limite = rows[0].file_size_limit === null ? null : Number(rows[0].file_size_limit);
      if (limite !== null && arquivo.dados.length > limite) return erro(413, "The object exceeded the maximum allowed size");
      const permitidos = rows[0].allowed_mime_types;
      if (Array.isArray(permitidos) && permitidos.length && !permitidos.includes(arquivo.tipo)) {
        return erro(415, `mime type ${arquivo.tipo} is not supported`);
      }
      const chave = `${bucket}/${nome}`;
      const upsert = String(cabecalhos["x-upsert"] ?? "false") === "true";
      if (arquivos.has(chave) && !upsert && metodo === "POST") return erro(409, "The resource already exists");

      // A linha passa pelas policies reais de storage.objects, com o papel do JWT
      const claims = claimsDoCabecalho(cabecalhos);
      const id = randomUUID();
      try {
        await db.transaction(async (tx) => {
          await tx.query("SELECT set_config('request.jwt.claims', $1::text, true)", [JSON.stringify(claims)]);
          await tx.query(`SET LOCAL ROLE ${claims.role === "service_role" ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon"}`);
          await tx.query("INSERT INTO storage.objects (id, bucket_id, name, owner) VALUES ($1, $2, $3, $4)", [id, bucket, nome, claims.sub ?? null]);
        });
      } catch (e) {
        return erro(403, String(e?.message ?? e).includes("row-level security") ? "new row violates row-level security policy" : String(e?.message ?? e));
      }
      arquivos.set(chave, arquivo);
      return { status: 200, corpo: { Key: chave, Id: id } };
    }

    return erro(404, `Rota de storage não suportada: ${caminho}`);
  };
}
