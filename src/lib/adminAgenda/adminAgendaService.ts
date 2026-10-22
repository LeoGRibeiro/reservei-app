/**
 * Serviço de Lógica de Negócio pura para a Agenda Completa do Administrador.
 * Implementa validação de conflitos, bloqueios, reservas manuais e agregação mensal.
 *
 * Princípio: Funções puras e desacopladas de componentes React, facilitando testes de unidade e regras de negócio.
 */

import { obterHorariosCatalogo, obterQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { calcularValorTotal, saoConsecutivos } from "@/lib/constants";
import type { Reserva } from "@/store/useReservasStore";
import type {
  DadosCriacaoBloqueio,
  DadosCriacaoReservaManual,
  DiaCalendarioMensal,
  ResumoMesAdmin,
  SlotAgendaAdmin,
  TipoOcupacaoSlot,
} from "./types";

/**
 * Número máximo de meses no futuro que o administrador pode navegar na agenda.
 * Permite ampla projeção administrativa de até 10 anos (120 meses) para reservas de longo prazo e campeonatos.
 */
export const LIMITE_MESES_FUTURO = 120;

/**
 * Classifica a ocupação de um horário individual com base nos dados da reserva.
 *
 * @param reserva Objeto de reserva ou undefined caso o horário esteja livre.
 * @returns Tipo de ocupação padronizado.
 */
export function classificarTipoSlot(reserva?: Reserva): TipoOcupacaoSlot {
  if (!reserva || reserva.status === "cancelada") {
    return "disponivel";
  }

  if (reserva.tipoReserva === "manutencao_bloqueio") {
    return "manutencao_bloqueio";
  }

  if (reserva.tipoReserva === "admin_manual") {
    return "admin_manual";
  }

  if (reserva.tipoReserva === "escolinha") {
    return "escolinha";
  }

  if (reserva.tipoReserva === "grupo") {
    return "grupo";
  }

  return "cliente_online";
}

/**
 * Monta todos os slots de uma quadra para um determinado dia, identificando
 * a ocupação e detalhes de cada horário (08:00 até 22:00).
 *
 * @param quadraId Identificador da quadra (ex: "q1")
 * @param data Data no formato YYYY-MM-DD
 * @param reservas Lista de reservas ativas
 * @returns Lista ordenada de slots com seus respectivos metadados
 */
export function montarSlotsQuadraDia(
  quadraId: string,
  data: string,
  reservas: Reserva[]
): SlotAgendaAdmin[] {
  // Filtra reservas da quadra e data que não estão canceladas
  const reservasDoDia = reservas.filter(
    (r) => r.quadraId === quadraId && r.data === data && r.status !== "cancelada"
  );

  return obterHorariosCatalogo().map((horario) => {
    const horaNum = parseInt(horario.split(":")[0], 10);
    const horaFim = `${String(horaNum + 1).padStart(2, "0")}:00`;

    // Localiza a reserva que ocupa este slot de horário
    const reserva = reservasDoDia.find((r) => r.horarios.includes(horario));
    const tipo = classificarTipoSlot(reserva);

    let nomeExibicao: string | undefined;
    let pago: boolean | undefined;
    let motivoBloqueio: string | undefined;

    if (reserva) {
      nomeExibicao = reserva.nomeCliente;
      pago = reserva.status === "confirmada" || reserva.valorPendente === 0;

      if (tipo === "manutencao_bloqueio") {
        motivoBloqueio = reserva.observacoes || reserva.nomeCliente || "Bloqueado pelo Admin";
      }
    }

    return {
      horario,
      horaFim,
      quadraId,
      data,
      tipo,
      reserva,
      nomeExibicao,
      pago,
      motivoBloqueio,
    };
  });
}

/**
 * Validação rigorosa para impedir que um administrador bloqueie um horário que já possua
 * reservas ativas. Conforme a regra de negócio da spec:
 * "O sistema deve IMPEDIR o admin de bloquear um horário que já possua uma reserva.
 *  O admin receberá um alerta e deverá gerenciar a reserva existente antes de efetuar o bloqueio."
 *
 * @param quadraId Identificador da quadra
 * @param data Data do bloqueio no formato YYYY-MM-DD
 * @param horarios Lista de horários que se deseja bloquear
 * @param reservasExistentes Lista completa de reservas
 * @returns Objeto indicando se a ação é válida ou detalhes do conflito
 */
export function validarConflitoBloqueio(
  quadraId: string,
  data: string,
  horarios: string[],
  reservasExistentes: Reserva[]
): { valido: boolean; motivo?: string; conflitoCom?: Reserva } {
  if (!quadraId || !obterQuadrasCatalogo().some((q) => q.id === quadraId)) {
    return { valido: false, motivo: "Selecione uma quadra válida para o bloqueio." };
  }

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { valido: false, motivo: "Informe uma data válida no formato AAAA-MM-DD." };
  }

  if (!horarios || horarios.length === 0) {
    return { valido: false, motivo: "Selecione ao menos um horário para aplicar o bloqueio." };
  }

  // Verifica se há alguma reserva ativa (que não seja outro bloqueio cancelado) que colide
  const reservaConflitante = reservasExistentes.find(
    (r) =>
      r.quadraId === quadraId &&
      r.data === data &&
      r.status !== "cancelada" &&
      r.horarios.some((h) => horarios.includes(h))
  );

  if (reservaConflitante) {
    const quadraObj = obterQuadrasCatalogo().find((q) => q.id === quadraId);
    const quadraNome = quadraObj ? `Quadra ${quadraObj.numero}` : quadraId;
    const ehBloqueio = reservaConflitante.tipoReserva === "manutencao_bloqueio";

    if (ehBloqueio) {
      return {
        valido: false,
        motivo: `O horário já está bloqueado (${reservaConflitante.nomeCliente}) na ${quadraNome}.`,
        conflitoCom: reservaConflitante,
      };
    }

    return {
      valido: false,
      motivo: `Não é possível bloquear este horário pois já existe uma reserva para "${reservaConflitante.nomeCliente}" (${reservaConflitante.horaInicio} às ${reservaConflitante.horaFim}) na ${quadraNome}. Por favor, entre em contato com o cliente e cancele ou remaneje a reserva antes de aplicar o bloqueio.`,
      conflitoCom: reservaConflitante,
    };
  }

  return { valido: true };
}

