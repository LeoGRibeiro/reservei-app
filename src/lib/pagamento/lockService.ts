/**
 * @file lockService.ts
 * @description Serviço de gerenciamento de locks transacionais temporários contra double-booking.
 * Controla a reserva temporária de horários durante o checkout e a liberação automática
 * de slots de clientes que desistiram ou não concluíram o Pix no prazo.
 */

import type { Reserva } from "@/store/useReservasStore";

/**
 * Tempo padrão de retenção de um horário durante o fluxo de checkout Pix (em minutos).
 */
export const TEMPO_PADRAO_LOCK_MINUTOS = 10;

/**
 * Verifica se um lock temporário de reserva ainda está dentro do período de validade.
 * 
 * @param reserva Objeto da reserva a ser analisado
 * @param agora Instante atual de referência (opcional, padrão: Date.now())
 * @returns true se o lock ainda estiver ativo e válido
 */
export function isLockAtivo(reserva: Reserva, agora: Date = new Date()): boolean {
  if (reserva.status !== "em_processamento") {
    return false;
  }

  // Se a reserva possuir campo explícito de expiração
  if ("expiraEm" in reserva && typeof reserva.expiraEm === "string" && reserva.expiraEm) {
    const dataExpiracao = new Date(reserva.expiraEm).getTime();
    return dataExpiracao > agora.getTime();
  }

  // Fallback baseado na data de criação da reserva + 10 minutos
  const dataCriacao = new Date(reserva.criadaEm).getTime();
  const limite = dataCriacao + TEMPO_PADRAO_LOCK_MINUTOS * 60 * 1000;
  return limite > agora.getTime();
}

/**
 * Avalia se uma reserva impede que outro cliente agende no mesmo horário.
 * 
 * Um horário é considerado ocupado se:
 * 1. A reserva estiver confirmada ou com sinal pendente de liquidação no balcão (`confirmada` | `pendente`).
 * 2. A reserva estiver em processamento com lock ativo não expirado (`em_processamento` e `expira_em > agora`).
 * 
 * Reservas canceladas ou com locks expirados NÃO bloqueiam a agenda.
 * 
 * @param reserva Reserva a ser avaliada
 * @param agora Instante atual
 * @returns true se o horário estiver efetivamente bloqueado
 */
export function isReservaOcupandoSlot(
  reserva: Reserva,
  agora: Date = new Date()
): boolean {
  if (reserva.status === "cancelada") {
    return false;
  }

  if (reserva.status === "confirmada" || reserva.status === "pendente") {
    return true;
  }

  if (reserva.status === "em_processamento") {
    return isLockAtivo(reserva, agora);
  }

  return false;
}

/**
 * Filtra e retorna todos os horários que estão indisponíveis para uma quadra e data,
 * considerando tanto reservas confirmadas quanto locks temporários ativos.
 * 
 * @param reservas Lista completa de reservas do sistema
 * @param quadraId Identificador da quadra
 * @param data Data no formato 'YYYY-MM-DD'
 * @param agora Instante de referência para expiração de locks
 * @returns Array com os horários ocupados (ex: ['19:00', '20:00'])
 */
export function filtrarHorariosOcupadosComLock(
  reservas: Reserva[],
  quadraId: string,
  data: string,
  agora: Date = new Date()
): string[] {
  const horariosOcupados = new Set<string>();

  for (const r of reservas) {
    if (r.quadraId !== quadraId || r.data !== data) {
      continue;
    }

    if (isReservaOcupandoSlot(r, agora)) {
      for (const h of r.horarios) {
        horariosOcupados.add(h);
      }
    }
  }

  return Array.from(horariosOcupados).sort();
}

/**
 * Identifica reservas com locks temporários que ultrapassaram o tempo limite
 * e devem ser limpas/canceladas no banco de dados.
 * 
 * @param reservas Lista de reservas
 * @param agora Instante atual
 * @returns Array de reservas expiradas
 */
export function identificarReservasExpiradas(
  reservas: Reserva[],
  agora: Date = new Date()
): Reserva[] {
  return reservas.filter((r) => {
    if (r.status !== "em_processamento") return false;
    return !isLockAtivo(r, agora);
  });
}

/**
 * Calcula a quantidade de segundos restantes para a expiração de um lock de pagamento.
 * Útil para alimentar cronômetros regressivos na tela de checkout Pix.
 * 
 * @param expiraEm String ISO da data de expiração
 * @param agora Instante de referência
 * @returns Segundos restantes (mínimo 0)
 */
export function calcularTempoRestanteLockSegundos(
  expiraEm?: string,
  agora: Date = new Date()
): number {
  if (!expiraEm) return 0;
  const diferencaMs = new Date(expiraEm).getTime() - agora.getTime();
  return Math.max(0, Math.floor(diferencaMs / 1000));
}

/**
 * Cria a data de expiração para um novo lock temporário de pagamento.
 * 
 * @param minutos Duração do lock em minutos (padrão: 10)
 * @param aPartirDe Instante inicial (padrão: agora)
 * @returns String no formato ISO 8601
 */
export function gerarTimestampExpiracaoLock(
  minutos: number = TEMPO_PADRAO_LOCK_MINUTOS,
  aPartirDe: Date = new Date()
): string {
  const data = new Date(aPartirDe.getTime() + minutos * 60 * 1000);
  return data.toISOString();
}

export const LockService = {
  isLockAtivo,
  isReservaOcupandoSlot,
  filtrarHorariosOcupadosComLock,
  identificarReservasExpiradas,
  calcularTempoRestanteLockSegundos,
  gerarTimestampExpiracaoLock,
};
