/**
 * Geração, validação e detecção de conflitos de ocorrências recorrentes.
 * Funções puras (sem React, Zustand ou Supabase) para facilitar os testes.
 */

import { obterHorariosCatalogo, obterQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { calcularValorTotal } from "@/lib/constants";
import type { Reserva } from "@/store/useReservasStore";
import {
  adicionarDias,
  adicionarMeses,
  diaDaSemana,
  horaParaTexto,
  isDataISOValida,
  textoParaHora,
} from "./datas";
import {
  MESES_MAXIMO_CONTRATO,
  type ContratoRecorrente,
  type DadosNovoContrato,
  type DiaSemana,
} from "./types";

// ─── Horários ─────────────────────────────────────────────────────────────────

/**
 * Expande um intervalo em slots de 1h.
 * Ex.: ("14:00", "16:00") → ["14:00", "15:00"]
 * Retorna lista vazia se o intervalo for inválido (fim <= início).
 */
export function expandirHorarios(horaInicio: string, horaFim: string): string[] {
  const inicio = textoParaHora(horaInicio);
  const fim = textoParaHora(horaFim);
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) return [];

  const slots: string[] = [];
  for (let hora = inicio; hora < fim; hora++) {
    slots.push(horaParaTexto(hora));
  }
  return slots;
}

/** Horários de fim aceitos: o fim de cada slot disponível (09:00 ... 23:00) */
export function horariosFimDisponiveis(): string[] {
  return obterHorariosCatalogo().map((h) => horaParaTexto(textoParaHora(h) + 1));
}

// ─── Datas ────────────────────────────────────────────────────────────────────

/**
 * Gera todas as datas de um contrato: dias da semana escolhidos entre
 * `dataInicio` (inclusive) e `dataInicio + meses` (exclusive).
 */
export function gerarDatasRecorrentes(
  dataInicio: string,
  diasSemana: DiaSemana[],
  meses: number
): string[] {
  if (!isDataISOValida(dataInicio) || diasSemana.length === 0 || meses <= 0) {
    return [];
  }

  const limite = adicionarMeses(dataInicio, meses);
  const permitidos = new Set<number>(diasSemana);
  const datas: string[] = [];

  for (let atual = dataInicio; atual < limite; atual = adicionarDias(atual, 1)) {
    if (permitidos.has(diaDaSemana(atual))) {
      datas.push(atual);
    }
  }
  return datas;
}

// ─── Validação ────────────────────────────────────────────────────────────────

/** Quantidade mínima de dígitos de um telefone brasileiro com DDD */
const MIN_DIGITOS_TELEFONE = 10;

/**
 * Valida os dados do formulário de contrato.
 * Retorna a lista de mensagens de erro (vazia = dados válidos).
 *
 * @param hoje data de referência "YYYY-MM-DD" (injetável para testes)
 */
export function validarDadosContrato(dados: DadosNovoContrato, hoje: string): string[] {
  const erros: string[] = [];

  if (!dados.nome.trim()) {
    erros.push(dados.tipo === "escolinha" ? "Informe o nome da escolinha." : "Informe o nome do grupo.");
  }

  if (dados.tipo === "escolinha" && !dados.esporte) {
    erros.push("Informe o esporte da escolinha.");
  }

  if (!dados.responsavelNome.trim()) {
    erros.push("Informe o nome do responsável.");
  }

  if (dados.contatoWhatsapp.replace(/\D/g, "").length < MIN_DIGITOS_TELEFONE) {
    erros.push("Informe um WhatsApp válido com DDD.");
  }

  if (!obterQuadrasCatalogo().some((q) => q.id === dados.quadraId)) {
    erros.push("Selecione uma quadra válida.");
  }

  if (dados.diasSemana.length === 0) {
    erros.push("Selecione ao menos um dia da semana.");
  }

  const slots = expandirHorarios(dados.horaInicio, dados.horaFim);
  if (slots.length === 0) {
    erros.push("O horário de fim deve ser posterior ao horário de início.");
  } else if (!slots.every((s) => obterHorariosCatalogo().includes(s))) {
    erros.push("O intervalo contém horários fora do funcionamento do complexo.");
  }

  if (!isDataISOValida(dados.dataInicio)) {
    erros.push("Informe uma data de início válida.");
  } else if (dados.dataInicio < hoje) {
    erros.push("A data de início não pode estar no passado.");
  }

  if (!Number.isInteger(dados.meses) || dados.meses < 1 || dados.meses > MESES_MAXIMO_CONTRATO) {
    erros.push(`A duração deve ser de 1 a ${MESES_MAXIMO_CONTRATO} meses.`);
  }

  return erros;
}

