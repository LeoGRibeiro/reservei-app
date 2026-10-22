/**
 * Serviço de Regras de Negócio e Validações do Sistema de Vagas Abertas.
 * Funções puras e isoladas para facilitar testes unitários abrangentes e alta manutenibilidade.
 */

import type { Reserva } from "@/store/useReservasStore";
import { obterQuadrasCatalogo } from "@/store/useCatalogoArenaStore";
import { getHoje } from "@/lib/constants";
import type {
  DadosAberturaVagas,
  DadosInteresseVaga,
  InteresseVaga,
  VagaDisponivelItem,
} from "./types";

/**
 * Valida a abertura ou atualização de vagas por parte do organizador de uma reserva.
 *
 * @param dados Dados informados pelo organizador
 * @param reserva Objeto da reserva a ser modificada
 * @returns Objeto com indicador de validade e lista de mensagens de erro
 *
 * @example
 * ```ts
 * const validacao = validarAberturaVagas({ reservaId: "r1", vagasAbertas: 3, aceitouTermos: true }, reserva);
 * if (!validacao.valido) console.error(validacao.erros);
 * ```
 */
export function validarAberturaVagas(
  dados: DadosAberturaVagas,
  reserva?: Reserva
): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  if (!reserva) {
    erros.push("Reserva não encontrada.");
    return { valido: false, erros };
  }

  if (reserva.status === "cancelada") {
    erros.push("Não é possível abrir vagas para uma reserva cancelada.");
  }

  const hoje = getHoje();
  if (reserva.data < hoje) {
    erros.push("Não é possível abrir vagas para reservas em datas passadas.");
  }

  if (
    !Number.isInteger(dados.vagasAbertas) ||
    dados.vagasAbertas < 1 ||
    dados.vagasAbertas > 30
  ) {
    erros.push("O número de vagas abertas deve ser um valor inteiro entre 1 e 30.");
  }

  if (!dados.aceitouTermos) {
    erros.push(
      "É obrigatório concordar com os termos de responsabilidade e rateio para abrir vagas."
    );
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

/**
 * Valida a solicitação de participação de um jogador em uma reserva com vagas abertas.
 *
 * @param dados Dados da solicitação de interesse do jogador
 * @param reserva Objeto da reserva em que o jogador quer participar
 * @param interessesExistentes Lista com os interesses já registrados no sistema
 * @returns Objeto com indicador de validade e lista de erros
 */
export function validarDemonstracaoInteresse(
  dados: DadosInteresseVaga,
  reserva?: Reserva,
  interessesExistentes: InteresseVaga[] = []
): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  if (!reserva) {
    erros.push("Reserva não encontrada.");
    return { valido: false, erros };
  }

  if (reserva.status === "cancelada") {
    erros.push("Esta reserva foi cancelada e não aceita mais participantes.");
  }

  const hoje = getHoje();
  if (reserva.data < hoje) {
    erros.push("Não é possível manifestar interesse em horários já encerrados.");
  }

  if (!reserva.permiteVagas || (reserva.vagasAbertas ?? 0) <= 0) {
    erros.push("Esta reserva não possui vagas abertas no momento.");
  }

  if (!dados.usuarioId || dados.usuarioId.trim() === "") {
    erros.push("É necessário estar autenticado para demonstrar interesse.");
  }

  if (reserva.userId && reserva.userId === dados.usuarioId) {
    erros.push("Você não pode solicitar vaga na sua própria reserva.");
  }

  const jaTemInteresse = interessesExistentes.some(
    (i) =>
      i.reservaId === dados.reservaId &&
      i.usuarioId === dados.usuarioId &&
      i.status !== "rejeitado"
  );

  if (jaTemInteresse) {
    erros.push("Você já manifestou interesse nesta vaga anteriormente.");
  }

  if (!dados.nomeUsuario || dados.nomeUsuario.trim().length < 2) {
    erros.push("Nome do usuário inválido.");
  }

  const digitosTelefone = (dados.telefoneUsuario || "").replace(/\D/g, "");
  if (digitosTelefone.length < 8) {
    erros.push("Número de WhatsApp/telefone inválido para contato.");
  }

  if (!dados.aceitouTermos) {
    erros.push(
      "É obrigatório aceitar o termo de responsabilidade para enviar seu contato ao organizador."
    );
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

/**
 * Constrói o objeto de registro de interesse após validação bem-sucedida.
 *
 * @param dados Dados validados do interesse
 * @returns Instância de InteresseVaga com ID e timestamp
 */
export function construirInteresseVaga(dados: DadosInteresseVaga): InteresseVaga {
  return {
    id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reservaId: dados.reservaId,
    usuarioId: dados.usuarioId,
    nomeUsuario: dados.nomeUsuario.trim(),
    telefoneUsuario: dados.telefoneUsuario.trim(),
    status: "pendente",
    criadoEm: new Date().toISOString(),
  };
}

/**
 * Converte e filtra a lista de reservas ativas em itens prontos para exibição no Mural de Vagas.
 *
 * @param reservas Todas as reservas da plataforma
 * @param interesses Lista de todos os interesses registrados
 * @param dataReferencia Data base (padrão é o dia de hoje)
 * @returns Lista ordenada de vagas abertas disponíveis
 */
export function montarVagasDisponiveis(
  reservas: Reserva[],
  interesses: InteresseVaga[] = [],
  dataReferencia?: string
): VagaDisponivelItem[] {
  const baseData = dataReferencia || getHoje();

  const reservasComVagas = reservas.filter(
    (r) =>
      r.permiteVagas === true &&
      (r.vagasAbertas ?? 0) > 0 &&
      r.status !== "cancelada" &&
      r.data >= baseData
  );

  return reservasComVagas
    .map((r) => {
      const quadra = obterQuadrasCatalogo().find((q) => q.id === r.quadraId);
      const totalInteressados = interesses.filter(
        (i) => i.reservaId === r.id
      ).length;

      return {
        reservaId: r.id,
        data: r.data,
        horaInicio: r.horaInicio,
        horaFim: r.horaFim,
        quadraId: r.quadraId,
        quadraNumero: quadra?.numero ?? 1,
        quadraDescricao: quadra?.descricao ?? `Quadra ${quadra?.numero || 1}`,
        esporte: r.esporte,
        organizadorId: r.userId,
        organizadorNome: r.nomeCliente || "Organizador",
        vagasAbertas: r.vagasAbertas ?? 0,
        totalInteressados,
      };
    })
    .sort((a, b) => {
      if (a.data !== b.data) {
        return a.data.localeCompare(b.data);
      }
      return a.horaInicio.localeCompare(b.horaInicio);
    });
}

/**
 * Retorna os interessados em uma reserva específica, ordenados por data de manifestação.
 *
 * @param reservaId Identificador da reserva
 * @param interesses Lista geral de interesses
 * @returns Lista filtrada e ordenada de interessados
 */
export function obterInteressadosDaReserva(
  reservaId: string,
  interesses: InteresseVaga[]
): InteresseVaga[] {
  return interesses
    .filter((i) => i.reservaId === reservaId)
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

/**
 * Retorna a quantidade de interessados pendentes de contato para uma reserva.
 * Utilizado para badges de notificação visual.
 *
 * @param reservaId Identificador da reserva
 * @param interesses Lista geral de interesses
 * @returns Quantidade de interessados pendentes
 */
export function contarInteressadosPendentes(
  reservaId: string,
  interesses: InteresseVaga[]
): number {
  return interesses.filter(
    (i) => i.reservaId === reservaId && i.status === "pendente"
  ).length;
}
