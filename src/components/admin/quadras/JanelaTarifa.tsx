/**
 * @file JanelaTarifa.tsx
 * @description Criar ou editar uma tarifa da quadra: nome, dias, início, fim e valor. Explica como a
 * tarifa aparece no site ("de dia" = preço das 10h; "à noite" = preço das 19h) e mostra o efeito
 * enquanto o dono preenche.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §8.3
 */

"use client";

import { useState } from "react";
import { Aviso, Botao, Campo, Entrada, Janela, Selecao } from "@/components/admin/ui";
import { DIAS_SEMANA } from "@/lib/recorrencia/types";
import { efeitoDaTarifa, HORA_DIA_SITE, HORA_NOITE_SITE } from "@/lib/arena/precosNoSite";
import type { QuadraPreco } from "@/lib/arena/types";

/** Dados do formulário de tarifa. */
export interface DadosTarifa {
  descricao: string;
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
  valorHora: number;
}

/** Valida a tarifa. */
export function validarTarifa(t: DadosTarifa): string[] {
  const erros: string[] = [];
  if (!t.descricao.trim()) erros.push("Dê um nome à tarifa (ex.: Noite).");
  if (t.diasSemana.length === 0) erros.push("Marque pelo menos um dia.");
  if (t.horaFim <= t.horaInicio) erros.push("O fim precisa ser depois do início.");
  if (!(t.valorHora > 0)) erros.push("Informe o valor da hora.");
  return erros;
}

const HORAS = Array.from({ length: 25 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

export interface JanelaTarifaProps {
  nomeQuadra: string;
  /** Tarifa em edição; ausente = nova */
  tarifa?: QuadraPreco;
  /** Valor sugerido para tarifa nova */
  valorSugerido: number;
  aoFechar: () => void;
  aoSalvar: (dados: DadosTarifa) => Promise<void>;
}

/**
 * @example
 * ```tsx
 * <JanelaTarifa nomeQuadra="Areia 1" valorSugerido={100} aoFechar={fechar} aoSalvar={salvar} />
 * ```
 */
export function JanelaTarifa({ nomeQuadra, tarifa, valorSugerido, aoFechar, aoSalvar }: JanelaTarifaProps) {
  const [dados, setDados] = useState<DadosTarifa>({
    descricao: tarifa?.descricao ?? "Noite",
    diasSemana: tarifa?.diasSemana ?? [0, 1, 2, 3, 4, 5, 6],
    horaInicio: tarifa?.horaInicio ?? "18:00",
    horaFim: tarifa?.horaFim ?? "23:00",
    valorHora: tarifa?.valorHora ?? valorSugerido,
  });
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const mudar = <K extends keyof DadosTarifa>(campo: K, valor: DadosTarifa[K]) => setDados((d) => ({ ...d, [campo]: valor }));

  async function salvar() {
    const encontrados = validarTarifa(dados);
    setErros(encontrados);
    if (encontrados.length) return;
    setSalvando(true);
    try {
      await aoSalvar({ ...dados, descricao: dados.descricao.trim(), diasSemana: [...dados.diasSemana].sort((a, b) => a - b) });
    } catch (err) {
      setErros([err instanceof Error ? err.message : "Não foi possível salvar."]);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      aberta
      titulo={tarifa ? "Editar tarifa" : "Nova tarifa"}
      descricao={nomeQuadra}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao onClick={() => void salvar()} carregando={salvando}>
            Salvar tarifa
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Aviso tom="info">
          No site, cada quadra mostra dois preços: o da hora das {HORA_DIA_SITE.slice(0, 2)}h como <strong>&ldquo;de dia&rdquo;</strong> e o das{" "}
          {HORA_NOITE_SITE.slice(0, 2)}h como <strong>&ldquo;à noite&rdquo;</strong>. Na reserva, cada horário usa a tarifa que cobre aquela hora; sem
          tarifa, vale o preço padrão da quadra.
        </Aviso>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome da tarifa" ajuda="Só aparece no painel.">
            {(id) => <Entrada id={id} value={dados.descricao} maxLength={40} placeholder="Ex.: Noite" onChange={(e) => mudar("descricao", e.target.value)} />}
          </Campo>
          <Campo rotulo="Valor da hora (R$)">
            {(id) => (
              <Entrada id={id} type="number" inputMode="decimal" min={1} step={5} value={dados.valorHora || ""} onChange={(e) => mudar("valorHora", Number(e.target.value))} />
            )}
          </Campo>
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-[15px] font-medium text-painel-tinta">Dias</legend>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((d) => {
              const marcado = dados.diasSemana.includes(d.valor);
              return (
                <button
                  key={d.valor}
                  type="button"
                  aria-pressed={marcado}
                  aria-label={d.longo}
                  onClick={() => mudar("diasSemana", marcado ? dados.diasSemana.filter((x) => x !== d.valor) : [...dados.diasSemana, d.valor])}
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
              <Selecao id={id} value={dados.horaInicio} onChange={(e) => mudar("horaInicio", e.target.value)}>
                {HORAS.slice(0, 24).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo rotulo="Termina às" ajuda="A hora do fim não entra (18:00 a 23:00 cobre 18h até 22h).">
            {(id) => (
              <Selecao id={id} value={dados.horaFim} onChange={(e) => mudar("horaFim", e.target.value)}>
                {HORAS.slice(1).map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <p className="text-sm text-painel-tinta" role="status">
          Esta tarifa {efeitoDaTarifa(dados)}.
        </p>
        {erros.length > 0 && (
          <Aviso tom="erro" titulo="Confira antes de salvar">
            <ul className="list-disc pl-4">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Aviso>
        )}
      </div>
    </Janela>
  );
}
