/**
 * @file caminhoArena.spec.ts
 * @description Testes do redirecionamento 301 de rotas por caminho (reservei.com/arena)
 * para subdomínios estritos, tanto nos helpers puros quanto no proxy do Next.js 16.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  extrairSlugDoCaminho,
  resolverRedirecionamentoPorCaminho,
} from "@/lib/arena/subdomain";
import { proxy } from "@/proxy";

describe("extrairSlugDoCaminho", () => {
  it("extrai o primeiro segmento como slug em minúsculas", () => {
    expect(extrairSlugDoCaminho("/central")).toBe("central");
    expect(extrairSlugDoCaminho("/Arena-Doze/agenda")).toBe("arena-doze");
  });

  it("ignora a raiz e rotas da própria aplicação", () => {
    expect(extrairSlugDoCaminho("/")).toBeNull();
    expect(extrairSlugDoCaminho("/login")).toBeNull();
    expect(extrairSlugDoCaminho("/cadastro")).toBeNull();
    expect(extrairSlugDoCaminho("/admin")).toBeNull();
    expect(extrairSlugDoCaminho("/admin/dashboard")).toBeNull();
    expect(extrairSlugDoCaminho("/super-admin")).toBeNull();
    expect(extrairSlugDoCaminho("/minha-conta")).toBeNull();
    expect(extrairSlugDoCaminho("/robots.txt")).toBeNull();
  });

  it("ignora segmentos que coincidem com subdomínios reservados", () => {
    expect(extrairSlugDoCaminho("/www")).toBeNull();
    expect(extrairSlugDoCaminho("/api/webhooks")).toBeNull();
  });

  it("ignora segmentos que não têm formato de slug", () => {
    expect(extrairSlugDoCaminho("/arquivo.js")).toBeNull();
    expect(extrairSlugDoCaminho("/-invalido")).toBeNull();
    expect(extrairSlugDoCaminho("/com_underscore")).toBeNull();
  });
});

describe("resolverRedirecionamentoPorCaminho", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("monta a URL do subdomínio de produção preservando caminho restante e query", () => {
    expect(resolverRedirecionamentoPorCaminho("/central")).toBe(
      "https://central.reservei.com/"
    );
    expect(resolverRedirecionamentoPorCaminho("/central/agenda", "?data=2026-10-21")).toBe(
      "https://central.reservei.com/agenda?data=2026-10-21"
    );
  });

  it("monta a URL de *.localhost em ambiente de desenvolvimento", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(resolverRedirecionamentoPorCaminho("/central")).toBe(
      "http://central.localhost:3000/"
    );
  });

  it("retorna null para rotas que não pertencem a uma arena", () => {
    expect(resolverRedirecionamentoPorCaminho("/")).toBeNull();
    expect(resolverRedirecionamentoPorCaminho("/admin")).toBeNull();
  });
});

describe("proxy - subdomínios estritos", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function req(url: string, host: string) {
    return new NextRequest(url, { headers: { host } });
  }

  it("redireciona com 301 /arena no domínio raiz para o subdomínio da arena (dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = proxy(req("http://localhost:3000/central", "localhost:3000"));

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("http://central.localhost:3000/");
  });

  it("redireciona com 301 em produção preservando o restante do caminho", () => {
    const res = proxy(req("https://reservei.com/arenadoze/minha-conta", "reservei.com"));

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://arenadoze.reservei.com/minha-conta");
  });

  it("não redireciona rotas da aplicação no domínio raiz", () => {
    for (const caminho of ["/", "/login", "/cadastro", "/admin", "/admin/dashboard", "/minha-conta"]) {
      const res = proxy(req(`http://localhost:3000${caminho}`, "localhost:3000"));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("reescreve a home do subdomínio para a página da arena", () => {
    const res = proxy(req("https://central.reservei.com/", "central.reservei.com"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/central");
  });

  it("propaga o slug via cabeçalho e não reescreve demais páginas do subdomínio", () => {
    const res = proxy(
      req("https://central.reservei.com/admin", "central.reservei.com")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-arena-slug")).toBe("central");
  });

  it("não redireciona caminhos que já estão em um subdomínio de arena", () => {
    const res = proxy(
      req("https://central.reservei.com/outra", "central.reservei.com")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
