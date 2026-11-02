/**
 * @file JanelaGrupo.tsx
 * @description Cadastro e edição de grupo (horário fixo de amigos) no padrão do painel (`Janela` +
 * `Campo`). Novo grupo: nome, responsável, WhatsApp, quadra, dias, horário e período. Edição: nome,
 * responsável e WhatsApp (mudar dia, horário ou quadra exige encerrar e cadastrar de novo, para não
 * mexer em sessões já combinadas).
 *
 * No site, o horário do grupo aparece **igual a uma reserva comum ("Ocupado")**, sem nome nem motivo.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §5
 */

"use client";

import { useMemo, useState } from "react";
import { Aviso, Botao, Campo, Entrada, Janela, Selecao } from "@/components/admin/ui";
import { useHorariosCatalogo, useQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { formatarDataExibicao, getHoje, mascaraWhatsApp } from "@/lib/constants";
import { gerarDatasRecorrentes } from "@/lib/recorrencia/ocorrencias";
import { DIAS_SEMANA, MESES_MAXIMO_CONTRATO, MESES_PADRAO_CONTRATO, type ContratoRecorrente, type DadosNovoContrato, type DiaSemana } from "@/lib/recorrencia/types";
import type { ResultadoCriarContrato } from "@/hooks/useContratosService";

/** Hora seguinte ("21:00" → "22:00"). */
const horaSeguinte = (h: string) => `${String(Number(h.slice(0, 2)) + 1).padStart(2, "0")}:00`;

export interface JanelaGrupoProps {
  /** Grupo em edição; ausente = novo grupo */
  grupo?: ContratoRecorrente;
  aoFechar: () => void;
  aoCriar: (dados: DadosNovoContrato) => Promise<ResultadoCriarContrato>;
  aoAtualizar: (id: string, dados: Partial<ContratoRecorrente>) => Promise<{ ok: boolean; motivo?: string }>;
  /** Depois de salvar com sucesso (texto para o aviso) */
  aoSalvo: (mensagem: string) => void;
}

/**
 * @example
 * ```tsx
 * <JanelaGrupo aoFechar={fechar} aoCriar={criarContrato} aoAtualizar={atualizarContrato} aoSalvo={toast.success} />
 * ```
 */
export function JanelaGrupo({ grupo, aoFechar, aoCriar, aoAtualizar, aoSalvo }: JanelaGrupoProps) {
  const quadras = useQuadrasCatalogo();
  const horarios = useHorariosCatalogo();
  const editando = !!grupo;
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [responsavel, setResponsavel] = useState(grupo?.responsavelNome ?? "");
  const [whatsapp, setWhatsapp] = useState(grupo ? mascaraWhatsApp(grupo.contatoWhatsapp) : "");
  const [quadraId, setQuadraId] = useState(grupo?.quadraId ?? quadras[0]?.id ?? "");
  const [dias, setDias] = useState<DiaSemana[]>(grupo?.diasSemana ?? []);
  const [inicio, setInicio] = useState(grupo?.horaInicio ?? horarios.at(-2) ?? "21:00");
  const [fim, setFim] = useState(grupo?.horaFim ?? horaSeguinte(horarios.at(-2) ?? "21:00"));
  const [dataInicio, setDataInicio] = useState(grupo?.dataInicio ?? getHoje());
  const [meses, setMeses] = useState(grupo?.meses ?? MESES_PADRAO_CONTRATO);
  const [erros, setErros] = useState<string[]>([]);
  const [conflitos, setConflitos] = useState<{ data: string; nomeCliente: string }[]>([]);
  const [salvando, setSalvando] = useState(false);

  const fins = horarios.map(horaSeguinte).filter((h) => h > inicio);
  const sessoes = useMemo(() => gerarDatasRecorrentes(dataInicio, dias, meses).length, [dataInicio, dias, meses]);

  const alternarDia = (d: DiaSemana) => setDias((atual) => (atual.includes(d) ? atual.filter((x) => x !== d) : [...atual, d].sort((a, b) => a - b)));

  async function salvar() {
    setErros([]);
    setConflitos([]);
    const faltando: string[] = [];
    if (!nome.trim()) faltando.push("Informe o nome do grupo.");
    if (!responsavel.trim()) faltando.push("Informe o responsável.");
    if (whatsapp.replace(/\D/g, "").length < 10) faltando.push("Informe o WhatsApp com DDD.");
    if (!editando && dias.length === 0) faltando.push("Escolha pelo menos um dia da semana.");
    if (!editando && fim <= inicio) faltando.push("O fim precisa ser depois do início.");
    if (faltando.length) return setErros(faltando);

    setSalvando(true);
    try {
      if (grupo) {
        const r = await aoAtualizar(grupo.id, { nome, responsavelNome: responsavel, contatoWhatsapp: whatsapp.replace(/\D/g, "") });
        if (!r.ok) return setErros([r.motivo ?? "Não foi possível salvar."]);
        aoSalvo("Grupo atualizado.");
        return;
      }
      const r = await aoCriar({
        tipo: "grupo",
        nome,
        responsavelNome: responsavel,
        contatoWhatsapp: whatsapp.replace(/\D/g, ""),
        quadraId,
        diasSemana: dias,
        horaInicio: inicio,
        horaFim: fim,
        dataInicio,
        meses,
      });
      if (!r.ok) {
        setErros(r.erros);
        setConflitos(r.conflitos ?? []);
        return;
      }
      aoSalvo(`Grupo cadastrado: ${r.totalOcorrencias} horários reservados na agenda.`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      aberta
      largura="md"
      titulo={editando ? "Editar grupo" : "Novo grupo"}
      descricao="No site, o horário do grupo aparece como “Ocupado”, igual a uma reserva comum."
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={() => void salvar()} carregando={salvando}>
            {editando ? "Salvar" : "Cadastrar grupo"}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Nome do grupo">
          {(id, inv) => <Entrada id={id} aria-invalid={inv} value={nome} placeholder="Ex.: Pelada do Marcos" maxLength={80} onChange={(e) => setNome(e.target.value)} />}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Responsável">
            {(id) => <Entrada id={id} value={responsavel} placeholder="Quem combina com a arena" maxLength={80} onChange={(e) => setResponsavel(e.target.value)} />}
          </Campo>
          <Campo rotulo="WhatsApp do responsável" ajuda="Para avisar sobre chuva ou mudanças.">
            {(id) => (
              <Entrada id={id} inputMode="tel" value={whatsapp} placeholder="(91) 99999-0000" onChange={(e) => setWhatsapp(mascaraWhatsApp(e.target.value))} />
            )}
          </Campo>
        </div>

        {editando ? (
          <Aviso tom="info">
            Para mudar a quadra, os dias ou o horário, encerre este grupo e cadastre de novo. As sessões já combinadas continuam como estão.
          </Aviso>
        ) : (
          <>
            <Campo rotulo="Quadra">
              {(id) => (
                <Selecao id={id} value={quadraId} onChange={(e) => setQuadraId(e.target.value)}>
                  {quadras.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.descricao}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <fieldset>
              <legend className="mb-1.5 block text-[15px] font-medium text-painel-tinta">Dias da semana</legend>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((d) => {
                  const marcado = dias.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      aria-pressed={marcado}
                      aria-label={d.longo}
                      onClick={() => alternarDia(d.valor)}
                      className={
                        "h-10 min-w-12 rounded-md border px-3 text-sm font-medium transition-colors " +
                        (marcado
                          ? "border-painel-destaque bg-painel-destaque text-white"
                          : "border-painel-linha-forte bg-painel-superficie text-painel-tinta hover:bg-painel-elevada")
                      }
                    >
                      {d.curto}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Começa às">
                {(id) => (
                  <Selecao
                    id={id}
                    value={inicio}
                    onChange={(e) => {
                      setInicio(e.target.value);
                      if (fim <= e.target.value) setFim(horaSeguinte(e.target.value));
                    }}
                  >
                    {horarios.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo rotulo="Termina às">
                {(id) => (
                  <Selecao id={id} value={fim} onChange={(e) => setFim(e.target.value)}>
                    {fins.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="A partir de">
                {(id) => <Entrada id={id} type="date" min={getHoje()} value={dataInicio} onChange={(e) => e.target.value && setDataInicio(e.target.value)} />}
              </Campo>
              <Campo rotulo="Por quanto tempo">
                {(id) => (
                  <Selecao id={id} value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
                    {Array.from({ length: MESES_MAXIMO_CONTRATO }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m === 1 ? "1 mês" : `${m} meses`}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
            {dias.length > 0 && (
              <p className="text-sm text-painel-suave">
                {sessoes} {sessoes === 1 ? "dia reservado" : "dias reservados"} na agenda, de {formatarDataExibicao(dataInicio)} em diante.
              </p>
            )}
          </>
        )}

        {erros.length > 0 && (
          <Aviso tom="erro" titulo="Confira antes de salvar">
            <ul className="list-disc pl-4">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            {conflitos.length > 0 && (
              <p className="mt-1">
                Já reservado: {conflitos.slice(0, 5).map((c) => `${formatarDataExibicao(c.data)} (${c.nomeCliente})`).join(", ")}
                {conflitos.length > 5 ? ` e mais ${conflitos.length - 5}` : ""}.
              </p>
            )}
          </Aviso>
        )}
      </div>
    </Janela>
  );
}
