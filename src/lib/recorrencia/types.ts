/**
 * Tipos de domínio para reservas recorrentes.
 *
 * Um "contrato recorrente" bloqueia horários fixos na agenda por alguns meses.
 * Existem dois tipos, com regras distintas:
 *  - "escolinha": horário divulgado no portal com contato para matrícula.
 *    Não possui regra de cancelamento (contrato robusto, tratado à parte).
 *  - "grupo": grupo comum (mensalista). Horário aparece como "Ocupado" e
 *    possui a regra de cancelamento com aviso de 1 semana.
 */

import type { Esporte } from "@/lib/quadras";

export type TipoContrato = "escolinha" | "grupo";

/** 0 = domingo ... 6 = sábado (mesma convenção de Date#getDay) */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DIAS_SEMANA: ReadonlyArray<{ valor: DiaSemana; curto: string; longo: string }> = [
  { valor: 0, curto: "Dom", longo: "Domingo" },
  { valor: 1, curto: "Seg", longo: "Segunda-feira" },
  { valor: 2, curto: "Ter", longo: "Terça-feira" },
  { valor: 3, curto: "Qua", longo: "Quarta-feira" },
  { valor: 4, curto: "Qui", longo: "Quinta-feira" },
  { valor: 5, curto: "Sex", longo: "Sexta-feira" },
  { valor: 6, curto: "Sáb", longo: "Sábado" },
];

/** Tipo de uma reserva na agenda: avulsa (portal), recorrente (escolinha/grupo), manual de admin ou bloqueio */
export type TipoReserva =
  | "avulsa"
  | TipoContrato
  | "admin_manual"
  | "manutencao_bloqueio";

export interface ContratoRecorrente {
  id: string;
  tipo: TipoContrato;

  /** Nome da escolinha ou do grupo */
  nome: string;
  /** Esporte praticado (obrigatório para escolinhas, opcional para grupos) */
  esporte?: Esporte;
  /** Texto exibido no modal "saiba mais" da escolinha */
  descricao?: string;

  /** Responsável pelo contrato (pessoa de contato interno) */
  responsavelNome: string;
  /** WhatsApp para contato (escolinha: matrícula; grupo: aviso de cancelamento) */
  contatoWhatsapp: string;

  quadraId: string;
  diasSemana: DiaSemana[];
  /** Início do bloco, ex: "14:00" */
  horaInicio: string;
  /** Fim do bloco (exclusivo), ex: "16:00" */
  horaFim: string;

  /** Primeira data de vigência (YYYY-MM-DD) */
  dataInicio: string;
  /** Duração do contrato em meses */
  meses: number;

  /** Foto do professor / banner da modalidade para divulgação na Landing Page */
  fotoUrl?: string;
  /** Faixa etária atendida (ex: Infantil, Juvenil, Adulto) */
  faixaEtaria?: string;
  /** Escolinha do site (`landing_page_schools.id`) a que esta turma pertence (só escolinhas) */
  escolinhaId?: string;

  ativo: boolean;
  criadoEm: string;
}

/** Dados informados pelo admin no formulário (antes de gerar id/criadoEm) */
export type DadosNovoContrato = Omit<ContratoRecorrente, "id" | "ativo" | "criadoEm">;

/** Duração padrão do bloqueio de agenda (spec: 6 meses) */
export const MESES_PADRAO_CONTRATO = 6;
export const MESES_MAXIMO_CONTRATO = 12;
