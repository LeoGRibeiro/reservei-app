/**
 * @file CardQuadra.tsx
 * @description Card de uma quadra: foto com enquadramento, nome, esportes, preço de dia e de noite e
 * todos os horários do dia em Manhã, Tarde e Noite (no celular, grade de 4 sem rótulo, pelo CSS).
 *
 * No computador a grade tem sempre o mesmo tamanho: horários que já começaram aparecem como
 * "Encerrado" e os que estão dentro da antecedência da arena como "Indisponível" (tocar mostra o
 * motivo). No celular os encerrados somem (CSS) e fica uma linha dizendo até que horas já passou,
 * para a seção não ocupar várias telas.
 */

"use client";

import { useState } from "react";

import { hh, lista, maiuscula, reais, esporteNaFrase } from "@/lib/portal/formatos";
import type { Periodo, SituacaoHorario } from "@/lib/portal/agenda";
import type { QuadraPortal } from "@/lib/portal/types";
import { Icone } from "../Icone";

export interface CardQuadraProps {
  quadra: QuadraPortal;
  /** Posição na lista (as duas primeiras fotos carregam já) */
  indice: number;
  periodos: Periodo[];
  /** Situação de cada hora do dia */
  situacao: (h: number) => SituacaoHorario;
  /** Preço de cada hora do dia */
  preco: (h: number) => number;
  /** Horas selecionadas nesta quadra */
  selecionadas: number[];
  /** Toque num horário livre ou selecionado */
  aoAlternar: (h: number) => void;
  /** Toque num horário de aula (leva até a turma) */
  aoVerAula: (escolinhaId?: string) => void;
  /** Toque em "Sua reserva" (leva até a reserva na conta) */
  aoVerReserva: (reservaId: string) => void;
}

/** Texto dos esportes: "Futevôlei, vôlei e beach tennis". */
export function textoEsportes(esportes: string[]): string {
  return maiuscula(lista(esportes.map((e) => e.toLowerCase())));
}

/**
 * @example
 * ```tsx
 * <CardQuadra quadra={q} indice={0} periodos={periodos} situacao={(h) => ...} preco={(h) => ...}
 *   selecionadas={[19, 20]} aoAlternar={...} aoVerAula={...} aoVerReserva={...} />
 * ```
 */
export function CardQuadra({ quadra, indice, periodos, situacao, preco, selecionadas, aoAlternar, aoVerAula, aoVerReserva }: CardQuadraProps) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const blocos = periodos
    .map((p) => {
      const slots = p.horas.flatMap((h) => {
        const s = situacao(h);
        const faixa = `${hh(h)} às ${hh(h + 1)}`;
        if (s.tipo === "encerrado") {
          return [
            <button key={h} type="button" className="slot encerrado" disabled aria-label={`${faixa}, encerrado`}>
              <b className="num">{hh(h)}</b>
              <span>Encerrado</span>
            </button>,
          ];
        }
        if (s.tipo === "indisponivel") {
          return [
            <button
              key={h}
              type="button"
              className="slot indisponivel"
              aria-disabled="true"
              title={s.motivo}
              aria-label={`${faixa}, indisponível. ${s.motivo}`}
              onClick={() => setMotivo(`${hh(h)} · ${s.motivo}`)}
            >
              <b className="num">{hh(h)}</b>
              <span>Indisponível</span>
            </button>,
          ];
        }
        if (s.tipo === "livre") {
          const valor = reais(preco(h));
          const sel = selecionadas.includes(h);
          return [
            <button
              key={h}
              type="button"
              className={`slot ${sel ? "sel" : "livre"}`}
              data-q={quadra.id}
              data-h={h}
              aria-pressed={sel}
              aria-label={`${faixa}, ${valor}`}
              onClick={() => aoAlternar(h)}
            >
              <b className="num">{hh(h)}</b>
              <span className="num">
                <Icone nome="check" className="slot-ok" />
                {valor}
              </span>
            </button>,
          ];
        }
        if (s.tipo === "ocupado") {
          return [
            <button key={h} type="button" className="slot ocupado" disabled aria-label={`${faixa}, ocupado`}>
              <b className="num">{hh(h)}</b>
              <span>Ocupado</span>
            </button>,
          ];
        }
        if (s.tipo === "meu") {
          return [
            <button key={h} type="button" className="slot meu" aria-label={`${faixa}, sua reserva. Ver em Minhas reservas`}
              onClick={() => aoVerReserva(s.reservaId)}>
              <b className="num">{hh(h)}</b>
              <span>Sua reserva</span>
            </button>,
          ];
        }
        const nome = esporteNaFrase(s.esporte ? maiuscula(s.esporte.toLowerCase()) : "");
        return [
          <button key={h} type="button" className="slot aula" title={`Aula de ${nome}`} aria-label={`${faixa}, aula de ${nome}. Ver a turma`}
            onClick={() => aoVerAula(s.escolinhaId)}>
            <b className="num">{hh(h)}</b>
            <span>
              <Icone nome="graduation-cap" />
              Aula
            </span>
          </button>,
        ];
      });
      return slots.length ? (
        <div key={p.nome} className="periodo">
          <span className="p-nome">{p.nome}</span>
          <div className="slots">{slots}</div>
        </div>
      ) : null;
    })
    .filter(Boolean);

  const dia = preco(10);
  const noite = preco(19);
  const encerrados = periodos.flatMap((p) => p.horas).filter((h) => situacao(h).tipo === "encerrado");
  const ultimoEncerrado = encerrados.length ? Math.max(...encerrados) : null;
  const todosEncerrados = encerrados.length > 0 && encerrados.length === periodos.reduce((n, p) => n + p.horas.length, 0);

  return (
    <article className="quadra" id={`q-${quadra.id}`} aria-labelledby={`qt-${quadra.id}`}>
      <div className="q-foto">
        {quadra.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- foto em object-fit com enquadramento do banco
          <img
            src={quadra.fotoUrl}
            alt={quadra.fotoDescricao ?? quadra.nome}
            width={680}
            height={510}
            style={quadra.fotoPosicao ? { objectPosition: quadra.fotoPosicao } : undefined}
            loading={indice > 1 ? "lazy" : undefined}
          />
        )}
      </div>
      <div className="q-corpo">
        <div className="q-topo">
          <div>
            <h3 id={`qt-${quadra.id}`}>{quadra.nome}</h3>
            <p className="q-esportes">{textoEsportes(quadra.esportes)}</p>
          </div>
          {dia === noite ? (
            <p className="q-preco num">
              <b>{reais(dia)}</b> a hora
            </p>
          ) : (
            <p className="q-preco num">
              <b>{reais(dia)}</b> de dia · <b>{reais(noite)}</b> à noite
            </p>
          )}
        </div>
        {ultimoEncerrado !== null && (
          <p className="q-passados">
            {todosEncerrados ? "Os horários de hoje já passaram nesta quadra." : `Horários até ${hh(ultimoEncerrado)} já passaram.`}
          </p>
        )}
        <div className="periodos">{blocos.length ? blocos : <p className="q-sem">Não há mais horários hoje nesta quadra.</p>}</div>
        {motivo && (
          <p className="q-motivo" role="status">
            {motivo}
          </p>
        )}
      </div>
    </article>
  );
}
