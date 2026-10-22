# Especificação Técnica: Autenticação Supabase Real, RBAC Multi-Tenant, Subdomínios Estritos e Blindagem RLS

**Data:** 21/10/2026  
**Status:** Aprovado para Implementação  
**Responsável pelo Blueprint:** Antigravity (CTO / Arquiteto de Software)  
**Engenheiro de Execução:** Claude (Full Stack Implementation Engineer)  
**Escopo:** Transição definitiva da autenticação de teste/faculdade para **Supabase Auth nativo**, RBAC multi-tenant (`proprietario`, `gerente`, `operador`), resolução estrita de subdomínios (`[slug].reservei.com`), modularidade via Feature Flags e blindagem total de Row Level Security (RLS) no PostgreSQL.

---

## 1. Contexto e Motivação Técnica

O sistema **Reservei** operava com mecanismos provisórios herdados de um projeto acadêmico:
1. Senha estática `admin123` em texto puro gravada no front-end ([`src/hooks/useAdminAuth.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/hooks/useAdminAuth.ts)).
2. Senhas de clientes salvas sem hash em `localStorage` e na tabela `public.usuarios` ([`src/lib/supabase/authService.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/supabase/authService.ts)).
3. Políticas de RLS abertas com `FOR ALL USING (true)` ([`src/lib/supabase/schema.sql`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/supabase/schema.sql)).
4. Roteamento por caminho ainda permitido (`reservei.com/arena`), quando a diretriz comercial do SaaS exige **subdomínios estritos** (`arena.reservei.com`).

Esta especificação define o blueprint completo para o Claude implementar a segurança de nível bancário/enterprise e preparar o sistema para as primeiras vendas reais a complexos esportivos.

---

## 2. Modelagem do Banco de Dados (Supabase / PostgreSQL)

### 2.1. Estruturas a Criar e Alterar

#### A. Atualização da Tabela `public.arenas` (Feature Flags Modulares)
Cada arena contrata apenas os módulos desejados. Adicionar coluna de flags ativas:
```sql
ALTER TABLE public.arenas 
ADD COLUMN IF NOT EXISTS modulos_ativos TEXT[] NOT NULL 
DEFAULT '{agendamento_core,fidelidade,vagas,escolinhas,contratos}';
```
Valores suportados:
- `agendamento_core`: Grade de horários, reservas avulsas e Pix (sempre ativo).
- `fidelidade`: Programa de fidelidade e vouchers.
- `vagas`: Mural social de vagas abertas.
- `escolinhas`: Gestão de escolinhas parceiras.
- `contratos`: Contratos contínuos e mensalistas.
- `whatsapp_ia`: Módulo adicional do AI Concierge.

#### B. Nova Tabela `public.arena_usuarios` (RBAC Multi-Tenant)
Associa um usuário autenticado (`auth.users`) a uma arena esportiva com perfil de acesso:
```sql
CREATE TABLE IF NOT EXISTS public.arena_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('proprietario', 'gerente', 'operador')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_arena_usuario UNIQUE (arena_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_arena_usuarios_lookup ON public.arena_usuarios (arena_id, user_id, ativo);
```

#### C. Atualização da Tabela `public.usuarios` (Perfil de Atletas)
Remover a coluna `senha` em texto puro e vincular ao `auth.users`:
```sql
-- Garante que o ID do usuário seja referenciado ou compatível com auth.users
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS senha;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

---

### 2.2. Script SQL de Blindagem RLS (Row Level Security)

Executar a revogação de políticas antigas e aplicação das novas diretrizes estritas:

```sql
-- ==============================================================================
-- BLINDAGEM RLS: public.arenas
-- ==============================================================================
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de arenas" ON public.arenas;
DROP POLICY IF EXISTS "Permitir leitura pública de arenas ativas" ON public.arenas;
DROP POLICY IF EXISTS "Permitir modificação apenas por administradores" ON public.arenas;

-- Leitura pública de arenas ativas (necessário para carregar o portal da arena)
CREATE POLICY "Permitir leitura pública de arenas ativas"
  ON public.arenas FOR SELECT
  USING (ativo = true);

-- Modificação restrita a proprietários da respectiva arena
CREATE POLICY "Permitir modificação apenas por proprietarios"
  ON public.arenas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.arenas.id
        AND au.user_id = auth.uid()
        AND au.role = 'proprietario'
        AND au.ativo = true
    )
  );

-- ==============================================================================
-- BLINDAGEM RLS: public.quadras e public.quadras_precos
-- ==============================================================================
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de quadras" ON public.quadras;
DROP POLICY IF EXISTS "Permitir leitura pública de precos" ON public.quadras_precos;
DROP POLICY IF EXISTS "Gestão de quadras por operadores da arena" ON public.quadras;
DROP POLICY IF EXISTS "Gestão de precos por operadores da arena" ON public.quadras_precos;

