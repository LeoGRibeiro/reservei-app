/**
 * @file Campo.tsx
 * @description Campos de formulário do painel: rótulo, ajuda e erro sempre no mesmo lugar.
 *
 * @example
 * ```tsx
 * <Campo rotulo="Nome da arena" erro={erros.nome}>
 *   {(id) => <Entrada id={id} value={nome} onChange={(e) => setNome(e.target.value)} />}
 * </Campo>
 * ```
 */

"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";

const BASE =
  "w-full rounded-md border border-painel-linha-forte bg-painel-superficie px-3 text-sm text-painel-tinta placeholder:text-painel-apagada " +
  "focus:border-painel-foco focus:outline-none focus:ring-2 focus:ring-painel-foco/20 disabled:bg-painel-elevada disabled:text-painel-apagada " +
  "aria-[invalid=true]:border-red-400";

export interface CampoProps {
  rotulo: string;
  /** Texto curto de ajuda abaixo do campo */
  ajuda?: ReactNode;
  /** Mensagem de erro (substitui a ajuda) */
  erro?: string | null;
  /** Marca o rótulo com "opcional" */
  opcional?: boolean;
  className?: string;
  /** Recebe o id gerado para ligar o rótulo ao campo */
  children: (id: string, invalido: boolean) => ReactNode;
}

export function Campo({ rotulo, ajuda, erro, opcional, className, children }: CampoProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[15px] font-medium text-painel-tinta">
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-painel-apagada">(opcional)</span>}
      </label>
      {children(id, !!erro)}
      {erro ? (
        <p className="text-xs text-red-700">{erro}</p>
      ) : (
        ajuda && <p className="text-xs text-painel-suave">{ajuda}</p>
      )}
    </div>
  );
}

export function Entrada({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(BASE, "h-10", className)} {...props} />;
}

export function Selecao({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(BASE, "h-10 pr-8", className)} {...props} />;
}

export function AreaTexto({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(BASE, "py-2 min-h-24", className)} {...props} />;
}

/** Caixa de seleção com rótulo ao lado (e descrição opcional). */
export function Caixa({
  rotulo,
  descricao,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { rotulo: ReactNode; descricao?: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-2.5 text-sm text-painel-tinta cursor-pointer", className)}>
      <input type="checkbox" className="mt-1 size-4 rounded border-painel-linha-forte accent-[var(--painel-destaque)]" {...props} />
      <span>
        {rotulo}
        {descricao && <span className="block text-xs text-painel-suave">{descricao}</span>}
      </span>
    </label>
  );
}

/** Opção de escolha única em cartão (ex.: tipo de botão, perfil de acesso). */
export function OpcaoCartao({
  rotulo,
  descricao,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { rotulo: ReactNode; descricao?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-painel-linha p-3 text-sm cursor-pointer",
        "has-[:checked]:border-painel-destaque has-[:checked]:bg-painel-destaque-suave",
        className
      )}
    >
      <input type="radio" className="mt-1 size-4 accent-[var(--painel-destaque)]" {...props} />
      <span>
        <span className="font-medium text-painel-tinta">{rotulo}</span>
        {descricao && <span className="block text-xs text-painel-suave mt-0.5">{descricao}</span>}
      </span>
    </label>
  );
}
