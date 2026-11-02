/**
 * @module institucional/escolinhasSite
 *
 * Escolinha como aparece no site da arena (`landing_page_schools`), editada pelo dono no painel:
 * nome, esporte, professor, foto, descrição, turmas e o botão "Quero uma vaga", que abre o WhatsApp
 * com mensagem pronta ou um link (formulário, site etc.).
 *
 * Cada turma tem dias da semana, início e fim; o texto do site ("Ter e Qui", "8h e 9h") é montado a
 * partir deles. Com "Bloquear na agenda", a turma vira um contrato recorrente na quadra escolhida
 * (`contratos_recorrentes`, ligado à escolinha por `escolinha_id`), como no cadastro antigo.
 *
 * Funções puras: usadas pelo painel (formulário e validação), pelo repositório e pelo site.
 *
 * @see SPEC/2026-10-31-escolinhas-admin.md
 */

import { esporteNaFrase, linkWhatsApp } from "@/lib/portal/formatos";
import { ESPORTES, type Esporte } from "@/lib/quadras";
import { DIAS_SEMANA, type ContratoRecorrente, type DiaSemana } from "@/lib/recorrencia/types";

/** Máximo de turmas por escolinha (o banco recusa mais que isso). */
export const MAX_TURMAS = 12;
/** Tamanho máximo do nome da escolinha. */
export const MAX_NOME = 60;
/** Tamanho máximo da mensagem pronta do WhatsApp. */
export const MAX_MENSAGEM = 500;

/** O que o botão "Quero uma vaga" faz. */
export type TipoBotaoEscolinha = "whatsapp" | "link";

/** Turma: dias da semana, horário e categoria; opcionalmente bloqueia a quadra na agenda. */
export interface TurmaSite {
  /** Texto dos dias no site (ex.: "Ter e Qui"), montado a partir de `diasSemana` */
  dias: string;
  /** Texto dos horários no site (ex.: "8h e 9h"), montado a partir de início e fim */
  horas: string;
  /** Ex.: "Iniciante", "6 a 10 anos" (opcional) */
  categoria: string;
  /** Dias da semana (0 = domingo) */
  diasSemana: DiaSemana[];
  /** Início da primeira aula ("08:00") */
  horaInicio: string;
  /** Fim da última aula ("10:00") */
  horaFim: string;
  /** Bloqueia a quadra nesses dias e horários (cria o contrato na agenda) */
  bloquearAgenda: boolean;
  /** Quadra bloqueada na agenda */
  quadraId: string;
  /** Contrato da agenda já criado para esta turma (vazio = ainda não bloqueada) */
  contratoId: string;
}

/** Turma em branco (bloqueia a agenda por padrão, na quadra informada). */
export function turmaVazia(quadraId = ""): TurmaSite {
  return { dias: "", horas: "", categoria: "", diasSemana: [], horaInicio: "", horaFim: "", bloquearAgenda: true, quadraId, contratoId: "" };
}

/** Ordem de leitura dos dias: segunda primeiro, domingo por último. */
const ORDEM_DIAS: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];
const curto = (d: DiaSemana) => DIAS_SEMANA.find((x) => x.valor === d)?.curto ?? "";

/**
 * Texto dos dias como o aluno lê.
 *
 * @example
 * textoDias([4, 2]); // "Ter e Qui"
 * textoDias([1, 2, 3, 4, 5]); // "Seg a Sex"
 * textoDias([6]); // "Sábado"
 */
