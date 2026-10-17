/**
 * @file usePrecoCalculado.ts
 * @description Hook React para cálculo reativo e memoizado de preços de locação
 * utilizando as regras de negócio dinâmicas da Arena e da Quadra.
 */

"use client";

import { useMemo } from "react";
import type { Quadra, QuadraPreco, CalculoPrecoResultado } from "@/lib/arena/types";
import { calcularPrecoReserva } from "@/lib/arena/arenaService";

export interface UsePrecoCalculadoParams {
  /** Quadra selecionada atualmente */
  quadra?: Quadra | null;
  /** Tabela de regras de precificação dinâmica */
  precos?: QuadraPreco[];
  /** Data da locação no formato 'YYYY-MM-DD' */
  data: string;
  /** Lista de horários selecionados (ex: ['18:00', '19:00']) */
  horarios: string[];
  /** Percentual mínimo de sinal (padrão: 50%) */
  percentualSinal?: number;
}

/**
 * Hook para cálculo reativo do valor total e sinal mínimo de uma locação.
 * 
 * @param params Parâmetros com quadra, data, horários e regras de preço
 * @returns Objeto com `valorTotal`, `valorSinal`, `valorPendente` e `detalhamento`
 * 
 * @example
 * ```tsx
 * const calculo = usePrecoCalculado({
 *   quadra: quadraSelecionada,
 *   precos: regrasPrecos,
 *   data: "2026-10-25",
 *   horarios: ["19:00", "20:00"],
 *   percentualSinal: 50,
 * });
 * console.log(calculo.valorTotal);
 * ```
 */
export function usePrecoCalculado({
  quadra,
  precos = [],
  data,
  horarios = [],
  percentualSinal = 50,
}: UsePrecoCalculadoParams): CalculoPrecoResultado {
  return useMemo(() => {
    if (!quadra || !data || !horarios || horarios.length === 0) {
      return {
        valorTotal: 0,
        valorSinal: 0,
        valorPendente: 0,
        detalhamento: [],
      };
    }

    return calcularPrecoReserva({
      quadra,
      precos,
      data,
      horarios,
      percentualSinal,
    });
  }, [quadra, precos, data, horarios, percentualSinal]);
}
