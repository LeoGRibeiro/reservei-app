/**
 * @module components/admin/institucional/FormEscolinhaSite
 *
 * Formulário (modal) de uma escolinha do site: nome, esporte, professor, foto, descrição, turmas
 * (dias, horários e categoria) e o botão "Quero uma vaga" (WhatsApp com mensagem pronta ou link).
 * Cada campo explica ao dono o que aparece no site.
 *
 * A mensagem pronta acompanha o esporte e o professor enquanto o dono não a editar; depois de
 * editada, fica como ele escreveu (e dá para voltar à padrão).
 */

"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Link2, Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import {
  MAX_TURMAS,
  hrefBotaoEscolinha,
  mensagemPadraoEscolinha,
  validarEscolinhaSite,
  type ErrosEscolinha,
  type EscolinhaSiteInput,
  type TurmaSite,
} from "@/lib/institucional/escolinhasSite";

export interface FormEscolinhaSiteProps {
  /** Dados iniciais (escolinha em edição ou formulário vazio) */
  inicial: EscolinhaSiteInput;
  editando: boolean;
  /** WhatsApp da arena (dígitos), usado quando a escolinha não tem número próprio */
  whatsappArena?: string;
  /** Grava; deve lançar erro com mensagem clara se o banco recusar */
  aoSalvar: (dados: EscolinhaSiteInput) => Promise<void>;
  aoCancelar: () => void;
  /** Envia a foto e devolve a URL pública (ou o erro) */
  aoEnviarFoto: (arquivo: File) => Promise<{ success: boolean; url?: string; error?: string }>;
}

const CAMPO = "w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500";
const ROTULO = "text-xs font-semibold text-slate-300 block mb-1";
const DICA = "text-[11px] text-slate-400 mt-1";
const ERRO = "text-[11px] text-red-400 mt-1";

/**
 * @example
 * ```tsx
 * <FormEscolinhaSite inicial={escolinhaVazia()} editando={false} aoSalvar={salvar} aoCancelar={fechar} aoEnviarFoto={upload} />
 * ```
 */
