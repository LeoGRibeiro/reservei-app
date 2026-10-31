/**
 * @file page.tsx
 * @description Endereço antigo do cadastro do atleta (senha). A conta agora é criada com um código no
 * WhatsApp, no próprio portal: redireciona com o diálogo "Criar conta" aberto.
 */

import { redirect } from "next/navigation";

export default function Cadastro() {
  redirect("/?conta=criar");
}
