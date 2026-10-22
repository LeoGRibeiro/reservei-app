/**
 * @file subdomain.spec.ts
 * @description Testes unitários para o parser e construtor de subdomínios dinâmicos multi-tenant.
 */

import { describe, it, expect } from "vitest";
import {
  extrairSubdominio,
  construirUrlArena,
  hostEhDominioRaiz,
  resolverSlugArenaDoHost,
  SLUG_ARENA_RAIZ,
} from "@/lib/arena/subdomain";

describe("Subdomain Parser - extrairSubdominio", () => {
  it("deve extrair o slug de subdomínios padrão de produção (.reservei.com)", () => {
    expect(extrairSubdominio("arena-central.reservei.com")).toBe("arena-central");
    expect(extrairSubdominio("arena-belem.reservei.com:443")).toBe("arena-belem");
  });

  it("trata domínios da Vercel (produção e previews) como domínio raiz, sem arena", () => {
    expect(extrairSubdominio("reserveei.vercel.app")).toBeNull();
    expect(extrairSubdominio("reservei-p0lyvm7um-leo-gr-ibeiro.vercel.app")).toBeNull();
  });

  it("deve extrair o slug de domínios com extensão composta (.com.br)", () => {
    expect(extrairSubdominio("arena-central.reservei.com.br")).toBe("arena-central");
    expect(extrairSubdominio("reservei.com.br")).toBeNull();
  });

  it("deve extrair subdomínios em ambiente de desenvolvimento local (*.localhost)", () => {
    expect(extrairSubdominio("central.localhost:3000")).toBe("central");
    expect(extrairSubdominio("arena-demo.localhost:3000")).toBe("arena-demo");
    expect(extrairSubdominio("localhost:3000")).toBeNull();
    expect(extrairSubdominio("localhost")).toBeNull();
  });

  it("deve ignorar subdomínios reservados do sistema", () => {
    expect(extrairSubdominio("www.reservei.com")).toBeNull();
    expect(extrairSubdominio("app.reservei.com")).toBeNull();
    expect(extrairSubdominio("admin.reservei.com")).toBeNull();
    expect(extrairSubdominio("api.reservei.com")).toBeNull();
    expect(extrairSubdominio("auth.reservei.com")).toBeNull();
  });

  it("deve retornar null para o domínio raiz sem subdomínio", () => {
    expect(extrairSubdominio("reservei.com")).toBeNull();
    expect(extrairSubdominio("reservei.com:8080")).toBeNull();
  });

  it("deve retornar null para endereços IP ou valores nulos/vazios", () => {
    expect(extrairSubdominio("127.0.0.1:3000")).toBeNull();
    expect(extrairSubdominio("192.168.0.1")).toBeNull();
    expect(extrairSubdominio("")).toBeNull();
    expect(extrairSubdominio(null)).toBeNull();
    expect(extrairSubdominio(undefined)).toBeNull();
  });
});

describe("Subdomain Builder - construirUrlArena", () => {
  it("deve gerar URL completa para a arena", () => {
    const url = construirUrlArena("central", "https");
    expect(url).toContain("central");
  });
});

describe("resolverSlugArenaDoHost", () => {
  it("usa o subdomínio quando existe", () => {
    expect(resolverSlugArenaDoHost("central.reservei.com")).toBe("central");
    expect(resolverSlugArenaDoHost("central.localhost:3000")).toBe("central");
  });

  it("usa a arena raiz em hosts sem subdomínio de arena", () => {
    expect(resolverSlugArenaDoHost("reserveei.vercel.app")).toBe(SLUG_ARENA_RAIZ);
    expect(resolverSlugArenaDoHost("localhost:3000")).toBe(SLUG_ARENA_RAIZ);
    expect(resolverSlugArenaDoHost(null)).toBe(SLUG_ARENA_RAIZ);
  });
});

describe("hostEhDominioRaiz", () => {
  it("aceita o domínio raiz configurado, o www e localhost", () => {
    expect(hostEhDominioRaiz("reservei.com")).toBe(true);
    expect(hostEhDominioRaiz("www.reservei.com:443")).toBe(true);
    expect(hostEhDominioRaiz("localhost:3000")).toBe(true);
  });

  it("recusa hosts que não são o domínio da plataforma", () => {
    expect(hostEhDominioRaiz("reserveei.vercel.app")).toBe(false);
    expect(hostEhDominioRaiz("central.reservei.com")).toBe(false);
    expect(hostEhDominioRaiz("")).toBe(false);
  });
});