export function FormEscolinhaSite({ inicial, editando, whatsappArena = "", aoSalvar, aoCancelar, aoEnviarFoto }: FormEscolinhaSiteProps) {
  const [form, setForm] = useState<EscolinhaSiteInput>(inicial);
  const [mensagemEditada, setMensagemEditada] = useState(Boolean(inicial.mensagemWhatsapp.trim()));
  const [erros, setErros] = useState<ErrosEscolinha>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const mensagemPadrao = mensagemPadraoEscolinha(form.esporte, form.professor);
  const mensagem = mensagemEditada ? form.mensagemWhatsapp : mensagemPadrao;

  const mudar = <K extends keyof EscolinhaSiteInput>(campo: K, valor: EscolinhaSiteInput[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const mudarTurma = (i: number, campo: keyof TurmaSite, valor: string) =>
    setForm((f) => ({ ...f, turmas: f.turmas.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) }));

  const dadosFinais = (): EscolinhaSiteInput => ({ ...form, mensagemWhatsapp: mensagemEditada ? form.mensagemWhatsapp : "" });

  const enviarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setEnviandoFoto(true);
    const res = await aoEnviarFoto(arquivo);
    setEnviandoFoto(false);
    if (res.success && res.url) mudar("fotoProfessorUrl", res.url);
    else setErroGeral(res.error ?? "Não foi possível enviar a foto.");
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const dados = dadosFinais();
    const encontrados = validarEscolinhaSite(dados);
    setErros(encontrados);
    if (Object.keys(encontrados).length) {
      setErroGeral("Confira os campos marcados em vermelho.");
      return;
    }
    setErroGeral(null);
    setSalvando(true);
    try {
      await aoSalvar(dados);
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-form-escolinha" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-4">
        <div>
          <h2 id="titulo-form-escolinha" className="text-xl font-bold text-white">
            {editando ? "Editar escolinha" : "Nova escolinha"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tudo o que você preencher aqui aparece na seção <strong>Escolinhas</strong> do site da arena, logo depois de salvar.
          </p>
        </div>

        <form onSubmit={salvar} noValidate className="space-y-5">
          {/* Identificação */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-emerald-400 mb-1">1. Escolinha e professor</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="esc-esporte" className={ROTULO}>Esporte *</label>
                <input id="esc-esporte" className={CAMPO} placeholder="Ex.: Beach tennis" value={form.esporte} onChange={(e) => mudar("esporte", e.target.value)} aria-invalid={!!erros.esporte} />
                {erros.esporte ? <p className={ERRO}>{erros.esporte}</p> : <p className={DICA}>Vai na mensagem do WhatsApp: &ldquo;quero uma vaga no beach tennis&rdquo;.</p>}
              </div>
              <div>
                <label htmlFor="esc-nome" className={ROTULO}>Nome da escolinha (opcional)</label>
                <input id="esc-nome" className={CAMPO} placeholder="Ex.: CT Falcão 12" value={form.nome} onChange={(e) => mudar("nome", e.target.value)} aria-invalid={!!erros.nome} />
                {erros.nome ? <p className={ERRO}>{erros.nome}</p> : <p className={DICA}>É o título do card. Se deixar vazio, o título é o esporte.</p>}
              </div>
              <div>
                <label htmlFor="esc-professor" className={ROTULO}>Nome do professor *</label>
                <input id="esc-professor" className={CAMPO} placeholder="Ex.: Italo Bianck" value={form.professor} onChange={(e) => mudar("professor", e.target.value)} aria-invalid={!!erros.professor} />
                {erros.professor ? <p className={ERRO}>{erros.professor}</p> : <p className={DICA}>Só o nome. O site já escreve &ldquo;Prof.&rdquo; na frente.</p>}
              </div>
              <div>
                <span className={ROTULO}>Foto do professor</span>
                <div className="flex items-center gap-2">
                  {form.fotoProfessorUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- prévia da foto enviada
                    <img src={form.fotoProfessorUrl} alt="Prévia da foto do professor" className="w-10 h-12 rounded-lg object-cover border border-slate-700" />
                  )}
                  <label className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer">
                    {enviandoFoto ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Upload className="w-4 h-4 text-emerald-400" />}
                    <span>{enviandoFoto ? "Enviando..." : form.fotoProfessorUrl ? "Trocar foto" : "Enviar foto"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={enviarFoto} disabled={enviandoFoto} aria-label="Enviar foto do professor" />
                  </label>
                  {form.fotoProfessorUrl && (
                    <button type="button" className="text-xs text-slate-400 hover:text-red-400" onClick={() => mudar("fotoProfessorUrl", "")}>
                      Remover
                    </button>
                  )}
                </div>
                <p className={DICA}>Foto em pé, com o rosto no centro (até 5 MB). Sem foto, aparece uma silhueta.</p>
              </div>
            </div>
            <div>
              <label htmlFor="esc-descricao" className={ROTULO}>Descrição</label>
              <textarea id="esc-descricao" rows={2} className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500" placeholder="Ex.: Do primeiro saque ao jogo competitivo. Turmas pequenas, com raquete e bolas da arena para quem está começando." value={form.descricao} onChange={(e) => mudar("descricao", e.target.value)} />
              <p className={DICA}>Duas ou três frases sobre as aulas: para quem é, o que se aprende, o que a arena empresta.</p>
            </div>
          </fieldset>

          {/* Turmas */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-emerald-400 mb-1">2. Turmas</legend>
            <p className="text-[11px] text-slate-400">
              Cada linha vira uma linha da tabela do card. Escreva do jeito que o aluno lê, ex.: <strong>Ter e Qui</strong> · <strong>7h e 8h</strong> · <strong>Iniciante</strong>. A categoria pode ser nível, idade ou público (ex.: &ldquo;6 a 10 anos&rdquo;, &ldquo;Feminino&rdquo;) e é opcional.
            </p>
            <div className="space-y-2">
              {form.turmas.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input className={CAMPO} placeholder="Dias (ex.: Seg e Qua)" aria-label={`Dias da turma ${i + 1}`} value={t.dias} onChange={(e) => mudarTurma(i, "dias", e.target.value)} />
                  <input className={CAMPO} placeholder="Horários (ex.: 16h)" aria-label={`Horários da turma ${i + 1}`} value={t.horas} onChange={(e) => mudarTurma(i, "horas", e.target.value)} />
                  <input className={CAMPO} placeholder="Categoria (ex.: Avançado)" aria-label={`Categoria da turma ${i + 1}`} value={t.categoria} onChange={(e) => mudarTurma(i, "categoria", e.target.value)} />
                  <button type="button" aria-label={`Remover turma ${i + 1}`} disabled={form.turmas.length === 1} onClick={() => setForm((f) => ({ ...f, turmas: f.turmas.filter((_, j) => j !== i) }))} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {erros.turmas && <p className={ERRO}>{erros.turmas}</p>}
            {form.turmas.length < MAX_TURMAS && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, turmas: [...f.turmas, { dias: "", horas: "", categoria: "" }] }))} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                <Plus className="w-3.5 h-3.5" /> Adicionar turma
              </button>
            )}
          </fieldset>

          {/* Botão */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-emerald-400 mb-1">3. Botão &ldquo;Quero uma vaga&rdquo;</legend>
            <p className="text-[11px] text-slate-400">Escolha o que acontece quando o visitante toca no botão do card.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="O que o botão faz">
              {([
                ["whatsapp", MessageCircle, "Abrir o WhatsApp", "A conversa abre com a mensagem já escrita. O aluno só toca em enviar."],
                ["link", Link2, "Abrir um link", "Ex.: formulário de inscrição (Google Forms) ou site do professor."],
              ] as const).map(([valor, IconeOpcao, titulo, texto]) => (
                <label key={valor} className={`flex gap-2 p-3 rounded-2xl border cursor-pointer ${form.tipoBotao === valor ? "border-emerald-500 bg-emerald-950/30" : "border-slate-700 bg-slate-950/50"}`}>
                  <input type="radio" name="tipo-botao" value={valor} checked={form.tipoBotao === valor} onChange={() => mudar("tipoBotao", valor)} className="mt-0.5 accent-emerald-500" />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white"><IconeOpcao className="w-4 h-4 text-emerald-400" />{titulo}</span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">{texto}</span>
                  </span>
                </label>
              ))}
            </div>

            {form.tipoBotao === "whatsapp" ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="esc-whatsapp" className={ROTULO}>WhatsApp que recebe os pedidos</label>
                  <input id="esc-whatsapp" type="tel" inputMode="tel" className={CAMPO} placeholder="(91) 98498-2865" value={form.whatsapp} onChange={(e) => mudar("whatsapp", e.target.value)} aria-invalid={!!erros.whatsapp} />
                  {erros.whatsapp ? <p className={ERRO}>{erros.whatsapp}</p> : <p className={DICA}>Pode ser o do professor ou o da recepção. Se deixar vazio, vai para o WhatsApp da arena.</p>}
                </div>
                <div>
                  <label htmlFor="esc-mensagem" className={ROTULO}>Mensagem pronta</label>
                  <textarea
                    id="esc-mensagem"
                    rows={3}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500"
                    value={mensagem}
                    onChange={(e) => {
                      setMensagemEditada(true);
                      mudar("mensagemWhatsapp", e.target.value);
                    }}
                    aria-invalid={!!erros.mensagemWhatsapp}
                    aria-describedby="esc-mensagem-dica"
                  />
                  {erros.mensagemWhatsapp && <p className={ERRO}>{erros.mensagemWhatsapp}</p>}
                  <p id="esc-mensagem-dica" className={DICA}>
                    {mensagemEditada
                      ? "Você personalizou a mensagem. Ela fica exatamente como está escrita acima."
                      : "Mensagem padrão: o esporte e o nome do professor entram sozinhos e mudam junto se você trocar os campos acima. Pode reescrever do seu jeito."}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {mensagemEditada && (
                      <button type="button" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300" onClick={() => { setMensagemEditada(false); mudar("mensagemWhatsapp", ""); }}>
                        Voltar para a mensagem padrão
                      </button>
                    )}
                    <a className="flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white" target="_blank" rel="noopener noreferrer" href={hrefBotaoEscolinha({ ...form, mensagemWhatsapp: mensagemEditada ? form.mensagemWhatsapp : "" }, whatsappArena)}>
                      <ExternalLink className="w-3.5 h-3.5" /> Testar no WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="esc-link" className={ROTULO}>Endereço do link *</label>
                <input id="esc-link" type="url" inputMode="url" className={CAMPO} placeholder="https://forms.gle/..." value={form.linkBotao} onChange={(e) => mudar("linkBotao", e.target.value)} aria-invalid={!!erros.linkBotao} />
                {erros.linkBotao ? <p className={ERRO}>{erros.linkBotao}</p> : <p className={DICA}>Copie o endereço da barra do navegador e cole aqui. Abre numa nova aba.</p>}
              </div>
            )}
          </fieldset>

          {/* Exibição */}
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="text-sm font-bold text-emerald-400 mb-1 col-span-full">4. No site</legend>
            <div>
              <label htmlFor="esc-ordem" className={ROTULO}>Posição</label>
              <input id="esc-ordem" type="number" min={0} max={99} className={CAMPO} value={form.ordem} onChange={(e) => mudar("ordem", Number(e.target.value) || 0)} />
              <p className={DICA}>1 aparece primeiro, depois 2, e assim por diante.</p>
            </div>
            <label className="flex items-start gap-2 p-3 rounded-2xl border border-slate-700 bg-slate-950/50 cursor-pointer self-start">
              <input type="checkbox" checked={form.ativa} onChange={(e) => mudar("ativa", e.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span>
                <span className="block text-sm font-semibold text-white">Mostrar no site</span>
                <span className="block text-[11px] text-slate-400">Desmarque para esconder sem apagar (ex.: férias do professor).</span>
              </span>
            </label>
          </fieldset>

          {erroGeral && <p role="alert" className="text-sm text-red-400">{erroGeral}</p>}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button type="button" onClick={aoCancelar} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold disabled:opacity-60">
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar escolinha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
