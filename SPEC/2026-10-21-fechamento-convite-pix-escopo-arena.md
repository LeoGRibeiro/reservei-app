# Especificação Técnica: Blindagem de Onboarding com Token de Convite Único, Geração Segura de Pix no Servidor e Escopo Estrito de Arena no Admin (Etapa 3)

**Data:** 21/10/2026  
**Status:** Aprovado para Implementação  
**Responsável pelo Blueprint:** Antigravity (CTO / Arquiteto de Software)  
**Engenheiro de Execução:** Claude (Full Stack Implementation Engineer & Revisor Crítico)  

---

## 1. Contexto e Objetivos

Esta especificação consolida as decisões tomadas após o peer review técnico da Etapa 2, eliminando os últimos bloqueios para a entrada em produção e venda direta a complexos esportivos:

1. **Prevenção de Sequestro de Arena (Token de Convite Único):** No fluxo anterior, qualquer pessoa que descobrisse a URL `[slug].reservei.com/admin` antes do dono poderia executar o setup e assumir o painel. O Super Admin agora gera um link de convite com **token de uso único** (`?token=...`), enviado privadamente via WhatsApp ao proprietário.
2. **Geração Segura de Pix no Servidor (`POST /api/pagamentos/pix`):** As políticas de RLS bloqueiam `UPDATE` anônimo em `reservas`. A criação do Pix e a gravação de `pix_txid`, `pix_copia_cola` e `expira_em` passam a ocorrer no servidor com privilégios de `service_role`.
3. **Escopo Estrito de Subdomínio no Admin:** Eliminar qualquer fallback cego para "arena demo" dentro do painel administrativo. Todas as telas (`AdminQuadrasPage`, `AdminConfiguracoesPage`, etc.) operam estritamente no escopo da arena do subdomínio resolvido.

---

## 2. Modelagem do Banco de Dados & Scripts SQL

O Claude deve sincronizar o arquivo `src/lib/supabase/schema.sql` e fornecer o bloco SQL pronto para execução:

```sql
-- ==============================================================================
-- TOKEN DE CONVITE DE PRIMEIRO ACESSO DO PROPRIETÁRIO (ONBOARDING SEGURO)
-- ==============================================================================

-- 1. Coluna de token de convite na tabela arenas
ALTER TABLE public.arenas 
  ADD COLUMN IF NOT EXISTS token_convite TEXT,
  ADD COLUMN IF NOT EXISTS convite_expira_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS setup_concluido_em TIMESTAMPTZ;

-- 2. Índice para validação eficiente do token
CREATE INDEX IF NOT EXISTS idx_arenas_token_convite 
  ON public.arenas (token_convite) 
  WHERE token_convite IS NOT NULL;

-- 3. Trava anti-concorrência de múltiplos proprietários na mesma arena
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_usuarios_proprietario_unico 
  ON public.arena_usuarios (arena_id) 
  WHERE role = 'proprietario' AND ativo = true;
```

---

## 3. Módulo 1: Onboarding Seguro via Token de Convite

### 3.1. Provisionamento no Super Admin (`/super-admin` e `/api/super-admin/arenas`)
1. Ao submeter o formulário de nova arena no Super Admin, a API gera:
   ```ts
   const tokenConvite = crypto.randomUUID();
   ```
2. A arena é inserida com `token_convite: tokenConvite`.
3. A resposta da API retorna:
   ```json
   {
     "sucesso": true,
     "arenaId": "uuid",
     "slug": "central",
     "tokenConvite": "uuid-token",
     "urlConvite": "https://central.reservei.com.br/admin?token=uuid-token"
   }
   ```
4. A tela `src/app/super-admin/page.tsx` exibe um card de sucesso com o link completo e um botão proeminente **"Copiar Link de Ativação do Dono"** para envio direto no WhatsApp.

### 3.2. Validação e Execução do Setup (`/api/admin/setup`)
- **`GET /api/admin/setup?slug=[slug]&token=[token]`:**
  - Consulta a arena pelo slug.
  - Verifica se já possui operadores ativos (se possuir, `precisaSetup = false`).
  - Se precisar de setup, valida se o `token` informado confere com `token_convite`.
  - Retorna `{ precisaSetup: boolean, tokenValido: boolean }`.
- **`POST /api/admin/setup`:**
  - Recebe `{ arenaSlug, token, nome, email, senha }`.
  - Validações:
    1. Se a arena já tiver operador ativo: retorna `403 Forbidden` (*"Esta arena já possui administrador ativo"*).
    2. Se `token` não bater com `arenas.token_convite`: retorna `403 Forbidden` (*"Token de convite inválido ou expirado"*).
  - Execução:
    1. Cria usuário em `auth.users` via `supabaseAdmin.auth.admin.createUser` com `email_confirm: true`.
    2. Insere vínculo em `arena_usuarios` (`role: 'proprietario'`).
    3. Atualiza `arenas`: define `token_convite = NULL` e `setup_concluido_em = now()` em operação atômica.

### 3.3. Experiência de UI (`AdminSetupWizard.tsx` e `AdminShell.tsx`)
- O componente `AdminSetupWizard` lê o parâmetro `token` da URL via `searchParams.get("token")`.
- **Cenário Sem Token ou Token Inválido:**
  - Exibe tela de segurança amigável:
    - Ícone de cadeado/escudo.
    - Título: *"Acesso Restrito · [Nome da Arena]"*.
    - Mensagem: *"Para realizar a configuração inicial desta arena, utilize o link de convite exclusivo enviado pelo administrador do Reservei."*