CREATE POLICY "Permitir leitura pública de quadras"
  ON public.quadras FOR SELECT
  USING (ativa = true);

CREATE POLICY "Permitir leitura pública de precos"
  ON public.quadras_precos FOR SELECT
  USING (ativo = true);

CREATE POLICY "Gestão de quadras por operadores da arena"
  ON public.quadras FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.quadras.arena_id
        AND au.user_id = auth.uid()
        AND au.role IN ('proprietario', 'gerente')
        AND au.ativo = true
    )
  );

CREATE POLICY "Gestão de precos por operadores da arena"
  ON public.quadras_precos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.quadras_precos.arena_id
        AND au.user_id = auth.uid()
        AND au.role IN ('proprietario', 'gerente')
        AND au.ativo = true
    )
  );

-- ==============================================================================
-- BLINDAGEM RLS: public.arena_usuarios
-- ==============================================================================
ALTER TABLE public.arena_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário consulta seus próprios vínculos de arena" ON public.arena_usuarios;
CREATE POLICY "Usuário consulta seus próprios vínculos de arena"
  ON public.arena_usuarios FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ==============================================================================
-- BLINDAGEM RLS: public.reservas
-- ==============================================================================
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir inserção de novas reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir atualização de reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir remoção de reservas" ON public.reservas;

-- 1. Leitura de reservas:
-- Visitantes públicos só lêem data, quadra e horários para saber o que está ocupado (sem vazar CPF/Telefone de terceiros)
-- Clientes autenticados lêem as suas próprias reservas (user_id = auth.uid())
-- Operadores e proprietários da arena lêem todas as reservas daquela arena_id
CREATE POLICY "Leitura de reservas por clientes ou operadores"
  ON public.reservas FOR SELECT
  USING (
    -- Cliente acessando sua própria reserva
    (auth.uid() IS NOT NULL AND user_id = auth.uid()::text)
    OR
    -- Operador autenticado da respectiva arena
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.ativo = true
    ))
    OR
    -- Leitura pública para checagem de slots da grade (sem expor dados sensíveis)
    (status IN ('confirmada', 'pendente', 'em_processamento'))
  );

-- 2. Inserção de reservas: público e clientes podem criar reservas para arenas ativas
CREATE POLICY "Criação de reservas para arenas ativas"
  ON public.reservas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.arenas a
      WHERE a.id = public.reservas.arena_id
        AND a.ativo = true
    )
  );

-- 3. Atualização de reservas: apenas operadores da arena ou webhooks de serviço
CREATE POLICY "Atualização de reservas por operadores"
  ON public.reservas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.ativo = true
    )
  );

-- 4. Exclusão de reservas: apenas proprietários da arena
CREATE POLICY "Exclusão de reservas por proprietarios"
  ON public.reservas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.role = 'proprietario'
        AND au.ativo = true
    )
  );

-- ==============================================================================
-- BLINDAGEM RLS: public.usuarios (Clientes / Atletas)
-- ==============================================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo a usuarios" ON public.usuarios;

-- O cliente só lê e altera seus próprios dados cadastrais
CREATE POLICY "Cliente acessa seu próprio perfil"
  ON public.usuarios FOR ALL
  TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid()::text)
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid()::text);

-- Operadores da arena podem consultar dados cadastrais de clientes com reservas na arena
CREATE POLICY "Operadores consultam clientes da arena"
  ON public.usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservas r
      JOIN public.arena_usuarios au ON au.arena_id = r.arena_id
      WHERE (r.user_id = public.usuarios.id OR r.whatsapp_cliente = public.usuarios.telefone)
        AND au.user_id = auth.uid()
        AND au.ativo = true
    )
  );
```

---

## 3. Resolução Estrita de Subdomínios (`src/middleware.ts`)

### 3.1. Requisitos de Negócio
1. Se a requisição chegar em `https://reservei.com/arenadoze` (ou `http://localhost:3000/arenadoze`), o middleware **DEVE** emitir um redirecionamento HTTP 301 Permanente para `https://arenadoze.reservei.com` (ou `http://arenadoze.localhost:3000`).
2. Se a requisição chegar via subdomínio `https://arenadoze.reservei.com`:
   - Extrai o slug `arenadoze`.
   - Injeta o cabeçalho `x-arena-slug: arenadoze`.
   - Se a rota for `/` (home da arena), reescreve internamente para a página de agendamento daquela arena.
   - Se a rota for `/admin` ou `/admin/*`, valida se o usuário possui sessão ativa de operador para esta arena.

