/**
 * @file CanhotoData.tsx
 * @description Canhoto azul dos ingressos (eventos e reservas): dia da semana, dia, mês e, nas
 * reservas, a hora de início. O recorte e o picote vêm do CSS do container (`.ev` ou `.rsv`).
 */

export interface CanhotoDataProps {
  /** `ev-data` (eventos) ou `rsv-data` (reservas) */
  className: "ev-data" | "rsv-data";
  /** Dia da semana abreviado (ex.: "Sáb") */
  semana: string;
  /** Dia do mês */
  dia: number;
  /** Mês abreviado (ex.: "Nov", "out") */
  mes: string;
  /** Hora de início (só reservas, ex.: "19:00") */
  hora?: string;
}

/**
 * @example
 * ```tsx
 * <CanhotoData className="rsv-data" semana="Seg" dia={31} mes="out" hora="19:00" />
 * ```
 */
export function CanhotoData({ className, semana, dia, mes, hora }: CanhotoDataProps) {
  return (
    <p className={className}>
      <span>{semana}</span>
      <b className="num">{dia}</b>
      <span>{mes}</span>
      {hora && <small className="num">{hora}</small>}
    </p>
  );
}
