/**
 * @file modulos.ts
 * @description Definições e helpers para modularidade de features por arena (Feature Flags).
 */

/**
 * Identificadores dos módulos contratáveis por arena.
 * Devem permanecer sincronizados com os valores gravados em `arenas.modulos_ativos`.
 */
export type ModuloArena =
  | "agendamento_core"
  | "fidelidade"
  | "vagas"
  | "escolinhas"
  | "contratos"
  | "whatsapp_ia";

/**
 * Metadados descritivos de um módulo contratável.
 */
export interface ModuloInfo {
  /** Identificador único do módulo */
  id: ModuloArena;
  /** Nome comercial exibido nos painéis */
  nome: string;
  /** Descrição curta do que o módulo entrega */
  descricao: string;
  /** Quando verdadeiro, o módulo é parte do core e está sempre ativo */
  obrigatorio?: boolean;
}

/**
 * Catálogo completo de módulos disponíveis na plataforma.
 */
export const MODULOS_DISPONIVEIS: Record<ModuloArena, ModuloInfo> = {
  agendamento_core: {
    id: "agendamento_core",
    nome: "Agendamento & Balcão",
    descricao: "Grade de horários, reservas avulsas e pagamento Pix.",
    obrigatorio: true,
  },
  fidelidade: {
    id: "fidelidade",
    nome: "Programa de Fidelidade",
    descricao: "Cartela de selos digitais e cupons de recompensa.",
  },
  vagas: {
    id: "vagas",
    nome: "Mural Social de Vagas",
    descricao: "Matchmaking para atletas completarem partidas.",
  },
  escolinhas: {
    id: "escolinhas",
    nome: "Escolinhas Parceiras",
    descricao: "Divulgação de turmas e aulas parceiras no complexo.",
  },
  contratos: {
    id: "contratos",
    nome: "Contratos & Mensalistas",
    descricao: "Gestão de turmas fixas com projeção de 6 meses de agenda.",
  },
  whatsapp_ia: {
    id: "whatsapp_ia",
    nome: "WhatsApp AI Concierge",
    descricao: "Assistente inteligente para tirar dúvidas institucionais da arena.",
  },
};

/**
 * Pacote padrão de módulos de uma arena recém-criada.
 * Espelha o `DEFAULT` da coluna `arenas.modulos_ativos` no PostgreSQL.
 */
export const MODULOS_PADRAO: ModuloArena[] = [
  "agendamento_core",
  "fidelidade",
  "vagas",
  "escolinhas",
  "contratos",
];

/**
 * Verifica se um valor desconhecido é um identificador de módulo conhecido.
 *
 * @param valor Valor a ser validado
 * @returns `true` se o valor for um {@link ModuloArena} válido
 */
export function isModuloArena(valor: unknown): valor is ModuloArena {
  return typeof valor === "string" && Object.prototype.hasOwnProperty.call(MODULOS_DISPONIVEIS, valor);
}

/**
 * Normaliza o valor bruto de `modulos_ativos` vindo do banco (array nativo, string
 * no formato `{a,b}` do PostgreSQL ou JSON) para uma lista tipada, descartando
 * identificadores desconhecidos e duplicados.
 *
 * @param bruto Valor retornado pelo Supabase
 * @returns Lista de módulos válidos; {@link MODULOS_PADRAO} se o valor for nulo/indefinido
 *
 * @example
 * ```ts
 * normalizarModulosAtivos(["fidelidade", "xyz"]); // ["fidelidade"]
 * normalizarModulosAtivos("{vagas,contratos}"); // ["vagas", "contratos"]
 * normalizarModulosAtivos(undefined); // MODULOS_PADRAO
 * ```
 */
export function normalizarModulosAtivos(bruto: unknown): ModuloArena[] {
  if (bruto === null || bruto === undefined) return [...MODULOS_PADRAO];

  let candidatos: unknown[] = [];

  if (Array.isArray(bruto)) {
    candidatos = bruto;
  } else if (typeof bruto === "string") {
    try {
      const parsed: unknown = JSON.parse(bruto);
      candidatos = Array.isArray(parsed) ? parsed : [];
    } catch {
      candidatos = bruto
        .replace(/[{}"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const validos = candidatos.filter(isModuloArena);
  return Array.from(new Set<ModuloArena>(validos));
}

/**
 * Verifica se um módulo específico está ativo para uma dada arena.
 *
 * @param modulosAtivos Lista de módulos contratados pela arena
 * @param modulo Módulo a ser consultado
 * @returns `true` se o módulo estiver ativo (o core de agendamento é sempre ativo)
 *
 * @example
 * ```ts
 * temModuloAtivo(["fidelidade"], "fidelidade"); // true
 * temModuloAtivo([], "agendamento_core"); // true
 * temModuloAtivo(undefined, "vagas"); // false
 * ```
 */
export function temModuloAtivo(
  modulosAtivos?: string[] | null,
  modulo?: ModuloArena
): boolean {
  if (!modulo) return false;
  if (modulo === "agendamento_core") return true; // Sempre ativo
  if (!modulosAtivos || !Array.isArray(modulosAtivos)) return false;
  return modulosAtivos.includes(modulo);
}
