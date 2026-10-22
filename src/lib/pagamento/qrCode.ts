/**
 * @file qrCode.ts
 * @description Renderização do QR Code de um Pix copia e cola como imagem PNG em data URL (somente servidor).
 */

import QRCode from "qrcode";

/**
 * Gera a imagem do QR Code para um payload Pix.
 *
 * @param payload Pix copia e cola (BR Code)
 * @returns Data URL `data:image/png;base64,...`, ou string vazia se a geração falhar
 *
 * @example
 * ```ts
 * const qr = await gerarQrCodeDataUrl("000201...6304ABCD");
 * ```
 */
export async function gerarQrCodeDataUrl(payload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 320 });
  } catch (err) {
    console.error("[QR Code] Falha ao gerar a imagem do Pix:", err);
    return "";
  }
}
