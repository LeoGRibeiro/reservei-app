/**
 * @file superAdminPage.test.tsx
 * @description Testes da tela /super-admin: criação de arena e exibição/cópia do link de ativação.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SuperAdminPage from "@/app/super-admin/page";

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
});
