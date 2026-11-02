/**
 * Tela do admin: Gestão de Grupos Comuns (mensalistas).
 * Cadastro de grupos com horário cativo e controle de cancelamentos
 * (aviso de 1 semana, reposição e cobrança).
 */

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Users } from "lucide-react";
import { useContratosService } from "@/hooks/useContratosService";
import { formatarMoeda, getHoje } from "@/lib/constants";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";
import { FormularioContrato } from "./recorrencia/FormularioContrato";
import { CartaoContrato } from "./recorrencia/CartaoContrato";
import { PainelOcorrenciasGrupo } from "./recorrencia/PainelOcorrenciasGrupo";
import { ModalEditarContrato } from "./recorrencia/ModalEditarContrato";

export function AdminGruposPage() {
  const {
    getContratosPorTipo,
    getOcorrencias,
    carregarSessoes,
    getSituacaoCobranca,
    criarContrato,
    atualizarContrato,
    registrarCancelamentoGrupo,
    reativarOcorrenciaGrupo,
    encerrarContrato,
  } = useContratosService();
  // Sessões futuras completas (não só as da janela da agenda)
  useEffect(() => {
    void carregarSessoes();
  }, [carregarSessoes]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [contratoEmEdicao, setContratoEmEdicao] = useState<ContratoRecorrente | null>(null);

  const grupos = getContratosPorTipo("grupo");
  const hoje = getHoje();

  function alternarExpandido(id: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function handleEncerrar(id: string, nome: string) {
    const confirmado = window.confirm(
      `Encerrar o contrato do grupo "${nome}"? As sessões de hoje em diante serão liberadas sem cobrança.`
    );
    if (!confirmado) return;

    const resultado = await encerrarContrato(id);
    if (resultado.ok) {
      toast.success("Contrato encerrado", {
        description: `${resultado.sessoesCanceladas} sessões foram liberadas na agenda.`,
      });
    } else {
      toast.error("Não foi possível encerrar o contrato.");
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            Grupos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Horários cativos para grupos de amigos, sem pagamento adiantado. Cancelamentos com menos de 1
            semana só são abonados se o horário for reposto.
          </p>
        </div>
        {!mostrarForm && (
          <button
            id="grupos-novo"
            onClick={() => setMostrarForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo grupo
          </button>
        )}
      </div>

      {mostrarForm && (
        <FormularioContrato
          tipo="grupo"
          onSubmit={criarContrato}
          onCancelar={() => setMostrarForm(false)}
          onSucesso={(resultado) => {
            setMostrarForm(false);
            toast.success("Grupo cadastrado", {
              description: `${resultado.totalOcorrencias} sessões bloqueadas na agenda.`,
            });
          }}
        />
      )}

      {grupos.length === 0 && !mostrarForm && (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-10 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nenhum grupo cadastrado</p>
          <p className="text-slate-600 text-sm mt-1">
            Cadastre um grupo para reservar um horário fixo com prioridade.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {grupos.map((contrato) => {
          const ocorrencias = getOcorrencias(contrato.id);
          const sessoesFuturas = ocorrencias.filter(
            (o) => o.data >= hoje && o.status !== "cancelada"
          ).length;

          const cobrancas = ocorrencias.filter(
            (o) => o.status === "cancelada" && getSituacaoCobranca(o) === "cobranca_devida"
          );
          const totalDevido = cobrancas.reduce((soma, o) => soma + o.valorTotal, 0);
          const aberto = expandidos.has(contrato.id);

          return (
            <CartaoContrato key={contrato.id} contrato={contrato} sessoesFuturas={sessoesFuturas}>
              {cobrancas.length > 0 && (
                <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                  {cobrancas.length} sessão(ões) cancelada(s) fora do prazo sem reposição ·{" "}
                  <strong>{formatarMoeda(totalDevido)}</strong> a cobrar
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id={`sessoes-${contrato.id}`}
                    onClick={() => alternarExpandido(contrato.id)}
                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
                  >
                    {aberto ? "Ocultar sessões" : "Gerenciar sessões e cancelamentos"}
                  </button>

                  <button
                    id={`editar-${contrato.id}`}
                    onClick={() => setContratoEmEdicao(contrato)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-sky-400" />
                    Editar informações
                  </button>
                </div>

                {contrato.ativo && (
                  <button
                    id={`encerrar-${contrato.id}`}
                    onClick={() => handleEncerrar(contrato.id, contrato.nome)}
                    className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Encerrar contrato
                  </button>
                )}
              </div>

              {aberto && (
                <PainelOcorrenciasGrupo
                  ocorrencias={ocorrencias}
                  getSituacaoCobranca={getSituacaoCobranca}
                  registrarCancelamentoGrupo={registrarCancelamentoGrupo}
                  reativarOcorrenciaGrupo={reativarOcorrenciaGrupo}
                />
              )}
            </CartaoContrato>
          );
        })}
      </div>

      {contratoEmEdicao && (
        <ModalEditarContrato
          contrato={contratoEmEdicao}
          onClose={() => setContratoEmEdicao(null)}
          onSalvar={async (id, dados) => {
            const res = await atualizarContrato(id, dados);
            if (res.ok) {
              toast.success("Grupo atualizado com sucesso!");
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