- **Cenário Token Válido:**
  - Exibe o formulário de cadastro (Nome, E-mail, Senha, Confirmação) e envia o `token` junto no payload do `POST`.

---

## 4. Módulo 2: Geração de Pix Segura no Servidor (`POST /api/pagamentos/pix`)

### 4.1. Endpoint Dedicado: `src/app/api/pagamentos/pix/route.ts`
- **Entrada (JSON):**
  ```json
  {
    "reservaId": "uuid-da-reserva",
    "tipoPagamento": "sinal" | "integral",
    "expiracaoMinutos": 10
  }
  ```
- **Fluxo do Backend (com Service Role):**
  1. Busca a reserva no Supabase usando `supabaseAdmin` para validar existência e status (`pendente`).
  2. Obtém a arena associada para calcular valores e taxas.
  3. Invoca o gateway de pagamento (`obterPaymentGateway().gerarPix(...)`).
  4. Executa `UPDATE` na tabela `reservas` via `supabaseAdmin` preenchendo:
     - `pix_txid`
     - `pix_copia_cola`
     - `pix_qr_code_url`
     - `expira_em`
     - `gateway_provedor`
     - `gateway_transacao_id`
     - `status`: `'em_processamento'`
  5. Retorna status `200 OK` com o objeto `{ sucesso: true, cobranca: PixCobranca }`.

### 4.2. Ajuste no Cliente (`src/lib/pagamento/pagamentoService.ts`)
- Substituir a chamada direta do browser ao Supabase por chamada HTTP `fetch("/api/pagamentos/pix", { method: "POST", body: ... })`.
- O cliente apenas recebe o resultado com QR Code / Copia e Cola e atualiza a store local do Zustand.

---

## 5. Módulo 3: Escopo Estrito de Arena no Painel Administrativo

### 5.1. Resolução Automática no `useArena`
No arquivo `src/hooks/useArena.ts`:
- Quando `slugOrId` for omitido ou não informado:
  - Tenta resolver o subdomínio da URL atual no cliente via `detectarSubdominio(window.location.hostname)`.
  - Se o subdomínio for válido (diferente de `www`, `app` ou raiz), utiliza-o como slug ativo em vez do fallback estático `ARENA_PADRAO_SLUG`.
  - Caso contrário (ex: localhost puro sem subdomínio), utiliza o fallback de desenvolvimento.
- Isso garante que qualquer tela administrativa (`AdminQuadrasPage`, `AdminConfiguracoesPage`, etc.) que invoque `useArena()` carregue automaticamente as quadras e preços da arena do subdomínio logado.

---

## 6. Diretrizes de Execução & Autonomia para o Claude

1. **Autonomia Completa:** O Claude tem aprovação total para implementar os 3 módulos acima de ponta a ponta sem necessidade de novas validações teóricas preliminares.
2. **Cobertura de Testes (Vitest):**
   - Atualizar testes de `provisionamento.test.ts` e `setup.test.ts` para cobrir o fluxo com `token_convite` (sucesso, token inválido, token ausente).
   - Adicionar teste para a rota `POST /api/pagamentos/pix`.
   - Garantir que toda a suíte de testes permaneça verde (`npm test`).
3. **Instruções ao Usuário:**
   - Entregar o script SQL da Seção 2 pronto para colar no SQL Editor do Supabase.
   - Fornecer instruções simples e diretas de onde clicar no Supabase caso seja necessário.

---

## 7. Decisões do Arquiteto sobre o Peer Review Técnico

Em resposta às questões levantadas pelo Claude na análise crítica:

1. **Desconto de Fidelidade e Vouchers no Pix:**
   - **Solução:** Em vez de criar mais uma rota complexa de checkout, o endpoint `POST /api/pagamentos/pix` passa a aceitar opcionalmente `{ reservaId, tipoPagamento, expiracaoMinutos, voucherCodigo, valorDesconto }`.
   - O servidor valida o voucher (ou o desconto informado), recalcula o valor real com segurança via `supabaseAdmin` e atualiza a reserva no banco com o desconto aplicado antes de gerar a cobrança no gateway.
2. **Expiração do Convite (7 Dias) & UX Aprimorada:**
   - **Solução:** Incluir `convite_expira_em TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')` em `arenas`.
   - Se o token já tiver sido consumido ou expirado, o componente `AdminSetupWizard` deve exibir:
     *"Este link de primeiro acesso já foi utilizado ou expirou. Se você já configurou suas credenciais, acesse o painel pelo login."* acompanhado de botão *"Ir para o Login"*.
3. **Rate Limiting e Upstash Redis:**
   - **Decisão:** Registrado formalmente no `BACKLOG.md` (Item 9). Não adicionar dependência do Upstash agora para evitar atrito desnecessário de credenciais externas. A proteção nativa de WAF/DDoS da Vercel atende ao estágio atual.
4. **Hardening de Módulos Secundários (Contratos/Vagas com USING true) e Realtime:**
   - Registrados formalmente no `BACKLOG.md` (Item 9) para desenvolvimento contínuo nos respectivos ciclos de feature.

