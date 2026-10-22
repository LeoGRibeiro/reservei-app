/**
 * Módulo de Regras de Negócio e Serviços de Domínio do Sistema de Fidelidade.
 * Contém funções puras, cálculos de ticket médio, validação de regras de elegibilidade
 * e aplicação de vouchers conforme a especificação SPEC/2026-10-05-sistema-fidelidade.md.
 */

import type { Reserva } from "@/store/useReservasStore";
import type {
  CampanhaFidelidade,
  SeloFidelidade,
  VoucherFidelidade,
  ProgressoFidelidadeUsuario,
  ResultadoCalculoDescontoVoucher,
} from "./types";

/**
 * Configuração padrão do programa de fidelidade conforme diretriz da arena:
 * 12 horas concluídas dentro do intervalo de 3 meses geram 1 voucher no valor do ticket médio.
 */
export const CAMPANHA_PADRAO: CampanhaFidelidade = {
  id: "campanha_padrao",
  nome: "Clube de Fidelidade",
  horasNecessarias: 12,
  mesesValidade: 3,
  diasValidadeVoucher: 60,
  ativo: true,
  atualizadoEm: "2026-10-05T00:00:00.000Z",
};

/**
 * Retorna se uma data informada no formato YYYY-MM-DD já expirou em relação à data de referência.
 *
 * @param dataExpiracao Data limite no formato "YYYY-MM-DD"
 * @param dataReferencia Data base (padrão: hoje)
 * @returns true se expirou
 */
export function isDataExpirada(
  dataExpiracao: string,
  dataReferencia: string = obterDataHojeIso()
): boolean {
  return dataExpiracao < dataReferencia;
}

/**
 * Retorna a data atual no formato YYYY-MM-DD.
 */
