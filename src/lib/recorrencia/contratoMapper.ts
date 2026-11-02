/**
 * Mapeamento entre a tabela `contratos_recorrentes` (snake_case) e a entidade ContratoRecorrente.
 */

import type { Esporte } from "@/lib/quadras";
import type { ContratoRecorrente, DiaSemana, TipoContrato } from "./types";

export interface ContratoDbRow {
  id: string;
  tipo: string;
  nome: string;
  esporte?: string | null;
  descricao?: string | null;
  responsavel_nome: string;
  contato_whatsapp: string;
  quadra_id: string;
  dias_semana: number[] | string;
  hora_inicio: string;
  hora_fim: string;
  data_inicio: string;
  meses: number | string;
  foto_url?: string | null;
  faixa_etaria?: string | null;
  escolinha_id?: string | null;
  ativo: boolean;
  criado_em?: string;
}

/** Aceita array nativo ou literal do Postgres ("{1,3}") */
function parseDiasSemana(valor: number[] | string): DiaSemana[] {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor)
        .replace(/[{}[\]]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number);

  return lista.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) as DiaSemana[];
}

export function rowToContrato(row: ContratoDbRow): ContratoRecorrente {
  return {
    id: row.id,
    tipo: row.tipo as TipoContrato,
    nome: row.nome,
    esporte: (row.esporte as Esporte) || undefined,
    descricao: row.descricao || undefined,
    responsavelNome: row.responsavel_nome,
    contatoWhatsapp: row.contato_whatsapp,
    quadraId: row.quadra_id,
    diasSemana: parseDiasSemana(row.dias_semana),
    horaInicio: row.hora_inicio,
    horaFim: row.hora_fim,
    dataInicio: typeof row.data_inicio === "string" ? row.data_inicio.split("T")[0] : String(row.data_inicio),
    meses: Number(row.meses),
    fotoUrl: row.foto_url || undefined,
    faixaEtaria: row.faixa_etaria || undefined,
    escolinhaId: row.escolinha_id || undefined,
    ativo: Boolean(row.ativo),
    criadoEm: row.criado_em ?? new Date().toISOString(),
  };
}

export function contratoToRow(contrato: Partial<ContratoRecorrente>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (contrato.id !== undefined) row.id = contrato.id;
  if (contrato.tipo !== undefined) row.tipo = contrato.tipo;
  if (contrato.nome !== undefined) row.nome = contrato.nome;
  if (contrato.esporte !== undefined) row.esporte = contrato.esporte ?? null;
  if (contrato.descricao !== undefined) row.descricao = contrato.descricao ?? null;
  if (contrato.responsavelNome !== undefined) row.responsavel_nome = contrato.responsavelNome;
  if (contrato.contatoWhatsapp !== undefined) row.contato_whatsapp = contrato.contatoWhatsapp;
  if (contrato.quadraId !== undefined) row.quadra_id = contrato.quadraId;
  if (contrato.diasSemana !== undefined) row.dias_semana = contrato.diasSemana;
  if (contrato.horaInicio !== undefined) row.hora_inicio = contrato.horaInicio;
  if (contrato.horaFim !== undefined) row.hora_fim = contrato.horaFim;
  if (contrato.dataInicio !== undefined) row.data_inicio = contrato.dataInicio;
  if (contrato.meses !== undefined) row.meses = contrato.meses;
  if (contrato.fotoUrl !== undefined) row.foto_url = contrato.fotoUrl ?? null;
  if (contrato.faixaEtaria !== undefined) row.faixa_etaria = contrato.faixaEtaria ?? null;
  if (contrato.escolinhaId !== undefined) row.escolinha_id = contrato.escolinhaId ?? null;
  if (contrato.ativo !== undefined) row.ativo = contrato.ativo;
  if (contrato.criadoEm !== undefined) row.criado_em = contrato.criadoEm;

  return row;
}
