"use client";

import { cn } from "@/lib/utils";
import type { Quadra as QuadraLegada } from "@/lib/quadras";
import type { Quadra as ArenaQuadra } from "@/lib/arena/types";
import { HorarioGrid } from "./HorarioGrid";
import { type AvisoEscolinha } from "@/lib/recorrencia/agenda";

interface Props {
  quadra: QuadraLegada | ArenaQuadra;
  dataSelecionada: string;
  horariosSelecionados: string[];
  horariosOcupados: string[];
  /** Blocos de escolinha nesta quadra/data (exibe banner promocional) */
  avisosEscolinha?: AvisoEscolinha[];
  isAtiva: boolean; // esta quadra está com seleção ativa?
  onToggleHorario: (horario: string, quadraId: string) => void;
}

export function QuadraHorarioItem({
  quadra,
  dataSelecionada,
  horariosSelecionados,
  horariosOcupados,
  avisosEscolinha = [],
  isAtiva,
  onToggleHorario,
}: Props) {
  const nomeExibicao = "nome" in quadra && quadra.nome ? quadra.nome : `Quadra ${quadra.numero}`;
  const tipoPiso = "tipoPiso" in quadra ? quadra.tipoPiso : undefined;
  const isCoberta = "coberta" in quadra ? quadra.coberta : undefined;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all duration-200",
        isAtiva
          ? "bg-slate-800/80 border-emerald-500/40 shadow-lg shadow-emerald-500/5"
          : "bg-slate-900/60 border-slate-800"
      )}
    >
      {/* ── Header da Quadra ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isAtiva && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          )}
          <h3 className="font-bold text-white text-base">
            {nomeExibicao}
          </h3>
          {tipoPiso && (
            <span className="text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700/80 px-2 py-0.5 rounded font-medium uppercase tracking-wider">
              {tipoPiso === "pu_cimentado" ? "Piso PU" : tipoPiso}
            </span>
          )}
          {isCoberta && (
            <span className="text-[10px] bg-sky-950/40 text-sky-300 border border-sky-800/50 px-2 py-0.5 rounded font-medium">
              Coberta
            </span>
          )}
        </div>

        {isAtiva && horariosSelecionados.length > 0 && (
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full font-semibold flex-shrink-0">
            {horariosSelecionados.length}h selecionada{horariosSelecionados.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <HorarioGrid
        quadraId={quadra.id}
        dataSelecionada={dataSelecionada}
        horariosSelecionados={horariosSelecionados}
        horariosOcupados={horariosOcupados}
        avisosEscolinha={avisosEscolinha}
        onToggleHorario={(horario) => onToggleHorario(horario, quadra.id)}
      />
    </div>
  );
}
