/**
 * @file types.ts
 * @description Entidades do portal público da arena (template multiarena). Tudo o que o site mostra
 * vem destes tipos, carregados do banco por `arena_id` (SPEC/2026-10-30-implementacao-template-portal.md §3–4).
 */

import type { ModoPagamentoArena, QuadraPreco, TipoPisoQuadra } from "@/lib/arena/types";
import type { ModuloArena } from "@/lib/arena/modulos";
import type { TemaArena } from "./tema";

/** Dados públicos da arena usados pelo portal. */
export interface ArenaPortal {
  id: string;
  slug: string;
  nome: string;
  /** Logo (escudo) da arena */
  logoUrl: string;
  /** WhatsApp só com dígitos e DDI (ex.: "5591984982865") */
  whatsappDigitos: string;
  /** WhatsApp para exibir (ex.: "(91) 98498-2865") */
  whatsappExibicao: string;
  /** Rua e número (ex.: "Av. Roberto Camelier, 580") */
  endereco: string;
  bairro?: string;
  /** Ponto de referência (ex.: "Esquina com a Rua dos Caripunas") */
  enderecoReferencia?: string;
  cidade: string;
  estado: string;
  cep?: string;
  /** 'HH:mm' */
  horarioAbertura: string;
  /** 'HH:mm' */
  horarioFechamento: string;
  antecedenciaMinimaMinutos: number;
  percentualSinal: number;
  modoPagamento: ModoPagamentoArena;
  politicaCancelamento: string;
  /** @ do Instagram, sem o "@" */
  instagram?: string;
  latitude?: number;
  longitude?: number;
  /** Página da arena no Google Maps */
  googleMapsUrl?: string;
  /** Place ID do Google (ChIJ...), para o botão "Avaliar no Google" */
  googlePlaceId?: string;
  /** Imagem do mapa (escala de cinza aplicada pelo CSS) */
  mapaUrl?: string;
  modulos: ModuloArena[];
  /** Recebedor do Pix (nome que o atleta confere no app do banco) */
  nomeRecebedorPix: string;
}

/** Quadra com foto e enquadramento. */
export interface QuadraPortal {
  id: string;
  nome: string;
  esportes: string[];
  tipoPiso: TipoPisoQuadra;
  valorHoraPadrao: number;
  fotoUrl?: string;
  /** object-position (ex.: '50% 62%') */
  fotoPosicao?: string;
  fotoDescricao?: string;
  ordem: number;
  /** Quadra fechada a partir deste dia (reforma, evento) */
  bloqueioInicio?: string;
  /** Último dia fechado; vazio com início = até a arena liberar */
  bloqueioFim?: string;
  bloqueioMotivo?: string;
}

/** Item "Na arena" da seção Estrutura: parte em negrito + resto. */
export interface DestaqueEstrutura {
  destaque: string;
  resto: string;
}

/** Regra numerada da página de Regras. */
export interface RegraArena {
  titulo: string;
  texto: string;
}

/** Pergunta frequente. */
export interface PerguntaFrequente {
  pergunta: string;
  resposta: string;
}

/** Textos do site (`arena_conteudo`). */
export interface ConteudoArena {
  introReserva?: string;
  introEscolinhas?: string;
  introEventos?: string;
  introEstrutura?: string;
  destaquesEstrutura: DestaqueEstrutura[];
  regras: RegraArena[];
  faq: PerguntaFrequente[];
}

/** Turma de uma escolinha. */
export interface TurmaEscolinha {
  dias: string;
  horas: string;
  nivel: string;
}

/** Escolinha exibida no site. */
export interface EscolinhaPortal {
  id: string;
  /** Título do card: nome da escolinha ou, sem nome, o esporte */
  titulo: string;
  esporte: string;
  professor: string;
  fotoProfessorUrl: string;
  descricao?: string;
  turmas: TurmaEscolinha[];
  /** WhatsApp da escolinha (dígitos com DDI); cai no da arena */
  whatsappDigitos: string;
  /** Endereço do botão "Quero uma vaga" (WhatsApp com a mensagem pronta ou link configurado no painel) */
  hrefBotao: string;
  ordem: number;
}

