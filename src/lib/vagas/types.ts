/**
 * Tipos e Definições de Domínio para o Sistema de Vagas Abertas.
 * Permite que organizadores de partidas abram vagas para jogadores avulsos
 * e que interessados solicitem participação com total isenção de responsabilidade da arena.
 */

import { NOME_PRODUTO } from "@/lib/marca";
import type { Esporte } from "@/lib/quadras";

/**
 * Status do interesse de um jogador em participar da partida:
 * - 'pendente': O jogador clicou em "Mostrar Interesse" e aguarda contato do organizador.
 * - 'contatado': O organizador já visualizou e entrou em contato via WhatsApp.
 * - 'rejeitado': O organizador optou por não selecionar este jogador.
 */
export type StatusInteresse = "pendente" | "contatado" | "rejeitado";

/**
 * Entidade que registra a manifestação de interesse de um jogador autenticado
 * em uma reserva com vagas abertas.
 */
export interface InteresseVaga {
  /** Identificador único do interesse */
  id: string;
  /** Identificador da reserva vinculada */
  reservaId: string;
  /** Identificador do usuário que demonstrou interesse */
  usuarioId: string;
  /** Nome completo do usuário interessado */
  nomeUsuario: string;
  /** Telefone/WhatsApp com DDD do usuário interessado */
  telefoneUsuario: string;
  /** Status atual da tratativa */
  status: StatusInteresse;
  /** Data e hora em formato ISO da manifestação de interesse */
  criadoEm: string;
}

/**
 * Dados necessários para o organizador abrir ou atualizar as vagas de sua reserva.
 */
export interface DadosAberturaVagas {
  /** Identificador da reserva a ser modificada */
  reservaId: string;
  /** Quantidade de vagas disponíveis para novos jogadores (mínimo 1) */
  vagasAbertas: number;
  /** Confirmação obrigatória de leitura e aceite dos termos de responsabilidade */
  aceitouTermos: boolean;
}

/**
 * Dados necessários para um jogador demonstrar interesse em uma vaga aberta.
 */
export interface DadosInteresseVaga {
  /** Identificador da reserva alvo */
  reservaId: string;
  /** Identificador do usuário interessado */
  usuarioId: string;
  /** Nome do usuário interessado */
  nomeUsuario: string;
  /** Telefone de contato do interessado */
  telefoneUsuario: string;
  /** Confirmação obrigatória do termo de isenção de responsabilidade */
  aceitouTermos: boolean;
}

/**
 * Modelo enriquecido de uma vaga disponível exibida no "Mural de Vagas".
 * Reúne informações da quadra, horário, organizador e contagem de vagas.
 */
export interface VagaDisponivelItem {
  /** ID da reserva correspondente */
  reservaId: string;
  /** Data do agendamento (YYYY-MM-DD) */
  data: string;
  /** Horário de início (ex: '19:00') */
  horaInicio: string;
  /** Horário de término (ex: '20:00') */
  horaFim: string;
  /** Identificador da quadra */
  quadraId: string;
  /** Número da quadra para exibição */
  quadraNumero: number;
  /** Nome ou descrição da quadra */
  quadraDescricao: string;
  /** Modalidade esportiva da reserva */
  esporte?: Esporte;
  /** ID do organizador que fez a reserva */
  organizadorId?: string;
  /** Primeiro nome ou nome completo do organizador */
  organizadorNome: string;
  /** Quantidade atual de vagas ainda abertas */
  vagasAbertas: number;
  /** Quantidade total de pessoas que já demonstraram interesse */
  totalInteressados: number;
}

/**
 * Termo legal rigoroso de isenção de responsabilidade para o organizador.
 * O organizador deve aceitar este termo ao habilitar vagas.
 */
export const TERMO_RESPONSABILIDADE_ORGANIZADOR =
  "Ao abrir vagas para sua reserva, você declara estar ciente de que a organização, " +
  "seleção de participantes, cobrança de valores (rateio) e qualquer conduta ou dano " +
  "causado pelos convidados são de sua inteira e exclusiva responsabilidade. " +
  `A Arena e a plataforma ${NOME_PRODUTO} não intermedeiam pagamentos de rateio, não realizam ` +
  "triagem de jogadores e não se responsabilizam por faltas, calotes, lesões, brigas ou qualquer " +
  "outro incidente decorrente deste convite. O gerenciamento destas vagas é de sua total responsabilidade.";

/**
 * Termo legal rigoroso de isenção de responsabilidade para o interessado.
 * O jogador deve aceitar este termo ao solicitar participação.
 */
export const TERMO_RESPONSABILIDADE_INTERESSADO =
  "Ao demonstrar interesse nesta vaga, seu número de telefone/WhatsApp será compartilhado " +
  "com o organizador da partida, que poderá entrar em contato com você. O rateio de valores " +
  "e as regras do jogo são combinados diretamente com o organizador. A Arena e a plataforma " +
  `${NOME_PRODUTO} não têm qualquer envolvimento ou responsabilidade sobre cobranças, qualidade do jogo, ` +
  "cancelamentos por parte do organizador ou eventuais incidentes. O acordo é feito exclusivamente entre você e o organizador.";
