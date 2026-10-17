/**
 * @file subdomain.spec.ts
 * @description Testes unitários para o parser e construtor de subdomínios dinâmicos multi-tenant.
 */

import { describe, it, expect } from "vitest";
import { extrairSubdominio, construirUrlArena } from "@/lib/arena/subdomain";

describe("Subdomain Parser - extrairSubdominio", () => {
  it("deve extrair o slug de subdomínios padrão de produção (.reservei.com)", () => {
    expect(extrairSubdominio("praia-leopoldina.reservei.com")).toBe("praia-leopoldina");
    expect(extrairSubdominio("arena-belem.reservei.com:443")).toBe("arena-belem");
  });

  it("deve extrair o slug de domínios com extensão composta (.com.br)", () => {
    expect(extrairSubdominio("praia-leopoldina.reservei.com.br")).toBe("praia-leopoldina");
    expect(extrairSubdominio("reservei.com.br")).toBeNull();
  });

  it("deve extrair subdomínios em ambiente de desenvolvimento local (*.localhost)", () => {
    expect(extrairSubdominio("leopoldina.localhost:3000")).toBe("leopoldina");
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
    const url = construirUrlArena("leopoldina", "https");
    expect(url).toContain("leopoldina");
  });
});
