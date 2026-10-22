"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useHorariosCatalogo } from "@/store/useCatalogoArenaStore";
import { saoConsecutivos, isHorarioExpirado, formatarMoeda } from "@/lib/constants";
import { toast } from "sonner";
import { type AvisoEscolinha } from "@/lib/recorrencia/agenda";
import { ModalEscolinha } from "./ModalEscolinha";
import { GraduationCap, Users } from "lucide-react";
import { useVagasService } from "@/hooks/useVagasService";
import { ModalConfirmarInteresse } from "@/components/vagas/ModalConfirmarInteresse";
import type { VagaDisponivelItem } from "@/lib/vagas/types";

interface Props {
  quadraId?: string;
  dataSelecionada: string;
  horariosSelecionados: string[]; // slots selecionados NESTA quadra
  horariosOcupados: string[];     // slots já reservados (persistidos)
  avisosEscolinha?: AvisoEscolinha[]; // avisos de escolinha na data/quadra
  onToggleHorario: (horario: string) => void;
  /** Antecedência mínima (minutos) para reservar online; horários mais próximos ficam indisponíveis */
  antecedenciaMinutos?: number;
  /** Preço por hora de um horário na tabela da quadra (para os rótulos de cada faixa) */
  precoDoHorario?: (horario: string) => number;
}

// ─── Faixas de horário ────────────────────────────────────────────────────────

const FAIXA: Record<string, { label: string; faixaHora: string; cor: string }> = {
  MANHA: { label: "Manhã",  faixaHora: "08h – 12h", cor: "text-amber-400"  },
  TARDE: { label: "Tarde",  faixaHora: "12h – 18h", cor: "text-sky-400"    },
  NOITE: { label: "Noite",  faixaHora: "18h – 22h", cor: "text-violet-400" },
};

const PRECO_POR_FAIXA: Record<string, string> = {
  MANHA: "R$ 70 / hora",
  TARDE: "R$ 90 / hora",
  NOITE: "R$ 110 / hora",
};

function getFaixa(hora: number): "MANHA" | "TARDE" | "NOITE" {
  if (hora < 12) return "MANHA";
  if (hora < 18) return "TARDE";
  return "NOITE";
}

/** Intervalo exibido de uma faixa a partir dos seus horários (ex.: '08h – 12h'). */
function intervaloDaFaixa(horarios: string[]): string {
  const inicio = parseInt(horarios[0], 10);
  const fim = parseInt(horarios[horarios.length - 1], 10) + 1;
  return `${String(inicio).padStart(2, "0")}h – ${String(fim).padStart(2, "0")}h`;
}