export function textoDias(dias: readonly DiaSemana[]): string {
  const ordenados = ORDEM_DIAS.filter((d) => dias.includes(d));
  if (ordenados.length === 0) return "";
  if (ordenados.length === 1) {
    const d = ordenados[0];
    return d === 6 ? "Sábado" : d === 0 ? "Domingo" : curto(d);
  }
  const posicoes = ordenados.map((d) => ORDEM_DIAS.indexOf(d));
  const seguidos = posicoes.every((p, i) => i === 0 || p === posicoes[i - 1] + 1);
  if (seguidos && ordenados.length >= 3) return `${curto(ordenados[0])} a ${curto(ordenados[ordenados.length - 1])}`;
  const nomes = ordenados.map(curto);
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

const horaNum = (h: string): number => Number(h.split(":")[0]);

/**
 * Texto dos horários: cada aula de 1 hora pelo horário de início; mais de 4 aulas viram faixa.
 *
 * @example
 * textoHoras("08:00", "10:00"); // "8h e 9h"
 * textoHoras("16:00", "17:00"); // "16h"
 * textoHoras("07:00", "12:00"); // "7h às 12h"
 */
export function textoHoras(inicio: string, fim: string): string {
  if (!inicio || !fim || horaNum(fim) <= horaNum(inicio)) return "";
  const horas = Array.from({ length: horaNum(fim) - horaNum(inicio) }, (_, i) => `${horaNum(inicio) + i}h`);
  if (horas.length > 4) return `${horaNum(inicio)}h às ${horaNum(fim)}h`;
  return horas.length === 1 ? horas[0] : `${horas.slice(0, -1).join(", ")} e ${horas[horas.length - 1]}`;
}

/** Recalcula os textos do site a partir dos dias e horários escolhidos. */
export function completarTextosTurma(t: TurmaSite): TurmaSite {
  return { ...t, dias: textoDias(t.diasSemana), horas: textoHoras(t.horaInicio, t.horaFim) };
}

const DIA_POR_TEXTO: Record<string, DiaSemana> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Lê dias e horários de turmas antigas, cadastradas só em texto ("Seg e Qua", "9h, 10h e 11h").
 * O que não der para entender fica vazio para o dono escolher.
 */
export function interpretarTextoTurma(dias: string, horas: string): Pick<TurmaSite, "diasSemana" | "horaInicio" | "horaFim"> {
  const texto = semAcento(dias);
  let diasSemana: DiaSemana[] = [];
  const faixa = texto.match(/(dom|seg|ter|qua|qui|sex|sab)\w*\s+a\s+(dom|seg|ter|qua|qui|sex|sab)/);
  if (faixa) {
    const a = ORDEM_DIAS.indexOf(DIA_POR_TEXTO[faixa[1]]);
    const b = ORDEM_DIAS.indexOf(DIA_POR_TEXTO[faixa[2]]);
    if (a <= b) diasSemana = ORDEM_DIAS.slice(a, b + 1);
  } else {
    diasSemana = [...new Set((texto.match(/dom|seg|ter|qua|qui|sex|sab/g) ?? []).map((d) => DIA_POR_TEXTO[d]))];
  }
  const numeros = (horas.match(/\d{1,2}(?=\s*h)/g) ?? []).map(Number).filter((n) => n >= 0 && n <= 23);
  if (numeros.length === 0) return { diasSemana, horaInicio: "", horaFim: "" };
  const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;
  const ehFaixa = /\bas\b|-/.test(semAcento(horas)) && numeros.length === 2;
  return {
    diasSemana,
    horaInicio: hh(Math.min(...numeros)),
    horaFim: hh(ehFaixa ? Math.max(...numeros) : Math.max(...numeros) + 1),
  };
}

/** Período em que as turmas ficam bloqueadas na agenda. */
export interface PeriodoAgenda {
  /** Primeiro dia (AAAA-MM-DD) */
  dataInicio: string;
  /** Duração em meses */
  meses: number;
}

/** Esporte do cadastro da quadra mais parecido com o texto do dono (o contrato exige um da lista). */
export function esporteDoContrato(esporte: string): Esporte {
  const alvo = semAcento(esporte.trim());
  const igual = ESPORTES.find((e) => semAcento(e) === alvo);
  if (igual) return igual;
  if (alvo.includes("society") || alvo.includes("futebol")) return "Futebol Society";
  const contido = ESPORTES.find((e) => e !== "Outro" && (alvo.includes(semAcento(e)) || semAcento(e).includes(alvo)));
  return contido ?? "Outro";
}

/** O que precisa mudar na agenda ao salvar a escolinha. */
export interface PlanoAgenda {
  /** Índices (em `depois`) das turmas que precisam de contrato novo */
  criar: number[];
  /** Contratos a encerrar (turma removida, desmarcada ou com dia/horário/quadra alterados) */
  encerrar: string[];
  /** Índices das turmas cujo contrato continua igual (só atualiza nome e contato) */
  manter: number[];
}

const mesmaAgenda = (a: TurmaSite, b: TurmaSite) =>
  a.quadraId === b.quadraId &&
  a.horaInicio === b.horaInicio &&
  a.horaFim === b.horaFim &&
  [...a.diasSemana].sort().join() === [...b.diasSemana].sort().join();

/**
 * Compara as turmas antes e depois da edição e diz o que criar, encerrar ou manter na agenda.
 *
 * @example
 * planejarAgenda([], [turmaNova]); // { criar: [0], encerrar: [], manter: [] }
 */
export function planejarAgenda(antes: readonly TurmaSite[], depois: readonly TurmaSite[]): PlanoAgenda {
  const plano: PlanoAgenda = { criar: [], encerrar: [], manter: [] };
  const antigas = new Map(antes.filter((t) => t.contratoId).map((t) => [t.contratoId, t]));
  const usados = new Set<string>();
  depois.forEach((t, i) => {
    const anterior = t.contratoId ? antigas.get(t.contratoId) : undefined;
    if (!t.bloquearAgenda) {
      if (t.contratoId) plano.encerrar.push(t.contratoId);
      return;
    }
    if (anterior && mesmaAgenda(anterior, t)) {
      plano.manter.push(i);
      usados.add(t.contratoId);
      return;
    }
    if (t.contratoId) plano.encerrar.push(t.contratoId);
    plano.criar.push(i);
  });
  for (const id of antigas.keys()) {
    if (!usados.has(id) && !plano.encerrar.includes(id)) plano.encerrar.push(id);
  }
  return plano;
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
    turmas: [turmaVazia()],
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

/** Turmas com algo preenchido (linhas totalmente vazias são ignoradas), com os textos do site em dia. */
export function turmasPreenchidas(turmas: readonly TurmaSite[]): TurmaSite[] {
  return turmas
    .map((t) => {
      const base = { ...t, categoria: t.categoria.trim() };
      return t.diasSemana.length || t.horaInicio || t.horaFim
        ? completarTextosTurma(base)
        : { ...base, dias: t.dias.trim(), horas: t.horas.trim() };
    })
    .filter((t) => t.dias || t.horas || t.categoria || t.diasSemana.length);
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
 * Regras: esporte e professor obrigatórios; ao menos uma turma; toda turma com dias, início e fim
 * (fim depois do início) e, se bloqueia a agenda, com quadra; no máximo {@link MAX_TURMAS} turmas; WhatsApp (se informado) com DDD; link obrigatório e https quando o
 * botão é de link; mensagem até {@link MAX_MENSAGEM} caracteres.
 */
export function validarEscolinhaSite(input: EscolinhaSiteInput): ErrosEscolinha {
  const erros: ErrosEscolinha = {};
  if (!input.esporte.trim()) erros.esporte = "Informe o esporte (ex.: Beach tennis).";
  if (!limparNomeProfessor(input.professor)) erros.professor = "Informe o nome do professor.";
  if (input.nome.trim().length > MAX_NOME) erros.nome = `Use até ${MAX_NOME} caracteres.`;

  const turmas = turmasPreenchidas(input.turmas);
  if (turmas.length === 0) erros.turmas = "Cadastre pelo menos uma turma com dias e horários.";
  else if (turmas.length > MAX_TURMAS) erros.turmas = `No máximo ${MAX_TURMAS} turmas por escolinha.`;
  else {
    const incompleta = turmas.findIndex((t) => t.diasSemana.length === 0 || !t.horaInicio || !t.horaFim);
    const invertida = turmas.findIndex((t) => t.horaInicio && t.horaFim && horaNum(t.horaFim) <= horaNum(t.horaInicio));
    const semQuadra = turmas.findIndex((t) => t.bloquearAgenda && !t.quadraId);
    if (incompleta >= 0) erros.turmas = `Turma ${incompleta + 1}: escolha os dias e o horário de início e de fim.`;
    else if (invertida >= 0) erros.turmas = `Turma ${invertida + 1}: o fim precisa ser depois do início.`;
    else if (semQuadra >= 0) erros.turmas = `Turma ${semQuadra + 1}: escolha a quadra que fica bloqueada na agenda.`;
  }

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

// ─── Horários antigos (contratos de escolinha sem escolinha do site) ─────────

/** Mesmos dias e mesmo horário (a ordem dos dias não importa). */
function mesmoHorario(t: Pick<TurmaSite, "diasSemana" | "horaInicio" | "horaFim">, c: Pick<ContratoRecorrente, "diasSemana" | "horaInicio" | "horaFim">): boolean {
  const dias = (d: readonly number[]) => [...d].sort((x, y) => x - y).join(",");
  return dias(t.diasSemana) === dias(c.diasSemana) && t.horaInicio === c.horaInicio && t.horaFim === c.horaFim;
}

/** Resultado de {@link vincularContratos}. */
export interface VinculoContratos<E extends Pick<EscolinhaSite, "id" | "turmas">> {
  /** Escolinhas com o `contratoId` das turmas completado pelos contratos encontrados */
  escolinhas: E[];
  /** Contratos de escolinha que não pertencem a nenhuma turma ("horários antigos") */
  antigos: ContratoRecorrente[];
}

/**
 * Liga os contratos de escolinha às turmas e separa os que sobram.
 *
 * 1. Turma com `contratoId` já gravado: fica com ele.
 * 2. Contrato com `escolinhaId` de uma escolinha existente, ainda sem turma: casa com a turma dessa
 *    escolinha que tem os mesmos dias e horário (a turma passa a mostrar "Na agenda"). Isso cobre
 *    dados gravados antes de a turma guardar o contrato.
 * 3. O resto dos contratos de escolinha ativos (sem escolinha, escolinha apagada ou sem turma igual)
 *    vira "horário antigo": o dono decide ligar a uma escolinha ou encerrar. Nada some sozinho.
 *
 * @example
 * ```ts
 * const { escolinhas: comAgenda, antigos } = vincularContratos(escolinhas, contratos);
 * ```
 */
export function vincularContratos<E extends Pick<EscolinhaSite, "id" | "turmas">>(
  escolinhas: readonly E[],
  contratos: readonly ContratoRecorrente[]
): VinculoContratos<E> {
  const ativos = contratos.filter((c) => c.tipo === "escolinha" && c.ativo);
  const usados = new Set(escolinhas.flatMap((e) => e.turmas.map((t) => t.contratoId).filter(Boolean)));
  const resultado = escolinhas.map((e) => ({ ...e, turmas: e.turmas.map((t) => ({ ...t })) }));
  const antigos: ContratoRecorrente[] = [];
  for (const c of ativos) {
    if (usados.has(c.id)) continue;
    const dona = c.escolinhaId ? resultado.find((e) => e.id === c.escolinhaId) : undefined;
    const turma = dona?.turmas.find((t) => !t.contratoId && mesmoHorario(t, c));
    if (turma) {
      turma.contratoId = c.id;
      turma.bloquearAgenda = true;
      turma.quadraId = c.quadraId;
      usados.add(c.id);
    } else {
      antigos.push(c);
    }
  }
  return { escolinhas: resultado, antigos };
}

/**
 * Contratos de escolinha ativos que não pertencem a nenhuma turma (atalho de {@link vincularContratos}).
 *
 * @example
 * ```ts
 * contratosSemEscolinha(contratos, escolinhas); // [{ id: "ctr-1", nome: "Escolinha Craques", ... }]
 * ```
 */
export function contratosSemEscolinha(
  contratos: readonly ContratoRecorrente[],
  escolinhas: readonly Pick<EscolinhaSite, "id" | "turmas">[]
): ContratoRecorrente[] {
  return vincularContratos(escolinhas, contratos).antigos;
}

/**
 * Turma da escolinha a partir de um contrato antigo: mesmos dias, horário e quadra, já bloqueada na
 * agenda (o contrato continua o mesmo, só passa a pertencer à escolinha).
 *
 * @example
 * ```ts
 * turmaDoContrato(contrato); // { dias: "Ter e Qui", horas: "8h e 9h", bloquearAgenda: true, contratoId: "ctr-1", ... }
 * ```
 */
export function turmaDoContrato(c: Pick<ContratoRecorrente, "id" | "diasSemana" | "horaInicio" | "horaFim" | "quadraId" | "faixaEtaria">): TurmaSite {
  return completarTextosTurma({
    dias: "",
    horas: "",
    categoria: c.faixaEtaria ?? "",
    diasSemana: [...c.diasSemana].sort((a, b) => a - b) as DiaSemana[],
    horaInicio: c.horaInicio,
    horaFim: c.horaFim,
    bloquearAgenda: true,
    quadraId: c.quadraId,
    contratoId: c.id,
  });
}
