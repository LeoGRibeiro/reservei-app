/**
 * Dados do complexo esportivo — um único estabelecimento com múltiplas quadras idênticas.
 * Todas as quadras têm o mesmo piso (PU) e as mesmas comodidades.
 */

// ─── Esportes disponíveis ─────────────────────────────────────────────────────

/**
 * Esporte que será praticado na reserva (campo opcional).
 * Quando informado, a administração prepara a quadra adequadamente
 * (ex.: instalar rede de vôlei, posicionar traves de futsal, etc.).
 */
export type Esporte =
  | "Beach Tennis"
  | "Futevôlei"
  | "Vôlei de Praia"
  | "Futebol Society"
  | "Futsal"
  | "Vôlei"
  | "Basquete"
  | "Handebol"
  | "Tênis"
  | "Padel"
  | "Outro";

export const ESPORTES: Esporte[] = [
  "Beach Tennis",
  "Futevôlei",
  "Vôlei de Praia",
  "Futebol Society",
  "Futsal",
  "Vôlei",
  "Basquete",
  "Handebol",
  "Tênis",
  "Padel",
  "Outro",
];

/** Equipamentos que a administração monta por esporte */
export const PREPARACAO_POR_ESPORTE: Record<Esporte, string> = {
  "Beach Tennis": "Rede de beach tennis na altura oficial (1,70 m) e areia nivelada",
  Futevôlei: "Rede de futevôlei na altura oficial (2,20 m) e areia nivelada",
  "Vôlei de Praia": "Rede de vôlei de praia e areia nivelada",
  "Futebol Society": "Traves de society posicionadas e gramado conferido",
  Futsal: "Posicionamento e fixação das traves de futsal",
  Vôlei: "Montagem da rede e marcação das linhas de vôlei",
  Basquete: "Posicionamento das tabelas de basquete",
  Handebol: "Posicionamento das traves de handebol",
  Tênis: "Rede de tênis tensionada e linhas conferidas",
  Padel: "Rede de padel tensionada e vidros limpos",
  Outro: "Preparação padrão (sem equipamento específico)",
};

/**
 * Esportes oferecidos ao atleta para uma quadra: os da própria quadra (cadastrados no admin) ou,
 * se ela não tiver nenhum cadastrado, a lista completa.
 *
 * @param esportesDaQuadra Esportes cadastrados na quadra
 * @returns Lista na ordem do catálogo
 */
export function esportesDisponiveis(esportesDaQuadra?: string[] | null): Esporte[] {
  const conhecidos = ESPORTES.filter((e) => esportesDaQuadra?.includes(e));
  return conhecidos.length > 0 ? conhecidos : ESPORTES;
}

// ─── Quadras ──────────────────────────────────────────────────────────────────

export interface Quadra {
  id: string;
  numero: number;        // "Quadra 1", "Quadra 2", etc.
  descricao: string;
  /** Esportes praticados nesta quadra (cadastrados pela arena) */
  esportes?: Esporte[];
}

/**
 * Comodidades comuns a todas as quadras do complexo.
 * Piso de pintura PU — todas idênticas.
 */
export const COMODIDADES_COMPLEXO: string[] = [
  "Piso PU (pintura poliuretânica)",
  "Vestiário masculino e feminino",
  "Iluminação LED noturna",
  "Estacionamento gratuito",
  "Bebedouro",
];

/** Quadras do complexo — altere a quantidade conforme o estabelecimento */
export const QUADRAS: Quadra[] = [
  { id: "q1", numero: 1, descricao: "Quadra poliesportiva coberta" },
  { id: "q2", numero: 2, descricao: "Quadra poliesportiva coberta" },
  { id: "q3", numero: 3, descricao: "Quadra poliesportiva coberta" },
];

/** Valor padrão por hora (igual para todas as quadras) */
export const VALOR_HORA = 90; // em reais

// ─── Horários ─────────────────────────────────────────────────────────────────

/** Horários disponíveis para agendamento (blocos de 1 hora) */
export const HORARIOS_DISPONIVEIS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00",
];
