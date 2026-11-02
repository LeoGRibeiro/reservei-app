/**
 * @file Botao.tsx
 * @description Botão único do painel. Uma ação primária por área; o resto é secundário ou fantasma.
 *
 * @example
 * ```tsx
 * <Botao onClick={salvar} carregando={salvando}>Salvar</Botao>
 * <Botao variante="secundario" icone={Plus}>Nova reserva</Botao>
 * <Botao variante="perigo" onClick={cancelar}>Cancelar reserva</Botao>
 * ```
 */

"use client";

import type { ComponentProps, ElementType } from "react";
import { cn } from "cn";

export type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-painel-destaque text-white hover:bg-painel-destaque-forte border-transparent",
  secundario: "bg-painel-superficie text-painel-tinta border-painel-linha-forte hover:bg-painel-elevada",
  perigo: "bg-painel-superficie text-red-700 border-red-200 hover:bg-red-50",
  fantasma: "bg-transparent text-painel-suave border-transparent hover:bg-painel-elevada hover:text-painel-tinta",
};

const TAMANHOS = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

/** Classes do botão, para links (`<a>`) com aparência de botão. */
export function classeBotao(variante: VarianteBotao = "primario", tamanho: keyof typeof TAMANHOS = "md", extra?: string): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-painel-foco",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTES[variante],
    TAMANHOS[tamanho],
    extra
  );
}

export interface BotaoProps extends ComponentProps<"button"> {
  variante?: VarianteBotao;
  tamanho?: keyof typeof TAMANHOS;
  /** Ícone (lucide) à esquerda do texto */
  icone?: ElementType;
  /** Mostra "aguarde" e desabilita o botão */
  carregando?: boolean;
}

export function Botao({
  variante = "primario",
  tamanho = "md",
  icone: Icone,
  carregando = false,
  className,
  children,
  disabled,
  type = "button",
  ...resto
}: BotaoProps) {
  return (
    <button type={type} disabled={disabled || carregando} className={classeBotao(variante, tamanho, className)} {...resto}>
      {carregando ? (
        <span aria-hidden className="size-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
      ) : (
        Icone && <Icone aria-hidden className={tamanho === "sm" ? "size-3.5" : "size-4"} />
      )}
      {children}
    </button>
  );
}
