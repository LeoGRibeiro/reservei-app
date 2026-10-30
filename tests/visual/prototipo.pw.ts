/**
 * @file prototipo.pw.ts
 * @description Sanidade da própria referência: o protótipo aprovado passa nas checagens de tela e a
 * captura é determinística (duas aberturas seguidas dão o mesmo resultado). Se este teste falhar, o
 * problema está no ambiente de comparação, não na implementação.
 */

import { test } from "@playwright/test";
import { TELAS, abrirPrototipo, checarTela, compararCapturas, instrumentar, type NomeTela } from "./comparar";

for (const tela of Object.keys(TELAS) as NomeTela[]) {
  test(`protótipo é estável e limpo · ${tela}`, async ({ page }, info) => {
    await page.setViewportSize(TELAS[tela]);
    await instrumentar(page);
    await abrirPrototipo(page, "visitante");
    const primeira = await page.screenshot({ fullPage: true });
    await checarTela(page, `protótipo ${tela}`, tela === "celular");
    await abrirPrototipo(page, "visitante");
    const segunda = await page.screenshot({ fullPage: true });
    await compararCapturas(`prototipo-${tela}`, primeira, segunda, info, 0);
  });
}
