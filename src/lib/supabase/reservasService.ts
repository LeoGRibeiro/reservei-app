import { supabase, isSupabaseConfigured } from "./client";
import { rowToReserva, reservaToRow, type ReservaDbRow } from "./types";
import type { Reserva } from "@/store/useReservasStore";
import { obterArenaAtivaId } from "@/lib/arena/arenaAtiva";

const TABELA_RESERVAS = "reservas";
const RPC_GRADE_PUBLICA = "grade_publica";

/**
 * Busca os slots ocupados da arena ativa pela função pública sanitizada `grade_publica`
 * (sem CPF/telefone de terceiros — LGPD). Necessária porque o RLS da tabela `reservas` só
 * permite ler as reservas do próprio usuário ou, para operadores, as da sua arena.
 *
 * @param dataInicio Filtro opcional de data inicial (YYYY-MM-DD)
 * @param dataFim Filtro opcional de data final (YYYY-MM-DD)
 * @returns Reservas "esqueleto" da arena ativa, ou lista vazia se a arena não existir ou a consulta falhar
 */
export async function fetchGradePublicaSupabase(
  dataInicio?: string,
  dataFim?: string
): Promise<Reserva[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const { data, error } = await supabase.rpc(RPC_GRADE_PUBLICA, {
      p_arena_id: arenaId,
      p_data_inicio: dataInicio ?? null,
      p_data_fim: dataFim ?? null,
    });
    if (error || !data) {
      console.warn("[Supabase] Grade pública indisponível:", error?.message);
      return [];
    }

    return (data as ReservaDbRow[]).map(rowToReserva);
  } catch (err) {
    console.warn("[Supabase] Falha ao consultar a grade pública:", err);
    return [];
  }
}

/**
 * Acrescenta à lista os slots ocupados da grade pública que o usuário atual não enxerga
 * na tabela base (reservas de terceiros). Itens já presentes (mesmo id) são preservados.
 */
function mesclarGradePublica(reservas: Reserva[], grade: Reserva[]): Reserva[] {
  const ids = new Set(reservas.map((r) => r.id));
  return [...reservas, ...grade.filter((g) => !ids.has(g.id))];
}

/** Tamanho da página de leitura (o PostgREST do Supabase devolve no máximo 1.000 linhas por pedido). */
const TAMANHO_PAGINA = 1000;

/** Opções da leitura por período. */
export interface OpcoesPeriodo {
  /** Só uma quadra */
  quadraId?: string;
  /** Acrescenta os slots da grade pública que o usuário não enxerga (padrão: sim) */
  incluirGradePublica?: boolean;
}

/**
 * Reservas da arena ativa num intervalo de datas, lidas em páginas de 1.000 até o fim. Nunca traz o
 * histórico inteiro: o painel pede só a janela que mostra (dia, mês, período do financeiro).
 *
 * @param dataInicio Primeiro dia (YYYY-MM-DD)
 * @param dataFim Último dia (YYYY-MM-DD)
 * @param opcoes Filtro de quadra e grade pública
 * @returns Reservas do período, ou null se a leitura falhar
 *
 * @example
 * ```ts
 * const novembro = await fetchReservasPeriodoSupabase("2026-11-01", "2026-11-30");
 * ```
 */
export async function fetchReservasPeriodoSupabase(
  dataInicio: string,
  dataFim: string,
  opcoes: OpcoesPeriodo = {}
): Promise<Reserva[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];

    const linhas: ReservaDbRow[] = [];
    for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
      let consulta = supabase
        .from(TABELA_RESERVAS)
        .select("*")
        .eq("arena_id", arenaId)
        .gte("data", dataInicio)
        .lte("data", dataFim);
      if (opcoes.quadraId) consulta = consulta.eq("quadra_id", opcoes.quadraId);
      const { data, error } = await consulta
        .order("data", { ascending: true })
        .order("id", { ascending: true })
        .range(inicio, inicio + TAMANHO_PAGINA - 1);

      if (error) {
        console.error(`[Supabase] Erro ao carregar reservas de ${dataInicio} a ${dataFim}:`, error.message);
        return null;
      }
      const pagina = (data ?? []) as ReservaDbRow[];
      linhas.push(...pagina);
      if (pagina.length < TAMANHO_PAGINA) break;
    }

    const proprias = linhas.map(rowToReserva);
    if (opcoes.incluirGradePublica === false) return proprias;
    const grade = await fetchGradePublicaSupabase(dataInicio, dataFim);
    return mesclarGradePublica(proprias, opcoes.quadraId ? grade.filter((g) => g.quadraId === opcoes.quadraId) : grade);
  } catch (err) {
    console.error(`[Supabase] Falha inesperada ao buscar reservas de ${dataInicio} a ${dataFim}:`, err);
    return null;
  }
}

