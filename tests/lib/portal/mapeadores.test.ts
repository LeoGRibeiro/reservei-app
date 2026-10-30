/**
 * @file mapeadores.test.ts
 * @description Conversão das linhas do banco nas entidades do portal, com JSON malformado descartado.
 */

import { describe, expect, it } from "vitest";
import {
  digitosWhatsApp,
  mapearArenaPortal,
  mapearClube,
  mapearConteudo,
  mapearEscolinha,
  mapearEvento,
  mapearQuadraPortal,
} from "@/lib/portal/mapeadores";

describe("digitosWhatsApp", () => {
  it("põe o DDI 55 em números nacionais", () => {
    expect(digitosWhatsApp("(91) 98498-2865")).toBe("5591984982865");
    expect(digitosWhatsApp("5591984982865")).toBe("5591984982865");
    expect(digitosWhatsApp("")).toBe("");
  });
});

describe("mapearArenaPortal", () => {
  it("monta contato, módulos, instagram sem @ e recebedor do Pix", () => {
    const a = mapearArenaPortal({
      id: "a1", slug: "a1", nome: "Arena Um", whatsapp: "(91) 98498-2865", endereco: "Rua A, 1", bairro: "Centro",
      instagram: "@arenaum", latitude: "-1.466340", modulos_ativos: "{vagas,eventos}", modo_pagamento: "simulado",
      percentual_sinal_minimo: "50.00", pix_nome_recebedor: null,
    });
    expect(a.whatsappDigitos).toBe("5591984982865");
    expect(a.whatsappExibicao).toBe("(91) 98498-2865");
    expect(a.instagram).toBe("arenaum");
    expect(a.latitude).toBeCloseTo(-1.46634);
    expect(a.modulos).toEqual(["vagas", "eventos"]);
    expect(a.percentualSinal).toBe(50);
    expect(a.nomeRecebedorPix).toBe("Arena Um");
    expect(a.logoUrl).toBe("/arenas/exemplo/logo.svg");
  });
});

describe("mapearQuadraPortal", () => {
  it("só aceita posição de foto em porcentagens", () => {
    expect(mapearQuadraPortal({ id: "q", foto_posicao: "50% 62%" }).fotoPosicao).toBe("50% 62%");
    expect(mapearQuadraPortal({ id: "q", foto_posicao: "center; color:red" }).fotoPosicao).toBeUndefined();
  });
});

describe("mapearConteudo", () => {
  it("descarta itens malformados das listas", () => {
    const c = mapearConteudo({
      destaques_estrutura: [{ destaque: "3 quadras", resto: "de areia" }, { resto: "sem destaque" }, "x"],
      regras: '[{"titulo": "Chegue cedo.", "texto": "Sempre."}, {"texto": "sem título"}]',
      faq: [{ pergunta: "P?", resposta: "R." }, { pergunta: "Sem resposta?" }],
    });
    expect(c.destaquesEstrutura).toEqual([{ destaque: "3 quadras", resto: "de areia" }]);
    expect(c.regras).toEqual([{ titulo: "Chegue cedo.", texto: "Sempre." }]);
    expect(c.faq).toEqual([{ pergunta: "P?", resposta: "R." }]);
  });

  it("sem linha de conteúdo, listas vazias", () => {
    expect(mapearConteudo(null).regras).toEqual([]);
  });
});

describe("mapearEscolinha", () => {
  it("tira o 'Prof.' do nome (o portal escreve) e cai no WhatsApp da arena", () => {
    const e = mapearEscolinha(
      { id: "e", sport_name: "Vôlei", teacher_name: "Prof. Lucas Andrade", whatsapp_number: "", turmas: [{ dias: "Sábado", horas: "9h" }] },
      "5591984982865"
    );
    expect(e.professor).toBe("Lucas Andrade");
    expect(e.whatsappDigitos).toBe("5591984982865");
    expect(e.turmas).toEqual([{ dias: "Sábado", horas: "9h", nivel: "" }]);
  });
});

describe("mapearEvento", () => {
  it("lê a chave e ignora fases sem jogos", () => {
    const ev = mapearEvento({
      id: "ev", titulo: "Copa", data_inicio: "2026-10-31", status: "em_andamento",
      chave: [
        { rotulo: "Semifinais", jogos: [{ hora: "15h", lados: ["A", "B"] }] },
        { rotulo: "Final", final: true, jogos: [{ hora: "18h", lados: ["C", "D"] }] },
        { rotulo: "Vazia", jogos: [] },
      ],
    });
    expect(ev.chave.map((f) => f.rotulo)).toEqual(["Semifinais", "Final"]);
    expect(ev.chave[1].final).toBe(true);
  });

  it("status e tipo de inscrição desconhecidos viram padrão seguro", () => {
    const ev = mapearEvento({ id: "ev", titulo: "X", data_inicio: "2026-11-21", status: "outro", inscricao_tipo: "pix" });
    expect(ev.status).toBe("inscricoes");
    expect(ev.inscricaoTipo).toBeUndefined();
  });
});

describe("mapearClube", () => {
  it("campanha inativa ou ausente não mostra o Clube", () => {
    expect(mapearClube(null)).toBeNull();
    expect(mapearClube({ ativo: false })).toBeNull();
  });

  it("lê meta, validades e teto", () => {
    expect(mapearClube({ nome: "Clube X", horas_necessarias: 10, meses_validade: 3, dias_validade_voucher: 60, valor_teto_voucher: "100.00" }))
      .toEqual({ nome: "Clube X", meta: 10, mesesValidade: 3, diasValidadeVoucher: 60, valorTeto: 100 });
  });
});
