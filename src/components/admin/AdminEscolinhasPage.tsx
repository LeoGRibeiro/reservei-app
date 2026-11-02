/**
 * Tela do admin: Escolinhas, tudo num lugar só.
 * - Aba "No site": o que aparece na seção Escolinhas do site (nome, professor, turmas e botão
 *   "Quero uma vaga"), em `landing_page_schools`.
 * - Aba "Horários na agenda": contratos recorrentes que bloqueiam quadra para as aulas.
 * (Sem regra de cancelamento por sessão — contratos financeiros em backlog.)
 */

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Pencil, Plus } from "lucide-react";
import { useContratosService } from "@/hooks/useContratosService";
import { getHoje } from "@/lib/constants";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";
import { FormularioContrato } from "./recorrencia/FormularioContrato";
import { CartaoContrato } from "./recorrencia/CartaoContrato";
import { ModalEditarContrato } from "./recorrencia/ModalEditarContrato";
import { AbaEscolinhasSite } from "./institucional/AbaEscolinhasSite";
import { Abas, CabecalhoPagina } from "@/components/admin/ui";

type AbaEscolinhas = "site" | "agenda";

export function AdminEscolinhasPage() {
  const [aba, setAba] = useState<AbaEscolinhas>("site");


  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Escolinhas"
        descricao={
          <>
            <strong className="font-medium text-painel-tinta">No site</strong>: o que o visitante vê e o botão &ldquo;Quero uma vaga&rdquo;.{" "}
            <strong className="font-medium text-painel-tinta">Horários na agenda</strong>: as aulas que ocupam quadra.
          </>
        }
      />
      <Abas
        rotulo="Escolinhas"
        itens={[
          { id: "site", rotulo: "No site" },
          { id: "agenda", rotulo: "Horários na agenda" },
        ]}
        ativa={aba}
        aoTrocar={(id) => setAba(id as typeof aba)}
      />

      {aba === "site" ? <AbaEscolinhasSite /> : <HorariosNaAgenda />}
    </div>
  );
}

/** Contratos de escolinha que bloqueiam horários na agenda. */
function HorariosNaAgenda() {
  const { getContratosPorTipo, getOcorrencias,
    carregarSessoes, criarContrato, atualizarContrato, encerrarContrato } =
    useContratosService();
  // Sessões futuras completas (não só as da janela da agenda)
  useEffect(() => {
    void carregarSessoes();
  }, [carregarSessoes]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [contratoEmEdicao, setContratoEmEdicao] = useState<ContratoRecorrente | null>(null);

  const escolinhas = getContratosPorTipo("escolinha");
  const hoje = getHoje();

  async function handleEncerrar(id: string, nome: string) {
    const confirmado = window.confirm(
      `Encerrar o contrato de "${nome}"? As sessões de hoje em diante serão liberadas na agenda.`
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-painel-suave max-w-xl">
          Cada horário cadastrado aqui fica bloqueado na agenda e aparece como &ldquo;Aula&rdquo; na grade de reservas do site.
          O card da escolinha (professor, turmas e botão) fica na aba <strong>No site</strong>.
        </p>
        {!mostrarForm && (
          <button
            id="escolinhas-nova"
            onClick={() => setMostrarForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold text-white bg-painel-destaque hover:bg-painel-destaque-forte transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo horário de aula
          </button>
        )}
      </div>

      {mostrarForm && (
        <FormularioContrato
          tipo="escolinha"
          onSubmit={criarContrato}
          onCancelar={() => setMostrarForm(false)}
          onSucesso={(resultado) => {
            setMostrarForm(false);
            toast.success("Horário de aula cadastrado", {
              description: `${resultado.totalOcorrencias} sessões bloqueadas na agenda.`,
            });
          }}
        />
      )}

      {escolinhas.length === 0 && !mostrarForm && (
        <div className="bg-painel-superficie border border-painel-linha rounded-lg p-10 text-center">
          <CalendarClock className="w-10 h-10 text-painel-apagada mx-auto mb-3" />
          <p className="text-painel-suave font-medium">Nenhum horário de aula na agenda</p>
          <p className="text-painel-apagada text-sm mt-1">
            Cadastre um horário para bloquear a quadra nos dias e horas das aulas.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {escolinhas.map((contrato) => {
          const sessoesFuturas = getOcorrencias(contrato.id).filter(
            (o) => o.data >= hoje && o.status !== "cancelada"
          ).length;

          return (
            <CartaoContrato key={contrato.id} contrato={contrato} sessoesFuturas={sessoesFuturas}>
              {contrato.descricao && (
                <p className="text-xs text-painel-suave border-t border-painel-linha pt-3">
                  {contrato.descricao}
                </p>
              )}
              <div className="flex items-center justify-between border-t border-painel-linha pt-3">
                <button
                  id={`editar-${contrato.id}`}
                  onClick={() => setContratoEmEdicao(contrato)}
                  className="flex items-center gap-1.5 text-xs font-medium text-painel-tinta hover:text-painel-tinta px-3 py-1.5 rounded-lg hover:bg-painel-elevada transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-violet-700" />
                  Editar informações
                </button>

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
              toast.success("Horário de aula atualizado!");
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
