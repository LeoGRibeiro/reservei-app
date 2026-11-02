/**
 * @module hooks/useAgendaEscolinha
 *
 * Liga as turmas da escolinha do site à agenda: depois de salvar a escolinha, cria os contratos
 * recorrentes das turmas marcadas com "Bloquear na agenda", encerra os de turmas removidas,
 * desmarcadas ou alteradas (dia, horário ou quadra) e atualiza nome e contato dos que continuam.
 * Usa as mesmas regras do cadastro de contratos (validação, conflito com reservas, ocorrências).
 *
 * @example
 * ```tsx
 * const { sincronizarAgenda, liberarAgenda } = useAgendaEscolinha();
 * const { turmas, falhas } = await sincronizarAgenda(salva, turmasAntes, periodo, whatsappArena);
 * ```
 */

"use client";

import { useCallback } from "react";
import { useContratosService } from "@/hooks/useContratosService";
import {
  esporteDoContrato,
  normalizarWhatsApp,
  planejarAgenda,
  tituloEscolinha,
  type EscolinhaSite,
  type PeriodoAgenda,
  type TurmaSite,
} from "@/lib/institucional/escolinhasSite";

/** Resultado da sincronização com a agenda. */
export interface ResultadoAgenda {
  /** Turmas com o `contratoId` de cada uma atualizado (gravar de volta na escolinha) */
  turmas: TurmaSite[];
  /** Turmas novas bloqueadas na agenda */
  criadas: number;
  /** Contratos encerrados (horários liberados de hoje em diante) */
  encerradas: number;
  /** Mensagens das turmas que não puderam ser bloqueadas (ex.: conflito com reservas) */
  falhas: string[];
}

export function useAgendaEscolinha() {
  const { criarContrato, atualizarContrato, encerrarContrato } = useContratosService();

  const sincronizarAgenda = useCallback(
    async (
      escolinha: EscolinhaSite,
      turmasAntes: readonly TurmaSite[],
      periodo: PeriodoAgenda,
      whatsappArena: string
    ): Promise<ResultadoAgenda> => {
      const plano = planejarAgenda(turmasAntes, escolinha.turmas);
      const turmas = escolinha.turmas.map((t) => ({ ...t, contratoId: t.bloquearAgenda ? t.contratoId : "" }));
      const falhas: string[] = [];
      let encerradas = 0;
      let criadas = 0;

      for (const id of plano.encerrar) {
        if ((await encerrarContrato(id)).ok) encerradas++;
      }

      // A agenda guarda o número nacional (DDD + número), como no cadastro de contratos
      const contato = (normalizarWhatsApp(escolinha.whatsapp) || whatsappArena).replace(/^55(?=\d{10,11}$)/, "");
      const cadastro = {
        nome: tituloEscolinha(escolinha),
        responsavelNome: escolinha.professor,
        contatoWhatsapp: contato,
        descricao: escolinha.descricao,
        escolinhaId: escolinha.id,
      };

      for (const i of plano.manter) {
        await atualizarContrato(turmas[i].contratoId, cadastro);
      }

      for (const i of plano.criar) {
        const t = turmas[i];
        const resultado = await criarContrato({
          tipo: "escolinha",
          ...cadastro,
          descricao: escolinha.descricao || undefined,
          esporte: esporteDoContrato(escolinha.esporte),
          quadraId: t.quadraId,
          diasSemana: t.diasSemana,
          horaInicio: t.horaInicio,
          horaFim: t.horaFim,
          dataInicio: periodo.dataInicio,
          meses: periodo.meses,
        });
        if (resultado.ok) {
          t.contratoId = resultado.contrato.id;
          criadas++;
        } else {
          t.contratoId = "";
          falhas.push(`Turma ${i + 1} (${t.dias} ${t.horas}): ${resultado.erros.join(" ")}`);
        }
      }

      return { turmas, criadas, encerradas, falhas };
    },
    [atualizarContrato, criarContrato, encerrarContrato]
  );

  /** Encerra os contratos de todas as turmas (ao excluir a escolinha). */
  const liberarAgenda = useCallback(
    async (turmas: readonly TurmaSite[]): Promise<number> => {
      let encerradas = 0;
      for (const t of turmas) {
        if (t.contratoId && (await encerrarContrato(t.contratoId)).ok) encerradas++;
      }
      return encerradas;
    },
    [encerrarContrato]
  );

  return { sincronizarAgenda, liberarAgenda };
}
