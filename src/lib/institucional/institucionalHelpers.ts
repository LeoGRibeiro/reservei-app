/**
 * @module institucional/institucionalHelpers
 *
 * Funções auxiliares e de validação para o módulo institucional.
 * Formatação de links WhatsApp para agendamento de aula experimental,
 * ordenação e filtros puros de galeria e escolinhas.
 */

import type {
  GaleriaItem,
  EscolinhaItem,
  FiltroCategoriaGaleria,
  CriarGaleriaInput,
  CriarEscolinhaInput,
} from "./types";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";
import { DIAS_SEMANA } from "@/lib/recorrencia/types";

/**
 * Gera a URL formatada do WhatsApp com texto pré-preenchido para contato
 * direto com o professor da escolinha, conforme requisito 2.2 da especificação.
 *
 * @param escolinha Dados da escolinha e professor
 * @param nomeArena Nome da arena citado na mensagem
 * @returns URL completa para abertura do WhatsApp web ou app
 *
 * @example
 * const link = gerarLinkWhatsAppEscolinha(escolinha, "Arena Central");
 * // "https://wa.me/5511988887777?text=..."
 */
export function gerarLinkWhatsAppEscolinha(escolinha: EscolinhaItem, nomeArena = "arena"): string {
  const digitos = escolinha.whatsappNumber.replace(/\D/g, "");
  // Adiciona DDI 55 do Brasil se não estiver presente
  const numeroCompleto = digitos.startsWith("55") ? digitos : `55${digitos}`;

  const mensagem =
    `Olá ${escolinha.teacherName}! Tenho interesse na escolinha de *${escolinha.sportName}* na ${nomeArena} ` +
    `e gostaria de saber sobre horários disponíveis e agendar uma aula experimental.`;

  return `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Filtra e ordena itens da galeria de fotos.
 *
 * @param itens Lista de fotos da galeria
 * @param filtro Categoria selecionada ("todas", "quadras", "bar", etc.)
 * @param apenasAtivos Se true, omite fotos inativas (para exibição pública)
 */
export function filtrarGaleria(
  itens: readonly GaleriaItem[],
  filtro: FiltroCategoriaGaleria = "todas",
  apenasAtivos = true
): GaleriaItem[] {
  return itens
    .filter((item) => (apenasAtivos ? item.isActive : true))
    .filter((item) => (filtro === "todas" ? true : item.categoria === filtro))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Filtra e ordena a lista de escolinhas esportivas.
 *
 * @param escolinhas Lista completa de escolinhas
 * @param apenasAtivas Se true, omite escolinhas inativas
 */
export function filtrarEscolinhas(
  escolinhas: readonly EscolinhaItem[],
  apenasAtivas = true
): EscolinhaItem[] {
  return escolinhas
    .filter((item) => (apenasAtivas ? item.isActive : true))
    .sort((a, b) => a.sportName.localeCompare(b.sportName));
}

/**
 * Valida os campos obrigatórios para cadastro ou edição de foto na galeria.
 */
export function validarItemGaleria(input: CriarGaleriaInput): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  if (!input.title || input.title.trim().length < 3) {
    erros.push("O título do espaço deve ter pelo menos 3 caracteres.");
  }
  if (!input.description || input.description.trim().length < 5) {
    erros.push("A descrição deve conter no mínimo 5 caracteres.");
  }
  if (!input.imageUrl || !input.imageUrl.trim().startsWith("http")) {
    erros.push("Informe uma URL de imagem válida (começando com http/https).");
  }
  if (!["quadras", "bar", "vestiarios", "lazer"].includes(input.categoria)) {
    erros.push("Selecione uma categoria válida para o ambiente.");
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

/**
 * Valida os dados para cadastro ou edição de uma escolinha esportiva.
 */
export function validarItemEscolinha(input: CriarEscolinhaInput): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  if (!input.sportName || input.sportName.trim().length < 2) {
    erros.push("O nome do esporte deve ter pelo menos 2 caracteres.");
  }
  if (!input.teacherName || input.teacherName.trim().length < 3) {
    erros.push("O nome do professor deve ter pelo menos 3 caracteres.");
  }
  if (!input.scheduleInfo || input.scheduleInfo.trim().length < 3) {
    erros.push("Informe os dias e horários das aulas.");
  }

  const digitos = input.whatsappNumber ? input.whatsappNumber.replace(/\D/g, "") : "";
  if (digitos.length < 10 || digitos.length > 13) {
    erros.push("Informe um telefone/WhatsApp válido com DDD (10 a 11 dígitos).");
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

/**
 * Converte o código de esporte em nome legível para exibição na Landing Page.
 */
export function mapearNomeEsporte(esporte?: string, nomeContrato?: string): string {
  if (nomeContrato && nomeContrato.trim()) return nomeContrato;
  if (!esporte) return "Aulas Esportivas";
  switch (esporte.toLowerCase()) {
    case "tenis":
      return "Tênis de Campo";
    case "beach_tennis":
      return "Beach Tennis";
    case "futebol":
      return "Futebol Society";
    default:
      return esporte.charAt(0).toUpperCase() + esporte.slice(1);
  }
}

/**
 * Formata os dias da semana e horários de um contrato de escolinha
 * em texto amigável para exibição na Landing Page.
 *
 * @example
 * formatarHorariosContrato(contrato);
 * // "Ter e Qui: 08:00 às 10:00"
 */
export function formatarHorariosContrato(contrato: ContratoRecorrente): string {
  const diasNomes = contrato.diasSemana
    .map((diaNum) => DIAS_SEMANA.find((d) => d.valor === diaNum)?.curto || "")
    .filter(Boolean);

  const diasTexto = diasNomes.length > 0 ? diasNomes.join(" e ") : "Dias a combinar";
  return `${diasTexto}: ${contrato.horaInicio} às ${contrato.horaFim}`;
}

/**
 * Sincroniza a lista de escolinhas da Landing Page com os contratos existentes da agenda.
 * Atualiza automaticamente o nome, professor, horários e WhatsApp vindos da agenda,
 * preservando as fotos, faixas etárias e descrições personalizadas para a LP.
 */
export function sincronizarEscolinhasComContratos(
  escolinhasAtuais: readonly EscolinhaItem[],
  contratosEscolinhas: readonly ContratoRecorrente[]
): EscolinhaItem[] {
  const resultado = [...escolinhasAtuais];

  for (const contrato of contratosEscolinhas) {
    // Procura se já existe vinculação por contratoId ou por nome/esporte aproximado
    const indexExistente = resultado.findIndex(
      (e) =>
        e.contratoId === contrato.id ||
        e.sportName.toLowerCase() === contrato.nome.toLowerCase() ||
        (contrato.esporte && e.sportName.toLowerCase().includes(contrato.esporte.toLowerCase()))
    );

    const schedule = formatarHorariosContrato(contrato);
    const sportName = mapearNomeEsporte(contrato.esporte, contrato.nome);

    if (indexExistente >= 0) {
      // Atualiza os dados operacionais da agenda mantendo fotos e configurações de LP
      resultado[indexExistente] = {
        ...resultado[indexExistente],
        contratoId: contrato.id,
        sportName,
        teacherName: contrato.responsavelNome || resultado[indexExistente].teacherName,
        whatsappNumber: contrato.contatoWhatsapp || resultado[indexExistente].whatsappNumber,
        scheduleInfo: schedule,
      };
    } else {
      // Adiciona como nova escolinha pronta para receber fotos e ser divulgada
      resultado.push({
        id: `esc_sync_${contrato.id}`,
        contratoId: contrato.id,
        sportName,
        teacherName: contrato.responsavelNome,
        teacherImageUrl:
          contrato.fotoUrl || fallbackFotoPorEsporte(contrato.esporte),
        scheduleInfo: schedule,
        whatsappNumber: contrato.contatoWhatsapp,
        descricao: contrato.descricao || "Turmas abertas para matrícula e aulas experimentais.",
        faixaEtaria: contrato.faixaEtaria || "Todas as idades",
        isActive: contrato.ativo,
        createdAt: contrato.criadoEm || new Date().toISOString(),
      });
    }
  }

  return resultado;
}

/**
 * Fornece foto/avatar padrão com base na modalidade esportiva caso o contrato
 * ainda não possua uma foto personalizada enviada pelo admin.
 */
export function fallbackFotoPorEsporte(esporte?: string): string {
  switch (esporte?.toLowerCase()) {
    case "tenis":
      return "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80";
    case "beach_tennis":
      return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
    case "futebol":
      return "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80";
    default:
      return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
  }
}

/**
 * Converte diretamente um ContratoRecorrente de escolinha em um EscolinhaItem
 * consumido pela Landing Page e pelos componentes institucionais.
 * É a mesma entidade do banco (contratos_recorrentes).
 */
export function converterContratoParaEscolinhaItem(contrato: ContratoRecorrente): EscolinhaItem {
  return {
    id: contrato.id,
    contratoId: contrato.id,
    sportName: mapearNomeEsporte(contrato.esporte, contrato.nome),
    teacherName: contrato.responsavelNome,
    teacherImageUrl: contrato.fotoUrl || fallbackFotoPorEsporte(contrato.esporte),
    scheduleInfo: formatarHorariosContrato(contrato),
    whatsappNumber: contrato.contatoWhatsapp,
    descricao: contrato.descricao || "Turmas abertas para matrícula e aulas experimentais.",
    faixaEtaria: contrato.faixaEtaria || "Todas as idades",
    isActive: contrato.ativo,
    createdAt: contrato.criadoEm,
  };
}