// ─── Conflitos ────────────────────────────────────────────────────────────────

export interface ConflitoOcorrencia {
  data: string;
  reservaId: string;
  nomeCliente: string;
  horarios: string[];
}

/** Indica se uma reserva está "segurando" o horário (qualquer status exceto cancelada) */
export function isReservaAtiva(reserva: Reserva): boolean {
  return reserva.status !== "cancelada";
}

/**
 * Procura reservas ativas que colidem com um bloco (quadra + data + horários).
 * `ignorarId` permite checar a própria reserva ao reativá-la.
 */
export function encontrarConflitosDoBloco(
  quadraId: string,
  data: string,
  horarios: string[],
  reservas: Reserva[],
  ignorarId?: string
): Reserva[] {
  return reservas.filter(
    (r) =>
      r.id !== ignorarId &&
      isReservaAtiva(r) &&
      r.quadraId === quadraId &&
      r.data === data &&
      r.horarios.some((h) => horarios.includes(h))
  );
}

/** Detecta conflitos de todas as ocorrências de um contrato com a agenda atual */
export function encontrarConflitosDoContrato(
  dados: Pick<
    DadosNovoContrato,
    "quadraId" | "diasSemana" | "horaInicio" | "horaFim" | "dataInicio" | "meses"
  >,
  reservas: Reserva[]
): ConflitoOcorrencia[] {
  const horarios = expandirHorarios(dados.horaInicio, dados.horaFim);
  const datas = gerarDatasRecorrentes(dados.dataInicio, dados.diasSemana, dados.meses);

  const conflitos: ConflitoOcorrencia[] = [];
  for (const data of datas) {
    for (const reserva of encontrarConflitosDoBloco(dados.quadraId, data, horarios, reservas)) {
      conflitos.push({
        data,
        reservaId: reserva.id,
        nomeCliente: reserva.nomeCliente,
        horarios: reserva.horarios,
      });
    }
  }
  return conflitos;
}

// ─── Materialização ───────────────────────────────────────────────────────────

/** ID determinístico: evita duplicar a mesma ocorrência se a geração rodar duas vezes */
export function gerarIdOcorrencia(contratoId: string, data: string): string {
  return `${contratoId}_${data}`;
}

/**
 * Converte uma data do contrato numa Reserva real da agenda.
 *
 * - Escolinha: sem valores (contrato financeiro tratado à parte), status "confirmada".
 * - Grupo: valor da sessão ao preço normal, nada pago antecipadamente
 *   (sinal 0, pendente = total), status "pendente".
 */
export function montarReservaDaOcorrencia(
  contrato: ContratoRecorrente,
  data: string,
  criadaEm: string = new Date().toISOString()
): Reserva {
  const horarios = expandirHorarios(contrato.horaInicio, contrato.horaFim);
  const ehGrupo = contrato.tipo === "grupo";
  const valorTotal = ehGrupo ? calcularValorTotal(horarios) : 0;

  return {
    id: gerarIdOcorrencia(contrato.id, data),
    quadraId: contrato.quadraId,
    nomeCliente: contrato.nome,
    whatsappCliente: contrato.contatoWhatsapp,
    cpfCliente: "",
    data,
    horarios,
    horaInicio: contrato.horaInicio,
    horaFim: contrato.horaFim,
    valorTotal,
    valorSinal: 0,
    valorPendente: valorTotal,
    status: ehGrupo ? "pendente" : "confirmada",
    statusWhatsApp: "nao_enviado",
    criadaEm,
    esporte: contrato.esporte,
    observacoes:
      contrato.descricao ||
      (contrato.tipo === "escolinha"
        ? `Escolinha: ${contrato.nome}`
        : `Grupo recorrente: ${contrato.nome}`),
    contratoId: contrato.id,
    tipoReserva: contrato.tipo,
  };
}

/** Gera todas as reservas (ocorrências) de um contrato */
export function gerarReservasDoContrato(
  contrato: ContratoRecorrente,
  criadaEm: string = new Date().toISOString()
): Reserva[] {
  return gerarDatasRecorrentes(contrato.dataInicio, contrato.diasSemana, contrato.meses).map(
    (data) => montarReservaDaOcorrencia(contrato, data, criadaEm)
  );
}
