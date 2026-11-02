/**
 * Modal para edição das informações cadastrais e de divulgação de um contrato
 * recorrente (escolinha ou grupo comum).
 */

"use client";

import { useState } from "react";
import { Janela } from "@/components/admin/ui";
import { Loader2, Info, Upload } from "lucide-react";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { mascaraWhatsApp, formatarDataExibicao } from "@/lib/constants";
import { DIAS_SEMANA, type ContratoRecorrente } from "@/lib/recorrencia/types";
import { uploadImagemInstitucional } from "@/lib/supabase/institucionalRepository";

interface Props {
  contrato: ContratoRecorrente | null;
  onClose: () => void;
  onSalvar: (
    contratoId: string,
    dados: {
      nome: string;
      esporte?: Esporte;
      descricao?: string;
      responsavelNome: string;
      contatoWhatsapp: string;
      fotoUrl?: string;
      faixaEtaria?: string;
    }
  ) => Promise<{ ok: boolean; motivo?: string }>;
}

const CLASSE_INPUT =
  "w-full bg-painel-elevada border border-painel-linha rounded-md px-3.5 py-2.5 text-sm text-painel-tinta placeholder:text-painel-suave focus:outline-none focus:border-painel-destaque transition-colors";
const CLASSE_LABEL = "block text-xs font-semibold text-painel-suave mb-1.5";

