/**
 * @file useArena.test.ts
 * @description Testes da resolução de escopo de arena: slug explícito, subdomínio do host atual
 * e fallback de desenvolvimento, sem vazar dados da arena demo para arenas reais.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buscarPorSlug: vi.fn(),
  buscarPorId: vi.fn(),
  listarQuadras: vi.fn(),
  listarPrecos: vi.fn(),
}));

vi.mock("@/lib/arena/arenaRepository", () => ({
  ArenaRepository: {
    buscarPorSlug: mocks.buscarPorSlug,
    buscarPorId: mocks.buscarPorId,
    listarQuadras: mocks.listarQuadras,
    listarPrecos: mocks.listarPrecos,
  },
}));

import { resolverSlugAtivo, useArena } from "@/hooks/useArena";
import { ARENA_PADRAO, QUADRAS_PADRAO } from "@/lib/arena/defaultArena";

const ARENA_CENTRAL = { ...ARENA_PADRAO, id: "arena-central-id", slug: "central", nome: "Arena Central" };
const QUADRA_CENTRAL = { ...QUADRAS_PADRAO[0], id: "central-q1", arenaId: "arena-central-id" };

/** Simula o host do navegador (jsdom permite redefinir location via defineProperty). */
function definirHost(host: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, host, hostname: host.split(":")[0] },
  });
}

describe("resolverSlugAtivo", () => {
  const original = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("prioriza o slug explícito", () => {
    definirHost("outra.localhost:3000");
    expect(resolverSlugAtivo("central")).toBe("central");
  });

  it("usa o subdomínio do host quando o slug é omitido", () => {
    definirHost("central.localhost:3000");
    expect(resolverSlugAtivo()).toBe("central");
    definirHost("central.reservei.com");
    expect(resolverSlugAtivo()).toBe("central");
  });

  it("usa a arena demo em localhost puro, no domínio raiz e em subdomínios reservados", () => {
    for (const host of ["localhost:3000", "reservei.com", "www.reservei.com"]) {
      definirHost(host);
      expect(resolverSlugAtivo()).toBe("arena-demo");
    }
  });
});

describe("useArena - escopo estrito de arena", () => {
  const original = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.buscarPorSlug.mockResolvedValue(null);
    mocks.buscarPorId.mockResolvedValue(null);
    mocks.listarQuadras.mockResolvedValue([]);
    mocks.listarPrecos.mockResolvedValue([]);
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("carrega a arena do subdomínio quando nenhum slug é informado", async () => {
    definirHost("central.localhost:3000");
    mocks.buscarPorSlug.mockResolvedValue(ARENA_CENTRAL);
    mocks.listarQuadras.mockResolvedValue([QUADRA_CENTRAL]);

    const { result } = renderHook(() => useArena());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(mocks.buscarPorSlug).toHaveBeenCalledWith("central");
    expect(result.current.arena.id).toBe("arena-central-id");
    expect(result.current.quadras).toEqual([QUADRA_CENTRAL]);
    expect(mocks.listarQuadras).toHaveBeenCalledWith("arena-central-id");
  });

  it("usa a arena demo (sem consultar o banco) em localhost puro", async () => {
    definirHost("localhost:3000");

    const { result } = renderHook(() => useArena());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(mocks.buscarPorSlug).not.toHaveBeenCalled();
    expect(result.current.arena.id).toBe(ARENA_PADRAO.id);
  });

  it("não despeja quadras da demo em uma arena real que ainda não tem quadras", async () => {
    definirHost("central.localhost:3000");
    mocks.buscarPorSlug.mockResolvedValue(ARENA_CENTRAL);
    mocks.listarQuadras.mockResolvedValue([]);

    const { result } = renderHook(() => useArena());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.quadras).toEqual([]);
    expect(result.current.precos).toEqual([]);
  });

  it("mantém os dados de demonstração para a arena demo sem quadras cadastradas", async () => {
    definirHost("localhost:3000");

    const { result } = renderHook(() => useArena());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.quadras).toEqual(QUADRAS_PADRAO);
  });

  it("sinaliza erro e não exibe dados da demo quando o subdomínio não corresponde a nenhuma arena", async () => {
    definirHost("fantasma.localhost:3000");

    const { result } = renderHook(() => useArena());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.erro).toContain("fantasma");
    expect(result.current.quadras).toEqual([]);
    expect(result.current.precos).toEqual([]);
  });

  it("o slug explícito prevalece sobre o subdomínio", async () => {
    definirHost("outra.localhost:3000");
    mocks.buscarPorSlug.mockResolvedValue(ARENA_CENTRAL);

    const { result } = renderHook(() => useArena("central"));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(mocks.buscarPorSlug).toHaveBeenCalledWith("central");
  });
});
