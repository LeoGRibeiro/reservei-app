/**
 * @file reservasAtletaServidorService.ts
 * @description Ações do atleta autenticado sobre as PRÓPRIAS reservas (somente servidor).
 * O RLS só permite UPDATE em `reservas` por operadores; estas regras substituem esse acesso
 * conferindo a titularidade (`user_id`) e o estado da reserva.
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import { FUSO_PADRAO_ARENA, instanteNoFuso } from "@/lib/datas/fusoHorario";
import { arenaTemModulo } from "@/lib/servidor/modulosServidor";

/** Máximo de vagas abertas numa partida. */
const MAX_VAGAS = 30;
const STATUS_ATIVOS = new Set(["confirmada", "pendente", "em_processamento"]);

/** Carrega a reserva conferindo que pertence ao atleta. */
async function carregarReservaDoAtleta(reservaId: string, usuarioId: string) {
  const { data, error } = await supabaseAdmin.from("reservas").select("*").eq("id", reservaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== usuarioId) throw new ErroHttp("Reserva não encontrada.", 404);
  return data as {
    id: string;
    arena_id: string;
    status: string;
    data: string;
    hora_inicio: string;
  };
}

/** Indica se a partida ainda não começou (no fuso da arena). */
function partidaAindaNaoComecou(data: string, horaInicio: string, agora: Date): boolean {
  return instanteNoFuso(String(data).slice(0, 10), horaInicio, FUSO_PADRAO_ARENA).getTime() > agora.getTime();
}

/**
 * Cancela uma reserva do próprio atleta antes do início da partida.
 *
 * @param reservaId Reserva
 * @param usuarioId Atleta autenticado
 * @param agora Instante de referência (testes)
 * @throws ErroHttp 404 (não é do atleta) ou 409 (já cancelada/iniciada)
 */
export async function cancelarReservaDoAtleta(
  reservaId: string,
  usuarioId: string,
  agora: Date = new Date()
): Promise<void> {
  const reserva = await carregarReservaDoAtleta(reservaId, usuarioId);
  if (!STATUS_ATIVOS.has(reserva.status)) throw new ErroHttp("Esta reserva não pode mais ser cancelada.", 409);
  if (!partidaAindaNaoComecou(reserva.data, reserva.hora_inicio, agora)) {
    throw new ErroHttp("Não é possível cancelar uma partida que já começou.", 409);
  }

  const { error } = await supabaseAdmin
    .from("reservas")
    .update({ status: "cancelada", permite_vagas: false, vagas_abertas: 0 })
    .eq("id", reservaId);
  if (error) throw new Error(error.message);
}

/**
 * Abre, altera ou fecha as vagas da partida do próprio atleta (mural de vagas).
 *
 * @param reservaId Reserva
 * @param usuarioId Atleta autenticado
 * @param vagasAbertas Quantidade de vagas (0 fecha o mural para esta partida)
 * @param agora Instante de referência (testes)
 * @throws ErroHttp 400 (quantidade inválida), 404 (não é do atleta) ou 409 (reserva inativa/iniciada)
 */
export async function atualizarVagasDoAtleta(
  reservaId: string,
  usuarioId: string,
  vagasAbertas: number,
  agora: Date = new Date()
): Promise<{ permiteVagas: boolean; vagasAbertas: number }> {
  if (!Number.isInteger(vagasAbertas) || vagasAbertas < 0 || vagasAbertas > MAX_VAGAS) {
    throw new ErroHttp("Quantidade de vagas inválida.", 400);
  }

  const reserva = await carregarReservaDoAtleta(reservaId, usuarioId);
  if (vagasAbertas > 0 && !(await arenaTemModulo(reserva.arena_id, "vagas"))) {
    throw new ErroHttp("Esta arena não oferece o mural de vagas.", 409);
  }
  if (reserva.status !== "confirmada" && reserva.status !== "pendente") {
    throw new ErroHttp("Só é possível abrir vagas em reservas pagas.", 409);
  }
  if (vagasAbertas > 0 && !partidaAindaNaoComecou(reserva.data, reserva.hora_inicio, agora)) {
    throw new ErroHttp("Esta partida já começou.", 409);
  }

  const resultado = { permiteVagas: vagasAbertas > 0, vagasAbertas };
  const { error } = await supabaseAdmin
    .from("reservas")
    .update({ permite_vagas: resultado.permiteVagas, vagas_abertas: vagasAbertas })
    .eq("id", reservaId);
  if (error) throw new Error(error.message);
  return resultado;
}