/**
 * Valida a criação de uma reserva manual pelo administrador.
 *
 * @param dados Dados submetidos no formulário
 * @param reservasExistentes Lista de reservas atuais para detecção de choque
 * @returns Objeto com lista de erros e eventual reserva conflitante
 */
export function validarReservaManual(
  dados: DadosCriacaoReservaManual,
  reservasExistentes: Reserva[]
): { valido: boolean; erros: string[]; conflitoCom?: Reserva } {
  const erros: string[] = [];

  if (!dados.nomeCliente || dados.nomeCliente.trim().length === 0) {
    erros.push("Informe o nome do cliente ou do grupo responsável.");
  }

  if (!dados.quadraId || !obterQuadrasCatalogo().some((q) => q.id === dados.quadraId)) {
    erros.push("Selecione uma quadra válida.");
  }

  if (!dados.data || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) {
    erros.push("Informe uma data válida.");
  }

  if (!dados.horarios || dados.horarios.length === 0) {
    erros.push("Selecione pelo menos um horário de jogo.");
  } else {
    // Horários devem ser consecutivos
    const horariosOrdenados = [...dados.horarios].sort();
    if (!saoConsecutivos(horariosOrdenados)) {
      erros.push("Os horários selecionados devem ser consecutivos (sem intervalos).");
    }

    // Choque de horários
    const conflito = reservasExistentes.find(
      (r) =>
        r.quadraId === dados.quadraId &&
        r.data === dados.data &&
        r.status !== "cancelada" &&
        r.horarios.some((h) => dados.horarios.includes(h))
    );

    if (conflito) {
      if (conflito.tipoReserva === "manutencao_bloqueio") {
        erros.push(
          `O horário está bloqueado para manutenção (${conflito.nomeCliente}). Remova o bloqueio antes de reservar.`
        );
      } else {
        erros.push(
          `O horário já está ocupado por "${conflito.nomeCliente}" (${conflito.horaInicio} às ${conflito.horaFim}).`
        );
      }
      return { valido: false, erros, conflitoCom: conflito };
    }
  }

  return { valido: erros.length === 0, erros };
}

