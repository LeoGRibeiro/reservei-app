/**
 * @file playwright.config.ts
 * @description Comparação visual (protótipo x implementação) e teste ponta a ponta da demonstração.
 *
 * Sobe dois servidores só para os testes:
 * - Supabase local (PGlite + REST + Auth + Realtime) com o schema, as migrações e o seed reais;
 * - Next em modo dev na porta 3100, com pasta de build própria e apontando SÓ para o banco local.
 *
 * Rodar: `npm run test:visual` (dentro de `src/`).
 */

import { defineConfig, devices } from "@playwright/test";
import { createHmac } from "node:crypto";
import path from "node:path";

const PORTA_NEXT = 3100;
const PORTA_SUPABASE = 54329;
const RAIZ_TESTES = path.resolve(__dirname, "..", "tests");

/** Mesmo JWT de `tests/supabase-local/gotrue.mjs` (segredo fixo de teste; não vale fora do banco local). */
function jwtLocal(papel: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const corpo = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: papel, iss: "supabase-local", iat: 1_700_000_000, exp: 2_000_000_000 })}`;
  const assinatura = createHmac("sha256", "segredo-local-somente-para-testes-automatizados").update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}
const CHAVE_ANON = jwtLocal("anon");
const CHAVE_SERVICO = jwtLocal("service_role");

export default defineConfig({
  testDir: RAIZ_TESTES,
  testMatch: ["visual/**/*.pw.ts", "e2e/**/*.pw.ts"],
  outputDir: path.join(RAIZ_TESTES, "visual", ".resultados"),
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORTA_NEXT}`,
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Belem",
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: [
    {
      command: `node "${path.join(RAIZ_TESTES, "supabase-local", "servidor.mjs")}"`,
      url: `http://127.0.0.1:${PORTA_SUPABASE}/rest/v1/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        SUPABASE_LOCAL_PORTA: String(PORTA_SUPABASE),
        SUPABASE_LOCAL_CENARIO: path.join(RAIZ_TESTES, "supabase-local", "cenario-prototipo.mjs"),
      },
    },
    {
      command: `npx next dev -p ${PORTA_NEXT}`,
      url: `http://localhost:${PORTA_NEXT}/preview-portal.html`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-teste",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTA_SUPABASE}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: CHAVE_ANON,
        SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO,
        SUPER_ADMIN_SECRET: "segredo-local-de-teste",
        ASAAS_API_KEY: "",
        ASAAS_WEBHOOK_SECRET: "",
        PAGAMENTO_SIMULADO_HABILITADO: "true",
        PAGAMENTO_CREDENCIAIS_SECRET: "chave-local-de-teste-com-32-caracteres!!",
        NEXT_PUBLIC_ARENA_RAIZ_SLUG: "arena-belem",
        NEXT_PUBLIC_FUSO_HORARIO: "America/Belem",
        CODIGO_ACESSO_DEMONSTRACAO: "123456",
      },
    },
  ],
});
