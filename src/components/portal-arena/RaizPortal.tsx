/**
 * @file RaizPortal.tsx
 * @description Raiz de toda página do portal da arena: `<div class="pa">` com a fonte Archivo, as
 * cores da arena (`arenas.tema`), a rolagem suave (Lenis) e os avisos. Carrega o CSS do portal.
 */

import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./portal-arena.css";
import { SmoothScrollProvider } from "@/components/landing/SmoothScrollProvider";
import { variaveisDoTema, type TemaArena } from "@/lib/portal/tema";
import { ProvedorAviso } from "./base/Aviso";
import { archivo } from "./fonte";

export interface RaizPortalProps {
  /** Cores da arena */
  tema: TemaArena;
  /** Conteúdo da página */
  children: ReactNode;
  /** Classes extras da raiz (ex.: `tem-barra`, `em-conta`) */
  className?: string;
}

/**
 * @example
 * ```tsx
 * <RaizPortal tema={dados.tema}><TopoArena ... /></RaizPortal>
 * ```
 */
export function RaizPortal({ tema, children, className }: RaizPortalProps) {
  return (
    <div className={`pa ${archivo.variable}${className ? ` ${className}` : ""}`} style={variaveisDoTema(tema)}>
      <SmoothScrollProvider>
        <ProvedorAviso>{children}</ProvedorAviso>
      </SmoothScrollProvider>
    </div>
  );
}
