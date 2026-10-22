/**
 * @file defaultArena.ts
 * @description Dados padrão (Seed / Mock Fallback) da Arena Reservei Demo.
 * Utilizado para manter retrocompatibilidade com o estado inicial da aplicação,
 * permitir testes automatizados isolados e atuar como fallback seguro caso
 * as tabelas do Supabase ainda não tenham sido provisionadas pelo usuário.
 */

import type { Arena, Quadra, QuadraPreco } from "./types";
import { MODULOS_PADRAO } from "./modulos";

/**
 * Identificador padrão da arena de demonstração / legada.
 */
export const ARENA_PADRAO_ID = "arena-padrao";

/**
 * Slug padrão da arena de demonstração para rotas dinâmicas.
 */
export const ARENA_PADRAO_SLUG = "arena-demo";

/**
 * Configuração da Arena Padrão do sistema.
 */
export const ARENA_PADRAO: Arena = {
  id: ARENA_PADRAO_ID,
  slug: ARENA_PADRAO_SLUG,
  nome: "Arena Reservei Demo",
  cnpjCpf: "12.345.678/0001-90",
  telefone: "(91) 98123-4567",
  whatsapp: "(91) 98123-4567",
  email: "contato@reservei.app",
  endereco: "Av. Visconde de Souza Franco, 1000 - Reduto",
  cidade: "Belém",
  estado: "PA",
  cep: "66053-000",
  logoUrl: "/logo.png",
  horarioAbertura: "08:00",
  horarioFechamento: "22:00",
  intervaloMinutos: 60,
  percentualSinalMinimo: 50.0,
  antecedenciaMinimaMinutos: 60,
  ativo: true,
  modulosAtivos: [...MODULOS_PADRAO],
  criadaEm: "2026-01-01T00:00:00Z",
};

/**
 * Lista padrão de quadras da Arena Reservei Demo, mantendo paridade
 * com a infraestrutura prévia de 3 quadras poliesportivas cobertas com piso PU.
 */
export const QUADRAS_PADRAO: Quadra[] = [
  {
    id: "q1",
    arenaId: ARENA_PADRAO_ID,
    numero: 1,
    nome: "Quadra 1 - Poliesportiva",
    descricao: "Quadra coberta com piso PU de alta aderência, traves e tabelas oficiais.",
    tipoPiso: "pu_cimentado",
    esportes: ["Futsal", "Vôlei", "Basquete", "Handebol", "Outro"],
    coberta: true,
    iluminacao: true,
    valorHoraPadrao: 90.0,
    ordem: 1,
    ativa: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "q2",
    arenaId: ARENA_PADRAO_ID,
    numero: 2,
    nome: "Quadra 2 - Poliesportiva",
    descricao: "Quadra coberta com piso PU de alta aderência, excelente ventilação e placar eletrônico.",
    tipoPiso: "pu_cimentado",
    esportes: ["Futsal", "Vôlei", "Basquete", "Handebol", "Outro"],
    coberta: true,
    iluminacao: true,
    valorHoraPadrao: 90.0,
    ordem: 2,
    ativa: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "q3",
    arenaId: ARENA_PADRAO_ID,
    numero: 3,
    nome: "Quadra 3 - Poliesportiva",
    descricao: "Quadra coberta com piso PU de alta aderência e iluminação LED de alta potência.",
    tipoPiso: "pu_cimentado",
    esportes: ["Futsal", "Vôlei", "Basquete", "Handebol", "Outro"],
    coberta: true,
    iluminacao: true,
    valorHoraPadrao: 90.0,
    ordem: 3,
    ativa: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
];

/**
 * Regras padrão de precificação dinâmica para fins de demonstração:
 * - Horário nobre noturno (a partir das 18:00 de segunda a sexta): R$ 120,00
 * - Finais de semana (Sábado e Domingo): R$ 130,00
 */
export const PRECOS_PADRAO: QuadraPreco[] = [
  // Tarifa Noturna com Luz (Seg a Sex das 18h às 22h) para todas as quadras padrão
  {
    id: "preco-noturno-q1",
    arenaId: ARENA_PADRAO_ID,
    quadraId: "q1",
    diasSemana: [1, 2, 3, 4, 5],
    horaInicio: "18:00",
    horaFim: "22:00",
    valorHora: 120.0,
    descricao: "Horário Nobre Noturno (Iluminação LED)",
    ativo: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "preco-fds-q1",
    arenaId: ARENA_PADRAO_ID,
    quadraId: "q1",
    diasSemana: [0, 6],
    horaInicio: "08:00",
    horaFim: "22:00",
    valorHora: 130.0,
    descricao: "Tarifa Final de Semana",
    ativo: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "preco-noturno-q2",
    arenaId: ARENA_PADRAO_ID,
    quadraId: "q2",
    diasSemana: [1, 2, 3, 4, 5],
    horaInicio: "18:00",
    horaFim: "22:00",
    valorHora: 120.0,
    descricao: "Horário Nobre Noturno (Iluminação LED)",
    ativo: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "preco-fds-q2",
    arenaId: ARENA_PADRAO_ID,
    quadraId: "q2",
    diasSemana: [0, 6],
    horaInicio: "08:00",
    horaFim: "22:00",
    valorHora: 130.0,
    descricao: "Tarifa Final de Semana",
    ativo: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "preco-noturno-q3",
    arenaId: ARENA_PADRAO_ID,
    quadraId: "q3",
    diasSemana: [1, 2, 3, 4, 5],
    horaInicio: "18:00",
    horaFim: "22:00",
    valorHora: 120.0,
    descricao: "Horário Nobre Noturno (Iluminação LED)",
    ativo: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
  {
    id: "preco-fds-q3",
    arenaId: ARENA_PADRAO_ID,
    quadraId: "q3",
    diasSemana: [0, 6],
    horaInicio: "08:00",
    horaFim: "22:00",
    valorHora: 130.0,
    descricao: "Tarifa Final de Semana",
    ativo: true,
    criadaEm: "2026-01-01T00:00:00Z",
  },
];
