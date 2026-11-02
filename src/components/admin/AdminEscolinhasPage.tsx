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
import { CalendarClock, Globe, GraduationCap, Pencil, Plus } from "lucide-react";
import { useContratosService } from "@/hooks/useContratosService";
import { getHoje } from "@/lib/constants";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";
import { FormularioContrato } from "./recorrencia/FormularioContrato";
import { CartaoContrato } from "./recorrencia/CartaoContrato";
import { ModalEditarContrato } from "./recorrencia/ModalEditarContrato";
import { AbaEscolinhasSite } from "./institucional/AbaEscolinhasSite";

type AbaEscolinhas = "site" | "agenda";

export function AdminEscolinhasPage() {
  const [aba, setAba] = useState<AbaEscolinhas>("site");

  const classeAba = (valor: AbaEscolinhas) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
      aba === valor ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
    }`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-violet-400" />
            Escolinhas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            <strong className="text-slate-300">No site</strong>: o que o visitante vê e o botão &ldquo;Quero uma vaga&rdquo;.{" "}
            <strong className="text-slate-300">Horários na agenda</strong>: as aulas que ocupam quadra.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start" role="tablist" aria-label="Escolinhas">
          <button type="button" role="tab" id="escolinhas-aba-site" aria-selected={aba === "site"} onClick={() => setAba("site")} className={classeAba("site")}>
            <Globe className="w-4 h-4" />
            No site
          </button>
          <button type="button" role="tab" id="escolinhas-aba-agenda" aria-selected={aba === "agenda"} onClick={() => setAba("agenda")} className={classeAba("agenda")}>
            <CalendarClock className="w-4 h-4" />
            Horários na agenda
          </button>
        </div>
      </div>

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
        <p className="text-xs text-slate-400 max-w-xl">
          Cada horário cadastrado aqui fica bloqueado na agenda e aparece como &ldquo;Aula&rdquo; na grade de reservas do site.
          O card da escolinha (professor, turmas e botão) fica na aba <strong>No site</strong>.
        </p>
        {!mostrarForm && (
          <button
            id="escolinhas-nova"
            onClick={() => setMostrarForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors shrink-0"
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
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-10 text-center">
          <CalendarClock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nenhum horário de aula na agenda</p>
          <p className="text-slate-600 text-sm mt-1">
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
                <p className="text-xs text-slate-500 border-t border-slate-800 pt-3">
                  {contrato.descricao}
                </p>
              )}
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <button
                  id={`editar-${contrato.id}`}
                  onClick={() => setContratoEmEdicao(contrato)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-violet-400" />
                  Editar informações
                </button>

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
