/**
 * @module components/admin/institucional/AbaEscolinhasSite
 *
 * Aba "No site" do menu Escolinhas: lista as escolinhas que aparecem no site da arena (turmas,
 * situação na agenda e o que o botão faz), cria, edita, esconde e exclui. Os dados ficam em
 * `landing_page_schools`, que o site lê direto; as turmas com "Bloquear na agenda" viram contratos
 * recorrentes ({@link useAgendaEscolinha}).
 *
 * @see SPEC/2026-10-31-escolinhas-admin.md
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Eye, EyeOff, Link2, Loader2, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEscolinhasSite } from "@/hooks/useEscolinhasSite";
import { useAgendaEscolinha } from "@/hooks/useAgendaEscolinha";
import { useArena } from "@/hooks/useArena";
import { useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { uploadImagemInstitucional } from "@/lib/supabase/institucionalRepository";
import { escolinhaVazia, normalizarWhatsApp, tituloEscolinha, turmasPreenchidas, turmaVazia, type EscolinhaSite } from "@/lib/institucional/escolinhasSite";
import { FormEscolinhaSite } from "./FormEscolinhaSite";

/** Formulário aberto: nova (id nulo) ou edição. */
type Edicao = { id: string | null; dados: Omit<EscolinhaSite, "id"> } | null;

/**
 * @example
 * ```tsx
 * {aba === "escolinhas" && <AbaEscolinhasSite />}
 * ```
 */
