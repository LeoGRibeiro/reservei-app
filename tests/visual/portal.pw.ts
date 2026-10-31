/**
 * @file portal.pw.ts
 * @description Comparação visual do portal público (visitante) com o protótipo aprovado, em
 * computador, tablet e celular: página inteira, menu do celular e cada etapa do checkout.
 *
 * Diferenças conhecidas e mascaradas (dados, não layout):
 * - horário da partida do mural de hoje: no protótipo a grade não considera as partidas (sorteio puro);
 *   na implementação a reserva da partida ocupa o horário, como deve;
 * - QR, código copia e cola, cronômetro e número da reserva (gerados na hora).
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { TELAS, abrirPrototipo, checarTela, compararCapturas, estabilizar, instrumentar, ocultar, type NomeTela } from "./comparar";

/** Quadras: id do protótipo → id da implementação. */
const QUADRAS = { "areia-1": "arena-belem-q1", "areia-2": "arena-belem-q2", "areia-3": "arena-belem-q3", society: "arena-belem-q4" };

async function abrirImplementacao(page: Page, caminho = "/"): Promise<void> {
  await page.goto(caminho);
  await page.waitForSelector("#reservar .slot");
  // Só depois da hidratação (o Lenis liga num efeito do React): mexer no DOM antes quebraria a hidratação
  await page.waitForFunction(() => document.documentElement.classList.contains("lenis"));
  await estabilizar(page);
}

/** Horário da partida do mural de hoje (Areia 1, 20h) nos dois lados. */
function mascaraPartida(page: Page, prototipo: boolean): Locator {
  const id = prototipo ? "q-areia-1" : `q-${QUADRAS["areia-1"]}`;
  return page.locator(`#${id} .slot`).filter({ has: page.locator("b", { hasText: /^20:00$/ }) });
}

for (const tela of Object.keys(TELAS) as NomeTela[]) {
  test.describe(`portal · ${tela}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(TELAS[tela]);
      await instrumentar(page);
    });

    test("página inteira (visitante)", async ({ page }, info) => {
      await abrirPrototipo(page);
      const esperado = await page.screenshot({ fullPage: true, mask: [mascaraPartida(page, true)], maskColor: "#ff00ff" });
      await abrirImplementacao(page);
      const obtido = await page.screenshot({ fullPage: true, mask: [mascaraPartida(page, false)], maskColor: "#ff00ff" });
      await compararCapturas(`pagina-${tela}`, esperado, obtido, info);
      await checarTela(page, `portal ${tela}`, tela === "celular");
    });

    if (tela !== "computador") {
      test("menu do celular aberto", async ({ page }, info) => {
        await abrirPrototipo(page);
        await page.click(".burger");
        const esperado = await page.screenshot();
        await abrirImplementacao(page);
        await page.click(".burger");
        const obtido = await page.screenshot();
        await compararCapturas(`menu-celular-${tela}`, esperado, obtido, info);
      });
    }

    test("checkout: dados, Pix e confirmada", async ({ page }, info) => {
      // Mesmo horário livre nos dois lados: o primeiro livre da Areia 2 num dia futuro (o servidor usa a
      // hora real; hoje, com o relógio do navegador fixo às 08:30, poderia ser um horário que já passou)
      // Cada tamanho de tela reserva num dia diferente (o banco local guarda as reservas da rodada)
      const ficha = { computador: 1, tablet: 2, celular: 3 }[tela];
      await abrirPrototipo(page);
      await page.locator(".dia").nth(ficha).click();
      const hora = (await page.locator("#q-areia-2 .slot.livre b").first().textContent()) ?? "";
      expect(hora).toMatch(/^\d\d:00$/);
      const escolher = async (prototipo: boolean) => {
        if (!prototipo) await page.locator(".dia").nth(ficha).click();
        const id = prototipo ? "q-areia-2" : `q-${QUADRAS["areia-2"]}`;
        await page.locator(`#${id} .slot`).filter({ has: page.locator("b", { hasText: hora }) }).click();
        await page.click(tela === "computador" ? ".ticket .btn-amarelo" : ".barra .btn-amarelo");
        await page.waitForSelector("#ck[open]");
        await page.waitForTimeout(300);
      };
      const preencher = async () => {
        await page.fill("#f-nome", "ana de souza");
        await page.fill("#f-whats", "91988887777");
        await page.check("#f-aceite");
        await page.locator("#f-nome").blur();
      };
      const PIX_NA_HORA = [".pix-qr > *", "#pix-code", "#pix-timer"];
      const OK_NA_HORA = [".carimbo small.num"];

      await escolher(true);
      const dadosEsperado = await page.screenshot();
      await preencher();
      const preenchidoEsperado = await page.screenshot();
      await page.click("#ck-gerar");
      await page.waitForSelector("#pix-code", { timeout: 5000 });
      await page.waitForTimeout(200);
      await ocultar(page, PIX_NA_HORA);
      const pixEsperado = await page.screenshot();
      await page.click('[data-acao="pagar"]');
      await page.waitForSelector("#ck-ok:not([hidden])");
      await page.waitForTimeout(200);
      await ocultar(page, OK_NA_HORA);
      const okEsperado = await page.screenshot();

      await abrirImplementacao(page);
      await escolher(false);
      await compararCapturas(`checkout-dados-${tela}`, dadosEsperado, await page.screenshot(), info);
      await preencher();
      await compararCapturas(`checkout-preenchido-${tela}`, preenchidoEsperado, await page.screenshot(), info);
      await page.click("#ck-gerar");
      await page.waitForSelector("#pix-code", { timeout: 15000 });
      await page.waitForTimeout(200);
      await ocultar(page, PIX_NA_HORA);
      await compararCapturas(`checkout-pix-${tela}`, pixEsperado, await page.screenshot(), info);
      await page.click("text=Simular pagamento");
      await page.waitForSelector("#ck-ok:not([hidden]) .ck-h", { timeout: 15000 });
      await page.waitForTimeout(200);
      await ocultar(page, OK_NA_HORA);
      await compararCapturas(`checkout-ok-${tela}`, okEsperado, await page.screenshot(), info);
    });
  });
}
