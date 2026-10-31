/**
 * @module institucional/dadosIniciais
 *
 * Dados iniciais e demonstração para a galeria de estrutura física e escolinhas.
 *
 * Utilizados como fonte inicial ao criar o banco ou como fallback em memória
 * e LocalStorage para que o complexo seja exibido completo e impecável
 * enquanto o usuário não faz upload de suas fotos definitivas.
 */

import type { GaleriaItem } from "./types";
import type { ContratoRecorrente } from "@/lib/recorrencia/types";

/**
 * Fotos iniciais de alta resolução com temática esportiva e de complexo.
 * URLs diretas da CDN do Unsplash otimizadas para velocidade e qualidade visual.
 */
export const GALERIA_INICIAL: readonly GaleriaItem[] = [
  {
    id: "gal_saibro_01",
    title: "Quadras de Saibro Profissionais",
    description:
      "4 quadras oficiais com saibro nivelado diariamente, iluminação noturna em LED de 500 lux sem ofuscamento e drenagem rápida após chuvas.",
    categoria: "quadras",
    imageUrl:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80",
    displayOrder: 1,
    isActive: true,
    createdAt: "2026-10-06T10:00:00.000Z",
  },
  {
    id: "gal_beach_02",
    title: "Arena de Beach Tennis & Futevôlei",
    description:
      "Areia branca especial tratada, redes com regulagem oficial, duchas ao lado da quadra e arquibancada com vista privilegiada para os jogos.",
    categoria: "quadras",
    imageUrl:
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80",
    displayOrder: 2,
    isActive: true,
    createdAt: "2026-10-06T10:05:00.000Z",
  },
  {
    id: "gal_society_03",
    title: "Campo de Futebol Society FIFA",
    description:
      "Grama sintética monofilamento de última geração com absorção de impacto, redes de contenção resistentes e placar digital moderno.",
    categoria: "quadras",
    imageUrl:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    displayOrder: 3,
    isActive: true,
    createdAt: "2026-10-06T10:10:00.000Z",
  },
  {
    id: "gal_bar_04",
    title: "Sports Bar & Lounge Gastronômico",
    description:
      "Chopp artesanal trincando, cardápio de petiscos e hambúrgueres gourmet, telões 4K transmitindo os principais campeonatos e mesas ao ar livre.",
    categoria: "bar",
    imageUrl:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    displayOrder: 4,
    isActive: true,
    createdAt: "2026-10-06T10:15:00.000Z",
  },
  {
    id: "gal_vestiario_05",
    title: "Vestiários Climatizados & Armários",
    description:
      "Duchas pressurizadas de alta vazão com aquecimento central, armários individuais com cadeado eletrônico, secadores e higienização contínua.",
    categoria: "vestiarios",
    imageUrl:
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    displayOrder: 5,
    isActive: true,
    createdAt: "2026-10-06T10:20:00.000Z",
  },
  {
    id: "gal_lazer_06",
    title: "Espaço Convivência & Área Kids",
    description:
      "Ambiente arborizado para relaxar no pós-jogo, playground seguro para as crianças, quiosques integrados com churrasqueira e Wi-Fi de alta velocidade.",
    categoria: "lazer",
    imageUrl:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
    displayOrder: 6,
    isActive: true,
    createdAt: "2026-10-06T10:25:00.000Z",
  },
];

/**
 * Contratos de escolinhas padrão unificados com o domínio da agenda.
 * Mesma estrutura e dados sincronizados para gestão e exibição na Landing Page.
 */
export const CONTRATOS_ESCOLINHAS_INICIAIS: readonly ContratoRecorrente[] = [
  {
    id: "ctr_escolinha_tenis",
    tipo: "escolinha",
    nome: "Tênis de Campo",
    esporte: "Outro",
    responsavelNome: "Prof. Rodrigo Alencar",
    contatoWhatsapp: "11988887777",
    quadraId: "q1",
    diasSemana: [2, 4],
    horaInicio: "08:00",
    horaFim: "10:00",
    dataInicio: "2026-01-01",
    meses: 12,
    fotoUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    faixaEtaria: "Infantil (6 a 14 anos) e Adulto Iniciante",
    descricao:
      "Metodologia focada no desenvolvimento biomecânico, técnicas de saque e jogo de pernas, adaptada tanto para crianças quanto para quem está começando no esporte.",
    ativo: true,
    criadoEm: "2026-10-06T10:00:00.000Z",
  },
  {
    id: "ctr_escolinha_beach",
    tipo: "escolinha",
    nome: "Beach Tennis",
    esporte: "Outro",
    responsavelNome: "Profª. Camila Duarte",
    contatoWhatsapp: "11977776666",
    quadraId: "q2",
    diasSemana: [1, 3],
    horaInicio: "07:00",
    horaFim: "09:00",
    dataInicio: "2026-01-01",
    meses: 12,
    fotoUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    faixaEtaria: "Juvenil e Adulto (Turmas Femininas e Mistas)",
    descricao:
      "Aulas dinâmicas com ênfase em agilidade na areia, controle de smash e posicionamento tático em duplas. Treinos divertidos que queimam calorias e integram a galera.",
    ativo: true,
    criadoEm: "2026-10-06T10:05:00.000Z",
  },
  {
    id: "ctr_escolinha_futebol",
    tipo: "escolinha",
    nome: "Futebol Society Kids",
    esporte: "Outro",
    responsavelNome: "Prof. Marcos Silveira",
    contatoWhatsapp: "11966665555",
    quadraId: "q3",
    diasSemana: [3, 6],
    horaInicio: "08:00",
    horaFim: "11:00",
    dataInicio: "2026-01-01",
    meses: 12,
    fotoUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    faixaEtaria: "Categorias Sub-7, Sub-10 e Sub-14",
    descricao:
      "Formação esportiva integral, com fundamentos de passe, condução e cooperação em equipe. Acompanhamento pedagógico atencioso com foco em disciplina e diversão.",
    ativo: true,
    criadoEm: "2026-10-06T10:10:00.000Z",
  },
];
