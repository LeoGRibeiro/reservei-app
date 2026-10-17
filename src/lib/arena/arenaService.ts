/**
 * @file arenaService.ts
 * @description Serviço de domínio com regras de negócio para cálculo dinâmico de preços,
 * validação temporal estrita e geração de slots operacionais de quadras esportivas.
 */

import type {
  Quadra,
  QuadraPreco,
  CalculoPrecoInput,
  CalculoPrecoResultado,
  DetalhePrecoHorario,
  Arena,
} from "./types";

/**
 * Converte uma string de data 'YYYY-MM-DD' para o dia da semana numérico correspondente (0=Domingo a 6=Sábado),
 * utilizando meio-dia em UTC para evitar desvios de fuso horário.
 * 
 * @param dataStr Data no formato 'YYYY-MM-DD' (ex: '2026-10-25')
 * @returns Número do dia da semana (0 a 6)
 */
export function obterDiaSemanaUtc(dataStr: string): number {
  if (!dataStr) return 0;
  // Meio-dia UTC neutraliza o fuso horário de Belém (UTC-3) e outros
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  if (!ano || !mes || !dia) return 0;
  const data = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
  return data.getUTCDay();
}

/**
 * Normaliza e formata um horário em formato 'HH:mm' para comparação segura.
 * @param hora Horário (ex: '8:00' ou '08:00')
 * @returns String formatada em 'HH:mm'
 */
