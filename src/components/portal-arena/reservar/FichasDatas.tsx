/**
 * @file FichasDatas.tsx
 * @description Fichas de data (hoje + 30 dias) com marcador de mês, fim de semana em vermelho e setas
 * no computador. As setas rolam o trilho e se desligam nas pontas.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MES_CURTO, SEM_CURTA, diaLongo, paraData } from "@/lib/portal/formatos";
import { Icone } from "../Icone";

export interface FichasDatasProps {
  /** Datas ISO das fichas */
  dias: string[];
  /** Data selecionada */
  selecionado: string;
  /** Hoje (para os rótulos "Hoje") */
  hoje: string;
  /** Escolhe um dia */
  aoEscolher: (dia: string) => void;
}

/**
 * @example
 * ```tsx
 * <FichasDatas dias={diasDaGrade(hoje)} selecionado={dia} hoje={hoje} aoEscolher={setDia} />
 * ```
 */
export function FichasDatas({ dias, selecionado, hoje, aoEscolher }: FichasDatasProps) {
  const trilho = useRef<HTMLDivElement>(null);
  const [pontas, setPontas] = useState({ inicio: true, fim: false });

  const atualizarSetas = useCallback(() => {
    const t = trilho.current;
    if (!t) return;
    setPontas({ inicio: t.scrollLeft <= 2, fim: t.scrollLeft + t.clientWidth >= t.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    atualizarSetas();
  }, [atualizarSetas, dias]);

  const rolar = (direcao: number) => {
    const t = trilho.current;
    if (t) t.scrollBy({ left: direcao * t.clientWidth * 0.8, behavior: "smooth" });
  };

  const itens = dias.flatMap((iso, i) => {
    const d = paraData(iso);
    const dow = d.getDay();
    const saida = [];
    // Marcador de mês antes do primeiro dia de cada mês
    if (i === 0 || paraData(dias[i - 1]).getMonth() !== d.getMonth()) {
      saida.push(
        <span key={`mes-${iso}`} className="mes" aria-hidden="true">
          {MES_CURTO[d.getMonth()]}
        </span>
      );
    }
    saida.push(
      <button
        key={iso}
        type="button"
        className={dow === 0 || dow === 6 ? "dia fds" : "dia"}
        data-dia={iso}
        aria-pressed={iso === selecionado}
        aria-label={diaLongo(iso, hoje)}
        onClick={() => iso !== selecionado && aoEscolher(iso)}
      >
        <span>{i === 0 ? "Hoje" : SEM_CURTA[dow]}</span>
        <b className="num">{d.getDate()}</b>
      </button>
    );
    return saida;
  });

  return (
    <div className="datas">
      <button type="button" className="seta" data-dir="-1" aria-label="Dias anteriores" disabled={pontas.inicio} onClick={() => rolar(-1)}>
        <Icone nome="chevron-left" />
      </button>
      <div className="trilho" id="trilho" role="group" aria-label="Escolha o dia" ref={trilho} onScroll={atualizarSetas}>
        {itens}
      </div>
      <button type="button" className="seta" data-dir="1" aria-label="Próximos dias" disabled={pontas.fim} onClick={() => rolar(1)}>
        <Icone nome="chevron-right" />
      </button>
    </div>
  );
}