export function ModalEditarContrato({ contrato, onClose, onSalvar }: Props) {
  const quadrasCatalogo = useQuadrasCatalogo();

  const [nome, setNome] = useState("");
  const [esporte, setEsporte] = useState<Esporte | "">("");
  const [descricao, setDescricao] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [contatoWhatsapp, setContatoWhatsapp] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [faixaEtaria, setFaixaEtaria] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [contratoCarregado, setContratoCarregado] = useState<typeof contrato | null>(null);
  if (contrato && contrato !== contratoCarregado) {
    setContratoCarregado(contrato);
    setNome(contrato.nome);
    setEsporte(contrato.esporte || "");
    setDescricao(contrato.descricao || "");
    setResponsavelNome(contrato.responsavelNome);
    setContatoWhatsapp(mascaraWhatsApp(contrato.contatoWhatsapp));
    setFotoUrl(contrato.fotoUrl || "");
    setFaixaEtaria(contrato.faixaEtaria || "");
    setErro(null);
  }

  if (typeof document === "undefined" || !contrato) return null;

  const ehEscolinha = contrato.tipo === "escolinha";
  const quadra = quadrasCatalogo.find((q) => q.id === contrato.quadraId);
  const dias = DIAS_SEMANA.filter((d) => contrato.diasSemana.includes(d.valor))
    .map((d) => d.curto)
    .join(", ");

  const handleWhatsappChange = (valor: string) => {
    setContatoWhatsapp(mascaraWhatsApp(valor));
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const resultado = await onSalvar(contrato.id, {
        nome,
        esporte: esporte || undefined,
        descricao: ehEscolinha ? descricao : undefined,
        responsavelNome,
        contatoWhatsapp,
        fotoUrl: ehEscolinha ? (fotoUrl || undefined) : undefined,
        faixaEtaria: ehEscolinha ? (faixaEtaria || undefined) : undefined,
      });

      if (resultado.ok) {
        onClose();
      } else {
        setErro(resultado.motivo || "Não foi possível salvar as alterações.");
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Janela
      aberta
      titulo={ehEscolinha ? "Editar escolinha" : "Editar grupo"}
      descricao="Altere os dados cadastrais e de divulgação deste contrato."
      aoFechar={onClose}
    >
        {/* ── Formulário com scroll ── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
              {erro}
            </div>
          )}

          {/* Nome */}
          <div>
            <label htmlFor="editar-nome" className={CLASSE_LABEL}>
              {ehEscolinha ? "Nome da escolinha" : "Nome do grupo"} *
            </label>
            <input
              id="editar-nome"
              required
              className={CLASSE_INPUT}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Escolinha Craques do Futuro"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Esporte */}
            <div>
              <label htmlFor="editar-esporte" className={CLASSE_LABEL}>
                Esporte {ehEscolinha ? "*" : "(opcional)"}
              </label>
              <select
                id="editar-esporte"
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

            {/* Responsável */}
            <div>
              <label htmlFor="editar-responsavel" className={CLASSE_LABEL}>
                Responsável *
              </label>
              <input
                id="editar-responsavel"
                required
                className={CLASSE_INPUT}
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Ex.: Prof. Carlos"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label htmlFor="editar-whatsapp" className={CLASSE_LABEL}>
              WhatsApp de contato *
            </label>
            <input
              id="editar-whatsapp"
              required
              className={CLASSE_INPUT}
              value={contatoWhatsapp}
              onChange={(e) => handleWhatsappChange(e.target.value)}
              placeholder="(99) 99999-9999"
            />
          </div>

          {/* Descrição, Faixa Etária e Foto (somente escolinhas) */}
          {ehEscolinha && (
            <>
              <div>
                <label htmlFor="editar-descricao" className={CLASSE_LABEL}>
                  Descrição da escolinha
                </label>
                <textarea
                  id="editar-descricao"
                  rows={3}
                  className={CLASSE_INPUT}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Para crianças de 8 a 14 anos. Turmas pela manhã e tarde. Matrículas abertas!"
                />
                <span className="text-xs text-painel-suave mt-1 block">
                  Exibido para os clientes no portal e na Landing Page.
                </span>
              </div>

              <div>
                <label htmlFor="editar-faixa-etaria" className={CLASSE_LABEL}>
                  Faixa Etária <span className="text-painel-suave">(Landing Page)</span>
                </label>
                <input
                  id="editar-faixa-etaria"
                  className={CLASSE_INPUT}
                  value={faixaEtaria}
                  onChange={(e) => setFaixaEtaria(e.target.value)}
                  placeholder="Ex.: Infantil (6 a 14 anos) ou Adulto Iniciante"
                />
              </div>

              <div>
                <label htmlFor="editar-foto-professor" className={CLASSE_LABEL}>
                  Foto do Professor / Banner <span className="text-painel-suave">(Landing Page)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="editar-foto-professor"
                    type="url"
                    className={`${CLASSE_INPUT} flex-1`}
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    placeholder="https://... ou faça upload"
                  />
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-painel-linha hover:bg-painel-fundo text-painel-tinta text-xs font-semibold cursor-pointer transition-colors shrink-0">
                    {enviandoFoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-painel-destaque" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-painel-destaque" />
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
                      className="w-10 h-10 rounded-lg object-cover border border-painel-linha"
                    />
                    <span className="text-xs text-painel-suave">Prévia da imagem no site</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Dados fixos da agenda */}
          <div className="p-3.5 rounded-md bg-painel-superficie border border-painel-linha text-xs text-painel-suave space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-painel-tinta">
              <Info className="w-3.5 h-3.5 text-painel-suave" />
              <span>Agenda e bloqueios vinculados:</span>
            </div>
            <p className="text-xs text-painel-suave">
              {quadra ? `Quadra ${quadra.numero}` : contrato.quadraId} · {dias} · {contrato.horaInicio} às {contrato.horaFim} · {contrato.meses} {contrato.meses === 1 ? "mês" : "meses"} desde {formatarDataExibicao(contrato.dataInicio, { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="text-xs text-painel-suave italic">
              * Para alterar quadra, dias ou horários, encerre este contrato e cadastre um novo.
            </p>
          </div>

          {/* ── Footer ── */}
          <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-painel-linha">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-md text-xs font-semibold text-painel-tinta hover:text-painel-tinta hover:bg-painel-elevada transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold text-white bg-painel-destaque hover:bg-painel-destaque-forte transition-colors disabled:opacity-50"
            >
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </form>
    </Janela>
  );
}
