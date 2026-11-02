/**
 * @file superAdminPage.test.tsx
 * @description Testes da tela /super-admin: criação de arena e exibição/cópia do link de ativação.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SuperAdminPage from "@/app/(plataforma)/super-admin/page";

const LINK = "https://central.reservei.com/admin?token=tok-123";

function preencher() {
  fireEvent.change(screen.getByLabelText("Senha de Super Admin"), { target: { value: "segredo" } });
  fireEvent.change(screen.getByLabelText("Nome da Arena"), { target: { value: "Arena Central" } });
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "central" } });
  fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "Belém" } });
  fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "pa" } });
  fireEvent.change(screen.getByLabelText("WhatsApp Comercial"), { target: { value: "91981234567" } });
}

describe("SuperAdminPage", () => {
  const fetchMock = vi.fn();
  const writeText = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia o formulário com o segredo no cabeçalho e exibe o link de ativação", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ slug: "central", quadrasCriadas: 3, urlConvite: LINK }),
    });
    render(<SuperAdminPage />);

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar Arena" }));

    const campoLink = await screen.findByLabelText("Link de ativação do dono");
    expect(campoLink).toHaveValue(LINK);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/super-admin/arenas");
    expect(init.headers["x-super-admin-secret"]).toBe("segredo");
    expect(JSON.parse(init.body)).toMatchObject({ nome: "Arena Central", slug: "central", estado: "PA" });
  });

  it("copia o link para a área de transferência", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ slug: "central", urlConvite: LINK }) });
    writeText.mockResolvedValue(undefined);
    render(<SuperAdminPage />);

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar Arena" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copiar Link de Ativação do Dono" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
    expect(await screen.findByRole("button", { name: "Link copiado!" })).toBeInTheDocument();
  });

  it("orienta a copiar manualmente quando a área de transferência falha", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ slug: "central", urlConvite: LINK }) });
    writeText.mockRejectedValue(new Error("negado"));
    render(<SuperAdminPage />);

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar Arena" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copiar Link de Ativação do Dono" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/copie manualmente/);
  });

  it("exibe o erro do servidor e nenhum link quando a criação falha", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Senha de Super Admin inválida." }) });
    render(<SuperAdminPage />);

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar Arena" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Senha de Super Admin inválida.");
    expect(screen.queryByLabelText("Link de ativação do dono")).not.toBeInTheDocument();
  });

  it("some com o link anterior ao enviar uma nova criação", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ slug: "central", urlConvite: LINK }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Já existe uma arena com este slug." }) });
    render(<SuperAdminPage />);

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar Arena" }));
    await screen.findByLabelText("Link de ativação do dono");

    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar Arena" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/slug/);
    expect(screen.queryByLabelText("Link de ativação do dono")).not.toBeInTheDocument();
  });

  describe("arenas da plataforma", () => {
    const ARENA = {
      id: "arena-belem",
      nome: "Arena Belém",
      slug: "arena-belem",
      slugAnterior: null,
      url: "https://arena-belem.reservei.com",
      cidade: "Belém",
      estado: "PA",
      ativo: true,
      modulos: ["agendamento_core", "escolinhas"],
      modoPagamento: "manual",
      donoAtivado: true,
      emailDono: "dono@arena.com",
      criadaEm: "2026-10-01T00:00:00Z",
    };

    function entrar() {
      render(<SuperAdminPage />);
      fireEvent.change(screen.getByLabelText("Senha de Super Admin"), { target: { value: "segredo" } });
    }

    it("lista as arenas com dono, módulos e recebimento", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ arenas: [ARENA] }) });
      entrar();
      fireEvent.click(screen.getByRole("button", { name: "Carregar arenas" }));

      expect(await screen.findByText("Arena Belém")).toBeInTheDocument();
      expect(screen.getByText(/dono@arena.com/)).toHaveTextContent("Recebimento: Pix direto");
      expect(screen.getByText(/Módulos: Escolinhas/)).toBeInTheDocument();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/super-admin/arenas");
      expect(init.headers["x-super-admin-secret"]).toBe("segredo");
    });

    it("troca o endereço, os módulos e liga a demonstração, com confirmação", async () => {
      const salva = { ...ARENA, slug: "belem-arena", slugAnterior: "arena-belem", modoPagamento: "simulado" };
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ arenas: [ARENA] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ arena: salva }) });
      vi.spyOn(window, "confirm").mockReturnValue(true);
      entrar();
      fireEvent.click(screen.getByRole("button", { name: "Carregar arenas" }));
      fireEvent.click(await screen.findByRole("button", { name: "Editar" }));

      fireEvent.change(screen.getByLabelText("Endereço (subdomínio)"), { target: { value: "belem-arena" } });
      fireEvent.click(screen.getByLabelText(/Modo demonstração/));
      fireEvent.click(screen.getByRole("button", { name: "Salvar arena" }));

      expect(await screen.findByText(/antes: arena-belem/)).toBeInTheDocument();
      expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/endereço antigo será levado para o novo/));
      const [url, init] = fetchMock.mock.calls[1];
      expect(url).toBe("/api/super-admin/arenas/arena-belem");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toEqual({
        slug: "belem-arena",
        modulos: ["agendamento_core", "escolinhas"],
        ativo: true,
        modoDemonstracao: true,
      });
    });

    it("mostra o erro do servidor sem fechar a edição", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => ({ arenas: [ARENA] }) })
        .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Este endereço já é (ou já foi) usado por outra arena." }) });
      vi.spyOn(window, "confirm").mockReturnValue(true);
      entrar();
      fireEvent.click(screen.getByRole("button", { name: "Carregar arenas" }));
      fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
      fireEvent.change(screen.getByLabelText("Endereço (subdomínio)"), { target: { value: "outra" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar arena" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/já é \(ou já foi\) usado/);
      expect(screen.getByRole("button", { name: "Salvar arena" })).toBeInTheDocument();
    });
  });
});
