/**
 * @file auditoria.ts
 * @description Trilha de auditoria de ações administrativas sensíveis (somente servidor): convites e
 * mudanças de equipe, redefinições de senha, confirmações manuais de pagamento e alterações de
 * credenciais. Grava em `auditoria_admin`, tabela sem acesso pelo navegador.
 *
 * A gravação é best-effort: uma falha de auditoria é registrada no log do servidor, mas não desfaz
 * a ação já concluída (o usuário não deve ver erro numa operação que deu certo).
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";

/** Ações auditadas. */
export type AcaoAuditada =
  | "equipe.convite"
  | "equipe.alteracao"
  | "equipe.redefinir_senha"
  | "atleta.redefinir_senha"
  | "pagamento.confirmacao_manual"
  | "pagamento.recusa_manual"
  | "pagamento.credencial_conectada"
  | "pagamento.credencial_removida"
  | "pagamento.configuracao_pix";

/** Registro de auditoria. */
export interface EventoAuditoria {
  /** Arena onde a ação aconteceu */
  arenaId: string;
  /** Usuário que executou a ação */
  autorId: string;
  /** Ação executada */
  acao: AcaoAuditada;
  /** Identificador do alvo (usuário, reserva, etc.) */
  alvoId?: string | null;
  /** Detalhes livres, sem segredos (nunca senhas ou chaves de API) */
  detalhes?: Record<string, unknown>;
}

/**
 * Registra um evento de auditoria. Nunca lança exceção.
 *
 * @param evento Dados do evento
 *
 * @example
 * ```ts
 * await registrarAuditoria({ arenaId, autorId: membro.userId, acao: "equipe.convite", alvoId: novoId });
 * ```
 */
export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("auditoria_admin").insert({
      arena_id: evento.arenaId,
      autor_id: evento.autorId,
      acao: evento.acao,
      alvo_id: evento.alvoId ?? null,
      detalhes: evento.detalhes ?? {},
    });
    if (error) console.error("[Auditoria] Falha ao registrar evento:", evento.acao, error.message);
  } catch (err) {
    console.error("[Auditoria] Erro inesperado ao registrar evento:", evento.acao, err);
  }
}
