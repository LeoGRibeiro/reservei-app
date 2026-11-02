/**
 * @file contaRepository.ts
 * @description Leituras do navegador para o portal, com a sessão do atleta (RLS: cada atleta lê só o
 * que é dele): perfil, reservas, carimbos, horas grátis e pedidos de vaga; e a grade pública.
 * Toda leitura trata o erro e devolve um valor vazio, para a tela nunca quebrar.
 */

import { supabase } from "@/lib/supabase/client";
import { mapearLinhaGrade } from "./agenda";
import { somarDias } from "./formatos";
import {
  mapearAtleta,
  mapearCarimbo,
  mapearHoraGratis,
  mapearPedido,
  mapearReservaAtleta,
  type AtletaPortal,
  type CarimboAtleta,
  type HoraGratis,
  type PedidoVaga,
  type ReservaAtleta,
} from "./contaAtleta";
import type { LinhaGrade } from "./types";

type Linha = Record<string, unknown>;

async function ler(rotulo: string, consulta: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Linha[]> {
  try {
    const { data, error } = await consulta;
    if (error) {
      console.warn(`[contaRepository] ${rotulo}: ${error.message}`);
      return [];
    }
    return Array.isArray(data) ? (data as Linha[]) : data ? [data as Linha] : [];
  } catch (err) {
    console.error(`[contaRepository] ${rotulo}: falha inesperada`, err);
    return [];
  }
}

/**
 * Grade pública dos próximos 31 dias.
 */
export async function lerGrade(arenaId: string, hoje: string, diasAFrente: number): Promise<LinhaGrade[] | null> {
  try {
    const { data, error } = await supabase.rpc("grade_publica", {
      p_arena_id: arenaId,
      p_data_inicio: hoje,
      p_data_fim: somarDias(hoje, diasAFrente),
    });
    if (error) {
      console.warn(`[contaRepository] grade: ${error.message}`);
      return null;
    }
    return ((data ?? []) as Linha[]).map(mapearLinhaGrade);
  } catch (err) {
    console.error("[contaRepository] grade: falha inesperada", err);
    return null;
  }
}

/** Perfil do atleta (`usuarios`), ou null se ainda não existe. */
export async function lerAtleta(userId: string): Promise<AtletaPortal | null> {
  const linhas = await ler(
    "perfil",
    supabase.from("usuarios").select("*").or(`auth_user_id.eq.${userId},id.eq.${userId}`).limit(1)
  );
  return linhas[0] ? mapearAtleta(linhas[0], userId) : null;
}

/** Dados da conta do atleta numa arena. */
export interface DadosConta {
  reservas: ReservaAtleta[];
  carimbos: CarimboAtleta[];
  horasGratis: HoraGratis[];
  /** Horas grátis que bateram a meta e aguardam a arena liberar */
  horasEmAnalise?: number;
  /** Pedidos que o atleta fez em partidas de outras pessoas */
  pedidosFeitos: PedidoVaga[];
  /** Pedidos recebidos nas partidas do atleta */
  pedidosRecebidos: PedidoVaga[];
}

export const CONTA_VAZIA: DadosConta = { reservas: [], carimbos: [], horasGratis: [], pedidosFeitos: [], pedidosRecebidos: [] };

/**
 * Carrega reservas, Clube e pedidos do atleta na arena.
 *
 * @param agoraMinHoje Minutos de agora no fuso da arena
 */
export async function lerConta(arenaId: string, userId: string, hoje: string, agoraMinHoje: number): Promise<DadosConta> {
  const [reservas, selos, vouchers, feitos] = await Promise.all([
    ler("reservas", supabase.from("reservas").select("*").eq("arena_id", arenaId).eq("user_id", userId).order("data", { ascending: false })),
    ler("carimbos", supabase.from("fidelidade_selos").select("*").eq("arena_id", arenaId).eq("usuario_id", userId)),
    ler(
      "horas grátis",
      supabase.from("fidelidade_vouchers").select("*").eq("arena_id", arenaId).eq("usuario_id", userId).in("status", ["disponivel", "em_analise"])
    ),
    ler("pedidos feitos", supabase.from("interesses_vagas").select("*").eq("usuario_id", userId)),
  ]);
  const minhas = reservas.flatMap((r) => {
    const m = mapearReservaAtleta(r, hoje, agoraMinHoje);
    return m ? [m] : [];
  });
  const idsMinhas = minhas.map((r) => r.id);
  const recebidos = idsMinhas.length
    ? await ler("pedidos recebidos", supabase.from("interesses_vagas").select("*").in("reserva_id", idsMinhas).order("created_at", { ascending: false }))
    : [];
  return {
    reservas: minhas,
    carimbos: selos.map(mapearCarimbo),
    // Só as liberadas valem; as "em análise" aparecem como aviso no Clube
    horasGratis: vouchers.filter((v) => v.status !== "em_analise").map(mapearHoraGratis),
    horasEmAnalise: vouchers.filter((v) => v.status === "em_analise").length,
    pedidosFeitos: feitos.map(mapearPedido).filter((p) => !idsMinhas.includes(p.reservaId)),
    pedidosRecebidos: recebidos.map(mapearPedido).filter((p) => p.usuarioId !== userId),
  };
}

/**
 * Pede para entrar numa partida do mural (o organizador recebe e confirma pelo WhatsApp).
 * O RLS só deixa o atleta criar pedido em nome próprio.
 *
 * @returns true se o pedido foi gravado
 */
export async function pedirVaga(reservaId: string, atleta: { id: string; nome: string; whatsappDigitos: string }): Promise<boolean> {
  try {
    const { error } = await supabase.from("interesses_vagas").insert({
      id: `int_${crypto.randomUUID()}`,
      reserva_id: reservaId,
      usuario_id: atleta.id,
      nome_usuario: atleta.nome,
      telefone_usuario: atleta.whatsappDigitos,
      status: "pendente",
    });
    if (error) {
      console.warn(`[contaRepository] pedir vaga: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[contaRepository] pedir vaga: falha inesperada", err);
    return false;
  }
}
