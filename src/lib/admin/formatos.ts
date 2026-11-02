/**
 * @module admin/formatos
 *
 * Formatação única do painel: dinheiro, datas por extenso, telefones e status de reserva com nome de
 * negócio. Toda tela do admin usa estas funções, para que "R$ 80,00", "domingo, 1 de novembro de 2026"
 * e "Sinal pago" apareçam sempre iguais.
 *
 * @see SPEC/2026-11-02-admin-revisao.md §3.2
 */

import type { Reserva } from "@/store/useReservasStore";

/**
 * Valor em reais no padrão brasileiro.
 *
 * @example
 * ```ts
 * moeda(80); // "R$ 80,00"
 * ```
 */
export function moeda(valor: number | string | null | undefined): string {
  const num = Number(valor);
  // Espaço comum no lugar do não separável do Intl: igual na tela, nos testes e ao copiar
  return (Number.isFinite(num) ? num : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

function dataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

/**
 * Data por extenso, em minúsculas como no português ("domingo, 1 de novembro de 2026").
 *
 * @param iso Data "YYYY-MM-DD" (ou ISO completo; só a data é usada)
 * @param comAno Inclui o ano (padrão: sim)
 */
export function dataExtensa(iso: string, comAno = true): string {
  return dataLocal(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(comAno ? { year: "numeric" } : {}),
  });
}

/**
 * Data curta com dia da semana ("dom, 01/11").
 *
 * @param iso Data "YYYY-MM-DD"
 */
export function dataCurta(iso: string): string {
  const d = dataLocal(iso);
  const semana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${semana}, ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

/**
 * Data e hora de um instante ISO ("31/10 às 12:00").
 *
 * @param iso Instante ISO
 */
export function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora}`;
}

/**
 * Telefone brasileiro legível. Aceita com ou sem o 55 do país.
 *
 * @example
 * ```ts
 * telefone("5591984982865"); // "(91) 98498-2865"
 * ```
 */
export function telefone(bruto: string | null | undefined): string {
  let d = (bruto ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto ?? "";
}

/** Link de conversa no WhatsApp para um telefone brasileiro (com mensagem opcional). */
export function linkWhatsApp(bruto: string, mensagem?: string): string {
  let d = (bruto ?? "").replace(/\D/g, "");
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}

/** Tom visual de um status (cada tom tem uma cor fixa no componente de status). */
export type TomStatus = "neutro" | "aguardando" | "sinal" | "quitada" | "cancelada" | "bloqueio" | "fixo";

/** Status de uma reserva como o dono entende. */
export interface DescricaoStatus {
  rotulo: string;
  tom: TomStatus;
}

/**
 * Status com nome de negócio. "pendente" no banco é "sinal pago, falta o resto"; "confirmada" é
 * "quitada"; aulas e grupos mostram o tipo; bloqueios aparecem como bloqueados.
 *
 * @param reserva Reserva da agenda
 * @returns Rótulo e tom
 *
 * @example
 * ```ts
 * descreverStatus({ status: "pendente", valorPendente: 50 }); // { rotulo: "Sinal pago · falta R$ 50,00", tom: "sinal" }
 * ```
 */
export function descreverStatus(
  reserva: Pick<Reserva, "status" | "valorPendente" | "tipoReserva" | "pagamentoInformadoEm"> & { valorTotal?: number }
): DescricaoStatus {
  if (reserva.tipoReserva === "manutencao_bloqueio") return { rotulo: "Bloqueado", tom: "bloqueio" };
  if (reserva.status === "cancelada") return { rotulo: "Cancelada", tom: "cancelada" };
  if (reserva.tipoReserva === "escolinha") return { rotulo: "Aula", tom: "fixo" };
  if (reserva.tipoReserva === "grupo") return { rotulo: "Grupo", tom: "fixo" };
  if (reserva.status === "em_processamento") {
    return reserva.pagamentoInformadoEm
      ? { rotulo: "Pix informado · conferir", tom: "aguardando" }
      : { rotulo: "Aguardando Pix", tom: "aguardando" };
  }
  const falta = Number(reserva.valorPendente) || 0;
  if (reserva.status === "pendente" && falta > 0) {
    const nadaPago = (Number(reserva.valorTotal) || 0) - falta <= 0.009;
    return { rotulo: `${nadaPago ? "A pagar" : "Sinal pago"} · falta ${moeda(falta)}`, tom: "sinal" };
  }
  return { rotulo: "Quitada", tom: "quitada" };
}

/**
 * Percentual pago de uma reserva (0 a 100), a partir dos valores dela, nunca de um número fixo.
 *
 * @param reserva Valores da reserva
 */
export function percentualPago(reserva: Pick<Reserva, "valorTotal" | "valorSinal" | "valorPendente">): number {
  const total = Number(reserva.valorTotal) || 0;
  if (total <= 0) return 100;
  const pago = Math.max(0, total - (Number(reserva.valorPendente) || 0));
  return Math.round((pago / total) * 100);
}
