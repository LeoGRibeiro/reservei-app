/**
 * @module institucional/escolinhasSite
 *
 * Escolinha como aparece no site da arena (`landing_page_schools`), editada pelo dono no painel:
 * nome, esporte, professor, foto, descrição, turmas (dias, horários e categoria) e o botão
 * "Quero uma vaga", que abre o WhatsApp com mensagem pronta ou um link (formulário, site etc.).
 *
 * Funções puras: usadas pelo painel (formulário e validação), pelo repositório e pelo site.
 *
 * @see SPEC/2026-10-31-escolinhas-admin.md
 */

import { esporteNaFrase, linkWhatsApp } from "@/lib/portal/formatos";

/** Máximo de turmas por escolinha (o banco recusa mais que isso). */
export const MAX_TURMAS = 12;
/** Tamanho máximo do nome da escolinha. */
export const MAX_NOME = 60;
/** Tamanho máximo da mensagem pronta do WhatsApp. */
export const MAX_MENSAGEM = 500;

/** O que o botão "Quero uma vaga" faz. */
export type TipoBotaoEscolinha = "whatsapp" | "link";

/** Turma exibida no card: dias, horários e categoria (nível, idade ou público). */
export interface TurmaSite {
  /** Ex.: "Seg e Qua" */
  dias: string;
  /** Ex.: "7h e 8h" */
  horas: string;
  /** Ex.: "Iniciante", "6 a 10 anos" (opcional) */
  categoria: string;
}

/** Escolinha do site, como o painel edita. */
export interface EscolinhaSite {
  id: string;
  /** Nome da escolinha (ex.: "CT Falcão 12"); vazio = o site mostra o esporte como título */
  nome: string;
  /** Esporte (ex.: "Beach tennis"), usado na mensagem pronta */
  esporte: string;
  /** Nome do professor, sem "Prof." (o site acrescenta) */
  professor: string;
  /** Foto do professor; vazia = foto padrão */
  fotoProfessorUrl: string;
  descricao: string;
  turmas: TurmaSite[];
  tipoBotao: TipoBotaoEscolinha;
  /** WhatsApp que recebe os pedidos; vazio = WhatsApp da arena */
  whatsapp: string;
  /** Mensagem pronta; vazia = {@link mensagemPadraoEscolinha} */
  mensagemWhatsapp: string;
  /** Endereço do botão quando `tipoBotao` = "link" */
  linkBotao: string;
  /** Posição no site (menor primeiro) */
  ordem: number;
  /** Aparece no site */
  ativa: boolean;
}

/** Dados do formulário (sem id). */
export type EscolinhaSiteInput = Omit<EscolinhaSite, "id">;

/** Formulário vazio de uma escolinha nova. */
export function escolinhaVazia(ordem = 1): EscolinhaSiteInput {
  return {
    nome: "",
    esporte: "",
    professor: "",
    fotoProfessorUrl: "",
    descricao: "",
    turmas: [{ dias: "", horas: "", categoria: "" }],
    tipoBotao: "whatsapp",
    whatsapp: "",
    mensagemWhatsapp: "",
    linkBotao: "",
    ordem,
    ativa: true,
  };
}

/** Tira o "Prof." que o dono às vezes digita (o site já escreve "Prof. Fulano"). */
export function limparNomeProfessor(nome: string): string {
  return nome.trim().replace(/^prof(\.|ª|a\.|essora|essor)?(\s+|$)/i, "");
}

/**
 * Mensagem padrão do botão "Quero uma vaga", montada com o esporte e o professor.
 *
 * @example
 * mensagemPadraoEscolinha("Beach tennis", "Italo Bianck");
 * // "Olá! Vim pelo site e quero uma vaga no beach tennis com o Prof. Italo Bianck. Pode me passar os valores e as vagas das turmas?"
 */
export function mensagemPadraoEscolinha(esporte: string, professor: string): string {
  const esp = esporte.trim() ? esporteNaFrase(esporte.trim()) : "[esporte]";
  const prof = limparNomeProfessor(professor) || "[professor]";
  return `Olá! Vim pelo site e quero uma vaga no ${esp} com o Prof. ${prof}. Pode me passar os valores e as vagas das turmas?`;
}

/** Só os dígitos do WhatsApp, com o 55 do Brasil quando falta (vazio continua vazio). */
export function normalizarWhatsApp(numero: string): string {
  const d = numero.replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d;
}

