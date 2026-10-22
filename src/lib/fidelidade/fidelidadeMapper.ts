/**
 * @file fidelidadeMapper.ts
 * @description Conversão entre as linhas das tabelas de fidelidade (snake_case) e as entidades de
 * domínio. Compartilhado pelo navegador (leituras) e pelo servidor (emissão de selos e vouchers).
 */

import type {
  CampanhaFidelidade,
  SeloFidelidade,
  VoucherFidelidade,
  StatusVoucherFidelidade,
} from "./types";
import { CAMPANHA_PADRAO } from "./fidelidadeService";

/** Linha da tabela `fidelidade_campanha`. */
export interface CampanhaDbRow {
  id: string;
  arena_id?: string | null;
  nome?: string;
  horas_necessarias?: number;
  meses_validade?: number;
  dias_validade_voucher?: number;
  ativo?: boolean;
  atualizado_em?: string;
}

/** Linha da tabela `fidelidade_selos`. */
export interface SeloDbRow {
  id: string;
  arena_id?: string | null;
  usuario_id?: string;
  reserva_id?: string;
  horas_contabilizadas?: number;
  valor_por_hora?: number | string;
  valor_total_reserva?: number | string;
  data_jogo?: string;
  criado_em?: string;
  expira_em?: string;
  resgatado?: boolean;
  voucher_id?: string | null;
}

/** Linha da tabela `fidelidade_vouchers`. */
export interface VoucherDbRow {
  id: string;
  arena_id?: string | null;
  codigo?: string;
  usuario_id?: string;
  valor_teto?: number | string;
  status?: string;
  criado_em?: string;
  expira_em?: string;
  reserva_utilizada_id?: string | null;
  utilizado_em?: string | null;
}

/**
 * Converte a linha da campanha na entidade de domínio (com padrões para campos ausentes).
 *
 * @param row Linha do banco
 * @returns Campanha de fidelidade
 */
export function rowToCampanha(row: CampanhaDbRow): CampanhaFidelidade {
  return {
    id: row.id || CAMPANHA_PADRAO.id,
    nome: row.nome || CAMPANHA_PADRAO.nome,
    horasNecessarias: row.horas_necessarias ?? CAMPANHA_PADRAO.horasNecessarias,
    mesesValidade: row.meses_validade ?? CAMPANHA_PADRAO.mesesValidade,
    diasValidadeVoucher: row.dias_validade_voucher ?? CAMPANHA_PADRAO.diasValidadeVoucher,
    ativo: row.ativo !== undefined ? row.ativo : true,
    atualizadoEm: row.atualizado_em ?? new Date().toISOString(),
  };
}

/**
 * Converte a campanha no payload da tabela, vinculado à arena.
 *
 * @param campanha Campanha de domínio
 * @param arenaId Arena dona da campanha
 * @returns Payload para insert/upsert
 */
export function campanhaToRow(campanha: CampanhaFidelidade, arenaId: string): CampanhaDbRow {
  return {
    id: campanha.id,
    arena_id: arenaId,
    nome: campanha.nome,
    horas_necessarias: campanha.horasNecessarias,
    meses_validade: campanha.mesesValidade,
    dias_validade_voucher: campanha.diasValidadeVoucher,
    ativo: campanha.ativo,
    atualizado_em: campanha.atualizadoEm,
  };
}

/**
 * Converte a linha de selo na entidade de domínio.
 *
 * @param row Linha do banco
 * @returns Selo de fidelidade
 */
export function rowToSelo(row: SeloDbRow): SeloFidelidade {
  return {
    id: row.id,
    usuarioId: row.usuario_id ?? "",
    reservaId: row.reserva_id ?? "",
    horasContabilizadas: row.horas_contabilizadas ?? 1,
    valorPorHora: Number(row.valor_por_hora ?? 0),
    valorTotalReserva: Number(row.valor_total_reserva ?? 0),
    dataJogo: row.data_jogo ?? "",
    criadoEm: row.criado_em ?? new Date().toISOString(),
    expiraEm: row.expira_em ?? "",
    resgatado: Boolean(row.resgatado),
    voucherId: row.voucher_id ?? null,
  };
}

/**
 * Converte o selo no payload da tabela, vinculado à arena.
 *
 * @param selo Selo de domínio
 * @param arenaId Arena emissora
 * @returns Payload para insert
 */
export function seloToRow(selo: SeloFidelidade, arenaId: string): SeloDbRow {
  return {
    id: selo.id,
    arena_id: arenaId,
    usuario_id: selo.usuarioId,
    reserva_id: selo.reservaId,
    horas_contabilizadas: selo.horasContabilizadas,
    valor_por_hora: selo.valorPorHora,
    valor_total_reserva: selo.valorTotalReserva,
    data_jogo: selo.dataJogo,
    criado_em: selo.criadoEm,
    expira_em: selo.expiraEm,
    resgatado: selo.resgatado,
    voucher_id: selo.voucherId,
  };
}

/**
 * Converte a linha de voucher na entidade de domínio.
 *
 * @param row Linha do banco
 * @returns Voucher de fidelidade
 */
export function rowToVoucher(row: VoucherDbRow): VoucherFidelidade {
  return {
    id: row.id,
    codigo: row.codigo || "",
    usuarioId: row.usuario_id ?? "",
    valorTeto: Number(row.valor_teto ?? 0),
    status: (row.status as StatusVoucherFidelidade) || "disponivel",
    criadoEm: row.criado_em ?? new Date().toISOString(),
    expiraEm: row.expira_em ?? "",
    reservaUtilizadaId: row.reserva_utilizada_id ?? null,
    utilizadoEm: row.utilizado_em ?? null,
  };
}

/**
 * Converte o voucher no payload da tabela, vinculado à arena.
 *
 * @param voucher Voucher de domínio
 * @param arenaId Arena emissora
 * @returns Payload para insert
 */
export function voucherToRow(voucher: VoucherFidelidade, arenaId: string): VoucherDbRow {
  return {
    id: voucher.id,
    arena_id: arenaId,
    codigo: voucher.codigo,
    usuario_id: voucher.usuarioId,
    valor_teto: voucher.valorTeto,
    status: voucher.status,
    criado_em: voucher.criadoEm,
    expira_em: voucher.expiraEm,
    reserva_utilizada_id: voucher.reservaUtilizadaId,
    utilizado_em: voucher.utilizadoEm,
  };
}