/**
 * Reservas de um mês inteiro da arena ativa.
 *
 * @param ano Ano (ex.: 2026)
 * @param mes Mês de 1 a 12
 */
export async function fetchReservasPorMesSupabase(ano: number, mes: number): Promise<Reserva[] | null> {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  return fetchReservasPeriodoSupabase(`${ano}-${mm}-01`, `${ano}-${mm}-${String(ultimoDia).padStart(2, "0")}`);
}

/**
 * Sessões de turmas e grupos (reservas com contrato) a partir de uma data, em páginas de 1.000.
 * As telas de Escolinhas e Grupos listam todas as sessões futuras, não só as da janela da agenda.
 *
 * @param desde Primeiro dia (YYYY-MM-DD)
 * @returns Sessões, ou null se a leitura falhar
 */
export async function fetchSessoesDeContratosSupabase(desde: string): Promise<Reserva[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return [];
    const linhas: ReservaDbRow[] = [];
    for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
      const { data, error } = await supabase
        .from(TABELA_RESERVAS)
        .select("*")
        .eq("arena_id", arenaId)
        .not("contrato_id", "is", null)
        .gte("data", desde)
        .order("data", { ascending: true })
        .order("id", { ascending: true })
        .range(inicio, inicio + TAMANHO_PAGINA - 1);
      if (error) {
        console.error("[Supabase] Erro ao carregar as sessões dos contratos:", error.message);
        return null;
      }
      const pagina = (data ?? []) as ReservaDbRow[];
      linhas.push(...pagina);
      if (pagina.length < TAMANHO_PAGINA) break;
    }
    return linhas.map(rowToReserva);
  } catch (err) {
    console.error("[Supabase] Falha inesperada ao carregar as sessões dos contratos:", err);
    return null;
  }
}

/**
 * Uma reserva da arena ativa pelo id (o detalhe abre mesmo fora da janela carregada).
 *
 * @param id Reserva
 * @returns Reserva, null se não existir ou não for visível, undefined se a leitura falhar
 */
export async function buscarReservaSupabase(id: string): Promise<Reserva | null | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  try {
    const arenaId = await obterArenaAtivaId();
    if (!arenaId) return null;
    const { data, error } = await supabase.from(TABELA_RESERVAS).select("*").eq("id", id).eq("arena_id", arenaId).maybeSingle();
    if (error) {
      console.error(`[Supabase] Erro ao carregar a reserva ${id}:`, error.message);
      return undefined;
    }
    return data ? rowToReserva(data as ReservaDbRow) : null;
  } catch (err) {
    console.error(`[Supabase] Falha inesperada ao carregar a reserva ${id}:`, err);
    return undefined;
  }
}

/** Um evento da linha do tempo da reserva (quem quitou, cancelou, remarcou...). */
export interface EventoReserva {
  id: string;
  tipo: "quitada" | "cancelada" | "remarcada" | "nao_compareceu" | "compareceu" | "devolucao_registrada";
  detalhes: Record<string, unknown>;
  autorNome: string | null;
  criadoEm: string;
}

/**
 * Histórico de uma reserva, do mais antigo ao mais novo (lido pela equipe da arena; a RLS filtra).
 *
 * @param reservaId Reserva
 * @returns Eventos (lista vazia sem banco, sem migração ou se a leitura falhar)
 */
