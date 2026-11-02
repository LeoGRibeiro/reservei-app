/**
 * Entidades, Interfaces e Tipos de Domínio do Sistema de Fidelidade.
 * Conforme especificação em SPEC/2026-10-05-sistema-fidelidade.md.
 */

/**
 * Representa a campanha de fidelidade ativa configurada pela arena.
 */
export interface CampanhaFidelidade {
  /** Identificador único da campanha (ex: 'campanha_padrao') */
  id: string;
  /** Nome amigável da campanha exibido para os clientes */
  nome: string;
  /** Quantidade de horas de quadra concluídas necessárias para conquistar a recompensa (padrão: 12) */
  horasNecessarias: number;
  /** Janela de validade em meses para os selos acumulados (padrão: 3 meses) */
  mesesValidade: number;
  /** Prazo em dias corridos para o cliente usufruir do voucher após conquistado */
  diasValidadeVoucher: number;
  /** Se o programa de fidelidade está ativo para novos acúmulos */
  ativo: boolean;
  /** Data da última alteração de configuração */
  atualizadoEm: string;
}

/**
 * Representa um selo/carimbo conquistado por uma hora ou conjunto de horas jogadas em uma reserva.
 */
export interface SeloFidelidade {
  /** Identificador único do registro de selo */
  id: string;
  /** Identificador do usuário titular */
  usuarioId: string;
  /** Identificador da reserva que originou este selo */
  reservaId: string;
  /** Quantidade de horas contabilizadas nesta reserva (ex: 1, 2) */
  horasContabilizadas: number;
  /** Valor pago por hora nesta reserva (usado para compor o ticket médio) */
  valorPorHora: number;
  /** Valor total da reserva original */
  valorTotalReserva: number;
  /** Data em que o jogo ocorreu (formato YYYY-MM-DD) */
  dataJogo: string;
  /** Timestamp de registro do selo */
  criadoEm: string;
  /** Data em que este selo específico expira caso a cartela não seja fechada */
  expiraEm: string;
  /** Indica se este selo já foi consolidado/resgatado em um voucher */
  resgatado: boolean;
  /** ID do voucher em que foi consolidado, se aplicável */
  voucherId?: string | null;
}

/**
 * Status possíveis de um voucher de fidelidade.
 *
 * - `em_analise`: bateu a meta; aguarda o dono (ou gerente) liberar ou recusar.
 * - `disponivel`: liberado; o atleta vê e usa no Clube.
 * - `recusado`: o dono recusou, com motivo.
 * - `utilizado` / `expirado`: usado numa reserva ou vencido.
 *
 * @see SPEC/2026-11-02-admin-ajustes-demo.md §10
 */
export type StatusVoucherFidelidade = "em_analise" | "disponivel" | "recusado" | "utilizado" | "expirado";

/**
 * Representa a recompensa em forma de voucher gerada para o cliente.
 */
export interface VoucherFidelidade {
  /** Identificador único do voucher */
  id: string;
  /** Código único amigável para exibição e conferência (ex: FID-9A4B-2026) */
  codigo: string;
  /** Identificador do usuário beneficiário */
  usuarioId: string;
  /** Valor máximo de abatimento no checkout (calculado pelo Ticket Médio das horas cumpridas) */
  valorTeto: number;
  /** Status atual de usabilidade do voucher */
  status: StatusVoucherFidelidade;
  /** Timestamp de concessão do voucher */
  criadoEm: string;
  /** Data limite para utilização */
  expiraEm: string;
  /** Identificador da reserva onde o voucher foi aplicado, se já utilizado */
  reservaUtilizadaId?: string | null;
  /** Timestamp do momento em que o voucher foi consumido */
  utilizadoEm?: string | null;
  /** Quem liberou ou recusou (dono ou gerente) */
  analisadoPorNome?: string | null;
  /** Quando foi liberado ou recusado */
  analisadoEm?: string | null;
  /** Motivo da recusa (ou observação da liberação) */
  motivoAnalise?: string | null;
}

/**
 * Representa o estado agregado do progresso de fidelidade de um cliente específico.
 */
export interface ProgressoFidelidadeUsuario {
  /** Identificador do usuário */
  usuarioId: string;
  /** Total de horas ativas válidas acumuladas (não expiradas e não resgatadas) */
  totalHorasAtivas: number;
  /** Meta de horas da campanha atual */
  horasNecessarias: number;
  /** Percentual do progresso (0 a 100%) */
  percentualConcluido: number;
  /** Ticket médio atual calculado a partir dos selos ativos acumulados */
  ticketMedioAtual: number;
  /** Lista de selos ativos que compõem a cartela atual */
  selosAtivos: SeloFidelidade[];
  /** Selos que já expiraram sem fechamento da cartela */
  selosExpirados: SeloFidelidade[];
  /** Selos já convertidos em vouchers */
  selosResgatados: SeloFidelidade[];
  /** Vouchers disponíveis prontos para serem usados no checkout */
  vouchersDisponiveis: VoucherFidelidade[];
  /** Histórico de vouchers passados (utilizados ou expirados) */
  vouchersHistorico: VoucherFidelidade[];
  /** Data de expiração do selo ativo mais antigo (alerta de urgência) */
  proximoSeloExpirandoEm: string | null;
  /** Dias restantes até o próximo selo ativo expirar */
  diasParaProximoSeloExpirar: number | null;
  /** Indica se o cliente atingiu a meta e pode emitir o voucher */
  podeResgatar: boolean;
}

/**
 * Resultado da aplicação de um voucher sobre um valor de reserva.
 */
export interface ResultadoCalculoDescontoVoucher {
  /** Valor original da reserva */
  valorOriginal: number;
  /** Valor de desconto efetivamente aplicado (respeita o teto do voucher e o total) */
  valorDesconto: number;
  /** Valor final que o cliente deverá pagar (0 se for 100% coberto) */
  valorFinal: number;
  /** Se a reserva foi 100% gratuita */
  reservaGratuita: boolean;
  /** Sobra residual do teto do voucher (não cumulativo para próximas reservas) */
  diferencaNaoUtilizada: number;
}
