/**
 * @file brCode.ts
 * @description Geração do Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central) com valor
 * fixo, usado no modo de pagamento manual: o atleta paga direto na chave Pix da arena, sem gateway.
 *
 * Referência: Manual do BR Code (BCB) — campos 00 a 63, CRC16-CCITT (polinômio 0x1021, início 0xFFFF).
 */

/** Tipos de chave Pix aceitos. */
export type TipoChavePix = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

/** Dados de um Pix estático com valor. */
export interface DadosBrCode {
  /** Chave Pix do recebedor (qualquer formato; é normalizada conforme o tipo) */
  chave: string;
  /** Tipo da chave */
  tipoChave: TipoChavePix;
  /** Nome do recebedor (até 25 caracteres, sem acentos) */
  nomeRecebedor: string;
  /** Cidade do recebedor (até 15 caracteres, sem acentos) */
  cidadeRecebedor: string;
  /** Valor em reais (maior que zero) */
  valor: number;
  /** Identificador exibido no extrato do recebedor (até 25 caracteres alfanuméricos) */
  txid?: string;
}

/**
 * Remove acentos e caracteres fora do conjunto aceito pelos bancos nos campos de texto do BR Code.
 *
 * @param texto Texto livre
 * @param limite Tamanho máximo
 * @returns Texto em maiúsculas, sem acentos, cortado no limite
 */
export function sanitizarTextoBrCode(texto: string, limite: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, limite);
}

/**
 * Normaliza a chave Pix conforme o tipo (telefone no formato +55DDDNUMERO, documentos só com dígitos).
 *
 * @param chave Chave informada
 * @param tipo Tipo da chave
 * @returns Chave no formato aceito pelo DICT
 *
 * @example
 * ```ts
 * normalizarChavePix("(91) 98498-2865", "telefone"); // "+5591984982865"
 * ```
 */
export function normalizarChavePix(chave: string, tipo: TipoChavePix): string {
  const limpa = chave.trim();
  switch (tipo) {
    case "cpf":
    case "cnpj":
      return limpa.replace(/\D/g, "");
    case "telefone": {
      const digitos = limpa.replace(/\D/g, "");
      return `+${digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`}`;
    }
    case "email":
      return limpa.toLowerCase();
    case "aleatoria":
      return limpa.toLowerCase();
  }
}

/**
 * Valida a chave Pix para o tipo informado.
 *
 * @param chave Chave informada
 * @param tipo Tipo da chave
 * @returns Mensagem de erro ou null se válida
 */
export function validarChavePix(chave: string, tipo: TipoChavePix): string | null {
  const normalizada = normalizarChavePix(chave, tipo);
  switch (tipo) {
    case "cpf":
      return normalizada.length === 11 ? null : "CPF deve ter 11 dígitos.";
    case "cnpj":
      return normalizada.length === 14 ? null : "CNPJ deve ter 14 dígitos.";
    case "telefone":
      return /^\+55\d{10,11}$/.test(normalizada) ? null : "Telefone deve ter DDD e número.";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizada) && normalizada.length <= 77 ? null : "E-mail inválido.";
    case "aleatoria":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalizada)
        ? null
        : "Chave aleatória deve estar no formato 00000000-0000-0000-0000-000000000000.";
  }
}

/** Campo EMV: id (2 dígitos) + tamanho (2 dígitos) + valor. */
function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

/**
 * CRC16-CCITT (False) usado no campo 63 do BR Code.
 *
 * @param payload Conteúdo até "6304" inclusive
 * @returns CRC em 4 dígitos hexadecimais maiúsculos
 */
export function crc16BrCode(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o Pix copia e cola estático com valor.
 *
 * @param dados Recebedor, chave e valor
 * @returns Payload BR Code completo (com CRC)
 * @throws Error se o valor não for positivo
 *
 * @example
 * ```ts
 * gerarBrCodePix({ chave: "contato@arena.com", tipoChave: "email", nomeRecebedor: "Arena Belém",
 *   cidadeRecebedor: "Belém", valor: 60, txid: "RES123" });
 * ```
 */
export function gerarBrCodePix(dados: DadosBrCode): string {
  if (!(dados.valor > 0)) throw new Error("O valor do Pix deve ser maior que zero.");

  const contaRecebedor = campo("00", "br.gov.bcb.pix") + campo("01", normalizarChavePix(dados.chave, dados.tipoChave));
  const txid = (dados.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const semCrc =
    campo("00", "01") +
    campo("26", contaRecebedor) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", dados.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", sanitizarTextoBrCode(dados.nomeRecebedor, 25) || "RECEBEDOR") +
    campo("60", sanitizarTextoBrCode(dados.cidadeRecebedor, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";

  return semCrc + crc16BrCode(semCrc);
}
