# Especificação Técnica: Setup Wizard de Primeiro Acesso, Provisionamento de Arenas e Blindagem de Webhooks (Etapa 2)

**Data:** 21/10/2026  
**Status:** Aprovado para Implementação  
**Responsável pelo Blueprint:** Antigravity (CTO / Arquiteto de Software)  
**Engenheiro de Execução:** Claude (Full Stack Implementation Engineer & Revisor Crítico)  
**Escopo:** Implementação do **First-Run Admin Setup Wizard** (criação nobre e direta do primeiro administrador de cada arena sem manipulação manual de banco), **Cliente Supabase Service Role** no servidor para blindar webhooks de pagamento contra bloqueios de RLS, e **View Pública Sanitizada da Grade** (conformidade estrita com a LGPD).

---

## 1. Contexto e Objetivos de Negócio

Após a implementação da Fase 1 (Autenticação Supabase e RLS fechado), o Claude realizou um peer review técnico apontando pontos que precisam de resolução:
1. **Falta de um fluxo nobre de primeiro acesso:** Quando uma nova arena é criada ou no primeiro deploy, não há administrador cadastrado. O usuário não deve ser obrigado a abrir o dashboard do Supabase para copiar UUIDs ou rodar SQL manual.
2. **Webhooks Pix bloqueados por RLS:** Como o RLS da tabela `reservas` agora exige operador autenticado para `UPDATE`, webhooks externos que rodam no servidor (Asaas/Pix) quebram se utilizarem o cliente anônimo (`anon_key`).
3. **Vazamento de Dados Pessoais (LGPD):** A leitura pública da tabela `reservas` expõe colunas sensíveis (`nome_cliente`, `telefone_cliente`, `cpf_cliente`). A grade pública deve enxergar apenas os horários ocupados.

---

## 2. Modelagem do Banco de Dados & Scripts SQL

O Claude deve sincronizar o arquivo [`src/lib/supabase/schema.sql`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/supabase/schema.sql) com as seguintes definições:

### 2.1. View Sanitizada da Grade Pública (Conformidade com LGPD)
Em vez de permitir `SELECT *` na tabela base `reservas` para visitantes não autenticados, criamos uma View que expõe apenas os campos estritamente necessários para desenhar a grade:

```sql
-- ==============================================================================
-- VIEW PÚBLICA DE SLOTS OCUPADOS (LGPD)
-- ==============================================================================
CREATE OR REPLACE VIEW public.view_grade_publica AS
SELECT
  id,
  arena_id,
  quadra_id,
  data,
  horarios,
  hora_inicio,
  hora_fim,
  status,
  esporte
FROM public.reservas
WHERE status IN ('confirmada', 'pendente', 'em_processamento');

-- Concede leitura pública à View para anon e authenticated
GRANT SELECT ON public.view_grade_publica TO anon, authenticated;

-- Revoga a leitura pública direta de dados sensíveis na tabela base
DROP POLICY IF EXISTS "Leitura de reservas por clientes ou operadores" ON public.reservas;

CREATE POLICY "Leitura de reservas por clientes ou operadores"
  ON public.reservas FOR SELECT
  USING (
    -- Cliente acessa sua própria reserva
    (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
    OR
    -- Operadores e proprietários da respectiva arena
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.ativo = true
    ))
  );
```

---

## 3. First-Run Admin Setup Wizard (Tela Direta de Primeiro Acesso)

### 3.1. Regra de Negócio & Detecção Automática
Ao acessar `https://[slug].reservei.com/admin` (ou `http://[slug].localhost:3000/admin`):
1. O componente [`src/components/admin/AdminShell.tsx`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/components/admin/AdminShell.tsx) verifica se a arena atual possui algum operador ativo cadastrado em `arena_usuarios`.
2. **Cenário A: Existem operadores cadastrados:**
   - Exibe a tela de login normal (`AdminLogin.tsx`).
3. **Cenário B: Zero operadores cadastrados (Arena Nova / Primeiro Acesso):**
   - Renderiza automaticamente a tela direta e simples de configuração: `AdminSetupWizard.tsx`.

### 3.2. Componente de UI: `src/components/admin/AdminSetupWizard.tsx`
Interface direta, limpa e funcional (sem firulas visuais desnecessárias):
- **Cabeçalho:** *"Configuração Inicial do Administrador · [Nome da Arena]"*.
- **Texto auxiliar:** *"Esta arena ainda não possui uma conta de proprietário cadastrada. Defina as credenciais do primeiro administrador para iniciar."*
- **Campos do Formulário:**
  - `Nome Completo` (input texto)
  - `E-mail Profissional` (input email)
  - `Senha` (input password, mínimo 6 caracteres)
  - `Confirmar Senha` (input password)
- **Botão de Ação:** *"Criar Administrador e Acessar Painel"* (com spinner de carregamento).

### 3.3. Endpoint de Criação Segura: `src/app/api/admin/setup/route.ts`
Como criar usuários com auto-confirmação requer privilégios de administrador do Supabase, a criação deve ocorrer no servidor via API Route:
- **Método:** `POST /api/admin/setup`
- **Validação:**
  1. Valida se os campos foram preenchidos (Zod ou validação direta).
  2. Consulta `arena_usuarios` para a `arenaId` informada. Se já existir algum operador ativo, **rejeita a requisição** com HTTP 403 (*"Esta arena já possui administrador configurado"*).
  3. Utiliza o cliente `supabaseAdmin` (Service Role) para criar o usuário em `auth.users` com `email_confirm: true`:
     ```ts
     const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
       email,
       password,
       email_confirm: true,
       user_metadata: { nome },
     });
     ```
  4. Insere o registro na tabela `public.arena_usuarios`:
     ```ts
     await supabaseAdmin.from("arena_usuarios").insert({
       arena_id: arenaId,
       user_id: userData.user.id,
       role: "proprietario",
       ativo: true,
     });
     ```
  5. Retorna `{ success: true }`.
