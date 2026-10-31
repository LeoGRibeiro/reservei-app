import { describe, expect, it } from "vitest";
import { filtrarGaleria, validarItemGaleria } from "@/lib/institucional/institucionalHelpers";
import type { GaleriaItem } from "@/lib/institucional/types";


describe("institucionalHelpers - filtros e ordenação", () => {
  const galeriaMock: GaleriaItem[] = [
    {
      id: "1",
      title: "Bar",
      description: "Lounge",
      categoria: "bar",
      imageUrl: "https://img.com/1",
      displayOrder: 2,
      isActive: true,
    },
    {
      id: "2",
      title: "Saibro",
      description: "Quadra",
      categoria: "quadras",
      imageUrl: "https://img.com/2",
      displayOrder: 1,
      isActive: true,
    },
    {
      id: "3",
      title: "Vestiário Inativo",
      description: "Banho",
      categoria: "vestiarios",
      imageUrl: "https://img.com/3",
      displayOrder: 3,
      isActive: false,
    },
  ];

  it("filtra por categoria específica", () => {
    const apenasBar = filtrarGaleria(galeriaMock, "bar", false);
    expect(apenasBar).toHaveLength(1);
    expect(apenasBar[0].title).toBe("Bar");
  });

  it("ordena itens por displayOrder ascendente", () => {
    const todos = filtrarGaleria(galeriaMock, "todas", false);
    expect(todos[0].displayOrder).toBe(1);
    expect(todos[1].displayOrder).toBe(2);
    expect(todos[2].displayOrder).toBe(3);
  });

  it("omite itens inativos quando apenasAtivos é true", () => {
    const ativos = filtrarGaleria(galeriaMock, "todas", true);
    expect(ativos).toHaveLength(2);
    expect(ativos.some((i) => i.id === "3")).toBe(false);
  });

});

describe("institucionalHelpers - validações", () => {
  it("valida dados corretos de foto da galeria", () => {
    const valid = validarItemGaleria({
      title: "Quadra 1",
      description: "Saibro tratado e iluminado",
      imageUrl: "https://images.unsplash.com/foto",
      categoria: "quadras",
    });
    expect(valid.valido).toBe(true);
    expect(valid.erros).toHaveLength(0);
  });

  it("rejeita foto com campos vazios ou URL inválida", () => {
    const invalid = validarItemGaleria({
      title: "",
      description: "curto",
      imageUrl: "ftp://invalido",
      categoria: "quadras",
    });
    expect(invalid.valido).toBe(false);
    expect(invalid.erros.length).toBeGreaterThanOrEqual(2);
  });


});