export async function listarEventosReservaSupabase(reservaId: string): Promise<EventoReserva[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from("reservas_eventos")
      .select("id, tipo, detalhes, autor_nome, criado_em")
      .eq("reserva_id", reservaId)
      .order("criado_em", { ascending: true });
    if (error) return [];
    return ((data ?? []) as Record<string, unknown>[]).map((e) => ({
      id: String(e.id),
      tipo: e.tipo as EventoReserva["tipo"],
      detalhes: (e.detalhes as Record<string, unknown>) ?? {},
      autorNome: (e.autor_nome as string | null) ?? null,
      criadoEm: String(e.criado_em),
    }));
  } catch {
    return [];
  }
}

/** Resultado de uma gravação, com a mensagem do banco traduzida para o operador. */
export type ResultadoGravacao = { ok: true } | { ok: false; erro: string };

/**
 * Mensagem amigável para um erro do banco ao gravar reservas.
 *
 * @param erro Erro do PostgREST
 */
export function mensagemErroReserva(erro: { code?: string; message: string }): string {
  if (/Quadra fechada/i.test(erro.message)) {
    return "A quadra está fechada nesta data (Quadras e preços → Reabrir). Escolha outra quadra ou data.";
  }
  if (erro.code === "23P01" || /Horário já ocupado/i.test(erro.message)) {
    return "Esse horário já está ocupado nesta quadra. Atualize a agenda e escolha outro.";
  }
  if (erro.code === "42501" || /row-level security|permission denied/i.test(erro.message)) {
    return "Sem permissão para esta ação. Sua sessão pode ter expirado: saia e entre de novo.";
  }
  return `Não foi possível salvar no banco: ${erro.message}`;
}

/**
 * Aplica o mesmo update a todas as reservas de um contrato (filtro no banco, sem depender do que a
 * tela carregou). Ex.: encerrar uma turma cancela todas as sessões futuras, inclusive as de meses
 * que o painel nunca abriu.
 *
 * @param contratoId Contrato
 * @param dados Campos a gravar
 * @param filtro `desde`: só a partir desta data; `ativas`: ignora as já canceladas
 * @returns Quantas reservas mudaram, ou null se o banco recusar
 */
export async function atualizarReservasDoContratoSupabase(
  contratoId: string,
  dados: Partial<Reserva>,
  filtro: { desde?: string; ativas?: boolean } = {}
): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const payload: Record<string, unknown> = { ...reservaToRow(dados) };
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      let consulta = supabase.from(TABELA_RESERVAS).update(payload).eq("contrato_id", contratoId);
      if (filtro.desde) consulta = consulta.gte("data", filtro.desde);
      if (filtro.ativas) consulta = consulta.neq("status", "cancelada");
      const { data, error } = await consulta.select("id");
      if (!error) return (data ?? []).length;
      if (expurgarColunaIncompativel(payload, error.message)) continue;
      console.error(`[Supabase] Erro ao atualizar as reservas do contrato ${contratoId}:`, error.message);
      return null;
    }
    return null;
  } catch (err) {
    console.error(`[Supabase] Falha inesperada ao atualizar as reservas do contrato ${contratoId}:`, err);
    return null;
  }
}

/**
 * Remove colunas ausentes no schema cache do Supabase com base na mensagem de erro do PostgREST.
 * Retorna true se alguma coluna foi removida do payload, permitindo retry imediato sem quebrar o fluxo.
 */
function expurgarColunaIncompativel(
  payload: Record<string, unknown>,
  errorMessage: string
): boolean {
  const match = errorMessage.match(/Could not find the '(\w+)' column/i);
  if (match && match[1] && match[1] in payload) {
    console.warn(
      `[Supabase] Coluna '${match[1]}' ausente no schema cache de 'reservas'. Removendo do payload para compatibilidade retroativa.`
    );
    delete payload[match[1]];
    return true;
  }

  if (errorMessage.includes("user_id") && "user_id" in payload) {
    delete payload.user_id;
    return true;
  }

  return false;
}

/**
 * Preenche o `arena_id` com a arena ativa quando a reserva ainda não o tiver.
 * Sem ele, o RLS rejeita a gravação (o operador só grava na própria arena).
 */
async function comArenaAtiva(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (row.arena_id) return row;
  const arenaId = await obterArenaAtivaId();
  return arenaId ? { ...row, arena_id: arenaId } : row;
}

