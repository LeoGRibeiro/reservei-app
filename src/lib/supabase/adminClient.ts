/**
 * @file adminClient.ts
 * @description Cliente Supabase restrito exclusivamente a rotas de backend (Node.js/Serverless).
 * Utiliza a SUPABASE_SERVICE_ROLE_KEY para contornar políticas de RLS em operações do sistema
 * (ex: webhooks de pagamento Pix, criação de administradores e expurgo de locks).
 *
 * ATENÇÃO: nunca importe este módulo em componentes client ("use client") nem prefixe a chave
 * com NEXT_PUBLIC_. A chave service_role dá acesso total ao banco.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!serviceRoleKey && process.env.NODE_ENV === "production") {
  console.warn(
    "[adminClient] AVISO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente. Webhooks e rotas administrativas podem falhar."
  );
}

/**
 * Retorna true se URL do projeto e chave service_role estiverem preenchidas com valores reais.
 *
 * @example
 * ```ts
 * if (!isAdminClientConfigured()) return NextResponse.json({ error: "..." }, { status: 503 });
 * ```
 */
export const isAdminClientConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      serviceRoleKey &&
      !supabaseUrl.includes("sua-url-supabase") &&
      !serviceRoleKey.includes("sua-chave")
  );
};

/**
 * Cliente Supabase com autoridade total (service role). Sem sessão persistida.
 */
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  serviceRoleKey || "placeholder-service-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
