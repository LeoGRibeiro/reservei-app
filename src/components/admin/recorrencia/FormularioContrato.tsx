/**
 * Formulário de cadastro de contrato recorrente.
 * Reutilizado pelas telas de Escolinhas e de Grupos (muda apenas o `tipo`).
 */

"use client";

import { useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { useQuadrasCatalogo, useHorariosCatalogo } from "@/store/useCatalogoArenaStore";
import { getHoje, mascaraWhatsApp } from "@/lib/constants";
import { horariosFimDisponiveis, expandirHorarios, gerarDatasRecorrentes } from "@/lib/recorrencia/ocorrencias";
import { formatarDataExibicao } from "@/lib/constants";
import {
  DIAS_SEMANA,
  MESES_MAXIMO_CONTRATO,
  MESES_PADRAO_CONTRATO,
  type DadosNovoContrato,
  type DiaSemana,
  type TipoContrato,
} from "@/lib/recorrencia/types";
import type { ResultadoCriarContrato } from "@/hooks/useContratosService";
import { uploadImagemInstitucional } from "@/lib/supabase/institucionalRepository";

interface Props {
  tipo: TipoContrato;
  onSubmit: (dados: DadosNovoContrato) => Promise<ResultadoCriarContrato>;
  onSucesso: (resultado: Extract<ResultadoCriarContrato, { ok: true }>) => void;
  onCancelar: () => void;
}

const CLASSE_INPUT =
  "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors";
const CLASSE_LABEL = "block text-xs font-semibold text-slate-400 mb-1.5";

const TEXTOS: Record<TipoContrato, { nome: string; placeholderNome: string; titulo: string }> = {
  escolinha: {
    nome: "Nome da escolinha",
    placeholderNome: "Ex.: Escolinha Craques do Futuro",
    titulo: "Nova escolinha",
  },
  grupo: {
    nome: "Nome do grupo",
    placeholderNome: "Ex.: Pelada dos Amigos de Terça",
    titulo: "Novo grupo",
  },
};

export function FormularioContrato({ tipo, onSubmit, onSucesso, onCancelar }: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();
  const horariosCatalogo = useHorariosCatalogo();
  const textos = TEXTOS[tipo];
  const hoje = getHoje();

  const [nome, setNome] = useState("");
  const [esporte, setEsporte] = useState<Esporte | "">("");
  const [descricao, setDescricao] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [contatoWhatsapp, setContatoWhatsapp] = useState("");
  const [quadraId, setQuadraId] = useState((quadrasCatalogo[0]?.id ?? ""));
  const [diasSemana, setDiasSemana] = useState<DiaSemana[]>([]);
  const [horaInicio, setHoraInicio] = useState("14:00");
  const [horaFim, setHoraFim] = useState("16:00");
  const [dataInicio, setDataInicio] = useState(hoje);
  const [meses, setMeses] = useState(MESES_PADRAO_CONTRATO);
  const [fotoUrl, setFotoUrl] = useState("");
  const [faixaEtaria, setFaixaEtaria] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [conflitos, setConflitos] = useState<Array<{ data: string; nomeCliente: string }>>([]);

  const totalSessoes = useMemo(
    () => gerarDatasRecorrentes(dataInicio, diasSemana, meses).length,
    [dataInicio, diasSemana, meses]
  );
  const horasPorSessao = expandirHorarios(horaInicio, horaFim).length;

  function alternarDia(dia: DiaSemana) {
    setDiasSemana((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
    );
  }

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const res = await uploadImagemInstitucional(file, "professores");
      if (res.success && res.url) {
        setFotoUrl(res.url);
      }
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    setErros([]);
    setConflitos([]);
    setEnviando(true);

    try {
      const resultado = await onSubmit({
        tipo,
        nome,
        esporte: esporte || undefined,
        descricao: tipo === "escolinha" ? descricao : undefined,
        responsavelNome,
        contatoWhatsapp,
        quadraId,
        diasSemana,
        horaInicio,
        horaFim,
        dataInicio,
        meses,
        fotoUrl: tipo === "escolinha" ? (fotoUrl || undefined) : undefined,
        faixaEtaria: tipo === "escolinha" ? (faixaEtaria || undefined) : undefined,
      });

      if (resultado.ok) {
        onSucesso(resultado);
      } else {
        setErros(resultado.erros);
        setConflitos(resultado.conflitos ?? []);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      id={`form-contrato-${tipo}`}
      className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-5"
    >
      <h2 className="text-lg font-bold text-white">{textos.titulo}</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor={`${tipo}-nome`} className={CLASSE_LABEL}>
            {textos.nome}
          </label>
          <input
            id={`${tipo}-nome`}
            className={CLASSE_INPUT}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={textos.placeholderNome}
          />
        </div>

        <div>
          <label htmlFor={`${tipo}-esporte`} className={CLASSE_LABEL}>
            Esporte {tipo === "grupo" && <span className="text-slate-600">(opcional)</span>}
          </label>
          <select
            id={`${tipo}-esporte`}
            className={CLASSE_INPUT}
            value={esporte}
            onChange={(e) => setEsporte(e.target.value as Esporte | "")}
          >
            <option value="">Selecione...</option>
            {ESPORTES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${tipo}-quadra`} className={CLASSE_LABEL}>
            Quadra
          </label>
          <select
            id={`${tipo}-quadra`}
            className={CLASSE_INPUT}
            value={quadraId}
            onChange={(e) => setQuadraId(e.target.value)}
          >
            {quadrasCatalogo.map((q) => (
              <option key={q.id} value={q.id}>
                Quadra {q.numero}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${tipo}-responsavel`} className={CLASSE_LABEL}>
            Responsável
          </label>
          <input
            id={`${tipo}-responsavel`}
            className={CLASSE_INPUT}
            value={responsavelNome}
            onChange={(e) => setResponsavelNome(e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>

        <div>
          <label htmlFor={`${tipo}-whatsapp`} className={CLASSE_LABEL}>
            {tipo === "escolinha" ? "WhatsApp para matrículas" : "WhatsApp do responsável"}
          </label>
          <input
            id={`${tipo}-whatsapp`}
            className={CLASSE_INPUT}
            value={contatoWhatsapp}
            onChange={(e) => setContatoWhatsapp(mascaraWhatsApp(e.target.value))}
            placeholder="(00) 00000-0000"
            inputMode="tel"
          />
        </div>

        {tipo === "escolinha" && (
          <>
            <div className="sm:col-span-2">
              <label htmlFor="escolinha-descricao" className={CLASSE_LABEL}>
                Descrição <span className="text-slate-600">(exibida no &quot;saiba mais&quot; do portal e na Landing Page)</span>
              </label>
              <textarea
                id="escolinha-descricao"
                className={`${CLASSE_INPUT} min-h-[80px] resize-y`}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Metodologia, diferenciais, etc."
              />
            </div>

            <div>
              <label htmlFor="escolinha-faixa-etaria" className={CLASSE_LABEL}>
                Faixa Etária <span className="text-slate-600">(Landing Page)</span>
              </label>
              <input
                id="escolinha-faixa-etaria"
                className={CLASSE_INPUT}
                value={faixaEtaria}
                onChange={(e) => setFaixaEtaria(e.target.value)}
                placeholder="Ex.: Infantil (6 a 14 anos) ou Adulto"
              />
            </div>

            <div>
              <label htmlFor="escolinha-foto" className={CLASSE_LABEL}>
                Foto do Professor / Banner <span className="text-slate-600">(Landing Page)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="escolinha-foto"
                  type="url"
                  className={`${CLASSE_INPUT} flex-1`}
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  placeholder="https://... ou faça upload"
                />
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold cursor-pointer transition-colors shrink-0">
                  {enviandoFoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{enviandoFoto ? "Enviando..." : "Upload"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFoto}
                    className="hidden"
                    disabled={enviandoFoto}
                  />
                </label>
              </div>
              {fotoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={fotoUrl}
                    alt="Prévia da foto"
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                  />
                  <span className="text-xs text-slate-400">Prévia da imagem no site</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dias da semana */}
      <div>
        <p className={CLASSE_LABEL}>Dias da semana</p>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((dia) => {
            const ativo = diasSemana.includes(dia.valor);
            return (
              <button
                key={dia.valor}
                type="button"
                id={`${tipo}-dia-${dia.valor}`}
                aria-pressed={ativo}
                onClick={() => alternarDia(dia.valor)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  ativo
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {dia.curto}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label htmlFor={`${tipo}-inicio`} className={CLASSE_LABEL}>
            Início
          </label>
          <select
            id={`${tipo}-inicio`}
            className={CLASSE_INPUT}
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          >
            {horariosCatalogo.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${tipo}-fim`} className={CLASSE_LABEL}>
            Fim
          </label>
          <select
            id={`${tipo}-fim`}
            className={CLASSE_INPUT}
            value={horaFim}
            onChange={(e) => setHoraFim(e.target.value)}
          >
            {horariosFimDisponiveis().map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${tipo}-data-inicio`} className={CLASSE_LABEL}>
            A partir de
          </label>
          <input
            id={`${tipo}-data-inicio`}
            type="date"
            className={CLASSE_INPUT}
            min={hoje}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${tipo}-meses`} className={CLASSE_LABEL}>
            Duração
          </label>
          <select
            id={`${tipo}-meses`}
            className={CLASSE_INPUT}
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
          >
            {Array.from({ length: MESES_MAXIMO_CONTRATO }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "mês" : "meses"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Prévia */}
      <p className="text-xs text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3.5 py-2.5">
        {totalSessoes > 0 && horasPorSessao > 0 ? (
          <>
            Serão bloqueadas <strong className="text-white">{totalSessoes} sessões</strong> de{" "}
            {horasPorSessao}h, até{" "}
            {formatarDataExibicao(
              gerarDatasRecorrentes(dataInicio, diasSemana, meses).slice(-1)[0],
              { day: "numeric", month: "long", year: "numeric" }
            )}
            .
          </>
        ) : (
          "Preencha os dias, horários e data de início para ver quantas sessões serão bloqueadas."
        )}
      </p>

      {/* Erros */}
      {erros.length > 0 && (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 space-y-1"
        >
          {erros.map((erro) => (
            <p key={erro}>• {erro}</p>
          ))}
          {conflitos.length > 0 && (
            <ul className="mt-2 text-xs text-red-300/80 list-disc pl-5 space-y-0.5">
              {conflitos.slice(0, 8).map((c) => (
                <li key={`${c.data}-${c.nomeCliente}`}>
                  {formatarDataExibicao(c.data)} — {c.nomeCliente || "Reserva sem nome"}
                </li>
              ))}
              {conflitos.length > 8 && <li>… e mais {conflitos.length - 8}.</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          id={`${tipo}-salvar`}
          disabled={enviando}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Cadastrar e bloquear agenda
        </button>
      </div>
    </form>
  );
}
