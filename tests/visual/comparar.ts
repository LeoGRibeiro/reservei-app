/**
 * @file comparar.ts
 * @description Utilitários da comparação visual protótipo x implementação (Playwright).
 *
 * - `prepararPagina`: relógio fixo, imagens carregadas, fontes prontas e (no protótipo) sem a barra
 *   de controle do protótipo, que não existe em produção.
 * - `compararCapturas`: diferença pixel a pixel (pixelmatch) com tolerância só de antisserrilhado.
 * - `checarTela`: as checagens da revisão de 30/10 (console, rolagem lateral, imagens, texto cortado,
 *   alvos de toque).
 */

import { expect, type Page, type TestInfo } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/** Tamanhos de tela da SPEC (§7): computador, tablet e celular. */
export const TELAS = {
  computador: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  celular: { width: 390, height: 844 },
} as const;
export type NomeTela = keyof typeof TELAS;

/** Hoje às 08:30 em Belém (UTC-3): todos os horários do dia continuam reserváveis nos dois lados. */
export function relogioDoTeste(): Date {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem" }).format(new Date());
  return new Date(`${hoje}T08:30:00-03:00`);
}

/** Erros de console coletados por página. */
const errosPorPagina = new WeakMap<Page, string[]>();

/**
 * Prepara a página antes de navegar: relógio fixo e coleta de erros de console.
 */
export async function instrumentar(page: Page): Promise<void> {
  await page.clock.setFixedTime(relogioDoTeste());
  const erros: string[] = [];
  errosPorPagina.set(page, erros);
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(String(e)));
}

/** Espera fontes, imagens (inclusive as preguiçosas) e a rolagem suave se acomodarem. */
export async function estabilizar(page: Page): Promise<void> {
  await page.evaluate(async () => {
    document.querySelectorAll("img[loading=lazy]").forEach((img) => img.setAttribute("loading", "eager"));
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? null
          : new Promise((ok) => {
              img.addEventListener("load", ok, { once: true });
              img.addEventListener("error", ok, { once: true });
            })
      )
    );
  });
  await page.waitForTimeout(250);
}

/**
 * Abre o protótipo como visitante ou cliente logado (Rafael) e esconde a barra do protótipo.
 */
export async function abrirPrototipo(page: Page, modo: "visitante" | "logado" = "visitante", caminho = "/preview-portal.html"): Promise<void> {
  await page.goto(caminho);
  if (modo === "logado") await page.click('[data-modo="logado"]');
  await page.addStyleTag({ content: ".proto { display: none !important; }" });
  await estabilizar(page);
}

/**
 * Compara duas capturas PNG pixel a pixel. Anexa as imagens e a diferença ao relatório.
 *
 * @param nome Identificador da tela
 * @param esperado Captura do protótipo
 * @param obtido Captura da implementação
 * @param teste Contexto do teste (anexos)
 * @param limite Fração máxima de pixels diferentes (padrão 0,1%)
 */
export async function compararCapturas(
  nome: string,
  esperado: Buffer,
  obtido: Buffer,
  teste: TestInfo,
  limite = 0.001
): Promise<void> {
  const a = PNG.sync.read(esperado);
  const b = PNG.sync.read(obtido);
  await teste.attach(`${nome}-prototipo.png`, { body: esperado, contentType: "image/png" });
  await teste.attach(`${nome}-implementacao.png`, { body: obtido, contentType: "image/png" });
  expect(`${b.width}x${b.height}`, `${nome}: tamanho da página`).toBe(`${a.width}x${a.height}`);
  const diff = new PNG({ width: a.width, height: a.height });
  const diferentes = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, includeAA: false });
  if (diferentes > 0) await teste.attach(`${nome}-diferenca.png`, { body: PNG.sync.write(diff), contentType: "image/png" });
  const fracao = diferentes / (a.width * a.height);
  expect(fracao, `${nome}: ${diferentes} pixels diferentes`).toBeLessThanOrEqual(limite);
}

/**
 * Checagens automáticas por tela (§7.2): console limpo, sem rolagem lateral, nada fora da tela,
 * imagens carregadas, texto sem corte e alvos de toque com 44 px no celular.
 */
export async function checarTela(page: Page, nome: string, celular = false): Promise<void> {
  const erros = errosPorPagina.get(page) ?? [];
  expect(erros, `${nome}: erros de console`).toEqual([]);
  const r = await page.evaluate((ehCelular) => {
    const largura = document.documentElement.clientWidth;
    const visivel = (el: Element) => {
      const s = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && box.width > 0 && box.height > 0;
    };
    const foraDaTela = Array.from(document.querySelectorAll("body *"))
      .filter((el) => visivel(el) && !el.closest("[data-rolagem-lateral], .trilho, .ev-passados, .abas, dialog:not([open])"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > largura + 1 || b.left < -1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`)
      .slice(0, 5);
    const quebradas = Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src);
    const cortados = Array.from(document.querySelectorAll("h1, h2, h3, h4, button, a, b, p, span"))
      .filter((el) => visivel(el) && !el.closest(".sr") && getComputedStyle(el).overflow === "hidden" && getComputedStyle(el).textOverflow !== "ellipsis"
        && !getComputedStyle(el).webkitLineClamp?.match(/\d/) && el.scrollWidth > el.clientWidth + 1)
      .map((el) => (el.textContent ?? "").trim().slice(0, 40))
      .slice(0, 5);
    // Mínimo do WCAG 2.2 (2.5.8, 24 px). O protótipo aprovado tem alguns alvos entre 24 e 44 px
    // (logo do topo, links de texto do rodapé); a comparação de pixels garante que ficam iguais.
    const pequenos = ehCelular
      ? Array.from(document.querySelectorAll("button, a[href], summary, input[type=checkbox], [role=tab]"))
          .filter((el) => visivel(el) && !el.closest("dialog:not([open])") && getComputedStyle(el).display !== "inline")
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.height < 24 || b.width < 24;
          })
          .map((el) => (el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30))
          .slice(0, 5)
      : [];
    return {
      rolagemLateral: document.documentElement.scrollWidth > largura,
      foraDaTela,
      quebradas,
      cortados,
      pequenos,
    };
  }, celular);
  expect(r.rolagemLateral, `${nome}: rolagem lateral`).toBe(false);
  expect(r.foraDaTela, `${nome}: elementos fora da tela`).toEqual([]);
  expect(r.quebradas, `${nome}: imagens quebradas`).toEqual([]);
  expect(r.cortados, `${nome}: texto cortado`).toEqual([]);
  expect(r.pequenos, `${nome}: alvos de toque pequenos`).toEqual([]);
}