/**
 * Cria o objeto da entidade Reserva formatado para uma Reserva Manual do Administrador.
 *
 * @param dados Dados validados da reserva manual
 * @returns Instância de Reserva pronta para persistência
 */
export function construirReservaManual(dados: DadosCriacaoReservaManual): Reserva {
  const horariosOrdenados = [...dados.horarios].sort();
  const valorCalculado =
    typeof dados.valorTotal === "number" && dados.valorTotal >= 0
      ? dados.valorTotal
      : calcularValorTotal(horariosOrdenados);

  const horaInicio = horariosOrdenados[0];
  const ultimoSlot = parseInt(horariosOrdenados[horariosOrdenados.length - 1].split(":")[0], 10);
  const horaFim = `${String(ultimoSlot + 1).padStart(2, "0")}:00`;

  const id = `rsv_adm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    quadraId: dados.quadraId,
    nomeCliente: dados.nomeCliente.trim(),
    whatsappCliente: dados.whatsappCliente ? dados.whatsappCliente.trim() : "",
    cpfCliente: "",
    data: dados.data,
    horarios: horariosOrdenados,
    horaInicio,
    horaFim,
    valorTotal: valorCalculado,
    valorSinal: dados.pago ? valorCalculado : 0,
    valorPendente: dados.pago ? 0 : valorCalculado,
    status: dados.pago ? "confirmada" : "pendente",
    statusWhatsApp: "nao_enviado",
    criadaEm: new Date().toISOString(),
    esporte: dados.esporte,
    observacoes: dados.observacoes ? dados.observacoes.trim() : undefined,
    tipoReserva: "admin_manual",
  };
}

/**
 * Cria o objeto da entidade Reserva formatado para um Bloqueio de Manutenção/Administrativo.
 * Importante: O valor total é 0 e não contabiliza no faturamento do complexo.
 *
 * @param dados Dados do bloqueio
 * @returns Instância de Reserva representando o bloqueio
 */
export function construirBloqueio(dados: DadosCriacaoBloqueio): Reserva {
  const horariosOrdenados = [...dados.horarios].sort();
  const horaInicio = horariosOrdenados[0];
  const ultimoSlot = parseInt(horariosOrdenados[horariosOrdenados.length - 1].split(":")[0], 10);
  const horaFim = `${String(ultimoSlot + 1).padStart(2, "0")}:00`;

  const id = `bloq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const motivoLimpo = dados.motivo.trim();
  const obsCompleta = dados.observacoes?.trim()
    ? `${motivoLimpo} - ${dados.observacoes.trim()}`
    : motivoLimpo;

  return {
    id,
    quadraId: dados.quadraId,
    nomeCliente: `Bloqueio: ${motivoLimpo}`,
    whatsappCliente: "",
    cpfCliente: "",
    data: dados.data,
    horarios: horariosOrdenados,
    horaInicio,
    horaFim,
    valorTotal: 0,
    valorSinal: 0,
    valorPendente: 0,
    status: "confirmada",
    statusWhatsApp: "nao_enviado",
    criadaEm: new Date().toISOString(),
    observacoes: obsCompleta,
    tipoReserva: "manutencao_bloqueio",
  };
}

/**
 * Gera a matriz de dias para a exibição de um mês tradicional de calendário (Domingo a Sábado),
 * incluindo os dias de preenchimento dos meses adjacentes e agregando as reservas de cada dia.
 *
 * @param ano Ano com 4 dígitos (ex.: 2026)
 * @param mes Mês de 1 a 12 (ex.: 10 para Outubro)
 * @param reservas Lista de reservas para agregação diária
 * @param hojeStr Data atual no formato "YYYY-MM-DD"
 * @returns Lista completa de dias do grid (normalmente 35 ou 42 células)
 */
