/**
 * @file Carimbos.tsx
 * @description Cartela de carimbos do Clube em dois tamanhos: a linha de bolinhas (menu da conta,
 * checkout, diálogo de conta) e as casas grandes com o logo da arena (seção Clube e Minha conta).
 */

import type { CSSProperties } from "react";

/** Giro de cada carimbo grande, para parecer carimbado à mão. */
const GIRO = [-10, 6, -4, 9, -7, 3, -12, 8, -5];

export interface CarimbosMiniProps {
  /** Carimbos já na cartela */
  cheias: number;
  /** Carimbos novos desta reserva (amarelos) */
  novas?: number;
  /** Total de casas (meta do Clube) */
  total?: number;
}

/**
 * Linha de bolinhas: azuis = carimbos, amarelas = novos, tracejadas = vazias.
 *
 * @example
 * ```tsx
 * <CarimbosMini cheias={6} />
 * ```
 */
export function CarimbosMini({ cheias, novas = 0, total = 10 }: CarimbosMiniProps) {
  return (
    <ol className="carimbos" aria-label={`${cheias + novas} de ${total} carimbos`}>
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className={i < cheias ? "on" : i < cheias + novas ? "novo" : ""} />
      ))}
    </ol>
  );
}

export interface CasasCartelaProps {
  /** Carimbos na cartela */
  cheias: number;
  /** Logo da arena (vai em cada carimbo) */
  logoUrl: string;
  /** Total de casas (meta do Clube); a última é o prêmio */
  total?: number;
}

/**
 * Casas grandes da cartela. A última casa vazia mostra o prêmio ("1h grátis").
 *
 * @example
 * ```tsx
 * <CasasCartela cheias={6} logoUrl="/arenas/minha-arena/logo.png" />
 * ```
 */
export function CasasCartela({ cheias, logoUrl, total = 10 }: CasasCartelaProps) {
  return (
    <ol className="casas" role="img" aria-label={`${cheias} de ${total} carimbos. O décimo vale 1 hora grátis.`}>
      {Array.from({ length: total }, (_, i) => {
        if (i < cheias) {
          return (
            <li key={i} className="casa on" style={{ "--r": `${GIRO[i % GIRO.length]}deg` } as CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo da arena, tamanho fixo pelo CSS */}
              <img src={logoUrl} alt="" width={388} height={374} />
            </li>
          );
        }
        if (i === total - 1) {
          return (
            <li key={i} className="casa premio">
              1h
              <br />
              grátis
            </li>
          );
        }
        return (
          <li key={i} className="casa num">
            {i + 1}
          </li>
        );
      })}
    </ol>
  );
}
