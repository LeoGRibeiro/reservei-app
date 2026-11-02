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
import { Botao, CabecalhoPagina } from "@/components/admin/ui";

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
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Grupos"
        descricao="Horários fixos de grupos de amigos, sem pagamento adiantado. Cancelamento com menos de 1 semana só é abonado se o horário for reposto."
        acoes={
          !mostrarForm && (
            <Botao id="grupos-novo" icone={Plus} onClick={() => setMostrarForm(true)}>
              Novo grupo
            </Botao>
          )
        }
      />

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
        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-10 text-center">
          <Users className="w-10 h-10 text-painel-apagada mx-auto mb-3" />
          <p className="text-painel-suave font-medium">Nenhum grupo cadastrado</p>
          <p className="text-painel-apagada text-sm mt-1">
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
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3.5 py-2.5">
                  {cobrancas.length} sessão(ões) cancelada(s) fora do prazo sem reposição ·{" "}
                  <strong>{formatarMoeda(totalDevido)}</strong> a cobrar
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-painel-linha pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id={`sessoes-${contrato.id}`}
                    onClick={() => alternarExpandido(contrato.id)}
                    className="text-xs font-medium text-painel-destaque hover:text-painel-destaque px-3 py-1.5 rounded-lg hover:bg-painel-destaque-suave transition-colors"
                  >
                    {aberto ? "Ocultar sessões" : "Gerenciar sessões e cancelamentos"}
                  </button>

                  <button
                    id={`editar-${contrato.id}`}
                    onClick={() => setContratoEmEdicao(contrato)}
                    className="flex items-center gap-1.5 text-xs font-medium text-painel-tinta hover:text-painel-tinta px-3 py-1.5 rounded-lg hover:bg-painel-elevada transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-sky-700" />
                    Editar informações
                  </button>
                </div>

                {contrato.ativo && (
                  <button
                    id={`encerrar-${contrato.id}`}
                    onClick={() => handleEncerrar(contrato.id, contrato.nome)}
                    className="text-xs font-medium text-red-700 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
