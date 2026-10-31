/**
 * @file isolamento-css.pw.ts
 * @description O CSS de cada grupo de rotas fica no seu grupo: as páginas da plataforma carregam o
 * Tailwind (fundo escuro do painel) e o portal não (o preflight do Tailwind mudaria margens,
 * sublinhados e cores de placeholder do protótipo).
 */

import { expect, test } from "@playwright/test";

// `body { background-color: var(--background) }` do globals.css (#0f172a)
const FUNDO_PLATAFORMA = "rgb(15, 23, 42)";

for (const caminho of ["/para-arenas", "/admin", "/super-admin", "/termos"]) {
  test(`plataforma com Tailwind · ${caminho}`, async ({ page }) => {
    await page.goto(caminho);
    const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(fundo).toBe(FUNDO_PLATAFORMA);
  });
}
