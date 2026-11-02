/**
 * @file Estrutura.tsx
 * @description Blocos de estrutura do painel: topo de página, cartão, abas, avisos e estados vazios.
 * Toda tela começa com {@link CabecalhoPagina}; o resto se organiza em {@link Cartao}.
 */

"use client";

import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { cn } from "cn";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/**
 * Topo de toda página do painel: título, frase curta e ações (no máximo uma primária).
 *
 * @example
 * ```tsx
 * <CabecalhoPagina titulo="Agenda" descricao="Reservas, aulas e bloqueios" acoes={<Botao>Nova reserva</Botao>} />
 * ```
 */
export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-painel-tinta">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-painel-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

/** Superfície branca com borda fina. */
export function Cartao({
  titulo,
  descricao,
  acoes,
  children,
  className,
  semPadding = false,
}: {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sem espaçamento interno (para tabelas e listas que vão até a borda) */
  semPadding?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border border-painel-linha bg-painel-superficie", className)}>
      {(titulo || acoes) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-painel-linha px-4 py-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-semibold text-painel-tinta">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-xs text-painel-suave">{descricao}</p>}
          </div>
          {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
        </div>
      )}
      <div className={semPadding ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** Número de resumo (no máximo 3 ou 4 por tela). */
export function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="rounded-lg border border-painel-linha bg-painel-superficie px-4 py-3">
      <p className="text-xs font-medium text-painel-suave">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-painel-tinta">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-painel-suave">{detalhe}</p>}
    </div>
  );
}

export interface ItemAba {
  id: string;
  rotulo: ReactNode;
  /** Quando informado, a aba é um link (endereço próprio) */
  href?: string;
}

/**
 * Abas sublinhadas. Com `href`, cada aba é um link; sem, chama `aoTrocar`.
 *
 * O sublinhado é uma sombra interna (não ocupa altura nem estoura a borda), então a barra nunca ganha
 * rolagem vertical. No celular as abas que não cabem rolam na horizontal, sem barra visível.
 */
export function Abas({
  itens,
  ativa,
  aoTrocar,
  rotulo,
  className,
}: {
  itens: ItemAba[];
  ativa: string;
  aoTrocar?: (id: string) => void;
  rotulo: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={rotulo}
      className={cn("mb-4 flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-painel-linha md:overflow-hidden", className)}
    >
      {itens.map((item) => {
        const atual = item.id === ativa;
        const classe = cn(
          "shrink-0 whitespace-nowrap px-3 pb-2.5 pt-2 text-sm transition-colors",
          atual
            ? "font-semibold text-painel-tinta shadow-[inset_0_-3px_0_var(--painel-destaque)]"
            : "text-painel-suave hover:text-painel-tinta hover:shadow-[inset_0_-3px_0_var(--painel-linha-forte)]"
        );
        return item.href ? (
          <Link key={item.id} href={item.href} className={classe} aria-current={atual ? "page" : undefined}>
            {item.rotulo}
          </Link>
        ) : (
          <button key={item.id} type="button" onClick={() => aoTrocar?.(item.id)} className={classe} aria-pressed={atual}>
            {item.rotulo}
          </button>
        );
      })}
    </nav>
  );
}

const TONS_AVISO = {
  info: { classe: "border-sky-200 bg-sky-50 text-sky-900", icone: Info },
  sucesso: { classe: "border-emerald-200 bg-emerald-50 text-emerald-900", icone: CheckCircle2 },
  atencao: { classe: "border-amber-200 bg-amber-50 text-amber-900", icone: AlertTriangle },
  erro: { classe: "border-red-200 bg-red-50 text-red-900", icone: XCircle },
};

/** Aviso em faixa (informação, sucesso, atenção ou erro). */
export function Aviso({ tom = "info", titulo, children, acoes }: { tom?: keyof typeof TONS_AVISO; titulo?: ReactNode; children?: ReactNode; acoes?: ReactNode }) {
  const { classe, icone: Icone } = TONS_AVISO[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", classe)}>
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-medium">{titulo}</p>}
        {children && <div className={titulo ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {acoes && <div className="flex shrink-0 items-start gap-2">{acoes}</div>}
    </div>
  );
}

/** Estado vazio: ícone discreto, frase e ação opcional. */
export function EstadoVazio({ icone: Icone, titulo, descricao, acao }: { icone?: ElementType; titulo: string; descricao?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {Icone && <Icone aria-hidden className="mb-3 size-6 text-painel-apagada" />}
      <p className="text-sm font-medium text-painel-tinta">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-painel-suave">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

/** Indicador de carregamento discreto. */
export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-painel-suave">
      <span aria-hidden className="size-4 rounded-full border-2 border-painel-linha-forte border-t-painel-destaque animate-spin" />
      {texto}
    </div>
  );
}

/** Linha "rótulo: valor" para fichas de detalhe. */
export function LinhaDetalhe({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-painel-suave">{rotulo}</dt>
      <dd className="min-w-0 text-sm text-painel-tinta">{children}</dd>
    </div>
  );
}
