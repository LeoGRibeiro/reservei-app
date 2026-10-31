/**
 * @file regrasCodigo.ts
 * @description Regras do código de acesso pelo WhatsApp (SPEC/2026-10-30-implementacao-template-portal.md §5.1):
 * vale 10 minutos e uma vez, até 5 tentativas, no máximo 1 envio a cada 30 s e poucos por hora,
 * por número e por IP. Funções puras (o serviço do servidor lê o histórico e grava o resultado).
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** Validade do código. */
export const VALIDADE_CODIGO_MIN = 10;
/** Tentativas por código. */
export const MAX_TENTATIVAS = 5;
/** Espera entre dois envios para o mesmo número. */
export const INTERVALO_REENVIO_S = 30;
/** Envios por hora para o mesmo número. */
export const MAX_ENVIOS_HORA_TELEFONE = 5;
/** Envios por hora para o mesmo IP (vários atletas na mesma rede, como a da arena). */
export const MAX_ENVIOS_HORA_IP = 20;

/** Registro de um código enviado (linha de `codigos_acesso`). */
export interface RegistroCodigo {
  id: number;
  telefone: string;
  ip: string | null;
  codigoHash: string;
  tentativas: number;
  criadoEm: Date;
  expiraEm: Date;
  usadoEm: Date | null;
}

/** Resultado da checagem de envio. */
export type PermissaoEnvio = { ok: true } | { ok: false; motivo: string; esperarSegundos?: number };

/**
 * Pode mandar um código novo agora?
 *
 * @param porTelefone Envios recentes para o número (última hora)
 * @param porIp Envios recentes do IP (última hora)
 * @param agora Instante atual
 */
export function podeEnviarCodigo(porTelefone: RegistroCodigo[], porIp: RegistroCodigo[], agora: Date): PermissaoEnvio {
  const umaHoraAtras = agora.getTime() - 3_600_000;
  const recentesTel = porTelefone.filter((r) => r.criadoEm.getTime() > umaHoraAtras);
  const recentesIp = porIp.filter((r) => r.criadoEm.getTime() > umaHoraAtras);
  const ultimo = recentesTel.reduce<RegistroCodigo | null>((m, r) => (!m || r.criadoEm > m.criadoEm ? r : m), null);
  if (ultimo) {
    const desde = Math.floor((agora.getTime() - ultimo.criadoEm.getTime()) / 1000);
    if (desde < INTERVALO_REENVIO_S) {
      const esperar = INTERVALO_REENVIO_S - desde;
      return { ok: false, motivo: `Espere ${esperar} segundos para pedir outro código.`, esperarSegundos: esperar };
    }
  }
  if (recentesTel.length >= MAX_ENVIOS_HORA_TELEFONE || recentesIp.length >= MAX_ENVIOS_HORA_IP) {
    return { ok: false, motivo: "Muitos códigos pedidos em pouco tempo. Tente de novo daqui a uma hora." };
  }
  return { ok: true };
}

/** Hash do código (nunca se guarda o código em texto). O telefone entra no sal. */
export function hashCodigo(codigo: string, telefone: string): string {
  return createHash("sha256").update(`${telefone}:${codigo}`).digest("hex");
}

/** Resultado da conferência do código. */
export type ResultadoTentativa = { ok: true } | { ok: false; motivo: string; esgotou: boolean };

/**
 * Confere um código digitado contra o último código enviado ao número.
 *
 * @param registro Último código do número (ou null)
 * @param codigoDigitado 6 números
 * @param agora Instante atual
 */
export function conferirCodigo(registro: RegistroCodigo | null, codigoDigitado: string, agora: Date): ResultadoTentativa {
  if (!registro || registro.usadoEm) return { ok: false, motivo: "Peça um código novo.", esgotou: true };
  if (registro.expiraEm.getTime() <= agora.getTime()) return { ok: false, motivo: "O código venceu. Peça um novo.", esgotou: true };
  if (registro.tentativas >= MAX_TENTATIVAS) {
    return { ok: false, motivo: "Tentativas esgotadas. Peça um código novo.", esgotou: true };
  }
  const esperado = Buffer.from(registro.codigoHash, "hex");
  const digitado = Buffer.from(hashCodigo(codigoDigitado, registro.telefone), "hex");
  if (esperado.length === digitado.length && timingSafeEqual(esperado, digitado)) return { ok: true };
  const restam = MAX_TENTATIVAS - registro.tentativas - 1;
  return restam > 0
    ? { ok: false, motivo: `Código errado. ${restam === 1 ? "Resta 1 tentativa" : `Restam ${restam} tentativas`}.`, esgotou: false }
    : { ok: false, motivo: "Código errado. Tentativas esgotadas: peça um código novo.", esgotou: true };
}

/** WhatsApp só com dígitos, sem o DDI 55 (formato de `usuarios.telefone`). */
export function normalizarTelefone(bruto: unknown): string {
  const d = String(bruto ?? "").replace(/\D/g, "");
  return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
}
