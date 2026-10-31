/**
 * @file mapeadores.ts
 * @description Converte linhas do Supabase (snake_case) nas entidades do portal. Campos JSON são
 * lidos de forma defensiva: item malformado é descartado, nunca quebra a página.
 */

import { normalizarModoPagamento } from "@/lib/arena/arenaRepository";
import { normalizarModulosAtivos } from "@/lib/arena/modulos";
import type { TipoPisoQuadra } from "@/lib/arena/types";
import { mascaraWhatsApp } from "@/lib/constants";
import type {
  ArenaPortal,
  ClubeArena,
  ConteudoArena,
  EscolinhaPortal,
  EventoArena,
  FaseChave,
  FotoEstrutura,
  PerfilInstagram,
  PostInstagram,
  QuadraPortal,
  StatusEvento,
  TipoInscricao,
  TipoPostInstagram,
} from "./types";
import { hrefBotaoEscolinha, limparNomeProfessor, tituloEscolinha } from "@/lib/institucional/escolinhasSite";

type Linha = Record<string, unknown>;

const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const numero = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const POSICAO = /^\d{1,3}% \d{1,3}%$/;
const posicao = (v: unknown): string | undefined => {
  const t = texto(v);
  return t && POSICAO.test(t) ? t : undefined;
};

/** Lê um array JSON (jsonb ou string) e mantém só os itens válidos. */
function lista<T>(bruto: unknown, item: (o: Linha) => T | null): T[] {
  let arr: unknown = bruto;
  if (typeof bruto === "string") {
    try {
      arr = JSON.parse(bruto);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((o) => {
    if (!o || typeof o !== "object") return [];
    const r = item(o as Linha);
    return r === null ? [] : [r];
  });
}

/**
 * Telefone em dígitos com DDI 55 (para links `wa.me`).
 *
 * @example
 * ```ts
 * digitosWhatsApp("(91) 98498-2865"); // "5591984982865"
 * ```
 */
export function digitosWhatsApp(telefone: unknown): string {
  const d = String(telefone ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d;
}

/** Linha de `arenas` → {@link ArenaPortal}. */
export function mapearArenaPortal(row: Linha): ArenaPortal {
  const whatsapp = String(row.whatsapp || row.telefone || "");
  const locais = whatsapp.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    nome: String(row.nome ?? ""),
    logoUrl: texto(row.logo_url) ?? "/arenas/exemplo/logo.svg",
    whatsappDigitos: digitosWhatsApp(whatsapp),
    whatsappExibicao: mascaraWhatsApp(locais),
    endereco: texto(row.endereco) ?? "",
    bairro: texto(row.bairro),
    enderecoReferencia: texto(row.endereco_referencia),
    cidade: texto(row.cidade) ?? "",
    estado: texto(row.estado) ?? "",
    cep: texto(row.cep),
    horarioAbertura: texto(row.horario_abertura) ?? "07:00",
    horarioFechamento: texto(row.horario_fechamento) ?? "23:00",
    antecedenciaMinimaMinutos: numero(row.antecedencia_minima_minutos) ?? 60,
    percentualSinal: numero(row.percentual_sinal_minimo) ?? 50,
    modoPagamento: normalizarModoPagamento(row.modo_pagamento),
    politicaCancelamento: texto(row.politica_cancelamento) ?? "",
    instagram: texto(row.instagram)?.replace(/^@/, ""),
    latitude: numero(row.latitude),
    longitude: numero(row.longitude),
    googleMapsUrl: texto(row.google_maps_url),
    googlePlaceId: texto(row.google_place_id),
    mapaUrl: texto(row.mapa_url),
    modulos: normalizarModulosAtivos(row.modulos_ativos),
    nomeRecebedorPix: texto(row.pix_nome_recebedor) ?? String(row.nome ?? ""),
  };
}

const PISOS: TipoPisoQuadra[] = ["areia", "society", "saibro", "pu_cimentado", "madeira", "outro"];

/** Linha de `quadras` → {@link QuadraPortal}. */
export function mapearQuadraPortal(row: Linha): QuadraPortal {
  const piso = String(row.tipo_piso ?? "outro") as TipoPisoQuadra;
  return {
    id: String(row.id ?? ""),
    nome: String(row.nome ?? ""),
    esportes: Array.isArray(row.esportes) ? row.esportes.map(String) : [],
    tipoPiso: PISOS.includes(piso) ? piso : "outro",
    valorHoraPadrao: numero(row.valor_hora_padrao) ?? 0,
    fotoUrl: texto(row.foto_url),
    fotoPosicao: posicao(row.foto_posicao),
    fotoDescricao: texto(row.foto_descricao),
    ordem: numero(row.ordem) ?? 0,
  };
}

/** Linha de `arena_conteudo` (ou nada) → {@link ConteudoArena}. */
export function mapearConteudo(row: Linha | null | undefined): ConteudoArena {
  const r = row ?? {};
  return {
    introReserva: texto(r.intro_reserva),
    introEscolinhas: texto(r.intro_escolinhas),
    introEventos: texto(r.intro_eventos),
    introEstrutura: texto(r.intro_estrutura),
    destaquesEstrutura: lista(r.destaques_estrutura, (o) => {
      const destaque = texto(o.destaque);
      return destaque ? { destaque, resto: texto(o.resto) ?? "" } : null;
    }),
    regras: lista(r.regras, (o) => {
      const titulo = texto(o.titulo);
      return titulo ? { titulo, texto: texto(o.texto) ?? "" } : null;
    }),
    faq: lista(r.faq, (o) => {
      const pergunta = texto(o.pergunta);
      const resposta = texto(o.resposta);
      return pergunta && resposta ? { pergunta, resposta } : null;
    }),
  };
}

/** Linha de `landing_page_schools` → {@link EscolinhaPortal} (título, turmas e botão configurados no painel). */
export function mapearEscolinha(row: Linha, whatsappArena: string): EscolinhaPortal {
  const esporte = String(row.sport_name ?? "");
  const professor = limparNomeProfessor(String(row.teacher_name ?? ""));
  const whatsappDigitos = digitosWhatsApp(row.whatsapp_number) || whatsappArena;
  return {
    id: String(row.id ?? ""),
    titulo: tituloEscolinha({ nome: texto(row.nome) ?? "", esporte }),
    esporte,
    professor,
    fotoProfessorUrl: texto(row.teacher_image_url) ?? "/arenas/exemplo/professor.svg",
    descricao: texto(row.descricao),
    turmas: lista(row.turmas, (o) => {
      const dias = texto(o.dias);
      const horas = texto(o.horas);
      return dias && horas ? { dias, horas, nivel: texto(o.nivel) ?? "" } : null;
    }),
    whatsappDigitos,
    hrefBotao: hrefBotaoEscolinha(
      {
        tipoBotao: row.botao_tipo === "link" ? "link" : "whatsapp",
        linkBotao: texto(row.botao_url) ?? "",
        whatsapp: whatsappDigitos,
        mensagemWhatsapp: texto(row.mensagem_whatsapp) ?? "",
        esporte,
        professor,
      },
      whatsappArena
    ),
    ordem: numero(row.ordem) ?? 0,
  };
}

const STATUS_EVENTO: StatusEvento[] = ["inscricoes", "em_andamento", "encerrado"];
const TIPOS_INSCRICAO: TipoInscricao[] = ["formulario", "whatsapp", "confirmar_presenca"];

/** Linha de `eventos` → {@link EventoArena}. */
export function mapearEvento(row: Linha): EventoArena {
  const status = String(row.status) as StatusEvento;
  const tipo = String(row.inscricao_tipo) as TipoInscricao;
  const chave: FaseChave[] = lista(row.chave, (o) => {
    const rotulo = texto(o.rotulo);
    if (!rotulo) return null;
    const jogos = lista(o.jogos, (j) => {
      const lados = Array.isArray(j.lados) ? j.lados.map(String).filter(Boolean) : [];
      return lados.length ? { hora: texto(j.hora) ?? "", lados } : null;
    });
    return jogos.length ? { rotulo, final: o.final === true, jogos } : null;
  });
  return {
    id: String(row.id ?? ""),
    titulo: String(row.titulo ?? ""),
    modalidade: texto(row.modalidade),
    descricaoCurta: texto(row.descricao_curta),
    descricao: texto(row.descricao),
    dataInicio: String(row.data_inicio ?? "").slice(0, 10),
    dataFim: texto(row.data_fim)?.slice(0, 10),
    horario: texto(row.horario),
    status: STATUS_EVENTO.includes(status) ? status : "inscricoes",
    dados: lista(row.dados, (o) => {
      const rotulo = texto(o.rotulo);
      const valor = texto(o.valor);
      return rotulo && valor ? { rotulo, valor, numerico: o.numerico === true } : null;
    }),
    inscricaoTipo: TIPOS_INSCRICAO.includes(tipo) ? tipo : undefined,
    inscricaoUrl: texto(row.inscricao_url),
    mensagemWhatsapp: texto(row.mensagem_whatsapp),
    chave,
    linkRotulo: texto(row.link_rotulo),
    linkUrl: texto(row.link_url),
    campeoes: texto(row.campeoes),
    rotuloCampeoes: texto(row.rotulo_campeoes),
    placarFinal: texto(row.placar_final),
    fotoUrl: texto(row.foto_url),
    fotoPosicao: posicao(row.foto_posicao),
    fotoDescricao: texto(row.foto_descricao),
    ordem: numero(row.ordem) ?? 0,
  };
}

/** Linha de `landing_page_gallery` → {@link FotoEstrutura}. */
export function mapearFotoEstrutura(row: Linha): FotoEstrutura {
  return {
    id: String(row.id ?? ""),
    imagemUrl: String(row.image_url ?? ""),
    legenda: String(row.title ?? ""),
    descricao: String(row.description ?? row.title ?? ""),
  };
}

const TIPOS_POST: TipoPostInstagram[] = ["foto", "reels", "carrossel"];

/** Linha de `instagram_posts` → {@link PostInstagram}. */
export function mapearPost(row: Linha, linkPerfil: string): PostInstagram {
  const tipo = String(row.tipo) as TipoPostInstagram;
  return {
    id: String(row.id ?? ""),
    imagemUrl: String(row.imagem_url ?? ""),
    largura: numero(row.imagem_largura) ?? 680,
    altura: numero(row.imagem_altura) ?? 510,
    posicao: posicao(row.imagem_posicao),
    descricao: texto(row.descricao) ?? "",
    legenda: String(row.legenda ?? ""),
    tipo: TIPOS_POST.includes(tipo) ? tipo : "foto",
    link: texto(row.link) ?? linkPerfil,
    publicadoEm: String(row.publicado_em ?? ""),
    fixado: row.fixado === true,
  };
}

/** Linha de `instagram_perfil` → {@link PerfilInstagram}. */
export function mapearPerfilInstagram(row: Linha | null | undefined): PerfilInstagram | null {
  if (!row) return null;
  return {
    seguidores: numero(row.seguidores),
    totalPosts: numero(row.total_posts),
    contagemSimulada: row.contagem_simulada === true,
  };
}

/** Linha de `fidelidade_campanha` → {@link ClubeArena}. */
export function mapearClube(row: Linha | null | undefined): ClubeArena | null {
  if (!row || row.ativo === false) return null;
  return {
    nome: texto(row.nome) ?? "Clube",
    meta: numero(row.horas_necessarias) ?? 10,
    mesesValidade: numero(row.meses_validade) ?? 3,
    diasValidadeVoucher: numero(row.dias_validade_voucher) ?? 60,
    valorTeto: numero(row.valor_teto_voucher) ?? null,
  };
}
