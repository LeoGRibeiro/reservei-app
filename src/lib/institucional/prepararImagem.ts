/**
 * @module institucional/prepararImagem
 *
 * Prepara a foto no navegador antes de enviar ao Storage. Fotos de celular costumam passar de 5 MB
 * (limite do bucket) e o iPhone salva em HEIC, que o bucket não aceita: as duas situações faziam o
 * envio falhar. Aqui a foto é reduzida (lado maior até {@link LADO_MAXIMO}px) e regravada em JPEG
 * sempre que estiver grande ou num formato que o site não aceita.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §9.3
 */

/** Tipos que o bucket `institucional` aceita (mesma lista do `schema.sql`). */
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Limite do bucket (5 MB). */
export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

/** Acima disso a foto é reduzida antes de enviar (economiza dados e deixa o site leve). */
export const TAMANHO_PARA_REDUZIR_BYTES = 1.5 * 1024 * 1024;

/** Lado maior da foto depois de reduzida. */
export const LADO_MAXIMO = 2000;

/** O que fazer com o arquivo escolhido. */
export type DecisaoImagem = "enviar" | "converter" | "recusar";

/**
 * Decide se a foto vai como está, se precisa ser convertida/reduzida ou se não é imagem.
 *
 * @example
 * ```ts
 * decidirPreparo({ type: "image/heic", size: 2_000_000 }); // "converter"
 * decidirPreparo({ type: "image/png", size: 300_000 });    // "enviar"
 * decidirPreparo({ type: "application/pdf", size: 1 });    // "recusar"
 * ```
 */
export function decidirPreparo(arquivo: { type: string; size: number; name?: string }): DecisaoImagem {
  const tipo = arquivo.type || tipoPelaExtensao(arquivo.name ?? "");
  if (!tipo.startsWith("image/")) return "recusar";
  if (tipo === "image/gif") return arquivo.size <= TAMANHO_MAXIMO_BYTES ? "enviar" : "recusar";
  if (!(TIPOS_ACEITOS as readonly string[]).includes(tipo)) return "converter";
  return arquivo.size > TAMANHO_PARA_REDUZIR_BYTES ? "converter" : "enviar";
}

/** Tipo pela extensão (alguns navegadores deixam `type` vazio, ex.: HEIC no Windows). */
export function tipoPelaExtensao(nome: string): string {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  const mapa: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif" };
  return mapa[ext] ?? "";
}

/**
 * Tamanho final mantendo a proporção, com o lado maior em até `maximo`.
 *
 * @example
 * ```ts
 * dimensoesReduzidas(4032, 3024); // { largura: 2000, altura: 1500 }
 * ```
 */
export function dimensoesReduzidas(largura: number, altura: number, maximo = LADO_MAXIMO): { largura: number; altura: number } {
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.round(largura * escala), altura: Math.round(altura * escala) };
}

/** Resultado do preparo. */
export type ResultadoPreparo = { ok: true; arquivo: File } | { ok: false; erro: string };

/**
 * Prepara a foto para envio: devolve o próprio arquivo, uma versão reduzida em JPEG, ou o motivo
 * de não dar para enviar (com orientação para o dono).
 *
 * @param arquivo Arquivo escolhido no campo de foto
 */
export async function prepararImagem(arquivo: File): Promise<ResultadoPreparo> {
  const decisao = decidirPreparo(arquivo);
  if (decisao === "recusar") {
    return { ok: false, erro: arquivo.type === "image/gif" ? "GIF acima de 5 MB não é aceito. Use uma foto JPG ou PNG." : "Escolha uma foto (JPG, PNG ou WebP)." };
  }
  if (decisao === "enviar") return { ok: true, arquivo };

  try {
    const bitmap = await createImageBitmap(arquivo);
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (!blob) throw new Error("falha ao gerar JPEG");
    if (blob.size > TAMANHO_MAXIMO_BYTES) return { ok: false, erro: "A foto continua acima de 5 MB mesmo reduzida. Escolha outra." };
    const nome = (arquivo.name.replace(/\.[^.]+$/, "") || "foto") + ".jpg";
    return { ok: true, arquivo: new File([blob], nome, { type: "image/jpeg" }) };
  } catch {
    // O navegador não conseguiu abrir o formato (ex.: HEIC no Chrome do Windows)
    if (decisao === "converter" && (TIPOS_ACEITOS as readonly string[]).includes(arquivo.type) && arquivo.size <= TAMANHO_MAXIMO_BYTES) {
      return { ok: true, arquivo };
    }
    const heic = /hei[cf]/i.test(arquivo.type || arquivo.name);
    return {
      ok: false,
      erro: heic
        ? "Foto do iPhone (HEIC) que este navegador não consegue abrir. No iPhone, envie pelo Safari ou mude em Ajustes → Câmera → Formatos → Mais Compatível."
        : "Não foi possível abrir esta foto. Tente outra em JPG ou PNG de até 5 MB.",
    };
  }
}
