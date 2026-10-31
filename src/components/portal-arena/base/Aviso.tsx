/**
 * @file Aviso.tsx
 * @description Aviso curto do portal (toast escuro, centralizado embaixo, some em 2,8 s).
 * O painel continua com o `sonner`; o portal usa este, igual ao protótipo.
 */

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** Tempo que o aviso fica na tela. */
export const DURACAO_AVISO_MS = 2800;

const ContextoAviso = createContext<(texto: string) => void>(() => undefined);

/**
 * Provê `useAviso()` e desenha o aviso.
 *
 * @example
 * ```tsx
 * <ProvedorAviso><Portal /></ProvedorAviso>
 * ```
 */
export function ProvedorAviso({ children }: { children: ReactNode }) {
  const [texto, setTexto] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((novo: string) => {
    setTexto(novo);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setTexto(null), DURACAO_AVISO_MS);
  }, []);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  return (
    <ContextoAviso.Provider value={avisar}>
      {children}
      <div className="toast" id="toast" role="status" aria-live="polite" hidden={!texto}>
        {texto}
      </div>
    </ContextoAviso.Provider>
  );
}

/**
 * Mostra um aviso.
 *
 * @example
 * ```ts
 * const aviso = useAviso();
 * aviso("Sua partida está no mural.");
 * ```
 */
export function useAviso(): (texto: string) => void {
  return useContext(ContextoAviso);
}