/** Jogo da chave de um evento em andamento. */
export interface JogoChave {
  hora: string;
  lados: string[];
}

/** Fase da chave (semifinais, final). */
export interface FaseChave {
  rotulo: string;
  final: boolean;
  jogos: JogoChave[];
}

export type StatusEvento = "inscricoes" | "em_andamento" | "encerrado";
export type TipoInscricao = "formulario" | "whatsapp" | "confirmar_presenca";

/** Campeonato ou evento. */
export interface EventoArena {
  id: string;
  titulo: string;
  modalidade?: string;
  /** Linha cinza abaixo do título */
  descricaoCurta?: string;
  /** Texto do "Rolando agora" */
  descricao?: string;
  dataInicio: string;
  dataFim?: string;
  horario?: string;
  status: StatusEvento;
  /** Linhas "rótulo: valor"; `numerico` usa algarismos tabulares (preços, vagas, prazos) */
  dados: { rotulo: string; valor: string; numerico: boolean }[];
  inscricaoTipo?: TipoInscricao;
  inscricaoUrl?: string;
  mensagemWhatsapp?: string;
  chave: FaseChave[];
  linkRotulo?: string;
  linkUrl?: string;
  campeoes?: string;
  rotuloCampeoes?: string;
  placarFinal?: string;
  fotoUrl?: string;
  fotoPosicao?: string;
  fotoDescricao?: string;
  ordem: number;
}

/** Foto da Estrutura (galeria). */
export interface FotoEstrutura {
  id: string;
  imagemUrl: string;
  legenda: string;
  descricao: string;
}

export type TipoPostInstagram = "foto" | "reels" | "carrossel";

/** Post do Instagram exibido na grade. */
export interface PostInstagram {
  id: string;
  imagemUrl: string;
  largura: number;
  altura: number;
  posicao?: string;
  descricao: string;
  legenda: string;
  tipo: TipoPostInstagram;
  link: string;
  publicadoEm: string;
  fixado: boolean;
}

/** Cabeçalho do perfil do Instagram (contagens só aparecem quando existem). */
export interface PerfilInstagram {
  seguidores?: number;
  totalPosts?: number;
  contagemSimulada: boolean;
}

/** Regras do Clube (fidelidade) que o site mostra. */
export interface ClubeArena {
  nome: string;
  /** Carimbos para ganhar 1 hora grátis */
  meta: number;
  /** Validade de cada carimbo, em meses */
  mesesValidade: number;
  /** Validade da hora grátis, em dias */
  diasValidadeVoucher: number;
  /** Teto da hora grátis em reais (nulo = ticket médio) */
  valorTeto: number | null;
}

/** Linha da grade pública (`grade_publica`). */
export interface LinhaGrade {
  id: string;
  quadraId: string;
  data: string;
  horas: number[];
  status: string;
  tipoReserva: string;
  esporte?: string;
  escolinhaId?: string;
  expiraEm?: string;
  permiteVagas: boolean;
  vagasAbertas: number;
  /** Organizador da partida (só quando há vagas abertas) */
  userId?: string;
  /** Primeiro nome do organizador (só quando há vagas abertas) */
  organizador?: string;
}

/** Tudo o que o portal precisa do servidor para o primeiro desenho da página. */
export interface DadosPortal {
  arena: ArenaPortal;
  tema: TemaArena;
  conteudo: ConteudoArena;
  quadras: QuadraPortal[];
  precos: QuadraPreco[];
  escolinhas: EscolinhaPortal[];
  eventos: EventoArena[];
  galeria: FotoEstrutura[];
  instagram: { perfil: PerfilInstagram | null; posts: PostInstagram[] };
  clube: ClubeArena | null;
  /** Ocupação dos próximos 31 dias (grade pública, sem dados pessoais) */
  grade: LinhaGrade[];
  /** Instante do servidor no primeiro desenho (o navegador atualiza depois de montar) */
  agoraIso: string;
}