export function AbaEscolinhasSite() {
  const { escolinhas, carregando, erro, salvar, alternarVisibilidade, excluir } = useEscolinhasSite();
  const { arena } = useArena();
  const { sincronizarAgenda, liberarAgenda } = useAgendaEscolinha();
  const quadrasCatalogo = useQuadrasCatalogo();
  const horarios = useHorariosCatalogo();
  const quadras = quadrasCatalogo.map((q) => ({ id: q.id, nome: q.descricao }));
  const nomeQuadra = (id: string) => quadras.find((q) => q.id === id)?.nome ?? "quadra";
  const whatsappArena = normalizarWhatsApp(arena?.whatsapp ?? "");
  const [edicao, setEdicao] = useState<Edicao>(null);

  const abrirNova = () => {
    const dados = escolinhaVazia(escolinhas.length + 1);
    setEdicao({ id: null, dados: { ...dados, turmas: [turmaVazia(quadras[0]?.id)] } });
  };
  const abrirEdicao = (e: EscolinhaSite) => {
    const { id, ...dados } = e;
    setEdicao({ id, dados: { ...dados, turmas: dados.turmas.length ? dados.turmas : [turmaVazia(quadras[0]?.id)] } });
  };

  const remover = async (e: EscolinhaSite) => {
    const naAgenda = e.turmas.filter((t) => t.contratoId).length;
    const aviso = naAgenda ? " Os horários dela na agenda são liberados de hoje em diante." : "";
    if (!window.confirm(`Excluir a escolinha "${tituloEscolinha(e)}"?${aviso} Isso não pode ser desfeito.`)) return;
    try {
      await liberarAgenda(e.turmas);
      await excluir(e.id);
      toast.success(naAgenda ? "Escolinha excluída e horários liberados na agenda." : "Escolinha excluída do site.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  };

  const alternar = async (e: EscolinhaSite) => {
    try {
      await alternarVisibilidade(e);
      toast.success(e.ativa ? "Escolinha escondida do site." : "Escolinha visível no site.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-painel-suave max-w-xl">
          As escolinhas cadastradas aqui aparecem na seção <strong>Escolinhas</strong> do site, com as turmas e o botão
          &ldquo;Quero uma vaga&rdquo;. As turmas marcadas com <strong>Bloquear na agenda</strong> reservam a quadra
          sozinhas; dá para conferir na aba <strong>Horários na agenda</strong>.
        </p>
        <button type="button" id="btn-admin-nova-escolinha" onClick={abrirNova} className="flex items-center gap-2 px-4 py-2 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white text-xs sm:text-sm font-bold shrink-0">
          <Plus className="w-4 h-4" />
          Nova escolinha
        </button>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-painel-suave"><Loader2 className="w-4 h-4 animate-spin" /> Carregando escolinhas...</div>
      ) : erro ? (
        <p role="alert" className="text-sm text-red-700">{erro}</p>
      ) : escolinhas.length === 0 ? (
        <div className="p-8 rounded-lg border border-dashed border-painel-linha text-center">
          <p className="text-sm text-painel-tinta font-semibold">Nenhuma escolinha no site ainda.</p>
          <p className="text-xs text-painel-suave mt-1">Enquanto não houver escolinha visível, a seção Escolinhas some do site.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {escolinhas.map((e) => (
            <article key={e.id} className="bg-painel-superficie border border-painel-linha rounded-lg p-5 flex flex-col justify-between" aria-label={tituloEscolinha(e)}>
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-painel-tinta">{tituloEscolinha(e)}</h3>
                    <p className="text-xs text-painel-suave">{e.nome.trim() ? `${e.esporte} · ` : ""}Prof. {e.professor}</p>
                  </div>
                  {!e.ativa && <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-[10px] shrink-0">Oculta</span>}
                </div>
                <ul className="space-y-1 text-xs text-painel-tinta mb-3">
                  {turmasPreenchidas(e.turmas).map((t, i) => (
                    <li key={i}>
                      <div className="flex gap-2">
                        <span className="font-semibold">{t.dias}</span>
                        <span className="text-amber-700">{t.horas}</span>
                        {t.categoria && <span className="text-painel-suave ml-auto">{t.categoria}</span>}
                      </div>
                      {t.contratoId ? (
                        <span className="flex items-center gap-1 text-[10px] text-painel-destaque">
                          <CalendarCheck className="w-3 h-3" /> Na agenda · {nomeQuadra(t.quadraId)}
                        </span>
                      ) : t.bloquearAgenda ? (
                        <span className="text-[10px] text-amber-700">Ainda não bloqueada na agenda (edite e salve de novo)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-1.5 text-[11px] text-painel-suave mb-4">
                  {e.tipoBotao === "link" ? (
                    <><Link2 className="w-3.5 h-3.5 text-painel-destaque" /> Botão abre link</>
                  ) : (
                    <><MessageCircle className="w-3.5 h-3.5 text-painel-destaque" /> WhatsApp {e.whatsapp ? `(${normalizarWhatsApp(e.whatsapp).replace(/^55/, "")})` : "da arena"}{e.mensagemWhatsapp ? " · mensagem personalizada" : ""}</>
                  )}
                </p>
              </div>
              <div className="pt-3 border-t border-painel-linha flex items-center justify-between">
                <button type="button" onClick={() => alternar(e)} className="flex items-center gap-1.5 text-xs text-painel-suave hover:text-painel-tinta">
                  {e.ativa ? <><Eye className="w-3.5 h-3.5 text-painel-destaque" /><span>No site</span></> : <><EyeOff className="w-3.5 h-3.5" /><span>Escondida</span></>}
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => abrirEdicao(e)} aria-label={`Editar ${tituloEscolinha(e)}`} className="p-1.5 rounded-lg bg-painel-elevada hover:bg-painel-fundo text-painel-tinta hover:text-painel-tinta">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => remover(e)} aria-label={`Excluir ${tituloEscolinha(e)}`} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-50 text-red-700">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {edicao && (
        <FormEscolinhaSite
          inicial={edicao.dados}
          editando={edicao.id !== null}
          whatsappArena={whatsappArena}
          quadras={quadras}
          horarios={horarios}
          aoEnviarFoto={(arquivo) => uploadImagemInstitucional(arquivo, "professores")}
          aoCancelar={() => setEdicao(null)}
          aoSalvar={async (dados, periodo) => {
            const salva = await salvar(edicao.id, dados);
            const agenda = await sincronizarAgenda(salva, edicao.dados.turmas, periodo, whatsappArena);
            const mudouVinculo = agenda.turmas.some((t, i) => t.contratoId !== salva.turmas[i]?.contratoId);
            if (mudouVinculo) {
              const { id, ...resto } = salva;
              await salvar(id, { ...resto, turmas: agenda.turmas });
            }
            const partes = [
              edicao.id ? "Escolinha atualizada no site." : "Escolinha publicada no site.",
              agenda.criadas ? `${agenda.criadas} turma(s) bloqueada(s) na agenda.` : "",
              agenda.encerradas ? `${agenda.encerradas} horário(s) liberado(s) na agenda.` : "",
            ].filter(Boolean);
            if (agenda.falhas.length) {
              toast.warning(partes.join(" "), {
                description: `Não deu para bloquear na agenda: ${agenda.falhas.join(" | ")}`,
                duration: 15000,
              });
            } else {
              toast.success(partes.join(" "));
            }
            setEdicao(null);
          }}
        />
      )}
    </div>
  );
}
