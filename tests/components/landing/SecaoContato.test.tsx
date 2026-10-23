/**
 * @file SecaoContato.test.tsx
 * @description Seção de contato do portal: dados vêm do cadastro da arena e nada é inventado.
 */

import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecaoContato, linkMapa } from "@/components/landing/SecaoContato";
import { ARENA_PADRAO } from "@/lib/arena/defaultArena";
import { useCatalogoArenaStore } from "@/store/useCatalogoArenaStore";

afterEach(() => useCatalogoArenaStore.getState().redefinir());

describe("linkMapa", () => {
  it("codifica o endereço na busca do Google Maps", () => {
    expect(linkMapa("Av. Roberto Camelier, 580")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Av.%20Roberto%20Camelier%2C%20580"
    );
  });
});

describe("SecaoContato", () => {
  it("não renderiza nada até a arena carregar", () => {
    const { container } = render(<SecaoContato />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra endereço, horário e canais da arena", () => {
    useCatalogoArenaStore.getState().definirCatalogo(
      {
        ...ARENA_PADRAO,
        nome: "Arena Belém",
        endereco: "Av. Roberto Camelier, 580 - Jurunas",
        whatsapp: "(91) 98498-2865",
        telefone: "(91) 98498-2865",
        email: "contato@arenabelem.com.br",
        horarioAbertura: "07:00",
        horarioFechamento: "23:00",
      },
      []
    );
    render(<SecaoContato />);

    expect(screen.getByText(/Av\. Roberto Camelier, 580 - Jurunas/)).toBeInTheDocument();
    expect(screen.getByText(/das 07:00 às 23:00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/5591984982865");
    expect(screen.getByRole("link", { name: /contato@arenabelem.com.br/ })).toHaveAttribute(
      "href",
      "mailto:contato@arenabelem.com.br"
    );
    expect(screen.getByRole("link", { name: /Ver no mapa/ })).toHaveAttribute("target", "_blank");
  });
});
