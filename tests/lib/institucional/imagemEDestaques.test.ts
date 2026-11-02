/**
 * @file imagemEDestaques.test.ts
 * @description Envio de foto (SPEC/2026-11-02-admin-ajustes-demo.md §9.3): quando reduzir/converter,
 * tamanho final, recusa com orientação (HEIC sem suporte) e tradução dos erros do Storage. Tópicos
 * "Na arena" (§9.1): validação, limpeza, leitura do banco e ordem.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { decidirPreparo, dimensoesReduzidas, prepararImagem, tipoPelaExtensao } from "@/lib/institucional/prepararImagem";
import { mensagemErroUpload } from "@/lib/supabase/institucionalRepository";
import { lerDestaquesDoBanco, limparDestaques, mover, validarDestaques } from "@/lib/institucional/destaquesEstrutura";

describe("decidirPreparo", () => {
  it("foto pequena aceita vai como está; grande ou HEIC é reduzida/convertida; o resto é recusado", () => {
    expect(decidirPreparo({ type: "image/png", size: 300_000 })).toBe("enviar");
    expect(decidirPreparo({ type: "image/jpeg", size: 4_000_000 })).toBe("converter");
    expect(decidirPreparo({ type: "image/jpeg", size: 9_000_000 })).toBe("converter");
    expect(decidirPreparo({ type: "image/heic", size: 2_000_000 })).toBe("converter");
    expect(decidirPreparo({ type: "", size: 2_000_000, name: "IMG_0001.HEIC" })).toBe("converter");
    expect(decidirPreparo({ type: "application/pdf", size: 1 })).toBe("recusar");
    expect(decidirPreparo({ type: "image/gif", size: 6_000_000 })).toBe("recusar");
  });

  it("tipo pela extensão e redução proporcional", () => {
    expect(tipoPelaExtensao("foto.JPG")).toBe("image/jpeg");
    expect(tipoPelaExtensao("arquivo")).toBe("");
    expect(dimensoesReduzidas(4032, 3024)).toEqual({ largura: 2000, altura: 1500 });
    expect(dimensoesReduzidas(3024, 4032)).toEqual({ largura: 1500, altura: 2000 });
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe("prepararImagem", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("foto pequena passa direto", async () => {
    const arquivo = new File(["x"], "a.png", { type: "image/png" });
    expect(await prepararImagem(arquivo)).toEqual({ ok: true, arquivo });
  });

  it("não-imagem é recusada com orientação", async () => {
    const r = await prepararImagem(new File(["x"], "a.pdf", { type: "application/pdf" }));
    expect(r).toEqual({ ok: false, erro: "Escolha uma foto (JPG, PNG ou WebP)." });
  });

  it("HEIC que o navegador não abre: explica como resolver no iPhone", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("formato")));
    const r = await prepararImagem(new File(["x"], "IMG.heic", { type: "image/heic" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/iPhone/);
  });

  it("foto grande vira JPEG reduzido", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }));
    const contexto = { drawImage: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => contexto, toBlob: (ok: (b: Blob) => void) => ok(new Blob(["jpg"], { type: "image/jpeg" })) };
    const criar = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => (tag === "canvas" ? canvas : criar(tag))) as typeof document.createElement);
    const grande = new File([new Uint8Array(3_000_000)], "foto.png", { type: "image/png" });
    const r = await prepararImagem(grande);
    expect(r.ok && r.arquivo.type).toBe("image/jpeg");
    expect(r.ok && r.arquivo.name).toBe("foto.jpg");
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1500);
    vi.restoreAllMocks();
  });
});

describe("mensagemErroUpload", () => {
  it("traduz os erros do Storage para o dono", () => {
    expect(mensagemErroUpload("new row violates row-level security policy")).toMatch(/Sem permissão/);
    expect(mensagemErroUpload("The object exceeded the maximum allowed size")).toBe("A imagem deve ter no máximo 5 MB.");
    expect(mensagemErroUpload("mime type image/heic is not supported")).toMatch(/Formato não aceito/);
    expect(mensagemErroUpload("Bucket not found")).toMatch(/suporte/);
    expect(mensagemErroUpload("falha de rede")).toBe("Não foi possível enviar a imagem: falha de rede");
  });
});

describe("tópicos Na arena", () => {
  it("valida parte em negrito, tamanhos, repetidos e quantidade", () => {
    expect(validarDestaques([{ destaque: "3 quadras", resto: "de areia" }])).toEqual([]);
    expect(validarDestaques([{ destaque: "", resto: "x" }])).toEqual(["Tópico 1: escreva a parte em negrito."]);
    expect(validarDestaques([{ destaque: "x".repeat(41), resto: "" }])[0]).toMatch(/até 40/);
    expect(validarDestaques([{ destaque: "Bar", resto: "" }, { destaque: "bar", resto: "" }])).toEqual(["Tópico 2: repetido."]);
    expect(validarDestaques(Array.from({ length: 9 }, (_, i) => ({ destaque: `T${i}`, resto: "" })))[0]).toMatch(/até 8/);
  });

  it("limpa espaços e linhas vazias; lê o JSON do banco com segurança", () => {
    expect(limparDestaques([{ destaque: " Bar ", resto: " e lanchonete " }, { destaque: " ", resto: "" }])).toEqual([{ destaque: "Bar", resto: "e lanchonete" }]);
    expect(lerDestaquesDoBanco([{ destaque: "Bar", resto: "x" }, { resto: "sem destaque" }, null, "texto"])).toEqual([{ destaque: "Bar", resto: "x" }]);
    expect(lerDestaquesDoBanco(null)).toEqual([]);
  });

  it("move para cima e para baixo sem sair da lista", () => {
    expect(mover(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(mover(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