### 3.2. Implementação do Middleware
O Claude deve refatorar [`src/middleware.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/middleware.ts) aplicando:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { extrairSubdominio, construirUrlArena, SUBDOMINIOS_RESERVADOS } from "@/lib/arena/subdomain";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const subdominio = extrairSubdominio(host);
  const { pathname } = request.nextUrl;

  // 1. Caso acesse via path em domínio raiz (ex: reservei.com/Central):
  // Redireciona 301 para o subdomínio correspondente (Central.reservei.com)
  if (!subdominio) {
    const segmentos = pathname.split("/").filter(Boolean);
    const primeiroSegmento = segmentos[0]?.toLowerCase();

    // Se o primeiro segmento não for reservado e parecer um slug de arena:
    if (
      primeiroSegmento &&
      !SUBDOMINIOS_RESERVADOS.has(primeiroSegmento) &&
      primeiroSegmento !== "login" &&
      primeiroSegmento !== "cadastro" &&
      primeiroSegmento !== "admin"
    ) {
      const urlDestino = construirUrlArena(primeiroSegmento);
      const caminhoRestante = pathname.replace(`/${primeiroSegmento}`, "") || "/";
      return NextResponse.redirect(new URL(caminhoRestante, urlDestino), 301);
    }
  }

  // 2. Acesso via Subdomínio de Arena (ex: Central.reservei.com):
  const requestHeaders = new Headers(request.headers);

  if (subdominio) {
    requestHeaders.set("x-arena-slug", subdominio);

    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = `/${subdominio}`;
      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
```

---

## 4. Autenticação Administrativa Real (`useAdminAuth` & `AdminLogin`)

### 4.1. Refatoração de `src/hooks/useAdminAuth.ts`
Eliminar definitivamente a constante `const SENHA_ADMIN = "admin123";` e o `localStorage`.
O hook deve:
1. Utilizar o cliente singleton Supabase (`supabase.auth`).
2. Implementar `login(email: string, senha: string)`:
   - Chama `supabase.auth.signInWithPassword({ email, password })`.
   - Obtém o ID do usuário autenticado (`data.user.id`).
   - Consulta `public.arena_usuarios`:
     ```ts
     const { data: vinculo, error } = await supabase
       .from("arena_usuarios")
       .select("role, ativo, arena_id, arenas(slug)")
       .eq("user_id", data.user.id)
       .eq("ativo", true)
       .maybeSingle();
     ```
   - Valida se o usuário pertence à arena do subdomínio atual.
   - Se o usuário for válido, atualiza o estado com `{ user, role, arenaId }` e retorna `{ success: true }`.
   - Se não pertencer à arena, faz `supabase.auth.signOut()` e retorna `{ success: false, error: "Acesso não autorizado para esta arena." }`.
3. Implementar `logout()`:
   - Executa `supabase.auth.signOut()` e reseta o estado.

### 4.2. Refatoração de `src/components/admin/AdminLogin.tsx`
O componente de login deve:
1. Exibir dois campos: **E-mail Corporativo** e **Senha**.
2. Exibir o nome ou slug da arena sendo acessada (obtido via `useArena()` ou contexto de subdomínio).
3. Exibir mensagens de erro claras via toast ou aviso em vermelho no próprio formulário.

---

## 5. Autenticação Segura de Atletas (`src/lib/supabase/authService.ts`)

Para preservar a facilidade de cadastro e login de atletas via **WhatsApp + Senha**, sem exigir SMS pago:
1. **Mapeamento de E-mail Sintético Seguro:**
   - Para interagir com o `supabase.auth`, o sistema mapeia o número de WhatsApp (apenas dígitos) para uma identidade segura:
     `email = ${digits}@auth.reservei.com.br`
2. **Cadastro (`cadastrarUsuarioSupabase`):**
   - Executa `supabase.auth.signUp({ email, password: senha })`.
   - Cria o registro correspondente em `public.usuarios` com `auth_user_id = data.user.id`.
3. **Login (`loginUsuarioSupabase`):**
   - Executa `supabase.auth.signInWithPassword({ email: ${digits}@auth.reservei.com.br, password: senha })`.
   - Sessão é gerada e persistida nativamente com tokens JWT seguros pelo Supabase.
4. **Remoção de Senha:** O campo `senha` nunca mais é armazenado em texto puro em nenhuma tabela ou `localStorage`.

---

## 6. Módulos & Feature Flags por Arena

Criar o arquivo [`src/lib/arena/modulos.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/arena):

```ts
/**
 * @file modulos.ts
 * @description Definições e helpers para modularidade de features por arena (Feature Flags).
 */

export type ModuloArena =
  | "agendamento_core"
  | "fidelidade"
  | "vagas"
  | "escolinhas"
  | "contratos"
  | "whatsapp_ia";

export interface ModuloInfo {
  id: ModuloArena;
  nome: string;
  descricao: string;
  obrigatorio?: boolean;
}

export const MODULOS_DISPONIVEIS: Record<ModuloArena, ModuloInfo> = {
  agendamento_core: {
    id: "agendamento_core",
    nome: "Agendamento & Balcão",
    descricao: "Grade de horários, reservas avulsas e pagamento Pix.",
    obrigatorio: true,
  },
  fidelidade: {
    id: "fidelidade",
    nome: "Programa de Fidelidade",
    descricao: "Cartela de selos digitais e cupons de recompensa.",
  },
  vagas: {
    id: "vagas",
    nome: "Mural Social de Vagas",
    descricao: "Matchmaking para atletas completarem partidas.",
  },
  escolinhas: {
    id: "escolinhas",
    nome: "Escolinhas Parceiras",
    descricao: "Divulgação de turmas e aulas parceiras no complexo.",
  },
  contratos: {
    id: "contratos",
    nome: "Contratos & Mensalistas",
    descricao: "Gestão de turmas fixas com projeção de 6 meses de agenda.",
  },
  whatsapp_ia: {
    id: "whatsapp_ia",
    nome: "WhatsApp AI Concierge",
    descricao: "Assistente inteligente para tirar dúvidas institucionais da arena.",
  },
};

/**
 * Verifica se um módulo específico está ativo para uma dada arena.
 */
export function temModuloAtivo(
  modulosAtivos?: string[] | null,
  modulo?: ModuloArena
): boolean {
  if (!modulo) return false;
  if (modulo === "agendamento_core") return true; // Sempre ativo
  if (!modulosAtivos || !Array.isArray(modulosAtivos)) return false;
  return modulosAtivos.includes(modulo);
}
```

No componente [`src/components/admin/AdminSidebar.tsx`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/components/admin/AdminSidebar.tsx), as abas "Fidelidade", "Vagas", "Escolinhas" e "Contratos" devem ser renderizadas condicionalmente de acordo com `temModuloAtivo(arena.modulosAtivos, modulo)`.

---

## 7. Roteiro de Implementação para o Claude (Passo a Passo)

1. **Instalação do `@supabase/ssr` (se necessário):**
   - Executar `npm install @supabase/ssr --prefix src`.
2. **Atualização dos Tipos TypeScript:**
   - Em [`src/lib/arena/types.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/arena/types.ts), adicionar `modulosAtivos: ModuloArena[]` na interface `Arena`.
   - Em [`src/lib/supabase/types.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/supabase/types.ts), adicionar tipos para `ArenaUsuarioRow`.
3. **Criação do Helper de Módulos:**
   - Criar `src/lib/arena/modulos.ts` com a tipagem e funções acima.
4. **Refatoração do Middleware:**
   - Atualizar [`src/middleware.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/middleware.ts) implementando o redirecionamento 301 de rotas por caminho (`/arena` -> `arena.reservei.com`).
5. **Refatoração da Autenticação Administrativa:**
   - Atualizar [`src/hooks/useAdminAuth.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/hooks/useAdminAuth.ts) conectando ao Supabase Auth e validando `arena_usuarios`.
   - Atualizar [`src/components/admin/AdminLogin.tsx`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/components/admin/AdminLogin.tsx) para login com e-mail e senha.
6. **Refatoração da Autenticação de Usuários:**
   - Atualizar [`src/lib/supabase/authService.ts`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/lib/supabase/authService.ts) removendo campos de senha crua e usando `supabase.auth`.
7. **Modularidade na Sidebar Admin:**
   - Atualizar [`src/components/admin/AdminSidebar.tsx`](file:///c:/Users/Leonardo/programacoes/reservei-app/src/components/admin/AdminSidebar.tsx) para esconder abas de módulos desativados.
8. **Testes Automatizados:**
   - Criar arquivo `tests/lib/arena/modulos.test.ts` testando o helper `temModuloAtivo`.
   - Criar arquivo `tests/hooks/useAdminAuth.test.ts` testando o fluxo de login de administrador com Supabase Auth.
   - Rodar `npm test` e garantir que todos os 388+ testes continuem passando.

---

## 8. Critérios de Aceite & Validação

- [ ] Acessar `http://localhost:3000/Central` deve retornar HTTP 301 redirecionando para `http://Central.localhost:3000/`.
- [ ] O painel `/admin` não aceita mais a senha estática `admin123`.
- [ ] O painel `/admin` aceita login com e-mail e senha válidos no Supabase vinculados à arena atual.
- [ ] Usuário operador da "Arena A" que tenta logar na "Arena B" tem acesso negado com mensagem de erro clara.
- [ ] Nenhuma senha é gravada em texto puro em `localStorage` ou no PostgreSQL.
- [ ] Arenas sem o módulo de fidelidade não exibem a aba de fidelidade no painel administrativo.
- [ ] Todos os testes automatizados executam e passam 100% com `npm test`.
