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
import { createPortal } from "react-dom";
import {
  Loader2,
  MessageCircle,
  Link2,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
} from "lucide-react";
import { getHoje } from "@/lib/constants";
import { DIAS_SEMANA, MESES_MAXIMO_CONTRATO, MESES_PADRAO_CONTRATO, type DiaSemana } from "@/lib/recorrencia/types";
import {
  MAX_TURMAS,
  planejarAgenda,
  textoDias,
  textoHoras,
  turmaVazia,
  hrefBotaoEscolinha,
  mensagemPadraoEscolinha,
  validarEscolinhaSite,
  type ErrosEscolinha,
  type EscolinhaSiteInput,
  type PeriodoAgenda,
  type TurmaSite,
} from "@/lib/institucional/escolinhasSite";

export interface FormEscolinhaSiteProps {
  /** Dados iniciais (escolinha em edição ou formulário vazio) */
  inicial: EscolinhaSiteInput;
  editando: boolean;
  /** WhatsApp da arena (dígitos), usado quando a escolinha não tem número próprio */
  whatsappArena?: string;
  /** Quadras da arena (para bloquear a agenda) */
  quadras: ReadonlyArray<{ id: string; nome: string }>;
  /** Horários de funcionamento ("08:00", "09:00"...) */
  horarios: readonly string[];
  /** Grava; deve lançar erro com mensagem clara se o banco recusar */
  aoSalvar: (dados: EscolinhaSiteInput, periodo: PeriodoAgenda) => Promise<void>;
  aoCancelar: () => void;
  /** Envia a foto e devolve a URL pública (ou o erro) */
  aoEnviarFoto: (
    arquivo: File,
  ) => Promise<{ success: boolean; url?: string; error?: string }>;
}

const CAMPO =
  "w-full h-10 px-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm outline-none focus:border-painel-destaque";
const ROTULO = "text-xs font-semibold text-painel-tinta block mb-1";
const DICA = "text-[11px] text-painel-suave mt-1";
const ERRO = "text-[11px] text-red-700 mt-1";

/**
 * @example
 * ```tsx
 * <FormEscolinhaSite inicial={escolinhaVazia()} editando={false} aoSalvar={salvar} aoCancelar={fechar} aoEnviarFoto={upload} />
 * ```
 */
