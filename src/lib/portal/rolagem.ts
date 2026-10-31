/**
 * @file rolagem.ts
 * @description Rolagem suave do portal sobre o Lenis do `SmoothScrollProvider` (mesma configuração
 * do protótipo e do site atual). Sem Lenis (testes, redução de movimento), cai na rolagem nativa.
 */

/** Seletor do topo fixo, cuja altura entra no deslocamento das âncoras. */
const SELETOR_TOPO = "#topo";

/**
 * Rola até um elemento, descontando a altura do topo fixo.
 * O Lenis remede a página com atraso; `resize()` antes de rolar evita parar no limite antigo.
 *
 * @param alvo Id do elemento ou o próprio elemento
 * @param folga Espaço extra acima do elemento, em px
 *
 * @example
 * ```ts
 * rolarAte("reservar");
 * rolarAte("partidas", 20);
 * ```
 */
export function rolarAte(alvo: string | HTMLElement, folga = 0): void {
  const el = typeof alvo === "string" ? document.getElementById(alvo) : alvo;
  if (!el) return;
  const topo = document.querySelector<HTMLElement>(SELETOR_TOPO);
  const offset = -((topo?.offsetHeight ?? 0) + folga);
  const lenis = window.__lenis;
  lenis?.resize();
  if (lenis) lenis.scrollTo(el, { offset, duration: 0.85, force: true });
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: "smooth" });
}

/**
 * Volta ao topo da página.
 *
 * @param imediato Sem animação (troca de página da conta, saída da conta)
 */
export function rolarParaTopo(imediato = false): void {
  const lenis = window.__lenis;
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(0, imediato ? { immediate: true, force: true } : { duration: 0.85, force: true });
  } else {
    window.scrollTo({ top: 0, behavior: imediato ? "auto" : "smooth" });
  }
}

/** Recalcula a altura da página no Lenis (depois de trocar o conteúdo). */
export function remedirRolagem(): void {
  window.__lenis?.resize();
}

/** Quantos diálogos modais estão abertos (a rolagem da página fica parada enquanto houver algum). */
let dialogosAbertos = 0;

/** Para a rolagem da página ao abrir um diálogo. */
export function travarRolagem(): void {
  dialogosAbertos += 1;
  window.__lenis?.stop();
}

/** Libera a rolagem quando o último diálogo fecha. */
export function liberarRolagem(): void {
  dialogosAbertos = Math.max(0, dialogosAbertos - 1);
  if (dialogosAbertos === 0) window.__lenis?.start();
}

/** Tempo do contorno amarelo de destaque. */
export const DURACAO_DESTAQUE_MS = 2600;

/**
 * Rola até um elemento e o destaca por 2,6 s (horário de aula → turma, "Ver no mural", reserva na conta).
 *
 * @param id Id do elemento
 */
export function destacar(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  rolarAte(el, 28);
  el.classList.add("destaque");
  setTimeout(() => el.classList.remove("destaque"), DURACAO_DESTAQUE_MS);
}
