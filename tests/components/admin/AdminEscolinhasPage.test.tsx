import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminEscolinhasPage } from "@/components/admin/AdminEscolinhasPage";

describe("AdminEscolinhasPage - escolinhas num lugar só", () => {
  it("abre na aba No site, com o formulário do card e do botão Quero uma vaga", () => {
    render(<AdminEscolinhasPage />);
    expect(screen.getByRole("tab", { name: /No site/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: /Nova escolinha/i }));

    expect(screen.getByRole("heading", { name: "Nova escolinha" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Abrir o WhatsApp/ })).toBeChecked();
    expect((screen.getByLabelText("Mensagem pronta") as HTMLTextAreaElement).value).toContain("Vim pelo site e quero uma vaga");
  });

  it("a aba Horários na agenda mostra os contratos que bloqueiam quadra", () => {
    render(<AdminEscolinhasPage />);
    fireEvent.click(screen.getByRole("tab", { name: /Horários na agenda/ }));

    expect(screen.getByRole("tab", { name: /Horários na agenda/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /Novo horário de aula/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova escolinha/i })).not.toBeInTheDocument();
  });
});