- O front-end, ao receber o sucesso, executa automaticamente `supabase.auth.signInWithPassword({ email, password })` e o usuário já entra no dashboard logado!

---

## 4. Cliente Supabase com Service Role para o Servidor (`src/lib/supabase/adminClient.ts`)

Para que Webhooks externos (Pix/Asaas), Cron Jobs e o Setup Wizard possam gravar dados com autoridade total de backend:

Criar o arquivo `src/lib/supabase/adminClient.ts`:
```ts
/**
 * @file adminClient.ts
 * @description Cliente Supabase restrito exclusivamente a rotas de backend (Node.js/Serverless).
 * Utiliza a SUPABASE_SERVICE_ROLE_KEY para contornar políticas de RLS em operações do sistema
 * (ex: webhooks de pagamento Pix, criação de administradores e expurgo de locks).
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!serviceRoleKey && process.env.NODE_ENV === "production") {
  console.warn(
    "[adminClient] AVISO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente. Webhooks e rotas administrativas podem falhar."
  );
}

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
```

### 4.1. Atualização do Webhook Pix e PagamentoService
Em [`src/lib/pagamento/pagamentoService.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/pagamento/pagamentoService.ts):
- O método `processarConfirmacaoPagamento` e `liberarLocksExpirados` devem utilizar `supabaseAdmin` em vez do cliente público `supabase` quando executados no servidor.
- Dessa forma, quando o gateway de pagamento (Asaas) enviar a notificação de liquidação do Pix, a reserva é atualizada para `status = 'confirmada'` imediatamente, sem ser bloqueada pelo RLS!

---

## 5. Portal Simples de Onboarding de Novas Arenas (`src/app/super-admin/page.tsx`)

Para o Leonardo cadastrar uma nova arena em 1 minuto antes de visitá-la:

### Rota: `/super-admin`
- Uma tela limpa e direta para cadastro rápido:
  1. `Nome da Arena` (ex: "Arena Central")
  2. `Slug` (ex: "central") -> já avisa que a URL será `central.reservei.com`
  3. `Cidade` e `Estado`
  4. `WhatsApp Comercial`
  5. `Módulos Contratados` (Checkboxes pré-marcados: Agendamento, Vagas, Fidelidade, Escolinhas, Contratos)
  6. `Quantidade de Quadras Iniciais` (default: 3)
- Ao submeter, cria a arena em `public.arenas` e gera as quadras padrão.
- Quando o dono da arena acessar `Central.reservei.com/admin` pela primeira vez, ele cairá direto no **Setup Wizard** para definir a sua senha de proprietário!

---

## 6. Roteiro de Implementação para o Claude (Passo a Passo)

1. **Variáveis de Ambiente:**
   - Adicionar `SUPABASE_SERVICE_ROLE_KEY` no [`src/.env.example`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/.env.example).
2. **Criação do Admin Client:**
   - Criar `src/lib/supabase/adminClient.ts` com a instância de serviço.
3. **Criação da Rota de Setup:**
   - Criar `src/app/api/admin/setup/route.ts` que valida a ausência de operadores e cria o usuário com `supabaseAdmin.auth.admin.createUser`.
4. **Criação do Componente Setup Wizard:**
   - Criar `src/components/admin/AdminSetupWizard.tsx`.
   - Modificar [`src/components/admin/AdminShell.tsx`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/components/admin/AdminShell.tsx) para consultar se a arena possui operadores. Se tiver 0, renderiza `AdminSetupWizard` em vez de `AdminLogin`.
5. **Correção do Webhook Pix no Servidor:**
   - Em `src/lib/pagamento/pagamentoService.ts` e `src/app/api/webhooks/pagamentos/route.ts`, trocar o update de reservas para usar `supabaseAdmin`.
6. **Sincronização do Schema:**
   - Adicionar a criação da View `view_grade_publica` no [`src/lib/supabase/schema.sql`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/supabase/schema.sql).
7. **Página Simples de Super Admin:**
   - Criar `src/app/super-admin/page.tsx` com o formulário direto de criação de arenas.
8. **Testes Automatizados:**
   - Criar testes para o endpoint `/api/admin/setup` (sucesso e rejeição quando já existe operador).
   - Executar `npm test` garantindo que todos os testes passem.

---

## 7. Critérios de Aceite & Validação

- [ ] Acessar `/admin` de uma arena sem operadores exibe automaticamente o Setup Wizard limpo e direto.
- [ ] Preencher o Setup Wizard cria a conta, vincula como proprietário e já redireciona para o dashboard logado.
- [ ] Tentar acessar a rota `/api/admin/setup` após o administrador já existir retorna HTTP 403 (Blindagem contra invasão).
- [ ] Webhook de confirmação Pix consegue atualizar reservas com sucesso no banco mesmo com RLS ativo.
- [ ] Todos os testes unitários e de integração passam 100% com `npm test`.
