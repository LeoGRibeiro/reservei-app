/**
 * @file types.ts
 * @description Definições de tipos, contratos e entidades de domínio para a arquitetura
 * Multi-Tenant, flexibilidade de quadras e precificação dinâmica do ecossistema Reservei.
 */

import type { Esporte } from "@/lib/quadras";
import type { ModuloArena } from "./modulos";

/**
 * Tipos de piso suportados pelos complexos esportivos.
 */
export type TipoPisoQuadra =
  | "areia"
  | "society"
  | "saibro"
  | "pu_cimentado"
  | "madeira"
  | "outro";

/**
 * Papéis de acesso de usuários e operadores vinculados a uma arena específica (RBAC).
 */
export type ArenaUserRole = "proprietario" | "gerente" | "operador";

/**
 * Entidade que representa um estabelecimento esportivo (Tenant) na plataforma Reservei.
 */
export interface Arena {
  /** Identificador único primário da arena (ex: 'arena-padrao' ou UUID) */
  id: string;
  /** Slug exclusivo para acesso via URL amigável (ex: 'arena-central', 'arena-belem') */
  slug: string;
  /** Razão social ou nome fantasia do complexo esportivo */
  nome: string;
  /** CNPJ ou CPF do responsável legal (opcional) */
  cnpjCpf?: string;
  /** Telefone comercial fixo ou celular */
  telefone: string;
  /** Número de WhatsApp oficial para notificações e atendimento automatizado */
  whatsapp: string;
  /** E-mail oficial de contato */
  email?: string;
  /** Endereço físico completo */
  endereco?: string;
  /** Cidade onde a arena está localizada (ex: 'Belém') */
  cidade: string;
  /** Sigla do estado da federação (ex: 'PA') */
  estado: string;
  /** Código de Endereçamento Postal */
  cep?: string;
  /** URL pública do logotipo da arena hospedado no Supabase Storage */
  logoUrl?: string;
  /** Horário comercial padrão de abertura (formato 'HH:mm', ex: '06:00') */
  horarioAbertura: string;
  /** Horário comercial padrão de fechamento (formato 'HH:mm', ex: '23:00') */
  horarioFechamento: string;
  /** Duração em minutos dos blocos de locação (padrão: 60) */
  intervaloMinutos: number;
  /** Percentual mínimo exigido a título de sinal no checkout (ex: 50.00 para 50%) */
  percentualSinalMinimo: number;
  /** Tempo mínimo de antecedência em minutos para agendamento online (ex: 60) */
  antecedenciaMinimaMinutos: number;
  /** Indica se a arena está ativa na plataforma SaaS */
  ativo: boolean;
  /** Módulos (Feature Flags) contratados pela arena; ver `arenas.modulos_ativos` */
  modulosAtivos: ModuloArena[];
  /** Data e hora de cadastro da arena no sistema (ISO 8601) */
  criadaEm: string;
  /** Data e hora da última modificação dos dados cadastrais (ISO 8601) */
  atualizadaEm?: string;
}

/**
 * Entidade que representa uma quadra esportiva pertencente a uma Arena.
 */
export interface Quadra {
  /** Identificador único da quadra (ex: 'q1', 'q2' ou UUID) */
  id: string;
  /** Chave estrangeira que vincula a quadra ao seu respectivo Tenant (Arena) */
  arenaId: string;
  /** Número sequencial de identificação da quadra para ordenação e rótulo */
  numero: number;
  /** Nome amigável de exibição (ex: 'Quadra 1 - Areia Central') */
  nome: string;
  /** Descrição detalhada das características físicas ou comodidades */
  descricao?: string;
  /** Tipo de piso instalado na quadra */
  tipoPiso: TipoPisoQuadra;
  /** Lista de esportes aceitos e com marcação/equipamentos nesta quadra */
  esportes: Esporte[];
  /** Indica se a quadra é coberta (protegida contra chuva e sol excessivo) */
  coberta: boolean;
  /** Indica se a quadra conta com iluminação artificial para partidas noturnas */
  iluminacao: boolean;
  /** Tarifa base por hora (em Reais) caso nenhuma regra dinâmica seja aplicada */
  valorHoraPadrao: number;
  /** Ordem sequencial de exibição visual nos seletores e grades */
  ordem: number;
  /** Indica se a quadra está disponível para agendamento */
  ativa: boolean;
  /** Data de criação da quadra no sistema */
  criadaEm: string;
  /** Data da última alteração das configurações da quadra */
  atualizadaEm?: string;
}

