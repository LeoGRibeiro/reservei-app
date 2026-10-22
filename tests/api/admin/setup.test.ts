/**
 * @file setup.test.ts
 * @description Testes das rotas /api/admin/setup (Setup Wizard com token de convite) e
 * /api/super-admin/arenas.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  configurado: true,
  estadoSetup: vi.fn(),
  criarAdmin: vi.fn(),
  criarArena: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", () => ({
  isAdminClientConfigured: () => mocks.configurado,
  supabaseAdmin: {},
}));

vi.mock("@/lib/admin/provisionamento", async () => {
  const real = await vi.importActual<typeof import("@/lib/admin/provisionamento")>(
    "@/lib/admin/provisionamento"
  );
  return {
    ...real,
    consultarEstadoSetup: mocks.estadoSetup,
    criarPrimeiroAdministrador: mocks.criarAdmin,
    criarArena: mocks.criarArena,
  };
});

import { GET, POST } from "@/app/api/admin/setup/route";
import { POST as POST_ARENA } from "@/app/api/super-admin/arenas/route";
import { ErroProvisionamento } from "@/lib/admin/provisionamento";

function post(url: string, corpo: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const SETUP = {
  arenaSlug: "central",
  token: "token-de-convite",
  nome: "Maria Dona",
  email: "maria@arena.com",
  senha: "senhaForte1",
};

describe("GET /api/admin/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configurado = true;
  });

  it("retorna precisaSetup e tokenValido, repassando slug e token ao serviço", async () => {
    mocks.estadoSetup.mockResolvedValue({ precisaSetup: true, tokenValido: true });
    const res = await GET(
      new NextRequest("http://localhost:3000/api/admin/setup?slug=Central&token=abc")
    );

    expect(await res.json()).toEqual({ precisaSetup: true, tokenValido: true });
    expect(mocks.estadoSetup).toHaveBeenCalledWith("central", "abc");
  });

  it("repassa token vazio quando não informado", async () => {
    mocks.estadoSetup.mockResolvedValue({ precisaSetup: true, tokenValido: false });
    const res = await GET(new NextRequest("http://localhost:3000/api/admin/setup?slug=central"));

    expect(await res.json()).toEqual({ precisaSetup: true, tokenValido: false });
    expect(mocks.estadoSetup).toHaveBeenCalledWith("central", "");
  });

  it("exige o parâmetro slug", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/admin/setup"));
    expect(res.status).toBe(400);
  });

  it("retorna precisaSetup=false quando o service role não está configurado", async () => {
    mocks.configurado = false;
    const res = await GET(new NextRequest("http://localhost:3000/api/admin/setup?slug=x"));

    expect(await res.json()).toEqual({ precisaSetup: false, tokenValido: false });
    expect(mocks.estadoSetup).not.toHaveBeenCalled();
  });

  it("retorna precisaSetup=false em caso de erro de banco", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.estadoSetup.mockRejectedValue(new Error("db"));
    const res = await GET(new NextRequest("http://localhost:3000/api/admin/setup?slug=x"));

    expect(await res.json()).toEqual({ precisaSetup: false, tokenValido: false });
  });
});

describe("POST /api/admin/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configurado = true;
    mocks.criarAdmin.mockResolvedValue({ userId: "u1" });
  });

  it("cria o administrador enviando o token e responde success", async () => {
    const res = await POST(post("http://localhost:3000/api/admin/setup", SETUP));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.criarAdmin).toHaveBeenCalledWith(SETUP);
  });

  it("responde 403 quando o token é inválido, ausente ou já usado", async () => {
    mocks.criarAdmin.mockRejectedValue(
      new ErroProvisionamento("Token de convite inválido ou expirado", 403)
    );
    const res = await POST(post("http://localhost:3000/api/admin/setup", SETUP));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Token de convite inválido ou expirado");
  });

  it("repassa o token vazio ao serviço quando o corpo não o informa (rejeição fica no serviço)", async () => {
    const { token: _t, ...semToken } = SETUP;
    void _t;
    mocks.criarAdmin.mockRejectedValue(
      new ErroProvisionamento("Token de convite inválido ou expirado", 403)
    );

    const res = await POST(post("http://localhost:3000/api/admin/setup", semToken));

    expect(res.status).toBe(403);
    expect(mocks.criarAdmin).toHaveBeenCalledWith({ ...semToken, token: "" });
  });

  it("responde 403 quando a arena já possui administrador", async () => {
    mocks.criarAdmin.mockRejectedValue(
      new ErroProvisionamento("Esta arena já possui administrador ativo", 403)
    );
    const res = await POST(post("http://localhost:3000/api/admin/setup", SETUP));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Esta arena já possui administrador ativo");
  });

  it("responde 400 para corpo inválido ou JSON malformado", async () => {
    const invalido = await POST(post("http://localhost:3000/api/admin/setup", { ...SETUP, senha: "123" }));
    const malformado = await POST(post("http://localhost:3000/api/admin/setup", "{nao-e-json"));

    expect(invalido.status).toBe(400);
    expect(malformado.status).toBe(400);
    expect(mocks.criarAdmin).not.toHaveBeenCalled();
  });

  it("responde 503 quando o service role não está configurado", async () => {
    mocks.configurado = false;
    const res = await POST(post("http://localhost:3000/api/admin/setup", SETUP));

    expect(res.status).toBe(503);
    expect(mocks.criarAdmin).not.toHaveBeenCalled();
  });

  it("responde 500 sem vazar detalhes em erros inesperados", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.criarAdmin.mockRejectedValue(new Error("detalhe interno secreto"));
    const res = await POST(post("http://localhost:3000/api/admin/setup", SETUP));

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secreto");
  });
});

describe("POST /api/super-admin/arenas", () => {
  const ARENA = {
    nome: "Arena Central",
    slug: "central",
    cidade: "Belém",
    estado: "PA",
    whatsapp: "91981234567",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configurado = true;
    vi.stubEnv("SUPER_ADMIN_SECRET", "segredo-forte");
    mocks.criarArena.mockResolvedValue({
      arenaId: "a1",
      slug: "central",
      quadrasCriadas: 3,
      tokenConvite: "tok-1",
      urlConvite: "https://central.reservei.com/admin?token=tok-1",
    });
  });

  it("cria a arena e devolve token e link de ativação com o segredo correto", async () => {
    const res = await POST_ARENA(
      post("http://localhost:3000/api/super-admin/arenas", ARENA, { "x-super-admin-secret": "segredo-forte" })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      success: true,
      sucesso: true,
      slug: "central",
      quadrasCriadas: 3,
      tokenConvite: "tok-1",
      urlConvite: "https://central.reservei.com/admin?token=tok-1",
    });
  });

  it("responde 401 com segredo errado ou ausente", async () => {
    const errado = await POST_ARENA(
      post("http://localhost:3000/api/super-admin/arenas", ARENA, { "x-super-admin-secret": "outro" })
    );
    const ausente = await POST_ARENA(post("http://localhost:3000/api/super-admin/arenas", ARENA));

    expect(errado.status).toBe(401);
    expect(ausente.status).toBe(401);
    expect(mocks.criarArena).not.toHaveBeenCalled();
  });

  it("responde 503 quando SUPER_ADMIN_SECRET não está configurada (bloqueia tudo)", async () => {
    vi.stubEnv("SUPER_ADMIN_SECRET", "");
    const res = await POST_ARENA(
      post("http://localhost:3000/api/super-admin/arenas", ARENA, { "x-super-admin-secret": "" })
    );

    expect(res.status).toBe(503);
  });

  it("repassa erros de negócio (slug duplicado = 409) e valida o corpo (400)", async () => {
    mocks.criarArena.mockRejectedValue(new ErroProvisionamento("Já existe uma arena com este slug.", 409));
    const headers = { "x-super-admin-secret": "segredo-forte" };

    const duplicado = await POST_ARENA(post("http://localhost:3000/api/super-admin/arenas", ARENA, headers));
    const invalido = await POST_ARENA(
      post("http://localhost:3000/api/super-admin/arenas", { ...ARENA, slug: "Slug Inválido" }, headers)
    );

    expect(duplicado.status).toBe(409);
    expect(invalido.status).toBe(400);
  });
});
