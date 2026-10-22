"use client";

import { cn } from "@/lib/utils";
import { useConfiguracaoSiteArena } from "@/hooks/useConfiguracaoSiteArena";

/** Props do {@link LogoReservei}. */
export interface LogoReserveiProps {
  /** Exibe a descrição do estabelecimento ao lado da marca (oculta em telas pequenas). */
  exibirDescricao?: boolean;
  /** Classes extras do contêiner. */
  className?: string;
}

/**
 * Marca da plataforma (emoji + nome) usada no cabeçalho e no rodapé.
 *
 * @example
 * <LogoReservei exibirDescricao />
 */
export function LogoReservei({ exibirDescricao = true, className }: LogoReserveiProps) {
  const config = useConfiguracaoSiteArena();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-2xl" aria-hidden="true">
        🏟️
      </span>
      <div>
        <span className="font-black text-white text-lg tracking-tight">
          {config.nomePlataforma}
        </span>
        {exibirDescricao && (
          <span className="hidden sm:inline text-slate-500 text-sm ml-2">
            · {config.descricaoEstabelecimento}
          </span>
        )}
      </div>
    </div>
  );
}