/**
 * Regra de precificação dinâmica para faixas de horário e dias específicos da semana.
 */
export interface QuadraPreco {
  /** Identificador único da regra de preço */
  id: string;
  /** Identificador da arena à qual a regra pertence */
  arenaId: string;
  /** Identificador da quadra à qual a regra é aplicada */
  quadraId: string;
  /**
   * Array com os dias da semana em que a regra é válida.
   * Convenção: 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado.
   */
  diasSemana: number[];
  /** Horário de início da vigência da tarifa (inclusive, formato 'HH:mm', ex: '18:00') */
  horaInicio: string;
  /** Horário de término da vigência da tarifa (exclusive, formato 'HH:mm', ex: '23:00') */
  horaFim: string;
  /** Valor da hora cheia praticado dentro deste intervalo (em Reais) */
  valorHora: number;
  /** Rótulo descritivo da tarifa (ex: 'Horário Nobre Noturno com Refletores') */
  descricao?: string;
  /** Indica se a regra de precificação está ativa */
  ativo: boolean;
  /** Data de registro da regra */
  criadaEm: string;
}

/**
 * Vínculo de permissão entre um operador do painel administrativo e uma arena.
 */
export interface ArenaUsuario {
  /** Identificador do registro de vínculo */
  id: string;
  /** Identificador da arena vinculada */
  arenaId: string;
  /** Identificador do usuário no sistema */
  userId: string;
  /** Nível hierárquico de acesso */
  role: ArenaUserRole;
  /** Indica se o acesso está habilitado */
  ativo: boolean;
  /** Data de concessão da permissão */
  criadaEm: string;
}

/**
 * Detalhamento do valor calculado para cada slot de 1 hora individualmente.
 */
export interface DetalhePrecoHorario {
  /** Horário no formato 'HH:mm' (ex: '19:00') */
  horario: string;
  /** Valor cobrado para este horário específico (em Reais) */
  valor: number;
  /** Descrição da regra utilizada no cálculo (ex: 'Tarifa Noturna' ou 'Tarifa Base Padrão') */
  regraAplicada: string;
}

/**
 * Parâmetros de entrada para o cálculo dinâmico de valor de locação.
 */
export interface CalculoPrecoInput {
  /** Quadra selecionada */
  quadra: Quadra;
  /** Regras de preços cadastradas para a quadra ou arena */
  precos: QuadraPreco[];
  /** Data da locação no formato 'YYYY-MM-DD' (ex: '2026-10-20') */
  data: string;
  /** Lista de horários selecionados (ex: ['18:00', '19:00']) */
  horarios: string[];
  /** Percentual mínimo de sinal exigido (opcional; se omitido, assume 50%) */
  percentualSinal?: number;
}

/**
 * Resultado completo do cálculo transacional de tarifas de locação.
 */
export interface CalculoPrecoResultado {
  /** Soma total dos valores de todas as horas selecionadas */
  valorTotal: number;
  /** Valor monetário do sinal mínimo obrigatório para confirmação */
  valorSinal: number;
  /** Saldo restante a ser quitado no balcão da arena */
  valorPendente: number;
  /** Lista itemizada com o valor e a regra aplicada para cada hora */
  detalhamento: DetalhePrecoHorario[];
}