export function FormEscolinhaSite({
  inicial,
  editando,
  whatsappArena = "",
  quadras,
  horarios,
  aoSalvar,
  aoCancelar,
  aoEnviarFoto,
}: FormEscolinhaSiteProps) {
  const [form, setForm] = useState<EscolinhaSiteInput>(inicial);
  const [mensagemEditada, setMensagemEditada] = useState(
    Boolean(inicial.mensagemWhatsapp.trim()),
  );
  const [erros, setErros] = useState<ErrosEscolinha>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoAgenda>({ dataInicio: getHoje(), meses: MESES_PADRAO_CONTRATO });
  const quadraPadrao = quadras[0]?.id ?? "";
  // Fim possível: 1 hora depois de cada horário de funcionamento
  const horariosFim = horarios.map((h) => `${String(Number(h.slice(0, 2)) + 1).padStart(2, "0")}:00`);
  // Turmas que vão ganhar contrato novo (novas ou com dia, horário ou quadra alterados) usam o período
  const algumaNovaNaAgenda = planejarAgenda(inicial.turmas, form.turmas).criar.length > 0;

  const mensagemPadrao = mensagemPadraoEscolinha(form.esporte, form.professor);
  const mensagem = mensagemEditada ? form.mensagemWhatsapp : mensagemPadrao;

  const mudar = <K extends keyof EscolinhaSiteInput>(
    campo: K,
    valor: EscolinhaSiteInput[K],
  ) => setForm((f) => ({ ...f, [campo]: valor }));

  const mudarTurma = <K extends keyof TurmaSite>(i: number, campo: K, valor: TurmaSite[K]) =>
    setForm((f) => ({
      ...f,
      turmas: f.turmas.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)),
    }));

  const alternarDia = (i: number, dia: DiaSemana) =>
    setForm((f) => ({
      ...f,
      turmas: f.turmas.map((t, j) =>
        j === i
          ? { ...t, diasSemana: t.diasSemana.includes(dia) ? t.diasSemana.filter((d) => d !== dia) : [...t.diasSemana, dia] }
          : t,
      ),
    }));

  const dadosFinais = (): EscolinhaSiteInput => ({
    ...form,
    mensagemWhatsapp: mensagemEditada ? form.mensagemWhatsapp : "",
  });

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
      await aoSalvar(dados, periodo);
    } catch (err) {
      setErroGeral(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  };

  // Portal no body: um ancestral com animação (transform) prenderia o "fixed" à área da página e cortaria a janela
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-form-escolinha"
      className="painel fixed inset-0 z-[100] !bg-stone-900/40 overflow-y-auto overscroll-contain"
    >
      <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div className="bg-painel-superficie border border-painel-linha rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
          <div>
            <h2
              id="titulo-form-escolinha"
              className="text-xl font-bold text-painel-tinta"
            >
              {editando ? "Editar escolinha" : "Nova escolinha"}
            </h2>
            <p className="text-xs text-painel-suave mt-1">
              Tudo o que você preencher aqui aparece na seção{" "}
              <strong>Escolinhas</strong> do site da arena, logo depois de
              salvar.
            </p>
          </div>

          <form onSubmit={salvar} noValidate className="space-y-5">
            {/* Identificação */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-painel-destaque mb-1">
                1. Escolinha e professor
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="esc-esporte" className={ROTULO}>
                    Esporte *
                  </label>
                  <input
                    id="esc-esporte"
                    className={CAMPO}
                    placeholder="Ex.: Beach tennis"
                    value={form.esporte}
                    onChange={(e) => mudar("esporte", e.target.value)}
                    aria-invalid={!!erros.esporte}
                  />
                  {erros.esporte ? (
                    <p className={ERRO}>{erros.esporte}</p>
                  ) : (
                    <p className={DICA}>
                      Vai na mensagem do WhatsApp: &ldquo;quero uma vaga no
                      beach tennis&rdquo;.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="esc-nome" className={ROTULO}>
                    Nome da escolinha (opcional)
                  </label>
                  <input
                    id="esc-nome"
                    className={CAMPO}
                    placeholder="Ex.: CT Falcão 12"
                    value={form.nome}
                    onChange={(e) => mudar("nome", e.target.value)}
                    aria-invalid={!!erros.nome}
                  />
                  {erros.nome ? (
                    <p className={ERRO}>{erros.nome}</p>
                  ) : (
                    <p className={DICA}>
                      É o título do card. Se deixar vazio, o título é o esporte.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="esc-professor" className={ROTULO}>
                    Nome do professor *
                  </label>
                  <input
                    id="esc-professor"
                    className={CAMPO}
                    placeholder="Ex.: Italo Bianck"
                    value={form.professor}
                    onChange={(e) => mudar("professor", e.target.value)}
                    aria-invalid={!!erros.professor}
                  />
                  {erros.professor ? (
                    <p className={ERRO}>{erros.professor}</p>
                  ) : (
                    <p className={DICA}>
                      Só o nome. O site já escreve &ldquo;Prof.&rdquo; na
                      frente.
                    </p>
                  )}
                </div>
                <div>
                  <span className={ROTULO}>Foto do professor</span>
                  <div className="flex items-center gap-2">
                    {form.fotoProfessorUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- prévia da foto enviada
                      <img
                        src={form.fotoProfessorUrl}
                        alt="Prévia da foto do professor"
                        className="w-10 h-12 rounded-lg object-cover border border-painel-linha"
                      />
                    )}
                    <label className="flex items-center gap-1.5 px-3 h-10 rounded-md bg-painel-elevada hover:bg-painel-fundo border border-painel-linha text-painel-tinta text-xs font-semibold cursor-pointer">
                      {enviandoFoto ? (
                        <Loader2 className="w-4 h-4 animate-spin text-painel-destaque" />
                      ) : (
                        <Upload className="w-4 h-4 text-painel-destaque" />
                      )}
                      <span>
                        {enviandoFoto
                          ? "Enviando..."
                          : form.fotoProfessorUrl
                            ? "Trocar foto"
                            : "Enviar foto"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={enviarFoto}
                        disabled={enviandoFoto}
                        aria-label="Enviar foto do professor"
                      />
                    </label>
                    {form.fotoProfessorUrl && (
                      <button
                        type="button"
                        className="text-xs text-painel-suave hover:text-red-700"
                        onClick={() => mudar("fotoProfessorUrl", "")}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className={DICA}>
                    Foto em pé, com o rosto no centro (até 5 MB). Sem foto,
                    aparece uma silhueta.
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="esc-descricao" className={ROTULO}>
                  Descrição
                </label>
                <textarea
                  id="esc-descricao"
                  rows={2}
                  className="w-full p-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm outline-none focus:border-painel-destaque"
                  placeholder="Ex.: Do primeiro saque ao jogo competitivo. Turmas pequenas, com raquete e bolas da arena para quem está começando."
                  value={form.descricao}
                  onChange={(e) => mudar("descricao", e.target.value)}
                />
                <p className={DICA}>
                  Duas ou três frases sobre as aulas: para quem é, o que se
                  aprende, o que a arena empresta.
                </p>
              </div>
            </fieldset>

            {/* Turmas */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-painel-destaque mb-1">2. Turmas e horários na agenda</legend>
              <p className="text-[11px] text-painel-suave">
                Escolha os dias e o horário de cada turma. O site mostra sozinho, ex.: <strong>Ter e Qui</strong> ·{" "}
                <strong>8h e 9h</strong>. Com <strong>Bloquear na agenda</strong>, a quadra fica reservada para a aula
                nesses dias e horários, e ninguém consegue reservar por cima.
              </p>
              <div className="space-y-3">
                {form.turmas.map((t, i) => {
                  const previa = [textoDias(t.diasSemana), textoHoras(t.horaInicio, t.horaFim), t.categoria.trim()]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={i} className="p-3 rounded-lg border border-painel-linha bg-painel-superficie space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-painel-tinta">
                          Turma {i + 1}
                          {previa && <span className="font-normal text-painel-suave"> · No site: {previa}</span>}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remover turma ${i + 1}`}
                          disabled={form.turmas.length === 1}
                          onClick={() => setForm((f) => ({ ...f, turmas: f.turmas.filter((_, j) => j !== i) }))}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-50 text-red-700 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div role="group" aria-label={`Dias da turma ${i + 1}`} className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 0].map((valor) => {
                          const dia = DIAS_SEMANA.find((d) => d.valor === valor)!;
                          const marcado = t.diasSemana.includes(dia.valor);
                          return (
                            <button
                              key={dia.valor}
                              type="button"
                              aria-pressed={marcado}
                              aria-label={`${dia.longo} na turma ${i + 1}`}
                              onClick={() => alternarDia(i, dia.valor)}
                              className={`px-3 h-8 rounded-lg text-xs font-semibold border ${
                                marcado ? "bg-painel-destaque border-painel-destaque text-white" : "border-painel-linha text-painel-tinta hover:border-painel-linha-forte"
                              }`}
                            >
                              {dia.curto}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          className={CAMPO}
                          aria-label={`Início da turma ${i + 1}`}
                          value={t.horaInicio}
                          onChange={(e) => mudarTurma(i, "horaInicio", e.target.value)}
                        >
                          <option value="">Início</option>
                          {horarios.map((h) => (
                            <option key={h} value={h}>Começa {h}</option>
                          ))}
                        </select>
                        <select
                          className={CAMPO}
                          aria-label={`Fim da turma ${i + 1}`}
                          value={t.horaFim}
                          onChange={(e) => mudarTurma(i, "horaFim", e.target.value)}
                        >
                          <option value="">Fim</option>
                          {horariosFim.map((h) => (
                            <option key={h} value={h}>Termina {h}</option>
                          ))}
                        </select>
                        <input
                          className={CAMPO}
                          placeholder="Categoria (ex.: Iniciante)"
                          aria-label={`Categoria da turma ${i + 1}`}
                          value={t.categoria}
                          onChange={(e) => mudarTurma(i, "categoria", e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-painel-tinta cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-[var(--painel-destaque)]"
                            checked={t.bloquearAgenda}
                            onChange={(e) => {
                              mudarTurma(i, "bloquearAgenda", e.target.checked);
                              if (e.target.checked && !t.quadraId) mudarTurma(i, "quadraId", quadraPadrao);
                            }}
                          />
                          Bloquear na agenda
                        </label>
                        {t.bloquearAgenda && (
                          <select
                            className={`${CAMPO} sm:max-w-[220px]`}
                            aria-label={`Quadra da turma ${i + 1}`}
                            value={t.quadraId}
                            onChange={(e) => mudarTurma(i, "quadraId", e.target.value)}
                          >
                            <option value="">Escolha a quadra</option>
                            {quadras.map((q) => (
                              <option key={q.id} value={q.id}>{q.nome}</option>
                            ))}
                          </select>
                        )}
                        <span className="text-[11px] text-painel-suave">
                          {t.bloquearAgenda
                            ? t.contratoId
                              ? "Já está na agenda. Se mudar dia, horário ou quadra, a agenda é refeita a partir de hoje."
                              : "Vai ser bloqueada na agenda ao salvar."
                            : "Só aparece no site, sem ocupar quadra."}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {erros.turmas && <p className={ERRO}>{erros.turmas}</p>}
              {form.turmas.length < MAX_TURMAS && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, turmas: [...f.turmas, turmaVazia(quadraPadrao)] }))}
                  className="flex items-center gap-1.5 text-xs font-semibold text-painel-destaque hover:text-painel-destaque"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar turma
                </button>
              )}
              {algumaNovaNaAgenda && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                  <div>
                    <label htmlFor="esc-agenda-inicio" className={ROTULO}>Bloquear a partir de</label>
                    <input
                      id="esc-agenda-inicio"
                      type="date"
                      min={getHoje()}
                      className={CAMPO}
                      value={periodo.dataInicio}
                      onChange={(e) => setPeriodo((p) => ({ ...p, dataInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="esc-agenda-meses" className={ROTULO}>Por quanto tempo</label>
                    <select
                      id="esc-agenda-meses"
                      className={CAMPO}
                      value={periodo.meses}
                      onChange={(e) => setPeriodo((p) => ({ ...p, meses: Number(e.target.value) }))}
                    >
                      {Array.from({ length: MESES_MAXIMO_CONTRATO }, (_, k) => k + 1).map((m) => (
                        <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>
                      ))}
                    </select>
                  </div>
                  <p className={`${DICA} sm:col-span-2 mt-0`}>
                    Vale para as turmas novas ou alteradas na agenda. Se já houver reserva de cliente num desses horários, o sistema avisa e não bloqueia aquela turma.
                  </p>
                </div>
              )}
            </fieldset>

            {/* Botão */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-bold text-painel-destaque mb-1">
                3. Botão &ldquo;Quero uma vaga&rdquo;
              </legend>
              <p className="text-[11px] text-painel-suave">
                Escolha o que acontece quando o visitante toca no botão do card.
              </p>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                role="radiogroup"
                aria-label="O que o botão faz"
              >
                {(
                  [
                    [
                      "whatsapp",
                      MessageCircle,
                      "Abrir o WhatsApp",
                      "A conversa abre com a mensagem já escrita. O aluno só toca em enviar.",
                    ],
                    [
                      "link",
                      Link2,
                      "Abrir um link",
                      "Ex.: formulário de inscrição (Google Forms) ou site do professor.",
                    ],
                  ] as const
                ).map(([valor, IconeOpcao, titulo, texto]) => (
                  <label
                    key={valor}
                    className={`flex gap-2 p-3 rounded-lg border cursor-pointer ${form.tipoBotao === valor ? "border-painel-destaque bg-emerald-50" : "border-painel-linha bg-painel-superficie"}`}
                  >
                    <input
                      type="radio"
                      name="tipo-botao"
                      value={valor}
                      checked={form.tipoBotao === valor}
                      onChange={() => mudar("tipoBotao", valor)}
                      className="mt-0.5 accent-[var(--painel-destaque)]"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-painel-tinta">
                        <IconeOpcao className="w-4 h-4 text-painel-destaque" />
                        {titulo}
                      </span>
                      <span className="block text-[11px] text-painel-suave mt-0.5">
                        {texto}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {form.tipoBotao === "whatsapp" ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="esc-whatsapp" className={ROTULO}>
                      WhatsApp que recebe os pedidos
                    </label>
                    <input
                      id="esc-whatsapp"
                      type="tel"
                      inputMode="tel"
                      className={CAMPO}
                      placeholder="(91) 98498-2865"
                      value={form.whatsapp}
                      onChange={(e) => mudar("whatsapp", e.target.value)}
                      aria-invalid={!!erros.whatsapp}
                    />
                    {erros.whatsapp ? (
                      <p className={ERRO}>{erros.whatsapp}</p>
                    ) : (
                      <p className={DICA}>
                        Pode ser o do professor ou o da recepção. Se deixar
                        vazio, vai para o WhatsApp da arena.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="esc-mensagem" className={ROTULO}>
                      Mensagem pronta
                    </label>
                    <textarea
                      id="esc-mensagem"
                      rows={3}
                      className="w-full p-3 rounded-md bg-painel-superficie border border-painel-linha text-painel-tinta text-sm outline-none focus:border-painel-destaque"
                      value={mensagem}
                      onChange={(e) => {
                        setMensagemEditada(true);
                        mudar("mensagemWhatsapp", e.target.value);
                      }}
                      aria-invalid={!!erros.mensagemWhatsapp}
                      aria-describedby="esc-mensagem-dica"
                    />
                    {erros.mensagemWhatsapp && (
                      <p className={ERRO}>{erros.mensagemWhatsapp}</p>
                    )}
                    <p id="esc-mensagem-dica" className={DICA}>
                      {mensagemEditada
                        ? "Você personalizou a mensagem. Ela fica exatamente como está escrita acima."
                        : "Mensagem padrão: o esporte e o nome do professor entram sozinhos e mudam junto se você trocar os campos acima. Pode reescrever do seu jeito."}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {mensagemEditada && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-painel-destaque hover:text-painel-destaque"
                          onClick={() => {
                            setMensagemEditada(false);
                            mudar("mensagemWhatsapp", "");
                          }}
                        >
                          Voltar para a mensagem padrão
                        </button>
                      )}
                      <a
                        className="flex items-center gap-1 text-xs font-semibold text-painel-tinta hover:text-painel-tinta"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={hrefBotaoEscolinha(
                          {
                            ...form,
                            mensagemWhatsapp: mensagemEditada
                              ? form.mensagemWhatsapp
                              : "",
                          },
                          whatsappArena,
                        )}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Testar no
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="esc-link" className={ROTULO}>
                    Endereço do link *
                  </label>
                  <input
                    id="esc-link"
                    type="url"
                    inputMode="url"
                    className={CAMPO}
                    placeholder="https://forms.gle/..."
                    value={form.linkBotao}
                    onChange={(e) => mudar("linkBotao", e.target.value)}
                    aria-invalid={!!erros.linkBotao}
                  />
                  {erros.linkBotao ? (
                    <p className={ERRO}>{erros.linkBotao}</p>
                  ) : (
                    <p className={DICA}>
                      Copie o endereço da barra do navegador e cole aqui. Abre
                      numa nova aba.
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            {/* Exibição */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <legend className="text-sm font-bold text-painel-destaque mb-1 col-span-full">
                4. No site
              </legend>
              <div>
                <label htmlFor="esc-ordem" className={ROTULO}>
                  Posição
                </label>
                <input
                  id="esc-ordem"
                  type="number"
                  min={0}
                  max={99}
                  className={CAMPO}
                  value={form.ordem}
                  onChange={(e) => mudar("ordem", Number(e.target.value) || 0)}
                />
                <p className={DICA}>
                  1 aparece primeiro, depois 2, e assim por diante.
                </p>
              </div>
              <label className="flex items-start gap-2 p-3 rounded-lg border border-painel-linha bg-painel-superficie cursor-pointer self-start">
                <input
                  type="checkbox"
                  checked={form.ativa}
                  onChange={(e) => mudar("ativa", e.target.checked)}
                  className="mt-0.5 accent-[var(--painel-destaque)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-painel-tinta">
                    Mostrar no site
                  </span>
                  <span className="block text-[11px] text-painel-suave">
                    Desmarque para esconder sem apagar (ex.: férias do
                    professor).
                  </span>
                </span>
              </label>
            </fieldset>

            {erroGeral && (
              <p role="alert" className="text-sm text-red-700">
                {erroGeral}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-painel-linha">
              <button
                type="button"
                onClick={aoCancelar}
                className="px-4 py-2 rounded-md text-xs font-semibold text-painel-suave hover:text-painel-tinta"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-painel-destaque hover:bg-painel-destaque-forte text-white text-xs font-bold disabled:opacity-60"
              >
                {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar escolinha
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