/** Link é aceito só com https e sem espaços. */
export function linkValido(url: string): boolean {
  return /^https:\/\/[^\s]+\.[^\s]+$/i.test(url.trim()) && url.trim().length <= 500;
}

/** Turmas preenchidas (linhas totalmente vazias são ignoradas). */
export function turmasPreenchidas(turmas: readonly TurmaSite[]): TurmaSite[] {
  return turmas
    .map((t) => ({ dias: t.dias.trim(), horas: t.horas.trim(), categoria: t.categoria.trim() }))
    .filter((t) => t.dias || t.horas || t.categoria);
}

/**
 * Resumo em texto das turmas (guardado em `schedule_info` para telas e relatórios antigos).
 *
 * @example
 * resumirTurmas([{ dias: "Seg e Qua", horas: "16h", categoria: "Avançado" }]); // "Seg e Qua 16h"
 */
export function resumirTurmas(turmas: readonly TurmaSite[]): string {
  return turmasPreenchidas(turmas)
    .map((t) => `${t.dias} ${t.horas}`.trim())
    .join("; ");
}

/** Erros do formulário por campo (vazio = válido). */
export type ErrosEscolinha = Partial<Record<"esporte" | "professor" | "nome" | "turmas" | "whatsapp" | "linkBotao" | "mensagemWhatsapp", string>>;

/**
 * Valida o formulário da escolinha.
 *
 * Regras: esporte e professor obrigatórios; ao menos uma turma com dias e horários; no máximo
 * {@link MAX_TURMAS} turmas; WhatsApp (se informado) com DDD; link obrigatório e https quando o
 * botão é de link; mensagem até {@link MAX_MENSAGEM} caracteres.
 */
export function validarEscolinhaSite(input: EscolinhaSiteInput): ErrosEscolinha {
  const erros: ErrosEscolinha = {};
  if (!input.esporte.trim()) erros.esporte = "Informe o esporte (ex.: Beach tennis).";
  if (!limparNomeProfessor(input.professor)) erros.professor = "Informe o nome do professor.";
  if (input.nome.trim().length > MAX_NOME) erros.nome = `Use até ${MAX_NOME} caracteres.`;

  const turmas = turmasPreenchidas(input.turmas);
  if (turmas.length === 0) erros.turmas = "Cadastre pelo menos uma turma com dias e horários.";
  else if (turmas.some((t) => !t.dias || !t.horas)) erros.turmas = "Toda turma precisa de dias e horários.";
  else if (turmas.length > MAX_TURMAS) erros.turmas = `No máximo ${MAX_TURMAS} turmas por escolinha.`;

  const digitos = input.whatsapp.replace(/\D/g, "");
  if (digitos && (digitos.length < 10 || digitos.length > 13)) {
    erros.whatsapp = "Digite o número com DDD, ex.: (91) 98498-2865.";
  }
  if (input.tipoBotao === "link" && !linkValido(input.linkBotao)) {
    erros.linkBotao = "Cole o endereço completo, começando com https://";
  }
  if (input.mensagemWhatsapp.trim().length > MAX_MENSAGEM) {
    erros.mensagemWhatsapp = `Use até ${MAX_MENSAGEM} caracteres.`;
  }
  return erros;
}

/** Título do card no site: o nome da escolinha ou, sem nome, o esporte. */
export function tituloEscolinha(e: Pick<EscolinhaSite, "nome" | "esporte">): string {
  return e.nome.trim() || e.esporte.trim();
}

/**
 * Endereço do botão "Quero uma vaga".
 *
 * @param e Escolinha
 * @param whatsappArena WhatsApp da arena (dígitos com 55), usado quando a escolinha não tem número
 */
export function hrefBotaoEscolinha(
  e: Pick<EscolinhaSite, "tipoBotao" | "linkBotao" | "whatsapp" | "mensagemWhatsapp" | "esporte" | "professor">,
  whatsappArena: string
): string {
  if (e.tipoBotao === "link" && linkValido(e.linkBotao)) return e.linkBotao.trim();
  const numero = normalizarWhatsApp(e.whatsapp) || whatsappArena;
  return linkWhatsApp(numero, e.mensagemWhatsapp.trim() || mensagemPadraoEscolinha(e.esporte, e.professor));
}
