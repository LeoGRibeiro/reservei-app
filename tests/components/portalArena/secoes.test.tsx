/**
 * @file secoes.test.tsx
 * @description Componentes do portal: cada bloco some sem dado, estados dos horários e do ticket,
 * cartela do Clube (visitante, carimbos, hora grátis), Instagram e validação do checkout.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardQuadra } from "@/components/portal-arena/reservar/CardQuadra";
import { TicketReserva } from "@/components/portal-arena/reservar/TicketReserva";
import { MuralPartidas } from "@/components/portal-arena/reservar/MuralPartidas";
import { SecaoEventos, mensagemInscricao } from "@/components/portal-arena/secoes/SecaoEventos";
import { CartelaClube } from "@/components/portal-arena/secoes/SecaoClube";
import { SecaoInstagram, linhaPerfil } from "@/components/portal-arena/secoes/SecaoInstagram";
import { linksDoMapa } from "@/components/portal-arena/secoes/SecaoContato";
import { mensagemVagaEscolinha } from "@/components/portal-arena/secoes/SecaoEscolinhas";
import { DialogoCheckout } from "@/components/portal-arena/checkout/DialogoCheckout";
import { periodosDoDia, resumirSelecao, type SituacaoHorario } from "@/lib/portal/agenda";
import type { ArenaPortal, EventoArena, QuadraPortal } from "@/lib/portal/types";

const quadra: QuadraPortal = { id: "q1", nome: "Areia 1", esportes: ["Futevôlei", "Vôlei", "Beach Tennis"], tipoPiso: "areia", valorHoraPadrao: 80, ordem: 1 };
const HOJE = "2026-10-30";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

describe("CardQuadra", () => {
  const situacoes: Record<number, SituacaoHorario> = {
    7: { tipo: "encerrado" },
    8: { tipo: "ocupado" },
    9: { tipo: "aula", escolinhaId: "e1", esporte: "Beach Tennis" },
    10: { tipo: "meu", reservaId: "r1" },
  };
  const montar = (extra = {}) => {
    const props = {
      quadra,
      indice: 0,
      periodos: periodosDoDia("07:00", "13:00"),
      situacao: (h: number) => situacoes[h] ?? { tipo: "livre" as const },
      preco: (h: number) => (h >= 12 ? 100 : 80),
      selecionadas: [11],
      aoAlternar: vi.fn(),
      aoVerAula: vi.fn(),
      aoVerReserva: vi.fn(),
      ...extra,
    };
    render(<CardQuadra {...props} />);
    return props;
  };

  it("mostra todos os horários: encerrado e indisponível continuam na grade", () => {
    montar();
    expect(screen.getByRole("button", { name: "07:00 às 08:00, encerrado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "08:00 às 09:00, ocupado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /aula de beach tennis/ })).toHaveAttribute("title", "Aula de beach tennis");
    expect(screen.getByRole("button", { name: /sua reserva/ })).toHaveTextContent("Sua reserva");
    expect(screen.getByRole("button", { name: "11:00 às 12:00, R$ 80" })).toHaveAttribute("aria-pressed", "true");
  });

  it("horário indisponível fica na grade, não seleciona e mostra o motivo no toque", () => {
    const motivo = "A arena fecha as reservas pelo site 1 hora antes do horário.";
    const p = montar({
      situacao: (h: number) => (h === 12 ? { tipo: "indisponivel" as const, motivo } : situacoes[h] ?? { tipo: "livre" as const }),
    });
    const botao = screen.getByRole("button", { name: /12:00 às 13:00, indisponível/ });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveTextContent("Indisponível");
    fireEvent.click(botao);
    expect(p.aoAlternar).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(`12:00 · ${motivo}`);
  });

  it("encaminha os toques: livre alterna, aula leva à turma, sua reserva leva à conta", () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: "12:00 às 13:00, R$ 100" }));
    fireEvent.click(screen.getByRole("button", { name: /aula/ }));
    fireEvent.click(screen.getByRole("button", { name: /sua reserva/ }));
    expect(p.aoAlternar).toHaveBeenCalledWith(12);
    expect(p.aoVerAula).toHaveBeenCalledWith("e1");
    expect(p.aoVerReserva).toHaveBeenCalledWith("r1");
  });

  it("esportes por extenso e preço de dia e de noite", () => {
    montar();
    expect(screen.getByText("Futevôlei, vôlei e beach tennis")).toBeInTheDocument();
    expect(screen.getByText(/de dia/).textContent).toBe("R$ 80 de dia · R$ 100 à noite");
  });
});

describe("TicketReserva", () => {
  const base = {
    dia: HOJE, hoje: HOJE, nomeArena: "Arena X", logoUrl: "/l.png", percentualSinal: 50, nomeClube: "Clube X",
    temHoraGratis: true, usarHoraGratis: false, tetoHoraGratis: 100, aoUsarHoraGratis: vi.fn(), aoContinuar: vi.fn(), aoLimpar: vi.fn(),
  };

  it("vazio convida a escolher um horário", () => {
    render(<TicketReserva {...base} resumo={null} logado={false} />);
    expect(screen.getByRole("button", { name: "Escolha um horário" })).toBeDisabled();
  });

  it("com seleção mostra total, sinal e o que fica para a arena; visitante não vê hora grátis nem Clube", () => {
    const resumo = resumirSelecao({ quadra, horas: [19, 20], dia: HOJE, precos: [], percentualSinal: 50, integral: false, tetoHoraGratis: null });
    render(<TicketReserva {...base} resumo={resumo} logado={false} />);
    expect(screen.getByText("Total · 2 horas")).toBeInTheDocument();
    expect(screen.getByText("R$ 80", { selector: ".t-sinal" })).toBeInTheDocument();
    expect(screen.queryByText(/hora grátis/)).toBeNull();
    expect(screen.queryByText(/soma 2 horas/)).toBeNull();
  });

  it("atleta com hora grátis pode usá-la; a reserva soma horas no Clube", () => {
    const resumo = resumirSelecao({ quadra, horas: [19], dia: HOJE, precos: [], percentualSinal: 50, integral: false, tetoHoraGratis: null });
    render(<TicketReserva {...base} resumo={resumo} logado />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(base.aoUsarHoraGratis).toHaveBeenCalledWith(true);
    expect(screen.getByText("Esta reserva soma 1 hora no Clube X.")).toBeInTheDocument();
  });
});

describe("MuralPartidas", () => {
  it("nunca mostra quantas vagas faltam e diferencia a própria partida", () => {
    const aoPedir = vi.fn();
    render(
      <MuralPartidas hoje={HOJE} aberto aoAlternar={vi.fn()} aoPedir={aoPedir} aoVerPedidos={vi.fn()} partidas={[
        { id: "p1", data: HOJE, inicio: 20, fim: 21, esporte: "Beach Tennis", quadraNome: "Areia 1", organizador: "Thiago", propria: false, pedidos: 0, pedido: false },
        { id: "p2", data: "2026-10-31", inicio: 19, fim: 21, esporte: "Beach Tennis", quadraNome: "Areia 2", organizador: "Rafael", propria: true, pedidos: 2, pedido: false },
      ]} />
    );
    expect(screen.queryByText(/faltam|vaga/i)).toBeNull();
    expect(screen.getByText("Areia 2 · sua partida")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver pedidos (2)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quero jogar" }));
    expect(aoPedir).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });
});

const evento = (e: Partial<EventoArena>): EventoArena => ({
  id: "e", titulo: "Evento", dataInicio: "2026-11-21", status: "inscricoes", dados: [], chave: [], ordem: 0, ...e,
});

describe("SecaoEventos", () => {
  it("cada bloco some sem dado", () => {
    render(<SecaoEventos eventos={[evento({ id: "a", status: "inscricoes" })]} whatsappArena="5591900000000" />);
    expect(screen.getByText("Inscrições abertas")).toBeInTheDocument();
    expect(screen.queryByText("Rolando agora")).toBeNull();
    expect(screen.queryByText("Já aconteceu")).toBeNull();
  });

  it("formulário sem link vira inscrição pelo WhatsApp; confirmar presença usa o botão com borda", () => {
    render(
      <SecaoEventos whatsappArena="5591900000000" eventos={[
        evento({ id: "a", titulo: "Open", inscricaoTipo: "formulario" }),
        evento({ id: "b", titulo: "Resenha", inscricaoTipo: "confirmar_presenca", mensagemWhatsapp: "Confirmo!" }),
      ]} />
    );
    expect(screen.getByRole("link", { name: "Inscrever-se" }).getAttribute("href")).toContain("wa.me/5591900000000");
    expect(mensagemInscricao(evento({ titulo: "Open" }))).toBe("Olá! Vim pelo site e quero me inscrever no Open. Como faço?");
    expect(screen.getByRole("link", { name: "Confirmar presença" })).toHaveClass("btn-borda");
  });

  it("já aconteceu mostra no máximo 3, do mais recente ao mais antigo", () => {
    render(
      <SecaoEventos whatsappArena="55" eventos={["2026-06-01", "2026-09-01", "2026-07-01", "2026-08-01"].map((d, i) =>
        evento({ id: `p${i}`, titulo: `T${d}`, dataInicio: d, status: "encerrado" }))} />
    );
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["T2026-09-01", "T2026-08-01", "T2026-07-01"]);
  });
});

describe("CartelaClube", () => {
  const clube = { nome: "Clube X", meta: 10, mesesValidade: 3, diasValidadeVoucher: 60, valorTeto: 100 };
  const base = { clube, nomeArena: "Arena X", logoUrl: "/l.png", hoje: HOJE, aoCriarConta: vi.fn(), aoUsarHoraGratis: vi.fn(), aoNavegar: vi.fn() };

  it("visitante: casas vazias e criar conta", () => {
    render(<CartelaClube {...base} atleta={null} />);
    expect(screen.getByText("Cartela do Clube")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta e começar a juntar" }));
    expect(base.aoCriarConta).toHaveBeenCalled();
  });

  it("atleta com hora grátis vê validade e teto", () => {
    render(<CartelaClube {...base} atleta={{ nome: "Ana", carimbos: 6, ultimos: [], horasGratis: [{ expiraEm: "2026-12-21" }] }} />);
    expect(screen.getByText("Você tem 1 hora grátis")).toBeInTheDocument();
    expect(screen.getByText(/Vale em qualquer quadra, até/).textContent).toBe(
      "Vale em qualquer quadra, até R$ 100, até 21 de dezembro. Faltam 4 carimbos para a próxima."
    );
  });

  it("atleta sem hora grátis vê quanto falta", () => {
    render(<CartelaClube {...base} atleta={{ nome: "Ana", carimbos: 9, ultimos: [], horasGratis: [] }} />);
    expect(screen.getByText("Faltam 1 carimbo")).toBeInTheDocument();
  });
});

describe("Instagram, contato e escolinhas", () => {
  it("contagens só quando existem, com aviso de simuladas", () => {
    expect(linhaPerfil("Arena X", null)).toBe("Arena X no Instagram");
    render(
      <SecaoInstagram usuario="arenax" nomeArena="Arena X" logoUrl="/l.png" hoje={HOJE} fuso="America/Belem"
        perfil={{ seguidores: 4120, totalPosts: 312, contagemSimulada: true }}
        posts={[{ id: "1", imagemUrl: "/a.jpg", largura: 1, altura: 1, descricao: "", legenda: "Oi", tipo: "reels", link: "", publicadoEm: "2026-10-27T15:00:00Z", fixado: true }]} />
    );
    expect(screen.getByText(/312 posts · 4.120 seguidores/)).toBeInTheDocument();
    expect(screen.getByText("(simulado)")).toBeInTheDocument();
    expect(screen.getByText("há 3 dias")).toBeInTheDocument();
    expect(screen.getByText("Fixado")).toBeInTheDocument();
  });

  it("sem Place ID, Avaliar no Google cai na página do Maps; Waze usa as coordenadas", () => {
    const arena = { endereco: "Rua A, 1", cidade: "Belém", estado: "PA", latitude: -1.46, longitude: -48.49, googleMapsUrl: "https://maps/x" } as ArenaPortal;
    expect(linksDoMapa(arena)).toEqual({ maps: "https://maps/x", waze: "https://waze.com/ul?ll=-1.46,-48.49&navigate=yes", avaliar: "https://maps/x" });
    expect(linksDoMapa({ ...arena, googlePlaceId: "ChIJabc" }).avaliar).toBe("https://search.google.com/local/writereview?placeid=ChIJabc");
  });

  it("mensagem do Quero uma vaga", () => {
    expect(mensagemVagaEscolinha({ esporte: "Beach tennis", professor: "Italo Bianck" })).toBe(
      "Olá! Vim pelo site e quero uma vaga no beach tennis com o Prof. Italo Bianck. Pode me passar os valores e as vagas das turmas?"
    );
  });
});

describe("DialogoCheckout (Seus dados)", () => {
  const resumo = resumirSelecao({ quadra, horas: [19], dia: HOJE, precos: [], percentualSinal: 50, integral: false, tetoHoraGratis: null });
  const props = {
    aberto: true, aoFechar: vi.fn(), etapa: "dados" as const, resumo, confirmada: null, dia: HOJE, hoje: HOJE,
    arena: { nome: "Arena X", logoUrl: "/l.png", percentualSinal: 50, modoPagamento: "simulado" as const, recebedor: "Arena X", politica: "Política.", dddWhatsapp: "91" },
    atleta: null, clube: null, temHoraGratis: false, usarHoraGratis: false, aoUsarHoraGratis: vi.fn(), integral: false, aoEscolherIntegral: vi.fn(),
    pix: { carregando: false, cobranca: null, expiraEm: null, expirado: false, informado: false }, enviando: false,
    aoEnviar: vi.fn(), aoSimular: vi.fn(), aoInformarPagamento: vi.fn(), aoExpirar: vi.fn(), aoVoltar: vi.fn(), aoEntrar: vi.fn(),
    aoVerReservas: vi.fn(), aoCriarConta: vi.fn(), aoBaixarAgenda: vi.fn(),
  };

  it("valida nome completo, WhatsApp, esporte (quadra com vários) e aceite da política", () => {
    render(<DialogoCheckout {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix de R\$ 40/ }));
    expect(screen.getByText("Informe seu nome completo.")).toBeVisible();
    expect(screen.getByText("WhatsApp inválido. Use DDD e número.")).toBeVisible();
    expect(screen.getByText("Escolha o esporte da partida.")).toBeVisible();
    expect(screen.getByText("Aceite a política para continuar.")).toBeVisible();
    expect(props.aoEnviar).not.toHaveBeenCalled();
  });

  it("com tudo certo envia nome, WhatsApp e esporte; o WhatsApp ganha máscara", () => {
    render(<DialogoCheckout {...props} />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana de Souza" } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "91988887777" } });
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("(91) 98888-7777");
    expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("placeholder", "(91) 90000-0000");
    fireEvent.click(screen.getByLabelText("Vôlei"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(props.aoEnviar).toHaveBeenCalledWith({ nome: "Ana de Souza", whatsapp: "(91) 98888-7777", esporte: "Vôlei" });
  });

  const comPonteiro = (toque: boolean) =>
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: toque && q.includes("coarse"), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

  it("no celular (toque) não abre o teclado sozinho: o foco vai para o título", async () => {
    comPonteiro(true);
    render(<DialogoCheckout {...props} />);
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("ck-titulo"));
    expect(screen.getByLabelText("Nome completo")).not.toHaveFocus();
    vi.unstubAllGlobals();
  });

  it("no computador o foco vai direto para o nome", async () => {
    comPonteiro(false);
    render(<DialogoCheckout {...props} />);
    await vi.waitFor(() => expect(screen.getByLabelText("Nome completo")).toHaveFocus());
    vi.unstubAllGlobals();
  });

  it("na etapa do Pix, as ações ficam no rodapé fixo (Simular pagamento e Voltar)", () => {
    const pix = { carregando: false, cobranca: { copiaECola: "000201", qrCode: "" }, expiraEm: new Date(Date.now() + 600_000).toISOString(), expirado: false, informado: false };
    const { container } = render(<DialogoCheckout {...props} etapa="pix" pix={pix as never} />);
    const fixo = container.ownerDocument.querySelector(".ck-fixo");
    expect(fixo).not.toBeNull();
    expect(fixo).toHaveTextContent("Simular pagamento");
    expect(fixo).toHaveTextContent("Voltar e editar os dados");
  });
});
