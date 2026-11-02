/**
 * @file clientesServidorService.ts
 * @description Bloqueio de cliente NESTA arena (somente servidor), pelo WhatsApp. Vale para quem tem
 * conta e para quem reserva sem conta; não afeta o atleta em outras arenas. O checkout confere a
 * tabela `arena_clientes_bloqueados` antes de criar a reserva.
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano F, tela Clientes)
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { ErroHttp } from "@/lib/servidor/autenticacaoServidor";
import type { MembroArena } from "@/lib/servidor/autorizacaoArena";
import { telefoneNacional } from "@/lib/atletas/telefone";

/** Ação do painel sobre um cliente. */
export type AcaoCliente = { acao: "bloquear"; telefone: string; motivo: string } | { acao: "desbloquear"; telefone: string };

/**
 * Valida o pedido do painel.
 *
 * @throws ErroHttp 400
 */
export function validarAcaoCliente(corpo: unknown): AcaoCliente {
  const b = (corpo ?? {}) as Record<string, unknown>;
  const telefone = telefoneNacional(typeof b.telefone === "string" ? b.telefone : "");
  if (telefone.length < 10 || telefone.length > 11) throw new ErroHttp("WhatsApp do cliente inválido.", 400);
  if (b.acao === "desbloquear") return { acao: "desbloquear", telefone };
  if (b.acao !== "bloquear") throw new ErroHttp("Ação inválida.", 400);
  const motivo = typeof b.motivo === "string" ? b.motivo.trim().slice(0, 300) : "";
  if (motivo.length < 3) throw new ErroHttp("Informe o motivo do bloqueio.", 400);
  return { acao: "bloquear", telefone, motivo };
}

/**
 * Bloqueia ou libera o cliente nesta arena.
 *
 * @param membro Gerente ou dono (conferido na rota)
 * @param acao Ação validada
 */
export async function executarAcaoCliente(membro: MembroArena, acao: AcaoCliente): Promise<void> {
  if (acao.acao === "bloquear") {
    const { error } = await supabaseAdmin.from("arena_clientes_bloqueados").upsert(
      {
        arena_id: membro.arenaId,
        telefone: acao.telefone,
        motivo: acao.motivo,
        bloqueado_por: membro.userId,
        bloqueado_por_nome: membro.email,
        criado_em: new Date().toISOString(),
      },
      { onConflict: "arena_id,telefone" }
    );
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabaseAdmin.from("arena_clientes_bloqueados").delete().eq("arena_id", membro.arenaId).eq("telefone", acao.telefone);
  if (error) throw new Error(error.message);
}