/** Rótulo de preço de uma faixa (ex.: 'R$ 90 / hora' ou 'R$ 90 – R$ 120 / hora'). */
function precoDaFaixa(horarios: string[], precoDoHorario: (h: string) => number): string {
  const valores = horarios.map(precoDoHorario).filter((v) => v > 0);
  if (valores.length === 0) return "";
  const formatar = (v: number) => formatarMoeda(v).replace(",00", "");
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return min === max ? `${formatar(min)} / hora` : `${formatar(min)} – ${formatar(max)} / hora`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function HorarioGrid({
  quadraId,
  dataSelecionada,
  horariosSelecionados,
  horariosOcupados,
  avisosEscolinha = [],
  onToggleHorario,
  antecedenciaMinutos = 10,
  precoDoHorario,
}: Props) {
  const horariosCatalogo = useHorariosCatalogo();
  const [isMounted, setIsMounted] = useState(false);
  const [avisoSelecionado, setAvisoSelecionado] = useState<AvisoEscolinha | null>(null);
  const [vagaSelecionada, setVagaSelecionada] = useState<VagaDisponivelItem | null>(null);
  const { vagasDisponiveis } = useVagasService();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleClick = (
    horario: string,
    isEscolinha: boolean,
    aviso?: AvisoEscolinha,
    vaga?: VagaDisponivelItem
  ) => {
    if (isEscolinha && aviso) {
      setAvisoSelecionado(aviso);
      return;
    }

    if (vaga) {
      setVagaSelecionada(vaga);
      return;
    }

    if (horariosOcupados.includes(horario)) return;
    if (isHorarioExpirado(dataSelecionada, horario, antecedenciaMinutos)) return;

    const isSelecionado = horariosSelecionados.includes(horario);
    if (!isSelecionado) {
      const proximo = [...horariosSelecionados, horario];
      if (!saoConsecutivos(proximo)) {
        toast.error("Selecione horários consecutivos", {
          description: "Ex: 13h → 14h → 15h. Não é possível pular horários.",
        });
        return;
      }
    }
    onToggleHorario(horario);
  };

  // Agrupar slots por faixa
  const grupos: Array<{ faixa: string; horarios: string[] }> = [];
  let faixaAtual = "";
  for (const h of horariosCatalogo) {
    const f = getFaixa(parseInt(h.split(":")[0], 10));
    if (f !== faixaAtual) {
      faixaAtual = f;
      grupos.push({ faixa: f, horarios: [] });
    }
    grupos[grupos.length - 1].horarios.push(h);
  }

  // Deduplicar avisos pelo contratoId (ou nome + início) para exibição na legenda
  const avisosUnicos = avisosEscolinha.filter(
    (aviso, index, self) =>
      index ===
      self.findIndex((a) =>
        a.contratoId ? a.contratoId === aviso.contratoId : a.nome === aviso.nome && a.horaInicio === aviso.horaInicio
      )
  );

  return (
    <div className="space-y-3.5">
      {grupos.map(({ faixa, horarios }) => (
        <div key={faixa}>
          {/* ── Label da faixa ── */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
            <span className={cn("text-xs font-bold uppercase tracking-wider", FAIXA[faixa].cor)}>
              {FAIXA[faixa].label}
            </span>
            <span className="text-base sm:text-lg font-black text-white">
              {precoDoHorario ? precoDaFaixa(horarios, precoDoHorario) : PRECO_POR_FAIXA[faixa]}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({intervaloDaFaixa(horarios)})
            </span>
          </div>

          {/* ── Cards de horário com status superior (Disponível / Escolinha / Vagas Abertas) ── */}
          <div className="flex flex-wrap gap-2">
            {horarios.map((horario) => {
              const hora = parseInt(horario.split(":")[0], 10);
              const horaFim = String(hora + 1).padStart(2, "0") + ":00";
              const isSelecionado = horariosSelecionados.includes(horario);
              const isOcupado = horariosOcupados.includes(horario);
              const aviso = avisosEscolinha.find((a) => a.horarios.includes(horario));
              const isEscolinha = isOcupado && !!aviso;

              // Verifica se este horário ocupado possui vagas abertas pelo organizador
              const vagaAberta = isOcupado
                ? vagasDisponiveis.find(
                    (v) =>
                      v.data === dataSelecionada &&
                      (!quadraId || v.quadraId === quadraId) &&
                      horario >= v.horaInicio &&
                      horario < v.horaFim &&
                      v.vagasAbertas > 0
                  )
                : undefined;
              const isVagaAberta = isOcupado && !!vagaAberta;

              const expiradoParaSelecao = isMounted
                ? isHorarioExpirado(dataSelecionada, horario, antecedenciaMinutos)
                : false;
              const isDisabled = (isOcupado && !isEscolinha && !isVagaAberta) || expiradoParaSelecao;

              return (
                <button
                  key={horario}
                  onClick={() => handleClick(horario, isEscolinha, aviso, vagaAberta)}
                  disabled={isDisabled}
                  title={
                    isEscolinha
                      ? `${aviso?.nome ? `${aviso.nome} (${aviso.esporte || "Escolinha"})` : "Escolinha"} – Clique para ver detalhes`
                      : isVagaAberta
                      ? `Partida com ${vagaAberta.vagasAbertas} vaga(s) aberta(s) – Clique para solicitar participação`
                      : isOcupado
                      ? "Horário ocupado"
                      : expiradoParaSelecao
                      ? "Horário indisponível"
                      : `${horario} – ${horaFim}`
                  }
                  className={cn(
                    "flex flex-col items-start justify-center px-3.5 py-2 rounded-xl border text-left transition-all duration-150 select-none min-w-[115px]",
                    isSelecionado
                      ? "bg-emerald-500/25 border-emerald-500 text-emerald-300 shadow-sm"
                      : isEscolinha
                      ? "bg-violet-500/15 border-violet-500/40 text-violet-200 hover:bg-violet-500/25 cursor-pointer ring-1 ring-violet-500/20"
                      : isVagaAberta
                      ? "bg-slate-900 border-emerald-500/40 text-slate-200 hover:bg-slate-850 hover:border-emerald-400 cursor-pointer ring-1 ring-emerald-500/20"
                      : isDisabled
                      ? "bg-slate-900/40 border-slate-800 text-slate-700 cursor-not-allowed line-through"
                      : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 active:scale-95"
                  )}
                >
                  {/* Linha superior: Categoria / Status */}
                  <span
                    className={cn(
                      "text-xs font-semibold leading-tight flex items-center gap-1.5",
                      isSelecionado
                        ? "text-emerald-400"
                        : isEscolinha
                        ? "text-violet-300"
                        : isVagaAberta
                        ? "text-slate-400"
                        : isDisabled
                        ? "text-slate-600"
                        : "text-emerald-400/80"
                    )}
                  >
                    {isSelecionado ? (
                      "✓ Selecionado"
                    ) : isEscolinha ? (
                      <>
                        <span className="truncate max-w-[95px]">
                          {aviso?.esporte ? `Esc. ${aviso.esporte}` : "Escolinha"}
                        </span>
                        <GraduationCap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      </>
                    ) : isOcupado ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={isVagaAberta ? "text-slate-500 line-through" : ""}>
                          Ocupado
                        </span>
                        {isVagaAberta && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 tracking-tight not-line-through">
                            <Users className="w-2.5 h-2.5" />
                            vagas abertas
                          </span>
                        )}
                      </div>
                    ) : isDisabled ? (
                      "Indisponível"
                    ) : (
                      "Disponível"
                    )}
                  </span>

                  {/* Linha inferior: Intervalo de horário */}
                  <span
                    className={cn(
                      "text-sm font-bold leading-tight mt-0.5 whitespace-nowrap",
                      isSelecionado
                        ? "text-emerald-200"
                        : isEscolinha
                        ? "text-violet-100"
                        : isVagaAberta
                        ? "text-white"
                        : isDisabled
                        ? "text-slate-600"
                        : "text-white"
                    )}
                  >
                    {horario} – {horaFim}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Legenda compacta de Escolinhas presentes na quadra (embaixo, sem esticar) ── */}
      {avisosUnicos.length > 0 && (
        <div className="pt-2 flex flex-wrap gap-2">
          {avisosUnicos.map((aviso, idx) => (
            <button
              key={aviso.contratoId || idx}
              type="button"
              onClick={() => setAvisoSelecionado(aviso)}
              className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-violet-950/30 border border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-900/40 transition-all duration-150 group cursor-pointer text-left w-fit"
            >
              <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-3 h-3 text-violet-400" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-white text-xs">
                  {aviso.nome}
                </span>
                {aviso.esporte && (
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-300 border border-violet-500/30">
                    {aviso.esporte}
                  </span>
                )}
                <span className="text-[11px] text-violet-300/80 font-medium">
                  · {aviso.horaInicio} às {aviso.horaFim}
                </span>
              </div>

              <span className="text-[11px] font-medium text-violet-400 group-hover:text-violet-200 transition-colors whitespace-nowrap flex items-center gap-0.5 ml-1">
                Ver detalhes <span className="text-xs group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Modal de Detalhes da Escolinha */}
      <ModalEscolinha aviso={avisoSelecionado} onClose={() => setAvisoSelecionado(null)} />

      {/* Modal de Confirmação de Interesse em Vaga Aberta */}
      <ModalConfirmarInteresse
        open={Boolean(vagaSelecionada)}
        vaga={vagaSelecionada}
        onClose={() => setVagaSelecionada(null)}
      />
    </div>
  );
}
