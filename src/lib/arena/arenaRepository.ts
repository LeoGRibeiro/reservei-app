/**
 * @file arenaRepository.ts
 * @description Repositório de acesso a dados para Arenas, Quadras e Regras de Preços.
 * Realiza as consultas ao Supabase (PostgreSQL) com tipagem estrita, isolamento por tenant,
 * tratamento defensivo de falhas de conexão e fallback automático para a Arena Padrão.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Arena, Quadra, QuadraPreco, ArenaUsuario } from "./types";
import {
  ARENA_PADRAO,
  ARENA_PADRAO_ID,
  ARENA_PADRAO_SLUG,
  QUADRAS_PADRAO,
  PRECOS_PADRAO,
} from "./defaultArena";
import type { Esporte } from "@/lib/quadras";
import { normalizarModulosAtivos } from "./modulos";

/**
 * Converte um registro bruto do Supabase (snake_case) para a entidade de domínio Arena.
 * @param row Objeto retornado pela query do banco de dados
 * @returns Instância estruturada de Arena
 */
export function mapearLinhaParaArena(row: Record<string, unknown>): Arena {
  return {
    id: String(row.id || ""),
    slug: String(row.slug || ""),
    nome: String(row.nome || ""),
    cnpjCpf: row.cnpj_cpf ? String(row.cnpj_cpf) : undefined,
    telefone: String(row.telefone || ""),
    whatsapp: String(row.whatsapp || ""),
    email: row.email ? String(row.email) : undefined,
    endereco: row.endereco ? String(row.endereco) : undefined,
    cidade: String(row.cidade || "Belém"),
    estado: String(row.estado || "PA"),
    cep: row.cep ? String(row.cep) : undefined,
    logoUrl: row.logo_url ? String(row.logo_url) : undefined,
    horarioAbertura: String(row.horario_abertura || "06:00"),
    horarioFechamento: String(row.horario_fechamento || "23:00"),
    intervaloMinutos: Number(row.intervalo_minutos || 60),
    percentualSinalMinimo: Number(row.percentual_sinal_minimo || 50),
    antecedenciaMinimaMinutos: Number(row.antecedencia_minima_minutos || 60),
    ativo: Boolean(row.ativo ?? true),
    modulosAtivos: normalizarModulosAtivos(row.modulos_ativos),
    criadaEm: String(row.criado_em || new Date().toISOString()),
    atualizadaEm: row.atualizado_em ? String(row.atualizado_em) : undefined,
  };
}

/**
 * Converte um registro bruto do Supabase para a entidade de domínio Quadra.
 * @param row Objeto retornado pela tabela 'quadras'
 * @returns Instância estruturada de Quadra
 */
export function mapearLinhaParaQuadra(row: Record<string, unknown>): Quadra {
  let esportes: Esporte[] = [];
  if (Array.isArray(row.esportes)) {
    esportes = row.esportes as Esporte[];
  } else if (typeof row.esportes === "string") {
    try {
      const parsed = JSON.parse(row.esportes);
      if (Array.isArray(parsed)) esportes = parsed;
    } catch {
      esportes = row.esportes
        .replace(/[{}]/g, "")
        .split(",")
        .map((s) => s.trim() as Esporte)
        .filter(Boolean);
    }
  }

  return {
    id: String(row.id || ""),
    arenaId: String(row.arena_id || ""),
    numero: Number(row.numero || 1),
    nome: String(row.nome || ""),
    descricao: row.descricao ? String(row.descricao) : undefined,
    tipoPiso: (row.tipo_piso as Quadra["tipoPiso"]) || "areia",
    esportes,
    coberta: Boolean(row.coberta ?? false),
    iluminacao: Boolean(row.iluminacao ?? true),
    valorHoraPadrao: Number(row.valor_hora_padrao ?? 90),
    ordem: Number(row.ordem || 0),
    ativa: Boolean(row.ativa ?? true),
    criadaEm: String(row.criado_em || new Date().toISOString()),
    atualizadaEm: row.atualizado_em ? String(row.atualizado_em) : undefined,
  };
}

/**
 * Converte um registro da tabela 'quadras_precos' para a entidade QuadraPreco.
 * @param row Objeto retornado do Supabase
 * @returns Instância estruturada de QuadraPreco
 */
