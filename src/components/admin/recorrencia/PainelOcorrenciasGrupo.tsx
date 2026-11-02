/**
 * Lista as sessões de um grupo comum e permite registrar o aviso de cancelamento
 * (com a data do aviso) ou reativar uma sessão cancelada.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Reserva } from "@/store/useReservasStore";
import { formatarDataExibicao, formatarMoeda, getHoje } from "@/lib/constants";
import {
  ANTECEDENCIA_MINIMA_DIAS,
  ROTULO_SITUACAO_COBRANCA,
  type SituacaoCobranca,
} from "@/lib/recorrencia/cancelamento";
import type { useContratosService } from "@/hooks/useContratosService";

type Servico = ReturnType<typeof useContratosService>;

interface Props {
  ocorrencias: Reserva[];
  getSituacaoCobranca: Servico["getSituacaoCobranca"];
  registrarCancelamentoGrupo: Servico["registrarCancelamentoGrupo"];
  reativarOcorrenciaGrupo: Servico["reativarOcorrenciaGrupo"];
}

const ESTILO_SITUACAO: Record<SituacaoCobranca, string> = {
  sem_onus: "bg-painel-linha text-painel-tinta border-painel-linha-forte",
  aguardando_reposicao: "bg-amber-50 text-amber-700 border-amber-200",
  isento_por_reposicao: "bg-painel-destaque-suave text-painel-destaque border-painel-destaque",
  cobranca_devida: "bg-red-50 text-red-700 border-red-200",
};

export function PainelOcorrenciasGrupo({
  ocorrencias,
  getSituacaoCobranca,
  registrarCancelamentoGrupo,
  reativarOcorrenciaGrupo,
}: Props) {
  const hoje = getHoje();
  const [mostrarPassadas, setMostrarPassadas] = useState(false);
  const [emCancelamento, setEmCancelamento] = useState<string | null>(null);
  const [dataAviso, setDataAviso] = useState(hoje);

  const visiveis = ocorrencias.filter(
    (o) => mostrarPassadas || o.data >= hoje || (o.status === "cancelada" && !!o.avisoCancelamentoEm)
  );

  function abrirCancelamento(id: string) {
    setEmCancelamento(id);
    setDataAviso(hoje);
  }

  async function confirmarCancelamento(id: string) {
    const resultado = await registrarCancelamentoGrupo(id, dataAviso);
    if (!resultado.ok) {
      toast.error("Não foi possível cancelar", { description: resultado.motivo });
      return;
    }
    setEmCancelamento(null);

    if (resultado.classificacao === "sem_onus") {
      toast.success("Sessão cancelada sem ônus", {
        description: "Aviso com antecedência suficiente. O horário foi liberado ao público.",
      });
    } else {
      toast.warning("Aviso tardio registrado", {
        description:
          "Horário liberado ao público. O grupo só fica isento se outro cliente reservar e pagar.",
        duration: 7000,
      });
    }
  }

  async function reativar(id: string) {
    const resultado = await reativarOcorrenciaGrupo(id);
    if (resultado.ok) {
      toast.success("Sessão reativada");
    } else {
      toast.error("Não foi possível reativar", { description: resultado.motivo });
    }
  }

  return (
    <div className="border-t border-painel-linha pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-painel-suave">Sessões</p>
        <button
          onClick={() => setMostrarPassadas((v) => !v)}
          className="text-xs text-painel-suave hover:text-painel-tinta transition-colors"
        >
          {mostrarPassadas ? "Ocultar passadas" : "Mostrar passadas"}
        </button>
      </div>

      <p className="text-[11px] text-painel-apagada">
        Cancelamento sem ônus exige aviso com {ANTECEDENCIA_MINIMA_DIAS} dias ou mais de antecedência.
      </p>

      {visiveis.length === 0 && (
        <p className="text-sm text-painel-suave py-3 text-center">Nenhuma sessão para exibir.</p>
      )}

      <ul className="divide-y divide-painel-linha max-h-80 overflow-y-auto pr-1">
        {visiveis.map((o) => {
          const cancelada = o.status === "cancelada";
          const futura = o.data >= hoje;
          const situacao = cancelada ? getSituacaoCobranca(o) : null;

          return (
            <li key={o.id} className="py-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${cancelada ? "text-painel-suave line-through" : "text-painel-tinta"}`}>
                    {formatarDataExibicao(o.data, { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  {situacao && o.avisoCancelamentoEm && (
                    <p className="text-[11px] text-painel-suave">
                      Aviso em {formatarDataExibicao(o.avisoCancelamentoEm, { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {situacao && (
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${ESTILO_SITUACAO[situacao]}`}
                    >
                      {ROTULO_SITUACAO_COBRANCA[situacao]}
                      {situacao === "cobranca_devida" && ` · ${formatarMoeda(o.valorTotal)}`}
                    </span>
                  )}

                  {!cancelada && futura && emCancelamento !== o.id && (
                    <button
                      id={`cancelar-sessao-${o.id}`}
                      onClick={() => abrirCancelamento(o.id)}
                      className="text-xs font-medium text-red-700 hover:text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Registrar cancelamento
                    </button>
                  )}

                  {cancelada && futura && o.avisoCancelamentoEm && (
                    <button
                      onClick={() => reativar(o.id)}
                      className="text-xs font-medium text-painel-destaque hover:text-painel-destaque px-2.5 py-1 rounded-lg hover:bg-painel-destaque-suave transition-colors"
                    >
                      Reativar
                    </button>
                  )}
                </div>
              </div>

              {emCancelamento === o.id && (
                <div className="flex flex-wrap items-end gap-3 bg-painel-elevada border border-painel-linha rounded-md p-3">
                  <div>
                    <label htmlFor={`aviso-${o.id}`} className="block text-[11px] text-painel-suave mb-1">
                      Data em que o grupo avisou
                    </label>
                    <input
                      id={`aviso-${o.id}`}
                      type="date"
                      max={hoje}
                      value={dataAviso}
                      onChange={(e) => setDataAviso(e.target.value)}
                      className="bg-painel-superficie border border-painel-linha rounded-lg px-2.5 py-1.5 text-xs text-painel-tinta"
                    />
                  </div>
                  <button
                    onClick={() => confirmarCancelamento(o.id)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-400 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setEmCancelamento(null)}
                    className="px-3 py-2 rounded-lg text-xs text-painel-suave hover:text-painel-tinta transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
