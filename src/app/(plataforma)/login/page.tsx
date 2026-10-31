/**
 * @file page.tsx
 * @description Endereço antigo do login do atleta (senha). O atleta agora entra com um código no
 * WhatsApp, no próprio portal: redireciona com o diálogo "Entrar" aberto.
 */

import { redirect } from "next/navigation";

export default function Login() {
  redirect("/?conta=entrar");
}
