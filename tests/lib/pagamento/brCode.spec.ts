/**
 * @file brCode.spec.ts
 * @description BR Code estático (Pix manual): CRC, estrutura EMV e normalização de chaves.
 */

import { describe, expect, it } from "vitest";
import {
  crc16BrCode,
  gerarBrCodePix,
  normalizarChavePix,
  sanitizarTextoBrCode,
  validarChavePix,
} from "@/lib/pagamento/brCode";

/** Lê os campos EMV de nível superior de um payload. */
function lerCampos(payload: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const tamanho = Number(payload.slice(i + 2, i + 4));
    campos[id] = payload.slice(i + 4, i + 4 + tamanho);
    i += 4 + tamanho;
  }
  return campos;
}

describe("crc16BrCode", () => {
  it("confere com o exemplo oficial do manual do BR Code", () => {
    const exemplo =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16BrCode(exemplo)).toBe("1D3D");
  });
});

describe("gerarBrCodePix", () => {
  const base = {
    chave: "(91) 98498-2865",
    tipoChave: "telefone" as const,
    nomeRecebedor: "Arena Belém Esportes e Lazer LTDA",
    cidadeRecebedor: "Belém",
    valor: 60,
    txid: "res-ab12",
  };

  it("monta os campos obrigatórios com valor, recebedor e txid", () => {
    const payload = gerarBrCodePix(base);
    const c = lerCampos(payload);

    expect(c["00"]).toBe("01");
    expect(c["26"]).toBe("0014br.gov.bcb.pix0114+5591984982865");
    expect(c["53"]).toBe("986");
    expect(c["54"]).toBe("60.00");
    expect(c["58"]).toBe("BR");
    expect(c["59"]).toBe("ARENA BELEM ESPORTES E LA");
    expect(c["60"]).toBe("BELEM");
    expect(c["62"]).toBe("0507resab12");
    expect(payload.slice(-8, -4)).toBe("6304");
    expect(crc16BrCode(payload.slice(0, -4))).toBe(payload.slice(-4));
  });

  it("usa *** quando não há txid e recusa valor zero", () => {
    expect(lerCampos(gerarBrCodePix({ ...base, txid: undefined }))["62"]).toBe("0503***");
    expect(() => gerarBrCodePix({ ...base, valor: 0 })).toThrow(/maior que zero/);
  });
});

describe("normalizarChavePix / validarChavePix", () => {
  it("normaliza cada tipo de chave", () => {
    expect(normalizarChavePix("123.456.789-09", "cpf")).toBe("12345678909");
    expect(normalizarChavePix("12.345.678/0001-90", "cnpj")).toBe("12345678000190");
    expect(normalizarChavePix("5591984982865", "telefone")).toBe("+5591984982865");
    expect(normalizarChavePix(" Contato@Arena.com ", "email")).toBe("contato@arena.com");
  });

  it("valida o formato de cada tipo", () => {
    expect(validarChavePix("123.456.789-09", "cpf")).toBeNull();
    expect(validarChavePix("123", "cpf")).toMatch(/11 dígitos/);
    expect(validarChavePix("12.345.678/0001-90", "cnpj")).toBeNull();
    expect(validarChavePix("(91) 98498-2865", "telefone")).toBeNull();
    expect(validarChavePix("9898", "telefone")).toMatch(/DDD/);
    expect(validarChavePix("a@b.co", "email")).toBeNull();
    expect(validarChavePix("sem-arroba", "email")).toMatch(/inválido/);
    expect(validarChavePix("123e4567-e12b-12d1-a456-426655440000", "aleatoria")).toBeNull();
    expect(validarChavePix("abc", "aleatoria")).toMatch(/formato/);
  });
});

describe("sanitizarTextoBrCode", () => {
  it("remove acentos e símbolos e respeita o limite", () => {
    expect(sanitizarTextoBrCode("Gouvêa's Açaí & Cia", 25)).toBe("GOUVEAS ACAI CIA");
    expect(sanitizarTextoBrCode("Santa Bárbara do Pará", 15)).toBe("SANTA BARBARA D");
  });
});
