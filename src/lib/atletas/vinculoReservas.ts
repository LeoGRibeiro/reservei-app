/**
 * @file vinculoReservas.ts
 * @description Liga ao atleta, no momento em que a conta é criada, as reservas que ele fez antes sem
 * conta (balcão ou Pix sem cadastro) com o mesmo WhatsApp. Roda só no servidor. Substitui a ligação
 * que o painel fazia pelo navegador a cada abertura (gravação durante leitura).
 *
 * @see SPEC/2026-11-02-admin-revisao.md (Plano C, item 3)
 */

import { supabaseAdmin } from "@/lib/supabase/adminClient";
import { variacoesDoTelefone } from "./telefone";

export { variacoesDoTelefone } from "./telefone";

/**
 * Liga as reservas sem conta com o WhatsApp do atleta à conta dele. Nunca lança: falhar aqui não
 * pode impedir o cadastro.
 *
 * @param userId Conta do atleta
 * @param telefone WhatsApp do cadastro
 * @returns Quantas reservas foram ligadas (0 se nenhuma ou se falhou)
 */
export async function vincularReservasAoAtleta(userId: string, telefone: string): Promise<number> {
  const variacoes = variacoesDoTelefone(telefone);
  if (!userId || variacoes.length === 0) return 0;
  try {
    const { data, error } = await supabaseAdmin
      .from("reservas")
      .update({ user_id: userId })
      .is("user_id", null)
      .in("whatsapp_cliente", variacoes)
      .select("id");
    if (error) {
      console.error("[Vínculo] Falha ao ligar reservas ao atleta:", error.message);
      return 0;
    }
    return (data ?? []).length;
  } catch (err) {
    console.error("[Vínculo] Falha inesperada ao ligar reservas ao atleta:", err);
    return 0;
  }
}
