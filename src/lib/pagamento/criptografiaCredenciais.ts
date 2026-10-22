/**
 * @file criptografiaCredenciais.ts
 * @description Cifragem das chaves de API dos gateways das arenas (somente servidor), com AES-256-GCM.
 *
 * A chave mestra vem de `PAGAMENTO_CREDENCIAIS_SECRET` (fora do banco). Assim, um dump do banco, um backup
 * vazado ou uma consulta no SQL Editor não expõem chaves utilizáveis de nenhuma arena.
 * Formato gravado: `v1:<iv base64>:<tag base64>:<cifrado base64>`.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSAO = "v1";
const TAMANHO_IV = 12;

/** Erro de configuração ou de integridade das credenciais. */
export class ErroCredencial extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroCredencial";
  }
}

/**
 * Indica se o servidor tem a chave mestra configurada.
 *
 * @returns `true` quando `PAGAMENTO_CREDENCIAIS_SECRET` tem ao menos 32 caracteres
 */
export function criptografiaConfigurada(): boolean {
  return (process.env.PAGAMENTO_CREDENCIAIS_SECRET ?? "").length >= 32;
}

/** Deriva a chave AES de 32 bytes a partir do segredo do ambiente. */
function chaveMestra(): Buffer {
  const segredo = process.env.PAGAMENTO_CREDENCIAIS_SECRET ?? "";
  if (segredo.length < 32) {
    throw new ErroCredencial("PAGAMENTO_CREDENCIAIS_SECRET ausente ou curta (mínimo 32 caracteres).");
  }
  return createHash("sha256").update(segredo).digest();
}

/**
 * Cifra um segredo.
 *
 * @param textoPuro Segredo (ex.: chave de API do Asaas)
 * @returns Texto cifrado no formato `v1:iv:tag:dados`
 *
 * @example
 * ```ts
 * const cifrada = cifrarCredencial("$aact_...");
 * ```
 */
export function cifrarCredencial(textoPuro: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv("aes-256-gcm", chaveMestra(), iv);
  const dados = Buffer.concat([cifra.update(textoPuro, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [VERSAO, iv.toString("base64"), tag.toString("base64"), dados.toString("base64")].join(":");
}

/**
 * Decifra um segredo gravado por {@link cifrarCredencial}.
 *
 * @param cifrado Texto no formato `v1:iv:tag:dados`
 * @returns Segredo em texto puro
 * @throws ErroCredencial se o formato for inválido, a chave mestra mudou ou o dado foi adulterado
 */
export function decifrarCredencial(cifrado: string): string {
  const partes = cifrado.split(":");
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new ErroCredencial("Credencial em formato desconhecido.");
  }
  try {
    const [, iv, tag, dados] = partes;
    const decifra = createDecipheriv("aes-256-gcm", chaveMestra(), Buffer.from(iv, "base64"));
    decifra.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decifra.update(Buffer.from(dados, "base64")), decifra.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof ErroCredencial) throw err;
    throw new ErroCredencial("Não foi possível decifrar a credencial (chave mestra diferente ou dado adulterado).");
  }
}
