/**
 * @file Janela.tsx
 * @description Janela (modal) do painel, renderizada em portal no `<body>` para nunca ser cortada por
 * um ancestral com `transform`. Fecha com Esc e no fundo; trava a rolagem da página enquanto aberta.
 *
 * @example
 * ```tsx
 * <Janela aberta={aberta} titulo="Nova reserva" aoFechar={() => setAberta(false)} rodape={<Botao>Salvar</Botao>}>
 *   ...campos
 * </Janela>
 * ```
 */

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { X } from "lucide-react";
import { Botao, type VarianteBotao } from "./Botao";

export interface JanelaProps {
  aberta: boolean;
  titulo: string;
  descricao?: ReactNode;
  aoFechar: () => void;
  children: ReactNode;
  /** Botões do rodapé (alinhados à direita) */
  rodape?: ReactNode;
  largura?: "sm" | "md" | "lg";
}

const LARGURAS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

export function Janela({ aberta, titulo, descricao, aoFechar, children, rodape, largura = "md" }: JanelaProps) {
  const idTitulo = useId();

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", tecla);
    };
  }, [aberta, aoFechar]);

  if (!aberta || typeof document === "undefined") return null;

  return createPortal(
    <div className="painel fixed inset-0 z-50 overflow-y-auto !bg-stone-900/40" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          className={cn("w-full rounded-lg border border-painel-linha bg-painel-superficie shadow-xl", LARGURAS[largura])}
        >
          <div className="flex items-start justify-between gap-4 border-b border-painel-linha px-5 py-4">
            <div className="min-w-0">
              <h2 id={idTitulo} className="text-base font-semibold text-painel-tinta">
                {titulo}
              </h2>
              {descricao && <p className="mt-0.5 text-sm text-painel-suave">{descricao}</p>}
            </div>
            <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-md p-1 text-painel-suave hover:bg-painel-elevada hover:text-painel-tinta">
              <X className="size-4" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-painel-linha px-5 py-3">{rodape}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmacaoProps {
  aberta: boolean;
  titulo: string;
  children?: ReactNode;
  rotuloConfirmar: string;
  variante?: VarianteBotao;
  aoConfirmar: () => void | Promise<void>;
  aoFechar: () => void;
}

/**
 * Pergunta de confirmação para ações que não têm volta (cancelar, excluir, desativar).
 */
export function Confirmacao({ aberta, titulo, children, rotuloConfirmar, variante = "perigo", aoConfirmar, aoFechar }: ConfirmacaoProps) {
  const [executando, setExecutando] = useState(false);
  return (
    <Janela
      aberta={aberta}
      titulo={titulo}
      aoFechar={aoFechar}
      largura="sm"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={executando}>
            Voltar
          </Botao>
          <Botao
            variante={variante}
            carregando={executando}
            onClick={async () => {
              setExecutando(true);
              try {
                await aoConfirmar();
              } finally {
                setExecutando(false);
              }
            }}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <div className="text-sm text-painel-suave">{children}</div>
    </Janela>
  );
}
