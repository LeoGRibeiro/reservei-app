/**
 * @file base.test.tsx
 * @description Componentes-base do portal: diálogos (abrir, fechar, rolagem travada), aviso,
 * carimbos, canhoto e ícones.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogoSimples } from "@/components/portal-arena/base/DialogoSimples";
import { DialogoTicket } from "@/components/portal-arena/base/DialogoTicket";
import { DURACAO_AVISO_MS, ProvedorAviso, useAviso } from "@/components/portal-arena/base/Aviso";
import { CarimbosMini, CasasCartela } from "@/components/portal-arena/base/Carimbos";
import { CanhotoData } from "@/components/portal-arena/base/CanhotoData";
import { Icone } from "@/components/portal-arena/Icone";

const lenis = { stop: vi.fn(), start: vi.fn(), resize: vi.fn(), scrollTo: vi.fn() };

beforeEach(() => {
  (window as unknown as { __lenis: typeof lenis }).__lenis = lenis;
  // jsdom não implementa showModal/close: simula o comportamento nativo
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as { __lenis?: unknown }).__lenis;
});

function DialogoControlado() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        abrir
      </button>
      <DialogoSimples aberto={aberto} aoFechar={() => setAberto(false)} titulo="Cancelar reserva" subtitulo="Areia 1">
        <p>corpo</p>
      </DialogoSimples>
      <span data-testid="estado">{aberto ? "aberto" : "fechado"}</span>
    </>
  );
}

describe("DialogoSimples", () => {
  it("abre como modal, foca o título e para a rolagem da página", () => {
    render(<DialogoControlado />);
    fireEvent.click(screen.getByText("abrir"));
    const dialogo = document.getElementById("dlg") as HTMLDialogElement;
    expect(dialogo.hasAttribute("open")).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Cancelar reserva" }));
    expect(lenis.stop).toHaveBeenCalledTimes(1);
  });

  it("fecha pelo X, avisa o estado e libera a rolagem", () => {
    render(<DialogoControlado />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByTestId("estado").textContent).toBe("fechado");
    expect(lenis.start).toHaveBeenCalledTimes(1);
  });

  it("fecha com clique no fundo escuro (o próprio dialog)", () => {
    render(<DialogoControlado />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.click(document.getElementById("dlg") as HTMLDialogElement);
    expect(screen.getByTestId("estado").textContent).toBe("fechado");
  });

  it("clique dentro do corpo não fecha", () => {
    render(<DialogoControlado />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.click(screen.getByText("corpo"));
    expect(screen.getByTestId("estado").textContent).toBe("aberto");
  });
});

describe("DialogoTicket", () => {
  it("monta o ticket com resumo azul, canhoto e etapa", () => {
    render(
      <DialogoTicket id="ck" aberto aoFechar={() => undefined} idTitulo="ck-titulo" rotuloResumo="Resumo da reserva"
        resumo={<b>Resumo</b>} etapa="pix">
        <h2 id="ck-titulo">Pague com Pix</h2>
      </DialogoTicket>
    );
    const dialogo = document.getElementById("ck") as HTMLDialogElement;
    expect(dialogo.getAttribute("data-etapa")).toBe("pix");
    expect(dialogo.querySelector(".ck-resumo")?.getAttribute("aria-label")).toBe("Resumo da reserva");
    expect(dialogo.querySelector(".ck-stub .ck-fechar")).not.toBeNull();
    expect(dialogo.hasAttribute("data-lenis-prevent")).toBe(true);
  });
});

function BotaoAviso() {
  const aviso = useAviso();
  return (
    <button type="button" onClick={() => aviso("Pedido enviado.")}>
      avisar
    </button>
  );
}

describe("Aviso", () => {
  it("mostra o texto e some depois de 2,8 s", () => {
    vi.useFakeTimers();
    render(
      <ProvedorAviso>
        <BotaoAviso />
      </ProvedorAviso>
    );
    const toast = document.getElementById("toast") as HTMLElement;
    expect(toast.hidden).toBe(true);
    fireEvent.click(screen.getByText("avisar"));
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toBe("Pedido enviado.");
    act(() => {
      vi.advanceTimersByTime(DURACAO_AVISO_MS);
    });
    expect(toast.hidden).toBe(true);
    vi.useRealTimers();
  });
});

describe("Carimbos", () => {
  it("linha de 10 bolinhas com cheias e novas", () => {
    const { container } = render(<CarimbosMini cheias={6} novas={2} />);
    const itens = container.querySelectorAll("li");
    expect(itens).toHaveLength(10);
    expect(container.querySelectorAll("li.on")).toHaveLength(6);
    expect(container.querySelectorAll("li.novo")).toHaveLength(2);
    expect(container.querySelector("ol")?.getAttribute("aria-label")).toBe("8 de 10 carimbos");
  });

  it("casas grandes: logo nas cheias, número nas vazias e prêmio na décima", () => {
    const { container } = render(<CasasCartela cheias={6} logoUrl="/logo.png" />);
    expect(container.querySelectorAll(".casa.on img")).toHaveLength(6);
    expect(container.querySelector(".casa.premio")?.textContent).toBe("1hgrátis");
    expect(Array.from(container.querySelectorAll(".casa.num")).map((c) => c.textContent)).toEqual(["7", "8", "9"]);
  });

  it("cartela completa não mostra o prêmio vazio", () => {
    const { container } = render(<CasasCartela cheias={10} logoUrl="/logo.png" />);
    expect(container.querySelector(".casa.premio")).toBeNull();
  });
});

describe("CanhotoData e Icone", () => {
  it("canhoto de reserva com hora", () => {
    const { container } = render(<CanhotoData className="rsv-data" semana="Seg" dia={31} mes="out" hora="19:00" />);
    expect(container.textContent).toBe("Seg31out19:00");
  });

  it("ícone é decorativo", () => {
    const { container } = render(<Icone nome="trophy" className="seta-d" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toBe("ico seta-d");
  });
});