export function normalizarHora(hora: string): string {
  if (!hora) return "00:00";
  const partes = hora.trim().split(":");
  const h = String(parseInt(partes[0], 10) || 0).padStart(2, "0");
  const m = String(parseInt(partes[1], 10) || 0).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Calcula o preço de locação de uma quadra levando em consideração a tabela dinâmica
 * de tarifas por dia da semana e faixa horária (ex: tarifa noturna com luz ou fim de semana).
 *
 * @param params Parâmetros de entrada contendo a quadra, lista de preços, data e horários
 * @returns Resultado detalhado contendo valor total, valor do sinal mínimo e detalhamento por slot
 * 
 * @example
 * ```ts
 * const resultado = ArenaService.calcularPrecoReserva({
 *   quadra: quadraSociety,
 *   precos: regrasPrecos,
 *   data: "2026-10-25", // Domingo
 *   horarios: ["18:00", "19:00"],
 *   percentualSinal: 50
 * });
 * console.log(resultado.valorTotal); // Ex: 260
 * ```
 */
export function calcularPrecoReserva(
  params: CalculoPrecoInput
): CalculoPrecoResultado {
  const { quadra, precos = [], data, horarios = [], percentualSinal = 50 } = params;

  if (!horarios || horarios.length === 0) {
    return {
      valorTotal: 0,
      valorSinal: 0,
      valorPendente: 0,
      detalhamento: [],
    };
  }

  const diaSemana = obterDiaSemanaUtc(data);
  const detalhamento: DetalhePrecoHorario[] = [];
  let valorTotalAcumulado = 0;

  for (const slot of horarios) {
    const slotNorm = normalizarHora(slot);

    // Localiza a regra de preço dinâmica mais adequada para esta quadra, dia e horário
    const regraAplicavel = precos.find((regra) => {
      if (!regra.ativo) return false;
      if (regra.quadraId !== quadra.id) return false;
      if (!regra.diasSemana.includes(diaSemana)) return false;

      const inicioNorm = normalizarHora(regra.horaInicio);
      const fimNorm = normalizarHora(regra.horaFim);

      // O horário deve estar dentro do intervalo [horaInicio, horaFim)
      return slotNorm >= inicioNorm && slotNorm < fimNorm;
    });

    let valorHora = quadra.valorHoraPadrao;
    let regraDescricao = "Tarifa Base Padrão";

    if (regraAplicavel) {
      valorHora = Number(regraAplicavel.valorHora);
      regraDescricao =
        regraAplicavel.descricao || `Tarifa Especial (${regraAplicavel.horaInicio}-${regraAplicavel.horaFim})`;
    }

    detalhamento.push({
      horario: slotNorm,
      valor: valorHora,
      regraAplicada: regraDescricao,
    });

    valorTotalAcumulado += valorHora;
  }

  // Garante que o percentual de sinal esteja entre 0% e 100%
  const percentualSanitizado = Math.max(0, Math.min(100, percentualSinal));
  const valorSinalBruto = valorTotalAcumulado * (percentualSanitizado / 100);
  const valorSinal = Math.round(valorSinalBruto * 100) / 100;
  const valorPendente = Math.round((valorTotalAcumulado - valorSinal) * 100) / 100;

  return {
    valorTotal: valorTotalAcumulado,
    valorSinal,
    valorPendente,
    detalhamento,
  };
}

/**
 * Gera dinamicamente a lista de horários de início disponíveis para agendamento
 * com base no horário de abertura e fechamento da arena.
 *
 * @param horarioAbertura Ex: '06:00'
 * @param horarioFechamento Ex: '23:00'
 * @param intervaloMinutos Duração de cada slot em minutos (padrão: 60)
 * @returns Array de horários em formato 'HH:mm'
 * 
 * @example
 * ```ts
 * const slots = gerarHorariosOperacionais('08:00', '12:00', 60);
 * // Retorna: ['08:00', '09:00', '10:00', '11:00']
 * ```
 */
export function gerarHorariosOperacionais(
  horarioAbertura: string,
  horarioFechamento: string,
  intervaloMinutos = 60
): string[] {
  const [horaAb, minAb] = horarioAbertura.split(":").map(Number);
  const [horaFech, minFech] = horarioFechamento.split(":").map(Number);

  const inicioMinutos = (horaAb || 0) * 60 + (minAb || 0);
  const fimMinutos = (horaFech || 23) * 60 + (minFech || 0);

  const slots: string[] = [];
  let atual = inicioMinutos;

  while (atual + intervaloMinutos <= fimMinutos) {
    const h = Math.floor(atual / 60);
    const m = atual % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    atual += intervaloMinutos;
  }

  return slots;
}

/**
 * Valida se um agendamento cumpre a antecedência mínima estabelecida pela arena,
 * evitando que clientes reservem um horário que começa em poucos minutos sem aviso prévio.
 *
 * @param dataStr Data da locação 'YYYY-MM-DD'
 * @param horaInicio Horário de início 'HH:mm'
 * @param antecedenciaMinutos Antecedência mínima requerida (ex: 60 minutos)
 * @param agora Objeto Date opcional representando o instante atual (útil para testes unitários)
 * @returns Objeto com booleano `valido` e mensagem de `motivo`
 */
export function validarAntecedenciaMinima(
  dataStr: string,
  horaInicio: string,
  antecedenciaMinutos: number,
  agora: Date = new Date()
): { valido: boolean; motivo?: string } {
  if (!dataStr || !horaInicio) {
    return { valido: false, motivo: "Data e horário de início são obrigatórios." };
  }

  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const [hora, min] = horaInicio.split(":").map(Number);

  // Instante do agendamento (fuso horário local)
  const dataReserva = new Date(ano, mes - 1, dia, hora, min, 0, 0);

  const diferencaMs = dataReserva.getTime() - agora.getTime();
  const diferencaMinutos = Math.floor(diferencaMs / (1000 * 60));

  if (diferencaMinutos < 0) {
    return {
      valido: false,
      motivo: "Não é permitido reservar horários no passado.",
    };
  }

  if (diferencaMinutos < antecedenciaMinutos) {
    return {
      valido: false,
      motivo: `Esta arena exige antecedência mínima de ${antecedenciaMinutos} minutos para reservas online.`,
    };
  }

  return { valido: true };
}

/**
 * Valida se a quadra suporta o esporte escolhido pelo cliente.
 * 
 * @param quadra Entidade da quadra
 * @param esporte Modalidade esportiva desejada
 * @returns true se compatível ou se a quadra aceitar qualquer esporte
 */
export function validarEsporteQuadra(quadra: Quadra, esporte?: string): boolean {
  if (!esporte) return true;
  if (!quadra.esportes || quadra.esportes.length === 0) return true;
  return quadra.esportes.some(
    (e) => e.toLowerCase() === esporte.toLowerCase()
  );
}

/**
 * Serviço de fachada agregadora das operações de negócios da Arena.
 */
export const ArenaService = {
  obterDiaSemanaUtc,
  normalizarHora,
  calcularPrecoReserva,
  gerarHorariosOperacionais,
  validarAntecedenciaMinima,
  validarEsporteQuadra,
};