/**
 * Insere uma nova reserva no banco de dados Supabase (uso do painel administrativo:
 * reservas manuais e bloqueios). Visitantes e atletas usam `POST /api/reservas/checkout`.
 * Trata graciosamente eventuais colunas ausentes no schema cache com retry automático resiliente.
 *
 * @returns `{ ok: true }` ou a mensagem do banco traduzida (ex.: horário já ocupado)
 */
export async function inserirReservaSupabase(reserva: Reserva): Promise<ResultadoGravacao> {
  if (!isSupabaseConfigured()) {
    return { ok: false, erro: "Banco de dados não configurado." };
  }

  try {
    const payload: Record<string, unknown> = await comArenaAtiva({ ...reservaToRow(reserva) });
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const { error } = await supabase.from(TABELA_RESERVAS).insert([payload]);
      if (!error) return { ok: true };
      if (expurgarColunaIncompativel(payload, error.message)) continue;
      console.error("[Supabase] Erro ao inserir reserva:", error.message);
      return { ok: false, erro: mensagemErroReserva(error) };
    }
    return { ok: false, erro: "Não foi possível salvar a reserva." };
  } catch (err) {
    console.error("[Supabase] Falha inesperada ao inserir reserva:", err);
    return { ok: false, erro: "Falha de conexão ao salvar a reserva. Tente de novo." };
  }
}

/**
 * Insere várias reservas de uma só vez (ocorrências de um contrato recorrente).
 * Usa upsert por id para ser idempotente caso a geração seja repetida.
 */
export async function inserirReservasEmLoteSupabase(reservas: Reserva[]): Promise<boolean> {
  if (!isSupabaseConfigured() || reservas.length === 0) {
    return false;
  }

  try {
    const rows = await Promise.all(reservas.map((r) => comArenaAtiva(reservaToRow(r))));
    const { error } = await supabase
      .from(TABELA_RESERVAS)
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.error("[Supabase] Erro ao inserir reservas em lote:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Supabase] Falha inesperada ao inserir reservas em lote:", err);
    return false;
  }
}

/** Aplica o mesmo update a várias reservas (ex.: encerrar contrato → cancelar futuras). */
export async function atualizarReservasEmLoteSupabase(
  ids: string[],
  dados: Partial<Reserva>
): Promise<boolean> {
  if (!isSupabaseConfigured() || ids.length === 0) {
    return false;
  }

  try {
    const payload: Record<string, unknown> = { ...reservaToRow(dados) };
    let tentativa = 0;

    while (tentativa < 6) {
      const { error } = await supabase
        .from(TABELA_RESERVAS)
        .update(payload)
        .in("id", ids);

      if (!error) {
        return true;
      }

      if (expurgarColunaIncompativel(payload, error.message)) {
        tentativa++;
        continue;
      }

      console.error("[Supabase] Erro ao atualizar reservas em lote:", error.message);
      return false;
    }

    return false;
  } catch (err) {
    console.error("[Supabase] Falha inesperada ao atualizar reservas em lote:", err);
    return false;
  }
}

/**
 * Atualiza campos de uma reserva existente no Supabase.
 * Trata graciosamente caso colunas novas (ex: fidelidade) ainda não existam no schema do PostgreSQL,
 * removendo campos incompatíveis e tentando novamente sem interromper o fluxo da aplicação.
 */
export async function atualizarReservaSupabase(
  id: string,
  dados: Partial<Reserva>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const payload: Record<string, unknown> = { ...reservaToRow(dados) };
    let tentativa = 0;

    while (tentativa < 6) {
      const { error } = await supabase
        .from(TABELA_RESERVAS)
        .update(payload)
        .eq("id", id);

      if (!error) {
        return true;
      }

      if (expurgarColunaIncompativel(payload, error.message)) {
        tentativa++;
        continue;
      }

      console.error(`[Supabase] Erro ao atualizar reserva ${id}:`, error.message);
      return false;
    }

    return false;
  } catch (err) {
    console.error(`[Supabase] Falha inesperada ao atualizar reserva ${id}:`, err);
    return false;
  }
}

/**
 * Remove uma reserva do banco de dados Supabase.
 */
