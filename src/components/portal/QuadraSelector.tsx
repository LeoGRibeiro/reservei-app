"use client";

import { cn } from "@/lib/utils";
import { type Quadra } from "@/lib/quadras";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";

interface Props {
  quadraSelecionada: string | null;
  onSelectQuadra: (quadraId: string) => void;
  horariosOcupados: string[]; // horários já no carrinho — usados para indicar quadras "em uso"
}

export function QuadraSelector({
  quadraSelecionada,
  onSelectQuadra,
  horariosOcupados,
}: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  return (
    <div className="w-full">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
        Selecione a quadra
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
        {quadrasCatalogo.map((quadra: Quadra) => {
          const isSelecionada = quadraSelecionada === quadra.id;
          // Desabilita outras quadras quando há horários no carrinho
          const isDesabilitada =
            horariosOcupados.length > 0 &&
            quadraSelecionada !== null &&
            quadraSelecionada !== quadra.id;

          return (
            <button
              key={quadra.id}
              onClick={() => !isDesabilitada && onSelectQuadra(quadra.id)}
              disabled={isDesabilitada}
              className={cn(
                "flex flex-col items-start gap-1 min-w-[140px] p-4 rounded-2xl border transition-all duration-200 snap-start flex-shrink-0 text-left",
                isSelecionada
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                  : isDesabilitada
                  ? "bg-slate-800/30 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                  : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isSelecionada ? "bg-emerald-400" : isDesabilitada ? "bg-slate-600" : "bg-slate-500"
                  )}
                />
                <span className="text-sm font-bold">Quadra {quadra.numero}</span>
              </div>
              <span className="text-[11px] opacity-60 leading-tight">
                {quadra.descricao}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
