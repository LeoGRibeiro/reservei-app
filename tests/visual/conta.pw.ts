/**
 * @file conta.pw.ts
 * @description Comparação visual da área do atleta com o protótipo ("Cliente logado" = Rafael), em
 * computador, tablet e celular: página logada, menu do perfil, Minha conta (3 abas), diálogos simples
 * (cancelar, procurar jogadores, excluir conta) e o diálogo de conta (entrar, criar, código).
 *
 * Na implementação, o Rafael entra de verdade: código no WhatsApp pelo provedor de demonstração.
 */

import { expect, test, type Page } from "@playwright/test";
import { TELAS, abrirPrototipo, compararCapturas, estabilizar, instrumentar, ocultar, type NomeTela } from "./comparar";

const WHATS_RAFAEL = "91998765432";
const CODIGO_DEMO = "123456";

async function abrirImplementacao(page: Page, caminho = "/"): Promise<void> {
  await page.goto(caminho);
  await page.waitForFunction(() => document.documentElement.classList.contains("lenis"));
  await estabilizar(page);
}

/** Entra como Rafael pelo diálogo de conta (código de demonstração). */
async function entrarComoRafael(page: Page): Promise<void> {
  await abrirImplementacao(page);
  await page.click(".conta .entrar");
  await page.fill("#au-whats", WHATS_RAFAEL);
  await page.click("#au-form [type=submit]");
  await page.fill("#au-codigo", CODIGO_DEMO);
  await page.click("#au-form [type=submit]");
  await page.waitForSelector(".perfil");
  await page.waitForSelector("#auth:not([open])", { state: "attached" });
  await ocultar(page, ["#toast"]);
  await estabilizar(page);
}

/** Captura sem o aviso (toast) e sem o cursor de texto. */
async function captura(page: Page, inteira = false): Promise<Buffer> {
  await ocultar(page, ["#toast"]);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  return page.screenshot({ fullPage: inteira });
}

for (const tela of Object.keys(TELAS) as NomeTela[]) {
  test.describe(`conta · ${tela}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(TELAS[tela]);
      await instrumentar(page);
    });

    test("página logada, menu do perfil, Minha conta e diálogos", async ({ page }, info) => {
      const passos: [string, (prototipo: boolean) => Promise<void>, boolean][] = [
        ["pagina-logado", async () => undefined, true],
        ["menu-perfil", async () => page.click(".perfil"), false],
        ["conta-reservas", async () => page.click(tela === "celular" ? ".minhas" : ".minhas"), true],
        ["dlg-cancelar", async () => page.locator("#rsv-K7P2 .link-perigo").click(), false],
        ["dlg-vagas", async () => {
          await page.keyboard.press("Escape");
          await page.locator("#rsv-K7P2 .rsv-vagas .btn-borda").click();
        }, false],
        ["dlg-publicar", async () => {
          await page.keyboard.press("Escape");
          await page.locator("#rsv-M3XQ .rsv-vagas .btn-borda").click();
        }, false],
        ["conta-clube", async (prototipo) => {
          await page.keyboard.press("Escape");
          await page.click(prototipo ? '[data-aba="clube"]' : "#aba-clube");
        }, true],
        ["conta-dados", async (prototipo) => page.click(prototipo ? '[data-aba="dados"]' : "#aba-dados"), true],
        ["dlg-excluir", async () => page.locator(".link-perigo", { hasText: "Excluir minha conta" }).click(), false],
      ];
      const esperados: Buffer[] = [];
      await abrirPrototipo(page, "logado");
      for (const [, acao, inteira] of passos) {
        await acao(true);
        await page.waitForTimeout(350);
        esperados.push(await captura(page, inteira));
      }
      await entrarComoRafael(page);
      for (const [i, [nome, acao, inteira]] of passos.entries()) {
        await acao(false);
        await page.waitForTimeout(350);
        await compararCapturas(`${nome}-${tela}`, esperados[i], await captura(page, inteira), info);
      }
    });

    test("diálogo de conta: entrar, criar e código", async ({ page }, info) => {
      // Número próprio por tela: o limite de envio de código é real (1 a cada 30 s por número)
      const whatsDoTeste = { computador: "91990000001", tablet: "91990000002", celular: "91990000003" }[tela];
      const esperados: Buffer[] = [];
      const fazer = async (prototipo: boolean, guardar: (b: Buffer) => Promise<void>) => {
        await page.click(".conta .entrar");
        await page.waitForTimeout(300);
        await guardar(await captura(page));
        await page.click('#au-abas [role="tab"]:nth-child(2)');
        await page.waitForTimeout(200);
        await guardar(await captura(page));
        await page.click('#au-abas [role="tab"]:nth-child(1)');
        await page.fill("#au-whats", whatsDoTeste);
        await page.click("#au-form [type=submit]");
        await page.waitForSelector("#au-codigo");
        await page.waitForTimeout(prototipo ? 300 : 300);
        await guardar(await captura(page));
      };
      await abrirPrototipo(page);
      await fazer(true, async (b) => void esperados.push(b));
      await abrirImplementacao(page);
      let i = 0;
      const nomes = ["auth-entrar", "auth-criar", "auth-codigo"];
      await fazer(false, async (b) => {
        // "Criar conta": só antisserrilhado do texto do lado azul (posições medidas iguais), até 0,5%
        await compararCapturas(`${nomes[i]}-${tela}`, esperados[i], b, info, nomes[i] === "auth-criar" ? 0.005 : 0.001);
        i++;
      });
      expect(i).toBe(3);
    });
  });
}
