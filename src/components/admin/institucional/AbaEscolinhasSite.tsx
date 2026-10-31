/**
 * @module components/admin/institucional/AbaEscolinhasSite
 *
 * Aba "Escolinhas do site" do painel: lista as escolinhas que aparecem no site da arena (com as
 * turmas e o que o botão faz), cria, edita, esconde e exclui. Os dados ficam em
 * `landing_page_schools`, que o site lê direto.
 *
 * @see SPEC/2026-10-31-escolinhas-admin.md
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Link2, Loader2, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEscolinhasSite } from "@/hooks/useEscolinhasSite";
import { useArena } from "@/hooks/useArena";
import { uploadImagemInstitucional } from "@/lib/supabase/institucionalRepository";
import { escolinhaVazia, normalizarWhatsApp, tituloEscolinha, turmasPreenchidas, type EscolinhaSite } from "@/lib/institucional/escolinhasSite";
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
  const [edicao, setEdicao] = useState<Edicao>(null);

  const abrirNova = () => setEdicao({ id: null, dados: escolinhaVazia(escolinhas.length + 1) });
  const abrirEdicao = (e: EscolinhaSite) => {
    const { id, ...dados } = e;
    setEdicao({ id, dados: { ...dados, turmas: dados.turmas.length ? dados.turmas : escolinhaVazia().turmas } });
  };

  const remover = async (e: EscolinhaSite) => {
    if (!window.confirm(`Excluir a escolinha "${tituloEscolinha(e)}" do site? Isso não pode ser desfeito.`)) return;
    try {
      await excluir(e.id);
      toast.success("Escolinha excluída do site.");
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
        <p className="text-xs text-slate-400 max-w-xl">
          As escolinhas cadastradas aqui aparecem na seção <strong>Escolinhas</strong> do site, com as turmas e o botão
          &ldquo;Quero uma vaga&rdquo;. Os horários que ocupam quadra continuam na aba <strong>Escolinhas</strong> da agenda.
        </p>
        <button type="button" id="btn-admin-nova-escolinha" onClick={abrirNova} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold shrink-0">
          <Plus className="w-4 h-4" />
          Nova escolinha
        </button>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando escolinhas...</div>
      ) : erro ? (
        <p role="alert" className="text-sm text-red-400">{erro}</p>
      ) : escolinhas.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-700 text-center">
          <p className="text-sm text-slate-300 font-semibold">Nenhuma escolinha no site ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Enquanto não houver escolinha visível, a seção Escolinhas some do site.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {escolinhas.map((e) => (
            <article key={e.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between" aria-label={tituloEscolinha(e)}>
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{tituloEscolinha(e)}</h3>
                    <p className="text-xs text-slate-400">{e.nome.trim() ? `${e.esporte} · ` : ""}Prof. {e.professor}</p>
                  </div>
                  {!e.ativa && <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-bold text-[10px] shrink-0">Oculta</span>}
                </div>
                <ul className="space-y-1 text-xs text-slate-300 mb-3">
                  {turmasPreenchidas(e.turmas).map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold">{t.dias}</span>
                      <span className="text-amber-300">{t.horas}</span>
                      {t.categoria && <span className="text-slate-400 ml-auto">{t.categoria}</span>}
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
                  {e.tipoBotao === "link" ? (
                    <><Link2 className="w-3.5 h-3.5 text-emerald-400" /> Botão abre link</>
                  ) : (
                    <><MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp {e.whatsapp ? `(${normalizarWhatsApp(e.whatsapp).replace(/^55/, "")})` : "da arena"}{e.mensagemWhatsapp ? " · mensagem personalizada" : ""}</>
                  )}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button type="button" onClick={() => alternar(e)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
                  {e.ativa ? <><Eye className="w-3.5 h-3.5 text-emerald-400" /><span>No site</span></> : <><EyeOff className="w-3.5 h-3.5" /><span>Escondida</span></>}
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => abrirEdicao(e)} aria-label={`Editar ${tituloEscolinha(e)}`} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => remover(e)} aria-label={`Excluir ${tituloEscolinha(e)}`} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400">
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
          whatsappArena={normalizarWhatsApp(arena?.whatsapp ?? "")}
          aoEnviarFoto={(arquivo) => uploadImagemInstitucional(arquivo, "professores")}
          aoCancelar={() => setEdicao(null)}
          aoSalvar={async (dados) => {
            await salvar(edicao.id, dados);
            toast.success(edicao.id ? "Escolinha atualizada no site." : "Escolinha publicada no site.");
            setEdicao(null);
          }}
        />
      )}
    </div>
  );
}
