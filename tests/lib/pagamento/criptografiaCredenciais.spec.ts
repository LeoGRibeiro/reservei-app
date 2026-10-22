/**
 * @file criptografiaCredenciais.spec.ts
 * @description Cifragem AES-256-GCM das chaves de API dos gateways.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cifrarCredencial,
  criptografiaConfigurada,
  decifrarCredencial,
  ErroCredencial,
} from "@/lib/pagamento/criptografiaCredenciais";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";

beforeEach(() => vi.stubEnv("PAGAMENTO_CREDENCIAIS_SECRET", SEGREDO));
afterEach(() => vi.unstubAllEnvs());

describe("cifrarCredencial / decifrarCredencial", () => {
  it("cifra sem expor o texto puro e decifra de volta", () => {
    const cifrada = cifrarCredencial("$aact_chave_secreta");
    expect(cifrada.startsWith("v1:")).toBe(true);
    expect(cifrada).not.toContain("aact_chave_secreta");
    expect(decifrarCredencial(cifrada)).toBe("$aact_chave_secreta");
  });

  it("gera cifras diferentes para o mesmo texto (IV aleatório)", () => {
    expect(cifrarCredencial("x")).not.toBe(cifrarCredencial("x"));
  });

  it("detecta adulteração do conteúdo", () => {
    const [v, iv, tag, dados] = cifrarCredencial("$aact_chave").split(":");
    const adulterado = Buffer.from(dados, "base64");
    adulterado[0] ^= 0xff;
    expect(() => decifrarCredencial([v, iv, tag, adulterado.toString("base64")].join(":"))).toThrow(ErroCredencial);
  });

  it("não decifra com outra chave mestra", () => {
    const cifrada = cifrarCredencial("$aact_chave");
    vi.stubEnv("PAGAMENTO_CREDENCIAIS_SECRET", "outra-chave-mestra-com-mais-de-32-caracteres");
    expect(() => decifrarCredencial(cifrada)).toThrow(/chave mestra/);
  });

  it("recusa formato desconhecido", () => {
    expect(() => decifrarCredencial("texto-puro")).toThrow(/formato/);
  });
});

describe("criptografiaConfigurada", () => {
  it("exige segredo de ao menos 32 caracteres", () => {
    expect(criptografiaConfigurada()).toBe(true);
    vi.stubEnv("PAGAMENTO_CREDENCIAIS_SECRET", "curta");
    expect(criptografiaConfigurada()).toBe(false);
    expect(() => cifrarCredencial("x")).toThrow(/PAGAMENTO_CREDENCIAIS_SECRET/);
  });
});