export function gerarDiasCalendarioMensal(
  ano: number,
  mes: number,
  reservas: Reserva[],
  hojeStr: string
): DiaCalendarioMensal[] {
  // Primeiro dia do mês (0 = domingo ... 6 = sábado)
  const primeiroDiaDoMes = new Date(ano, mes - 1, 1);
  const diaSemanaInicio = primeiroDiaDoMes.getDay();

  // Quantidade de dias no mês atual
  const totalDiasMes = new Date(ano, mes, 0).getDate();

  // Quantidade de dias no mês anterior
  const totalDiasMesAnterior = new Date(ano, mes - 1, 0).getDate();

  const grid: DiaCalendarioMensal[] = [];

  // Mapeia reservas por data para busca instantânea O(1)
  const mapaReservasPorData = new Map<string, Reserva[]>();
  for (const r of reservas) {
    if (r.status === "cancelada") continue;
    const lista = mapaReservasPorData.get(r.data) || [];
    lista.push(r);
    mapaReservasPorData.set(r.data, lista);
  }

  function criarDia(dataIso: string, diaNumero: number, diaSemana: number, mesAtual: boolean): DiaCalendarioMensal {
    const doDia = mapaReservasPorData.get(dataIso) || [];
    let totalBloqueios = 0;
    let totalReservas = 0;
    let totalHorariosOcupados = 0;

    for (const r of doDia) {
      if (r.tipoReserva === "manutencao_bloqueio") {
        totalBloqueios++;
      } else {
        totalReservas++;
      }
      totalHorariosOcupados += r.horarios.length;
    }

    return {
      data: dataIso,
      diaNumero,
      diaSemana,
      mesAtual,
      isHoje: dataIso === hojeStr,
      totalReservas,
      totalBloqueios,
      totalHorariosOcupados,
    };
  }

  // 1. Preenchimento dos dias finais do mês anterior
  const anoAnt = mes === 1 ? ano - 1 : ano;
  const mesAnt = mes === 1 ? 12 : mes - 1;
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const diaNum = totalDiasMesAnterior - i;
    const dataIso = `${anoAnt}-${String(mesAnt).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`;
    const diaSemana = (diaSemanaInicio - 1 - i) % 7;
    grid.push(criarDia(dataIso, diaNum, diaSemana, false));
  }

  // 2. Dias do mês atual
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const dataIso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const diaSemana = (diaSemanaInicio + dia - 1) % 7;
    grid.push(criarDia(dataIso, dia, diaSemana, true));
  }

  // 3. Preenchimento dos dias iniciais do próximo mês para completar a última semana
  const restoSemana = grid.length % 7;
  if (restoSemana !== 0) {
    const diasParaCompletar = 7 - restoSemana;
    const anoProx = mes === 12 ? ano + 1 : ano;
    const mesProx = mes === 12 ? 1 : mes + 1;

    for (let dia = 1; dia <= diasParaCompletar; dia++) {
      const dataIso = `${anoProx}-${String(mesProx).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const diaSemana = (grid.length) % 7;
      grid.push(criarDia(dataIso, dia, diaSemana, false));
    }
  }

  return grid;
}

/**
 * Calcula o resumo consolidado de ocupação do mês.
 *
 * @param ano Ano com 4 dígitos
 * @param mes Mês de 1 a 12
 * @param dias Lista de dias gerados para o mês
 * @returns Estatísticas consolidadas
 */
export function calcularResumoMes(
  ano: number,
  mes: number,
  dias: DiaCalendarioMensal[]
): ResumoMesAdmin {
  const diasMesAtual = dias.filter((d) => d.mesAtual);

  let totalReservas = 0;
  let totalBloqueios = 0;
  let totalHorariosOcupados = 0;
  let diasComReservas = 0;

  for (const d of diasMesAtual) {
    totalReservas += d.totalReservas;
    totalBloqueios += d.totalBloqueios;
    totalHorariosOcupados += d.totalHorariosOcupados;
    if (d.totalReservas > 0) {
      diasComReservas++;
    }
  }

  return {
    ano,
    mes,
    totalReservas,
    totalBloqueios,
    totalHorariosOcupados,
    diasComReservas,
  };
}

/**
 * Verifica se a navegação temporal para determinado mês é permitida.
 * Permite retroceder ao passado ilimitadamente e avançar até LIMITE_MESES_FUTURO meses à frente.
 *
 * @param ano Ano atual exibido
 * @param mes Mês atual exibido (1..12)
 * @param dataReferencia Data base (geralmente data de hoje)
 * @returns Indicadores booleanos para navegação anterior/posterior
 */
export function isNavegacaoMesPermitida(
  ano: number,
  mes: number,
  dataReferencia: Date = new Date()
): { podeVoltar: boolean; podeAvancar: boolean } {
  const refAno = dataReferencia.getFullYear();
  const refMes = dataReferencia.getMonth() + 1; // 1..12

  // Diferença em meses entre o mês alvo e a referência de hoje
  const diferencaMeses = (ano - refAno) * 12 + (mes - refMes);

  return {
    podeVoltar: true, // Sempre pode consultar o histórico passado
    podeAvancar: diferencaMeses < LIMITE_MESES_FUTURO,
  };
}

/**
 * Retorna o nome por extenso do mês em Português.
 */
export function getNomeMesExtenso(mes: number): string {
  const nomes = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return nomes[mes - 1] ?? "";
}

/**
 * Converte uma string de horário "HH:MM" para o número total de minutos desde a meia-noite (0..1440).
 *
 * @param horario Horário no formato "HH:MM" (ex.: "16:00", "17:30")
 * @returns Quantidade total de minutos transcorridos no dia
 * @example
 * ```ts
 * horarioParaMinutos("16:00"); // 960
 * horarioParaMinutos("17:18"); // 1038
 * ```
 */
export function horarioParaMinutos(horario: string): number {
  if (!horario || typeof horario !== "string") return 0;
  const [h, m] = horario.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Retorna a data local atual no formato padrão ISO "YYYY-MM-DD".
 *
 * @returns Data formatada "YYYY-MM-DD"
 */
export function obterDataHojeLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Formata um valor de minutos restantes em uma string amigável "MM:SS" para exibição em cronômetros.
 *
 * @param minutosRestantes Quantidade de minutos restantes (pode conter frações de minuto)
 * @returns Texto formatado "MM:SS" (ex: "45:30", "02:15")
 */
export function formatarTempoRestante(minutosRestantes: number): string {
  const m = Math.max(0, Math.floor(minutosRestantes));
  const s = Math.max(0, Math.round((minutosRestantes - Math.floor(minutosRestantes)) * 60));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Retorna o progresso normalizado [0..1] de uma reserva atualmente em andamento.
 * Retorna estritamente `null` se a reserva não estiver acontecendo exatamente agora.
 *
 * Regra de Ouro da Timeline:
 * 1. Apenas exibe progresso ativo se a data visualizada for EXATAMENTE a data de hoje
 *    e a reserva também pertencer ao dia de hoje (`dataExibida === hoje && reserva.data === hoje`).
 *    Para datas futuras ou passadas, o retorno é obrigatoriamente `null`.
 * 2. O horário atual (`minutosAgora`) deve estar dentro do intervalo [inicio, fim).
 *
 * @param reserva Objeto da reserva a ser analisada
 * @param dataExibida Data selecionada na visualização da agenda (YYYY-MM-DD)
 * @param minutosAgora Minutos atuais transcorridos no dia (ex: 17:18 = 1038)
 * @param hojeStr Data de hoje opcional (para injeção e testes determinísticos)
 * @returns Valor entre 0 e 1 indicando o percentual decorrido, ou null caso não esteja ativa
 * @example
 * ```ts
 * // Hoje é 2026-10-06, 17:18 (1038 min). Reserva no domingo 2026-10-11 das 16:00 às 20:00:
 * calcularProgressoAtivo(reservaDomingo, "2026-10-11", 1038, "2026-10-06"); // null (não ativo!)
 *
 * // Hoje é 2026-10-06, 17:00 (1020 min). Reserva hoje das 16:00 às 18:00:
 * calcularProgressoAtivo(reservaHoje, "2026-10-06", 1020, "2026-10-06"); // 0.5 (50% concluído)
 * ```
 */
export function calcularProgressoAtivo(
  reserva: Reserva,
  dataExibida: string,
  minutosAgora: number,
  hojeStr?: string
): number | null {
  const hoje = hojeStr ?? obterDataHojeLocal();

  // Se a data exibida não for hoje, ou se a reserva não for de hoje, nunca está em andamento agora
  if (dataExibida !== hoje || reserva.data !== hoje) {
    return null;
  }

  const inicio = horarioParaMinutos(reserva.horaInicio);
  const fim = horarioParaMinutos(reserva.horaFim);

  if (fim <= inicio) {
    return null;
  }

  if (minutosAgora < inicio || minutosAgora >= fim) {
    return null;
  }

  return (minutosAgora - inicio) / (fim - inicio);
}