export async function removerReservaSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from(TABELA_RESERVAS)
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`[Supabase] Erro ao remover reserva ${id}:`, error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Supabase] Falha inesperada ao remover reserva ${id}:`, err);
    return false;
  }
}

/**
 * Cria uma inscrição Realtime para escutar inserções, atualizações e deleções
 * na tabela 'reservas' da arena ativa. O RLS limita os eventos ao que o usuário pode ler
 * (operadores recebem tudo da arena; atletas, só as próprias reservas).
 */
export function subscreverReservasSupabase(
  onInsert: (reserva: Reserva) => void,
  onUpdate: (reserva: Reserva) => void,
  onDelete: (id: string) => void
) {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  // Remove qualquer canal anterior com mesmo prefixo para evitar conflito de callbacks após subscribe
  try {
    const canaisExistentes = supabase.getChannels();
    for (const c of canaisExistentes) {
      if (c.topic.includes("mudancas-reservas-realtime")) {
        void supabase.removeChannel(c);
      }
    }
  } catch (err) {
    console.warn("[Supabase] Aviso ao limpar canais anteriores:", err);
  }

  let cancelado = false;
  let canal: ReturnType<typeof supabase.channel> | null = null;

  void obterArenaAtivaId().then((arenaId) => {
    if (cancelado || !arenaId) return;

    const filtro = `arena_id=eq.${arenaId}`;
    const canalId = `mudancas-reservas-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    canal = supabase
      .channel(canalId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABELA_RESERVAS, filter: filtro },
        (payload) => {
          onInsert(rowToReserva(payload.new as ReservaDbRow));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABELA_RESERVAS, filter: filtro },
        (payload) => {
          onUpdate(rowToReserva(payload.new as ReservaDbRow));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: TABELA_RESERVAS },
        (payload) => {
          const idDeletado = (payload.old as { id?: string })?.id;
          if (idDeletado) {
            onDelete(idDeletado);
          }
        }
      )
      .subscribe();
  });

  return () => {
    cancelado = true;
    if (canal) void supabase.removeChannel(canal);
  };
}

/** Reserva que cai num período de fechamento da quadra (para o dono decidir antes de fechar). */
export interface ReservaNoCaminho {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  nomeCliente: string;
}

/**
 * Reservas ativas de uma quadra num período (sem os bloqueios de horário do painel). Usado ao fechar
 * a quadra inteira: elas continuam valendo e o painel lista para o dono cancelar ou remarcar.
 *
 * @param quadraId Quadra
 * @param inicio Primeiro dia (YYYY-MM-DD)
 * @param fim Último dia; vazio = sem fim ("até eu liberar")
 * @returns Até 100 reservas em ordem de data, ou null se a consulta falhar
 *
 * @example
 * ```ts
 * const noCaminho = await listarReservasDaQuadraNoPeriodo("q2", "2026-11-10", null);
 * ```
 */
export async function listarReservasDaQuadraNoPeriodo(quadraId: string, inicio: string, fim: string | null): Promise<ReservaNoCaminho[] | null> {
  if (!isSupabaseConfigured()) return [];
  try {
    let consulta = supabase
      .from("reservas")
      .select("id, data, hora_inicio, hora_fim, nome_cliente, tipo_reserva")
      .eq("quadra_id", quadraId)
      .gte("data", inicio)
      .in("status", ["confirmada", "pendente", "em_processamento"])
      .neq("tipo_reserva", "manutencao_bloqueio")
      .order("data")
      .order("hora_inicio")
      .limit(100);
    if (fim) consulta = consulta.lte("data", fim);
    const { data, error } = await consulta;
    if (error) {
      console.error("[reservasService] Erro ao listar reservas da quadra:", error.message);
      return null;
    }
    return (data ?? []).map((r) => ({
      id: String(r.id),
      data: String(r.data).slice(0, 10),
      horaInicio: String(r.hora_inicio ?? ""),
      horaFim: String(r.hora_fim ?? ""),
      nomeCliente: String(r.nome_cliente ?? ""),
    }));
  } catch (err) {
    console.error("[reservasService] Erro inesperado ao listar reservas da quadra:", err);
    return null;
  }
}
