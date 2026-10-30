/**
 * @file BarraTicket.tsx
 * @description Barra azul fixa embaixo, no celular e no tablet (abaixo de 1120 px): resumo da seleção
 * e "Continuar" para o checkout. Some sem seleção.
 */

import { reais } from "@/lib/portal/formatos";
import type { ResumoSelecao } from "@/lib/portal/agenda";

export interface BarraTicketProps {
  resumo: ResumoSelecao | null;
  aoContinuar: () => void;
}

/**
 * @example
 * ```tsx
 * <BarraTicket resumo={resumo} aoContinuar={abrirCheckout} />
 * ```
 */
export function BarraTicket({ resumo, aoContinuar }: BarraTicketProps) {
  return (
    <div className="barra" id="barra" hidden={!resumo}>
      <div className="barra-txt" id="barra-txt">
        {resumo && (
          <>
            <b>
              {`${resumo.quadra.nome} · `}
              <span className="num">{`${resumo.inicio} às ${resumo.fim}`}</span>
            </b>
            <span className="num">{`Sinal ${reais(resumo.sinal)} · total ${reais(resumo.total)}`}</span>
          </>
        )}
      </div>
      <button type="button" className="btn-amarelo" onClick={aoContinuar}>
        Continuar
      </button>
    </div>
  );
}
