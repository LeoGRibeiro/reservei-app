/**
 * @file ics.ts
 * @description Arquivo de agenda (.ics, RFC 5545) para o botão "Adicionar à agenda" do portal.
 */

import { instanteNoFuso } from "@/lib/datas/fusoHorario";
import { hh } from "./formatos";

/** Dados do jogo para a agenda. */
export interface JogoAgenda {
  /** Identificador único (id da reserva) */
  id: string;
  /** 'AAAA-MM-DD' */
  data: string;
  /** Horas de início dos horários reservados (ex.: [19, 20]) */
  horas: number[];
  quadra: string;
  arena: string;
  endereco: string;
  fuso?: string;
}

/** Escapa texto para uma propriedade do .ics (vírgula, ponto e vírgula, barra e quebra de linha). */
function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Instante em UTC no formato do .ics (AAAAMMDDTHHMMSSZ). */
function utcIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Monta o conteúdo do .ics de um jogo, com início e fim convertidos do fuso da arena para UTC.
 *
 * @param jogo Dados do jogo
 * @param agora Instante da criação (DTSTAMP)
 * @returns Texto do arquivo, com quebras CRLF
 *
 * @example
 * ```ts
 * montarIcs({ id: "r1", data: "2026-10-31", horas: [19, 20], quadra: "Areia 2", arena: "Arena X", endereco: "Rua A, 1" });
 * ```
 */
export function montarIcs(jogo: JogoAgenda, agora: Date = new Date()): string {
  const fuso = jogo.fuso ?? "America/Belem";
  const inicio = instanteNoFuso(jogo.data, hh(jogo.horas[0]), fuso);
  const fim = instanteNoFuso(jogo.data, hh(jogo.horas[jogo.horas.length - 1]), fuso);
  fim.setUTCHours(fim.getUTCHours() + 1);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MarcArena//Portal da arena//PT",
    "BEGIN:VEVENT",
    `UID:${jogo.id}@marcarena`,
    `DTSTAMP:${utcIcs(agora)}`,
    `DTSTART:${utcIcs(inicio)}`,
    `DTEND:${utcIcs(fim)}`,
    `SUMMARY:${escaparIcs(`${jogo.quadra} · ${jogo.arena}`)}`,
    `LOCATION:${escaparIcs(jogo.endereco)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Baixa o .ics no navegador.
 *
 * @param conteudo Texto de {@link montarIcs}
 * @param nomeArquivo Nome do arquivo (ex.: "reserva-minha-arena.ics")
 */
export function baixarIcs(conteudo: string, nomeArquivo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