export function mapearLinhaParaPreco(row: Record<string, unknown>): QuadraPreco {
  let diasSemana: number[] = [0, 1, 2, 3, 4, 5, 6];
  if (Array.isArray(row.dias_semana)) {
    diasSemana = row.dias_semana.map(Number);
  } else if (typeof row.dias_semana === "string") {
    try {
      const parsed = JSON.parse(row.dias_semana);
      if (Array.isArray(parsed)) diasSemana = parsed.map(Number);
    } catch {
      diasSemana = row.dias_semana
        .replace(/[{}]/g, "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n));
    }
  }

  return {
    id: String(row.id || ""),
    arenaId: String(row.arena_id || ""),
    quadraId: String(row.quadra_id || ""),
    diasSemana,
    horaInicio: String(row.hora_inicio || "06:00"),
    horaFim: String(row.hora_fim || "23:00"),
    valorHora: Number(row.valor_hora || 90),
    descricao: row.descricao ? String(row.descricao) : undefined,
    ativo: Boolean(row.ativo ?? true),
    criadaEm: String(row.criado_em || new Date().toISOString()),
  };
}

/**
 * Repositório Enterprise para consulta e persistência de dados de Arenas e Quadras.
 */
export const ArenaRepository = {
  /**
   * Localiza uma arena pelo seu slug textual da URL (ex: 'arena-central').
   * @param slug Identificador textual da arena
   * @returns Arena correspondente ou null se inexistente
   */
  async buscarPorSlug(slug: string): Promise<Arena | null> {
    if (!slug) return null;

    // Se o Supabase não estiver configurado ou for o slug demo padrão
    if (!isSupabaseConfigured() || slug === ARENA_PADRAO_SLUG) {
      return ARENA_PADRAO;
    }

    try {
      const { data, error } = await supabase
        .from("arenas")
        .select("*")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.warn(`[ArenaRepository] Falha ao consultar arena por slug '${slug}':`, error.message);
        return slug === ARENA_PADRAO_SLUG ? ARENA_PADRAO : null;
      }

      if (!data) {
        return slug === ARENA_PADRAO_SLUG ? ARENA_PADRAO : null;
      }

      return mapearLinhaParaArena(data);
    } catch (err) {
      console.error(`[ArenaRepository] Erro inesperado ao consultar arena por slug '${slug}':`, err);
      return slug === ARENA_PADRAO_SLUG ? ARENA_PADRAO : null;
    }
  },

  /**
   * Localiza uma arena pelo seu identificador primário único (ID).
   * @param id Chave primária da arena
   * @returns Arena correspondente ou null se inexistente
   */
  async buscarPorId(id: string): Promise<Arena | null> {
    if (!id) return null;

    if (!isSupabaseConfigured() || id === ARENA_PADRAO_ID) {
      return ARENA_PADRAO;
    }

    try {
      const { data, error } = await supabase
        .from("arenas")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.warn(`[ArenaRepository] Falha ao consultar arena por id '${id}':`, error.message);
        return id === ARENA_PADRAO_ID ? ARENA_PADRAO : null;
      }

      if (!data) {
        return id === ARENA_PADRAO_ID ? ARENA_PADRAO : null;
      }

      return mapearLinhaParaArena(data);
    } catch (err) {
      console.error(`[ArenaRepository] Erro inesperado ao consultar arena por id '${id}':`, err);
      return id === ARENA_PADRAO_ID ? ARENA_PADRAO : null;
    }
  },

  /**
   * Lista todas as arenas ativas na plataforma para catálogo ou descoberta.
   * @returns Array de arenas ativas
   */
  async listarAtivas(): Promise<Arena[]> {
    if (!isSupabaseConfigured()) {
      return [ARENA_PADRAO];
    }

    try {
      const { data, error } = await supabase
        .from("arenas")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error || !data || data.length === 0) {
        return [ARENA_PADRAO];
      }

      return data.map(mapearLinhaParaArena);
    } catch (err) {
      console.error("[ArenaRepository] Erro ao listar arenas ativas:", err);
      return [ARENA_PADRAO];
    }
  },

  /**
   * Lista as quadras ativas vinculadas a uma arena específica.
   * @param arenaId Identificador único da arena
   * @returns Array de quadras ativas ordenadas por ordem de exibição
   */
  async listarQuadras(arenaId: string): Promise<Quadra[]> {
    if (!arenaId) return [];

    if (!isSupabaseConfigured() || arenaId === ARENA_PADRAO_ID) {
      return QUADRAS_PADRAO;
    }

    try {
      const { data, error } = await supabase
        .from("quadras")
        .select("*")
        .eq("arena_id", arenaId)
        .eq("ativa", true)
        .order("ordem", { ascending: true });

      if (error || !data || data.length === 0) {
        if (arenaId === ARENA_PADRAO_ID) {
          return QUADRAS_PADRAO;
        }
        return [];
      }

      return data.map(mapearLinhaParaQuadra);
    } catch (err) {
      console.error(`[ArenaRepository] Erro ao listar quadras para arena '${arenaId}':`, err);
      return arenaId === ARENA_PADRAO_ID ? QUADRAS_PADRAO : [];
    }
  },

  /**
   * Lista as regras de precificação dinâmica ativas para uma arena.
   * @param arenaId Identificador único da arena
   * @returns Array de regras de preço
   */
  async listarPrecos(arenaId: string): Promise<QuadraPreco[]> {
    if (!arenaId) return [];

    if (!isSupabaseConfigured() || arenaId === ARENA_PADRAO_ID) {
      return PRECOS_PADRAO;
    }

    try {
      const { data, error } = await supabase
        .from("quadras_precos")
        .select("*")
        .eq("arena_id", arenaId)
        .eq("ativo", true);

      if (error || !data || data.length === 0) {
        if (arenaId === ARENA_PADRAO_ID) {
          return PRECOS_PADRAO;
        }
        return [];
      }

      return data.map(mapearLinhaParaPreco);
    } catch (err) {
      console.error(`[ArenaRepository] Erro ao listar regras de preços para arena '${arenaId}':`, err);
      return arenaId === ARENA_PADRAO_ID ? PRECOS_PADRAO : [];
    }
  },

  /**
   * Consulta o vínculo de um usuário autenticado com uma arena (RBAC).
   * @param userId Identificador do usuário
   * @param arenaId Identificador opcional da arena
   * @returns Vínculo de operador/proprietário ou null se sem permissão
   */
  async buscarPermissaoUsuario(
    userId: string,
    arenaId?: string
  ): Promise<ArenaUsuario | null> {
    if (!userId || !isSupabaseConfigured()) return null;

    try {
      let query = supabase
        .from("arena_usuarios")
        .select("*")
        .eq("user_id", userId)
        .eq("ativo", true);

      if (arenaId) {
        query = query.eq("arena_id", arenaId);
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        id: String(data.id),
        arenaId: String(data.arena_id),
        userId: String(data.user_id),
        role: data.role as ArenaUsuario["role"],
        ativo: Boolean(data.ativo),
        criadaEm: String(data.criado_em),
      };
    } catch (err) {
      console.error(`[ArenaRepository] Erro ao consultar permissão do usuário '${userId}':`, err);
      return null;
    }
  },

  /**
   * Atualiza as configurações de uma arena no Supabase.
   * @param dados Dados a atualizar contendo obrigatoriamente o id da arena
   * @returns Arena atualizada ou null em caso de falha
   */
  async salvarArena(dados: Partial<Arena> & { id: string }): Promise<Arena | null> {
    if (!dados.id) return null;

    if (!isSupabaseConfigured()) {
      return { ...ARENA_PADRAO, ...dados };
    }

    try {
      const payload: Record<string, unknown> = {
        atualizado_em: new Date().toISOString(),
      };

      if (dados.nome !== undefined) payload.nome = dados.nome;
      if (dados.slug !== undefined) payload.slug = dados.slug;
      if (dados.cnpjCpf !== undefined) payload.cnpj_cpf = dados.cnpjCpf;
      if (dados.telefone !== undefined) payload.telefone = dados.telefone;
      if (dados.whatsapp !== undefined) payload.whatsapp = dados.whatsapp;
      if (dados.email !== undefined) payload.email = dados.email;
      if (dados.endereco !== undefined) payload.endereco = dados.endereco;
      if (dados.cidade !== undefined) payload.cidade = dados.cidade;
      if (dados.estado !== undefined) payload.estado = dados.estado;
      if (dados.cep !== undefined) payload.cep = dados.cep;
      if (dados.logoUrl !== undefined) payload.logo_url = dados.logoUrl;
      if (dados.horarioAbertura !== undefined) payload.horario_abertura = dados.horarioAbertura;
      if (dados.horarioFechamento !== undefined) payload.horario_fechamento = dados.horarioFechamento;
      if (dados.intervaloMinutos !== undefined) payload.intervalo_minutos = dados.intervaloMinutos;
      if (dados.percentualSinalMinimo !== undefined) payload.percentual_sinal_minimo = dados.percentualSinalMinimo;
      if (dados.antecedenciaMinimaMinutos !== undefined) payload.antecedencia_minima_minutos = dados.antecedenciaMinimaMinutos;
      if (dados.ativo !== undefined) payload.ativo = dados.ativo;

      const { data, error } = await supabase
        .from("arenas")
        .update(payload)
        .eq("id", dados.id)
        .select("*")
        .single();

      if (error || !data) {
        console.error(`[ArenaRepository] Erro ao salvar arena '${dados.id}':`, error?.message);
        return null;
      }

      return mapearLinhaParaArena(data);
    } catch (err) {
      console.error(`[ArenaRepository] Erro inesperado ao salvar arena '${dados.id}':`, err);
      return null;
    }
  },

  /**
   * Cria uma nova quadra para a arena no banco de dados.
   * @param dados Configurações da nova quadra
   * @returns Quadra criada ou null em caso de falha
   */
  async criarQuadra(
    dados: Omit<Quadra, "id" | "criadaEm">
  ): Promise<Quadra | null> {
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const agora = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      return { ...dados, id, criadaEm: agora };
    }

    try {
      const payload = {
        id,
        arena_id: dados.arenaId,
        numero: dados.numero,
        nome: dados.nome,
        descricao: dados.descricao || null,
        tipo_piso: dados.tipoPiso,
        esportes: dados.esportes,
        coberta: dados.coberta,
        iluminacao: dados.iluminacao,
        valor_hora_padrao: dados.valorHoraPadrao,
        ordem: dados.ordem,
        ativa: dados.ativa,
        criado_em: agora,
      };

      const { data, error } = await supabase
        .from("quadras")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) {
        console.error("[ArenaRepository] Erro ao criar quadra:", error?.message);
        return null;
      }

      return mapearLinhaParaQuadra(data);
    } catch (err) {
      console.error("[ArenaRepository] Erro inesperado ao criar quadra:", err);
      return null;
    }
  },

  /**
   * Atualiza dados de uma quadra existente.
   * @param id Identificador da quadra
   * @param dados Campos a atualizar
   * @returns Quadra atualizada ou null
   */
  async atualizarQuadra(
    id: string,
    dados: Partial<Quadra>
  ): Promise<Quadra | null> {
    if (!id) return null;

    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const payload: Record<string, unknown> = {
        atualizado_em: new Date().toISOString(),
      };

      if (dados.nome !== undefined) payload.nome = dados.nome;
      if (dados.numero !== undefined) payload.numero = dados.numero;
      if (dados.descricao !== undefined) payload.descricao = dados.descricao;
      if (dados.tipoPiso !== undefined) payload.tipo_piso = dados.tipoPiso;
      if (dados.esportes !== undefined) payload.esportes = dados.esportes;
      if (dados.coberta !== undefined) payload.coberta = dados.coberta;
      if (dados.iluminacao !== undefined) payload.iluminacao = dados.iluminacao;
      if (dados.valorHoraPadrao !== undefined) payload.valor_hora_padrao = dados.valorHoraPadrao;
      if (dados.ordem !== undefined) payload.ordem = dados.ordem;
      if (dados.ativa !== undefined) payload.ativa = dados.ativa;

      const { data, error } = await supabase
        .from("quadras")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) {
        console.error(`[ArenaRepository] Erro ao atualizar quadra '${id}':`, error?.message);
        return null;
      }

      return mapearLinhaParaQuadra(data);
    } catch (err) {
      console.error(`[ArenaRepository] Erro inesperado ao atualizar quadra '${id}':`, err);
      return null;
    }
  },

  /**
   * Desativa ou remove uma quadra.
   * @param id Identificador da quadra
   * @returns true se removida/desativada com sucesso
   */
  async removerQuadra(id: string): Promise<boolean> {
    if (!id) return false;

    if (!isSupabaseConfigured()) return true;

    try {
      const { error } = await supabase
        .from("quadras")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(`[ArenaRepository] Erro ao remover quadra '${id}':`, error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[ArenaRepository] Erro ao remover quadra '${id}':`, err);
      return false;
    }
  },

  /**
   * Cria uma regra de preço dinâmico para uma quadra.
   * @param dados Dados da regra de tarifa
   * @returns Regra criada ou null
   */
  async criarPreco(
    dados: Omit<QuadraPreco, "id" | "criadaEm">
  ): Promise<QuadraPreco | null> {
    const id = `prc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const agora = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      return { ...dados, id, criadaEm: agora };
    }

    try {
      const payload = {
        id,
        arena_id: dados.arenaId,
        quadra_id: dados.quadraId,
        dias_semana: dados.diasSemana,
        hora_inicio: dados.horaInicio,
        hora_fim: dados.horaFim,
        valor_hora: dados.valorHora,
        descricao: dados.descricao || null,
        ativo: dados.ativo,
        criado_em: agora,
      };

      const { data, error } = await supabase
        .from("quadras_precos")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) {
        console.error("[ArenaRepository] Erro ao criar regra de preço:", error?.message);
        return null;
      }

      return mapearLinhaParaPreco(data);
    } catch (err) {
      console.error("[ArenaRepository] Erro inesperado ao criar regra de preço:", err);
      return null;
    }
  },

  /**
   * Remove uma regra de preço dinâmico.
   * @param id Identificador da regra
   * @returns true se removida com sucesso
   */
  async removerPreco(id: string): Promise<boolean> {
    if (!id) return false;

    if (!isSupabaseConfigured()) return true;

    try {
      const { error } = await supabase
        .from("quadras_precos")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(`[ArenaRepository] Erro ao remover regra de preço '${id}':`, error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`[ArenaRepository] Erro ao remover regra de preço '${id}':`, err);
      return false;
    }
  },
};

