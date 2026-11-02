/**
 * @file HorariosAntigos.tsx
 * @description Aviso "Horários antigos sem escolinha": contratos de escolinha cadastrados no
 * formulário antigo (sem escolinha do site). Nada some sem o dono decidir: cada horário pode ser
 * **ligado a uma escolinha** (vira turma dela, com o mesmo contrato e as mesmas sessões na agenda) ou
 * **encerrado** (libera a agenda de hoje em diante).
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §4
 */

"use client";

import { useState } from "react";
import { Aviso, Botao, Confirmacao, Selecao } from "@/components/admin/ui";
import { textoDias, textoHoras, tituloEscolinha, type EscolinhaSite } from "@/lib/institucional/escolinhasSite";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";

export interface HorariosAntigosProps {
  contratos: ContratoRecorrente[];
  escolinhas: EscolinhaSite[];
  /** Nome da quadra pelo id */
  nomeQuadra: (id: string) => string;
  aoLigar: (contrato: ContratoRecorrente, escolinha: EscolinhaSite) => Promise<void>;
  aoEncerrar: (contrato: ContratoRecorrente) => Promise<void>;
}

/**
 * @example
 * ```tsx
 * <HorariosAntigos contratos={antigos} escolinhas={escolinhas} nomeQuadra={nome} aoLigar={ligar} aoEncerrar={encerrar} />
 * ```
 */
export function HorariosAntigos({ contratos, escolinhas, nomeQuadra, aoLigar, aoEncerrar }: HorariosAntigosProps) {
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState<ContratoRecorrente | null>(null);

  if (contratos.length === 0) return null;

  /** Escolinha sugerida: a do próprio contrato, quando ainda existe; senão a primeira. */
  const sugerida = (c: ContratoRecorrente) => destino[c.id] ?? (escolinhas.some((e) => e.id === c.escolinhaId) ? c.escolinhaId! : escolinhas[0]?.id);

  async function ligar(c: ContratoRecorrente) {
    const escolinha = escolinhas.find((e) => e.id === sugerida(c));
    if (!escolinha) return;
    setOcupado(c.id);
    try {
      await aoLigar(c, escolinha);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Aviso tom="atencao" titulo={`Horários antigos sem escolinha (${contratos.length})`}>
      <p>
        Estes horários de aula foram cadastrados no formulário antigo e não aparecem em nenhuma escolinha do site. Eles
        continuam bloqueando a agenda. Ligue cada um a uma escolinha (vira uma turma dela) ou encerre.
      </p>
      <ul className="mt-3 divide-y divide-amber-200 rounded-md border border-amber-200 bg-white/70">
        {contratos.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between" aria-label={`Horário antigo ${c.nome}`}>
            <div className="min-w-0 text-painel-tinta">
              <p className="font-semibold">{c.nome}</p>
              <p className="text-xs text-painel-suave">
                {textoDias(c.diasSemana)} · {textoHoras(c.horaInicio, c.horaFim)} · {nomeQuadra(c.quadraId)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {escolinhas.length > 0 ? (
                <>
                  <Selecao
                    aria-label={`Escolinha para ${c.nome}`}
                    className="w-auto min-w-44"
                    value={sugerida(c)}
                    onChange={(e) => setDestino((d) => ({ ...d, [c.id]: e.target.value }))}
                  >
                    {escolinhas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {tituloEscolinha(e)}
                      </option>
                    ))}
                  </Selecao>
                  <Botao variante="secundario" carregando={ocupado === c.id} onClick={() => void ligar(c)}>
                    Ligar à escolinha
                  </Botao>
                </>
              ) : (
                <span className="text-xs text-painel-suave">Cadastre uma escolinha para ligar este horário.</span>
              )}
              <Botao variante="perigo" onClick={() => setEncerrando(c)} disabled={ocupado === c.id}>
                Encerrar
              </Botao>
            </div>
          </li>
        ))}
      </ul>
      <Confirmacao
        aberta={!!encerrando}
        titulo="Encerrar este horário?"
        rotuloConfirmar="Encerrar e liberar a agenda"
        aoFechar={() => setEncerrando(null)}
        aoConfirmar={async () => {
          if (!encerrando) return;
          await aoEncerrar(encerrando);
          setEncerrando(null);
        }}
      >
        {encerrando && (
          <>
            As aulas de &ldquo;{encerrando.nome}&rdquo; ({textoDias(encerrando.diasSemana)} ·{" "}
            {textoHoras(encerrando.horaInicio, encerrando.horaFim)}) deixam de bloquear a agenda de hoje em diante.
          </>
        )}
      </Confirmacao>
    </Aviso>
  );
}
