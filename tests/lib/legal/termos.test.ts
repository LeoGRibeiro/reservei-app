/**
 * @file termos.test.ts
 * @description Documentos legais preenchidos com os dados da arena (controladora) e da plataforma (operadora).
 */

import { describe, expect, it } from "vitest";
import {
  montarPoliticaPrivacidade,
  montarTermosDeUso,
  POLITICA_CANCELAMENTO_PADRAO,
} from "@/lib/legal/termos";
import { NOME_PRODUTO } from "@/lib/marca";

const ARENA = {
  nome: "Arena Belém",
  cidade: "Belém",
  estado: "PA",
  whatsapp: "(91) 98498-2865",
  email: "contato@arenabelem.com.br",
  cnpjCpf: "12.345.678/0001-90",
};

const texto = (secoes: { paragrafos: string[] }[]) => secoes.flatMap((s) => s.paragrafos).join(" ");

describe("montarTermosDeUso", () => {
  it("identifica a arena, a plataforma e o contato", () => {
    const t = texto(montarTermosDeUso(ARENA));
    expect(t).toContain("Arena Belém (Belém/PA)");
    expect(t).toContain(NOME_PRODUTO);
    expect(t).toContain("WhatsApp (91) 98498-2865");
  });

  it("usa a política de cancelamento da arena ou o texto padrão", () => {
    expect(texto(montarTermosDeUso({ ...ARENA, politicaCancelamento: "Cancele com 24h." }))).toContain("Cancele com 24h.");
    expect(texto(montarTermosDeUso({ ...ARENA, politicaCancelamento: "   " }))).toContain(POLITICA_CANCELAMENTO_PADRAO);
  });
});

describe("montarPoliticaPrivacidade", () => {
  it("declara a arena como controladora e a plataforma como operadora", () => {
    const t = texto(montarPoliticaPrivacidade(ARENA));
    expect(t).toContain("Arena Belém (12.345.678/0001-90) é a controladora");
    expect(t).toContain(`${NOME_PRODUTO} é a operadora`);
    expect(t).toContain("contato@arenabelem.com.br");
  });

  it("funciona sem dados de contato", () => {
    expect(texto(montarPoliticaPrivacidade({ nome: "Arena X" }))).toContain("falando com a arena");
  });
});