export function obterDataHojeIso(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Adiciona meses a uma data YYYY-MM-DD mantendo o formato ISO simples.
 *
 * @param dataIso Data inicial (YYYY-MM-DD)
 * @param meses Quantidade de meses a somar
 * @returns Nova data YYYY-MM-DD
 */
export function adicionarMesesAData(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setMonth(data.getMonth() + meses);

  const novoAno = data.getFullYear();
  const novoMes = String(data.getMonth() + 1).padStart(2, "0");
  const novoDia = String(data.getDate()).padStart(2, "0");
  return `${novoAno}-${novoMes}-${novoDia}`;
}

/**
 * Adiciona dias a uma data YYYY-MM-DD mantendo o formato ISO simples.
 *
 * @param dataIso Data inicial (YYYY-MM-DD)
 * @param dias Quantidade de dias a somar
 * @returns Nova data YYYY-MM-DD
 */
export function adicionarDiasAData(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  data.setDate(data.getDate() + dias);

  const novoAno = data.getFullYear();
  const novoMes = String(data.getMonth() + 1).padStart(2, "0");
  const novoDia = String(data.getDate()).padStart(2, "0");
  return `${novoAno}-${novoMes}-${novoDia}`;
}

/**
 * Diferença em dias corridos entre duas datas YYYY-MM-DD.
 *
 * @param dataInicio Data base
 * @param dataFim Data alvo
 * @returns Quantidade de dias (positivo se dataFim estiver no futuro)
 */
export function calcularDiferencaDias(dataInicio: string, dataFim: string): number {
  const [a1, m1, d1] = dataInicio.split("-").map(Number);
  const [a2, m2, d2] = dataFim.split("-").map(Number);
  const ms1 = Date.UTC(a1, m1 - 1, d1);
  const ms2 = Date.UTC(a2, m2 - 1, d2);
  return Math.ceil((ms2 - ms1) / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se uma reserva é exclusivamente avulsa (não pertence a contrato de mensalista ou escolinha).
 *
 * @param reserva Objeto de reserva
 * @returns true se for avulsa
 */
export function isReservaAvulsa(reserva: Reserva): boolean {
  if (reserva.contratoId && reserva.contratoId.trim().length > 0) {
    return false;
  }
  if (reserva.tipoReserva === "escolinha" || reserva.tipoReserva === "grupo") {
    return false;
  }
  return true;
}

/**
 * Verifica se a data e horário do jogo já foram concluídos (jogo já aconteceu).
 * Reservas futuras, mesmo pagas, não devem gerar carimbo antecipado para evitar fraudes de estorno.
 *
 * @param reserva Objeto de reserva
 * @param momentoReferencia Momento para validação temporal (padrão: agora)
 * @returns true se a partida já aconteceu por completo
 */
export function isPartidaConcluida(
  reserva: Reserva,
  momentoReferencia: Date = new Date()
): boolean {
  if (reserva.status === "cancelada") {
    return false;
  }

  // Se a reserva foi confirmada ou pendente (pois no dia o cliente já jogou)
  const statusValido = reserva.status === "confirmada" || reserva.status === "pendente";
  if (!statusValido) {
    return false;
  }

  const [ano, mes, dia] = reserva.data.split("-").map(Number);
  const horaFimStr = reserva.horaFim || "23:59";
  const [horaFim, minFim] = horaFimStr.split(":").map(Number);

  // Suporta tanto momentos passados em UTC (ex: ISO com 'Z') quanto locais
  const dataFimJogoUtc = Date.UTC(ano, mes - 1, dia, horaFim, minFim || 0, 0);
  const dataFimJogoLocal = new Date(ano, mes - 1, dia, horaFim, minFim || 0, 0).getTime();

  const refTime = momentoReferencia.getTime();
  return refTime >= dataFimJogoUtc || refTime >= dataFimJogoLocal;
}

/**
 * Avalia se uma reserva é elegível para gerar selos de fidelidade.
 *
 * @param reserva Objeto da reserva
 * @param selosExistentes Selos já registrados no sistema
 * @param momentoReferencia Momento de checagem
 * @returns Resultado detalhado da avaliação
 */
export function avaliarElegibilidadeReservaParaSelo(
  reserva: Reserva,
  selosExistentes: SeloFidelidade[] = [],
  momentoReferencia: Date = new Date()
): {
  elegivel: boolean;
  motivo?: string;
  horasContabilizadas: number;
  valorPorHora: number;
} {
  // 1. Verificação se já possui selo cadastrado
  const jaPossuiSelo = selosExistentes.some((s) => s.reservaId === reserva.id);
  if (jaPossuiSelo) {
    return {
      elegivel: false,
      motivo: "Reserva já contabilizada anteriormente no programa de fidelidade.",
      horasContabilizadas: 0,
      valorPorHora: 0,
    };
  }

  // 2. Apenas reservas avulsas
  if (!isReservaAvulsa(reserva)) {
    return {
      elegivel: false,
      motivo: "Apenas reservas avulsas são elegíveis para fidelidade.",
      horasContabilizadas: 0,
      valorPorHora: 0,
    };
  }

  // 3. Status cancelado não é elegível
  if (reserva.status === "cancelada") {
    return {
      elegivel: false,
      motivo: "Reservas canceladas não geram selos de fidelidade.",
      horasContabilizadas: 0,
      valorPorHora: 0,
    };
  }

  // 4. Jogo deve estar concluído
  if (!isPartidaConcluida(reserva, momentoReferencia)) {
    return {
      elegivel: false,
      motivo: "O jogo ainda não foi concluído. O selo é liberado após o término da partida.",
      horasContabilizadas: 0,
      valorPorHora: 0,
    };
  }

  // 5. Quantidade de horas da reserva
  const horas = reserva.horarios && reserva.horarios.length > 0 ? reserva.horarios.length : 1;
  const valorTotal = Number(reserva.valorTotal) || 0;
  const valorPorHora = horas > 0 ? Number((valorTotal / horas).toFixed(2)) : valorTotal;

  return {
    elegivel: true,
    horasContabilizadas: horas,
    valorPorHora,
  };
}

/**
 * Cria a entidade de SeloFidelidade para uma reserva elegível.
 *
 * @param reserva Reserva elegível
 * @param usuarioId ID do usuário autenticado titular
 * @param campanha Campanha ativa
 * @returns Instância do SeloFidelidade
 */
export function construirSeloParaReserva(
  reserva: Reserva,
  usuarioId: string,
  campanha: CampanhaFidelidade = CAMPANHA_PADRAO
): SeloFidelidade {
  const horas = reserva.horarios && reserva.horarios.length > 0 ? reserva.horarios.length : 1;
  const valorTotal = Number(reserva.valorTotal) || 0;
  const valorPorHora = horas > 0 ? Number((valorTotal / horas).toFixed(2)) : valorTotal;
  const expiraEm = adicionarMesesAData(reserva.data, campanha.mesesValidade);

  return {
    id: `selo_${reserva.id}_${Date.now()}`,
    usuarioId,
    reservaId: reserva.id,
    horasContabilizadas: horas,
    valorPorHora,
    valorTotalReserva: valorTotal,
    dataJogo: reserva.data,
    criadoEm: new Date().toISOString(),
    expiraEm,
    resgatado: false,
    voucherId: null,
  };
}

/**
 * Calcula o Ticket Médio por hora ponderado com base nos selos acumulados.
 *
 * Exemplo: 12 horas acumuladas com custo total de R$ 1200 resultam em R$ 100/hora.
 *
 * @param selos Lista de selos participantes
 * @returns Valor médio por hora em reais (arredondado para 2 casas)
 */
export function calcularTicketMedio(selos: SeloFidelidade[]): number {
  if (!selos || selos.length === 0) {
    return 0;
  }

  let totalHoras = 0;
  let valorAcumulado = 0;

  for (const selo of selos) {
    const horas = selo.horasContabilizadas > 0 ? selo.horasContabilizadas : 1;
    totalHoras += horas;
    valorAcumulado += horas * selo.valorPorHora;
  }

  if (totalHoras === 0) {
    return 0;
  }

  return Number((valorAcumulado / totalHoras).toFixed(2));
}

/**
 * Calcula o progresso completo e status da cartela de fidelidade do usuário.
 *
 * @param usuarioId ID do usuário
 * @param selos Todos os selos do usuário
 * @param vouchers Todos os vouchers do usuário
 * @param campanha Configuração da campanha
 * @param dataReferencia Data base para cálculo de expiração (padrão: hoje)
 * @returns Progresso estruturado
 */
export function calcularProgressoUsuario(
  usuarioId: string,
  selos: SeloFidelidade[],
  vouchers: VoucherFidelidade[],
  campanha: CampanhaFidelidade = CAMPANHA_PADRAO,
  dataReferencia: string = obterDataHojeIso()
): ProgressoFidelidadeUsuario {
  const selosDoUsuario = selos.filter((s) => s.usuarioId === usuarioId);
  const vouchersDoUsuario = vouchers.filter((v) => v.usuarioId === usuarioId);

  const selosAtivos: SeloFidelidade[] = [];
  const selosExpirados: SeloFidelidade[] = [];
  const selosResgatados: SeloFidelidade[] = [];

  for (const selo of selosDoUsuario) {
    if (selo.resgatado) {
      selosResgatados.push(selo);
    } else if (isDataExpirada(selo.expiraEm, dataReferencia)) {
      selosExpirados.push(selo);
    } else {
      selosAtivos.push(selo);
    }
  }

  // Ordena selos ativos pelo vencimento mais próximo
  selosAtivos.sort((a, b) => a.expiraEm.localeCompare(b.expiraEm));

  const totalHorasAtivas = selosAtivos.reduce(
    (acc, curr) => acc + (curr.horasContabilizadas || 1),
    0
  );

  const horasNecessarias = Math.max(1, campanha.horasNecessarias);
  const percentualConcluido = Math.min(
    100,
    Math.round((totalHorasAtivas / horasNecessarias) * 100)
  );

  const ticketMedioAtual = calcularTicketMedio(selosAtivos);

  const vouchersDisponiveis = vouchersDoUsuario.filter(
    (v) => v.status === "disponivel" && !isDataExpirada(v.expiraEm, dataReferencia)
  );

  const vouchersHistorico = vouchersDoUsuario.filter(
    (v) => v.status !== "disponivel" || isDataExpirada(v.expiraEm, dataReferencia)
  );

  const proximoSeloExpirando = selosAtivos.length > 0 ? selosAtivos[0] : null;
  const proximoSeloExpirandoEm = proximoSeloExpirando ? proximoSeloExpirando.expiraEm : null;
  const diasParaProximoSeloExpirar = proximoSeloExpirandoEm
    ? Math.max(0, calcularDiferencaDias(dataReferencia, proximoSeloExpirandoEm))
    : null;

  const podeResgatar = totalHorasAtivas >= horasNecessarias && campanha.ativo;

  return {
    usuarioId,
    totalHorasAtivas,
    horasNecessarias,
    percentualConcluido,
    ticketMedioAtual,
    selosAtivos,
    selosExpirados,
    selosResgatados,
    vouchersDisponiveis,
    vouchersHistorico,
    proximoSeloExpirandoEm,
    diasParaProximoSeloExpirar,
    podeResgatar,
  };
}

/**
 * Converte selos ativos suficientes na criação de um novo Voucher de Fidelidade.
 * As primeiras `horasNecessarias` de selos ativos são marcadas como resgatadas.
 *
 * @param usuarioId ID do usuário beneficiário
 * @param selosAtivos Lista de selos ativos
 * @param campanha Configuração da campanha
 * @param dataReferencia Data base ISO (YYYY-MM-DD)
 * @returns Objeto com o novo voucher e a lista atualizada de selos
 */
export function resgatarVoucherFidelidade(
  usuarioId: string,
  selosAtivos: SeloFidelidade[],
  campanha: CampanhaFidelidade = CAMPANHA_PADRAO,
  dataReferencia: string = obterDataHojeIso()
): {
  voucher: VoucherFidelidade;
  selosUtilizados: SeloFidelidade[];
} {
  const horasNecessarias = Math.max(1, campanha.horasNecessarias);

  // Ordena pelo vencimento mais próximo para consumir os selos mais antigos primeiro
  const ordenados = [...selosAtivos].sort((a, b) => a.expiraEm.localeCompare(b.expiraEm));

  const selosConsumidos: SeloFidelidade[] = [];
  let horasAcumuladas = 0;

  for (const selo of ordenados) {
    if (horasAcumuladas >= horasNecessarias) break;
    selosConsumidos.push(selo);
    horasAcumuladas += selo.horasContabilizadas || 1;
  }

  if (horasAcumuladas < horasNecessarias) {
    throw new Error(
      `Horas insuficientes para emitir voucher. Necessário: ${horasNecessarias}h, possui: ${horasAcumuladas}h.`
    );
  }

  const ticketMedio = calcularTicketMedio(selosConsumidos);
  const voucherId = `vch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sufixoAleatorio = Math.random().toString(36).substring(2, 6).toUpperCase();
  const codigo = `FID-${sufixoAleatorio}-${new Date().getFullYear()}`;
  const expiraEm = adicionarDiasAData(dataReferencia, campanha.diasValidadeVoucher);

  const voucher: VoucherFidelidade = {
    id: voucherId,
    codigo,
    usuarioId,
    valorTeto: ticketMedio,
    status: "disponivel",
    criadoEm: new Date().toISOString(),
    expiraEm,
    reservaUtilizadaId: null,
    utilizadoEm: null,
  };

  const selosAtualizados = selosConsumidos.map((selo) => ({
    ...selo,
    resgatado: true,
    voucherId,
  }));

  return {
    voucher,
    selosUtilizados: selosAtualizados,
  };
}

/**
 * Calcula o abatimento financeiro ao aplicar um conjunto de vouchers de fidelidade no checkout.
 * Pela regra da arena: caso o cliente opte por usar os vouchers de fidelidade, TODOS os vouchers
 * disponíveis devem ser utilizados e consumidos conjuntamente de uma só vez nesta reserva.
 *
 * @param valorOriginal Valor integral original da nova reserva
 * @param vouchers Lista de vouchers a serem aplicados em conjunto
 * @returns Detalhamento dos valores calculados, desconto aplicado e se é 100% gratuita
 *
 * @example
 * ```ts
 * const resultado = aplicarDescontoVouchers(150, [vch1, vch2]);
 * console.log(resultado.valorDesconto, resultado.valorFinal);
 * ```
 */
export function aplicarDescontoVouchers(
  valorOriginal: number,
  vouchers: VoucherFidelidade[] = []
): ResultadoCalculoDescontoVoucher {
  const total = Number(valorOriginal) || 0;

  if (!vouchers || vouchers.length === 0) {
    return {
      valorOriginal: total,
      valorDesconto: 0,
      valorFinal: total,
      reservaGratuita: false,
      diferencaNaoUtilizada: 0,
    };
  }

  // Soma dos tetos de todos os vouchers ativos selecionados
  const tetoTotal = vouchers.reduce((acc, v) => acc + (Number(v.valorTeto) || 0), 0);
  const tetoArredondado = Number(tetoTotal.toFixed(2));

  const valorDesconto = Math.min(total, tetoArredondado);
  const valorFinal = Number((total - valorDesconto).toFixed(2));
  const reservaGratuita = valorFinal === 0;
  const diferencaNaoUtilizada = Number(Math.max(0, tetoArredondado - total).toFixed(2));

  return {
    valorOriginal: total,
    valorDesconto,
    valorFinal,
    reservaGratuita,
    diferencaNaoUtilizada,
  };
}

/**
 * Calcula o abatimento financeiro ao aplicar um voucher de fidelidade no checkout de uma reserva.
 * Mantido para compatibilidade com usos individuais e testes anteriores.
 *
 * @param valorOriginal Valor integral da nova reserva
 * @param voucher Voucher a ser aplicado
 * @returns Detalhamento dos valores calculados
 */
export function aplicarDescontoVoucher(
  valorOriginal: number,
  voucher: VoucherFidelidade
): ResultadoCalculoDescontoVoucher {
  return aplicarDescontoVouchers(valorOriginal, voucher ? [voucher] : []);
}

