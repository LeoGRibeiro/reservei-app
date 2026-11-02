/**
 * @file Tabela.tsx
 * @description Tabela densa do painel (cabeçalho discreto, linhas com hover, rolagem horizontal no
 * celular) e paginação.
 *
 * @example
 * ```tsx
 * <Tabela cabecalho={["Cliente", "Horário", { rotulo: "Valor", alinhar: "direita" }]}>
 *   {linhas.map((l) => (
 *     <tr key={l.id}><Td>{l.nome}</Td><Td>{l.hora}</Td><Td alinhar="direita">{moeda(l.valor)}</Td></tr>
 *   ))}
 * </Tabela>
 * ```
 */

"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";
import { Botao } from "./Botao";

type Alinhamento = "esquerda" | "direita" | "centro";
const ALINHAR: Record<Alinhamento, string> = { esquerda: "text-left", direita: "text-right", centro: "text-center" };

export type Coluna = string | { rotulo: ReactNode; alinhar?: Alinhamento; classe?: string };

export function Tabela({ cabecalho, children, rotulo }: { cabecalho: Coluna[]; children: ReactNode; rotulo?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={rotulo}>
        <thead>
          <tr className="border-b border-painel-linha">
            {cabecalho.map((c, i) => {
              const col = typeof c === "string" ? { rotulo: c } : c;
              return (
                <th
                  key={i}
                  scope="col"
                  className={cn("whitespace-nowrap px-4 py-2.5 text-xs font-medium text-painel-suave", ALINHAR[col.alinhar ?? "esquerda"], col.classe)}
                >
                  {col.rotulo}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-painel-linha">{children}</tbody>
      </table>
    </div>
  );
}

/** Linha clicável ou não. */
export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-painel-elevada", props.onClick && "cursor-pointer", className)} {...props} />;
}

export function Td({ alinhar = "esquerda", className, ...props }: ComponentProps<"td"> & { alinhar?: Alinhamento }) {
  return <td className={cn("px-4 py-2.5 align-middle text-painel-tinta", ALINHAR[alinhar], className)} {...props} />;
}

/**
 * Paginação simples ("1–50 de 776", anterior / próxima).
 *
 * @param props.pagina Página atual (começa em 1)
 * @param props.porPagina Itens por página
 * @param props.total Total de itens
 */
export function Paginacao({ pagina, porPagina, total, aoMudar }: { pagina: number; porPagina: number; total: number; aoMudar: (pagina: number) => void }) {
  if (total <= porPagina) return null;
  const ultima = Math.ceil(total / porPagina);
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-painel-linha px-4 py-3 text-sm text-painel-suave">
      <span className="tabular-nums">
        {inicio}–{fim} de {total}
      </span>
      <div className="flex gap-2">
        <Botao variante="secundario" tamanho="sm" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
          Anterior
        </Botao>
        <Botao variante="secundario" tamanho="sm" disabled={pagina >= ultima} onClick={() => aoMudar(pagina + 1)}>
          Próxima
        </Botao>
      </div>
    </div>
  );
}
