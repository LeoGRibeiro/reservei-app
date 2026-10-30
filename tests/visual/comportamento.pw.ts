/**
 * @file comportamento.pw.ts
 * @description Comportamento do portal comparado com o protótipo: menu e âncoras (posição da rolagem
 * e item marcado pelo scroll spy), horário de aula levando até a turma com destaque, mural aberto,
 * seleção de horas seguidas, botão de voltar ao topo e sombra do topo.
 */

import { expect, test, type Page } from "@playwright/test";
import { TELAS, abrirPrototipo, compararCapturas, estabilizar, instrumentar } from "./comparar";

async function abrirImplementacao(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.classList.contains("lenis"));
  await estabilizar(page);
}

/** Estado observável depois de uma ação: rolagem, item marcado, destaque e sombra do topo. */
async function estado(page: Page) {
  await page.waitForTimeout(1300);
  return page.evaluate(() => ({
    rolagem: Math.round(window.scrollY),
    marcado: document.querySelector(".nav a[aria-current]")?.textContent ?? null,
    destaque: Boolean(document.querySelector(".destaque")),
    sombra: document.getElementById("topo")?.dataset.rolado,
    subir: !(document.getElementById("subir") as HTMLElement).hidden,
  }));
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(TELAS.computador);
  await instrumentar(page);
});

test("menu do topo: mesma rolagem e mesmo item marcado em cada seção", async ({ page }) => {
  const resultado: Record<string, unknown>[] = [];
  for (const lado of ["prototipo", "implementacao"]) {
    if (lado === "prototipo") await abrirPrototipo(page);
    else await abrirImplementacao(page);
    const passos: Record<string, unknown> = {};
    for (const secao of ["Escolinhas", "Campeonatos", "Estrutura", "Contato", "Reservar"]) {
      await page.locator(".nav a", { hasText: secao }).click();
      passos[secao] = await estado(page);
    }
    resultado.push(passos);
  }
  expect(resultado[1]).toEqual(resultado[0]);
});

test("horário de aula leva até a turma com destaque; Como funciona leva ao Clube", async ({ page }) => {
  const resultado: unknown[] = [];
  for (const lado of ["prototipo", "implementacao"]) {
    if (lado === "prototipo") await abrirPrototipo(page);
    else await abrirImplementacao(page);
    await page.locator(".slot.aula").first().click();
    const aula = await estado(page);
    await page.locator(".nav a", { hasText: "Reservar" }).click();
    await page.waitForTimeout(1300);
    await page.locator('.t-obs a[href="#clube"]').click();
    const clube = await estado(page);
    await page.click("#subir");
    const subir = await estado(page);
    resultado.push({ aula, clube, subir });
  }
  expect(resultado[1]).toEqual(resultado[0]);
});

test("mural aberto e seleção de horas seguidas ficam iguais", async ({ page }, info) => {
  const capturas: Buffer[] = [];
  const selecoes: string[][] = [];
  for (const lado of ["prototipo", "implementacao"]) {
    if (lado === "prototipo") await abrirPrototipo(page);
    else await abrirImplementacao(page);
    await page.locator("#partidas summary").click();
    await page.waitForTimeout(200);
    capturas.push(await page.locator(".r-ticket").screenshot());
    // Duas horas seguidas e depois uma fora da sequência na mesma quadra (dia seguinte)
    await page.locator(".dia").nth(1).click();
    const quadra = page.locator(".quadra").nth(1);
    const livres = quadra.locator(".slot.livre");
    const horas = await livres.locator("b").allTextContents();
    const seguidas = horas.findIndex((h, i) => i + 1 < horas.length && Number(horas[i + 1].slice(0, 2)) === Number(h.slice(0, 2)) + 1);
    await quadra.locator(".slot", { hasText: horas[seguidas] }).click();
    await quadra.locator(".slot", { hasText: horas[seguidas + 1] }).click();
    const antes = await quadra.locator(".slot.sel b").allTextContents();
    await quadra.locator(".slot.livre").last().click();
    selecoes.push([...antes, "|", ...(await quadra.locator(".slot.sel b").allTextContents())]);
  }
  await compararCapturas("mural-aberto", capturas[0], capturas[1], info);
  expect(selecoes[1]).toEqual(selecoes[0]);
});
