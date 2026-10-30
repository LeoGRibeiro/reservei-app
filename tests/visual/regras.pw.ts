/**
 * @file regras.pw.ts
 * @description Comparação visual da página de Regras e dúvidas com o protótipo aprovado
 * (`preview-portal-regras.html`), em computador, tablet e celular, e o comportamento das âncoras.
 */

import { expect, test } from "@playwright/test";
import { TELAS, alvosPequenos, checarTela, compararCapturas, estabilizar, instrumentar, type NomeTela } from "./comparar";

for (const tela of Object.keys(TELAS) as NomeTela[]) {
  test(`regras · ${tela}`, async ({ page }, info) => {
    await page.setViewportSize(TELAS[tela]);
    await instrumentar(page);

    await page.goto("/preview-portal-regras.html");
    await estabilizar(page);
    const esperado = await page.screenshot({ fullPage: true });
    const pequenosNoPrototipo = await alvosPequenos(page);
    await page.locator(".faq summary").nth(1).click();
    const abertaEsperado = await page.screenshot({ fullPage: true });
    await page.click('.indice a[href="#perguntas"]');
    await page.waitForTimeout(1200);
    const ancoraPrototipo = await page.locator("#perguntas").evaluate((el) => el.getBoundingClientRect().top);

    await page.goto("/regras");
    await page.waitForFunction(() => document.documentElement.classList.contains("lenis"));
    await estabilizar(page);
    await compararCapturas(`regras-${tela}`, esperado, await page.screenshot({ fullPage: true }), info);
    await page.locator(".faq summary").nth(1).click();
    await compararCapturas(`regras-faq-aberta-${tela}`, abertaEsperado, await page.screenshot({ fullPage: true }), info);
    await checarTela(page, `regras ${tela}`, tela === "celular", pequenosNoPrototipo);

    // Âncora do índice: para no mesmo lugar que no protótipo (logo abaixo do topo, ou no fim da página)
    await page.click('.indice a[href="#perguntas"]');
    await page.waitForTimeout(1200);
    const topo = await page.locator("#perguntas").evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.round(topo)).toBe(Math.round(ancoraPrototipo));
  });
}
