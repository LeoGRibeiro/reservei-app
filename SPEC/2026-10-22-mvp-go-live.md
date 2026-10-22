# Especificação Técnica: MVP Go-Live — Recebimento na Conta da Arena, Equipe com Papéis, Recuperação de Acesso, LGPD e Vitrine Comercial

**Data:** 22/10/2026
**Status:** Implementado em 22/10/2026 (branch `feat/mvp-go-live`, commits M6→M5). Ver §13.
**Escopo:** Tudo o que falta para entregar uma URL funcional a uma arena pagante e fazer uma demonstração comercial
sem depender de explicações ("isso ainda não funciona"). Funcionalidades novas de produto ficam no `BACKLOG.md`.

---

## 1. Diagnóstico (22/10/2026)

Estado verificado: `tsc` limpo, 625 testes passando, `next build` ok, lint com 21 erros antigos (`set-state-in-effect`).
Multi-tenant, RLS, checkout no servidor, Pix Asaas com lock, convite de onboarding, agenda, financeiro, quadras e preços
dinâmicos já existem.

Bloqueadores de go-live encontrados:

| # | Problema | Onde |
|---|----------|------|
| B1 | Uma única `ASAAS_API_KEY` para a plataforma: o Pix de **todas** as arenas cairia na conta do fundador (risco jurídico/fiscal de intermediação e repasse manual). | `lib/pagamento/paymentGateway.ts` |
| B2 | Papéis `proprietario/gerente/operador` são lidos mas nunca aplicados; operador de balcão vê Financeiro e Configurações. Não há tela para o dono cadastrar a equipe. | `AdminShell`, `AdminSidebar` |
| B3 | Não existe recuperação de senha (nem dono, nem atleta). | `AdminLogin`, `/login` |
| B4 | Não há Termos de Uso nem Política de Privacidade; o sistema coleta WhatsApp, CPF e data de nascimento. | — |
| B5 | Não há página comercial do produto para prospecção; `reserveei.vercel.app` abre direto a arena demo. | `app/page.tsx` |
| B6 | Sem domínio próprio: em `*.vercel.app` não existe subdomínio por arena. Além disso, o proxy redireciona `/{slug}` para `{slug}.reservei.com` (domínio padrão que não é nosso) mesmo quando nenhum domínio foi configurado. | `lib/arena/subdomain.ts` |

---

## 2. Decisões alinhadas com o fundador

1. **Pagamento:** cada arena recebe na própria conta. Dois modos por arena:
   - **Asaas da arena** (confirmação automática por webhook);
   - **Pix manual** (chave Pix da arena + confirmação pelo balcão), usado quando a arena não tem Asaas.
2. **Domínio:** o nome do produto ainda pode mudar. Enquanto não houver domínio, a demonstração roda em
   `reserveei.vercel.app` com uma única arena vitrine. O domínio é comprado antes do primeiro contrato (ver §9).
3. **Demonstração:** não há cliente marcado; construir uma **arena vitrine genérica** para prospecção.

---

## 3. Módulo M1 — Recebimento na conta da arena

### 3.1. Modelo de dados

- `arenas.modo_pagamento TEXT NOT NULL DEFAULT 'manual' CHECK (modo_pagamento IN ('asaas','manual','simulado'))`.
  `simulado` só é aceito quando `pagamentoSimuladoHabilitado()` for verdadeiro (arena vitrine).
- `arenas.pix_chave`, `arenas.pix_tipo_chave` (`cpf|cnpj|email|telefone|aleatoria`), `arenas.pix_nome_recebedor`,
  `arenas.pix_cidade_recebedor`: dados **públicos** do Pix manual (aparecem para o atleta de qualquer forma).
- Nova tabela `arena_credenciais_pagamento` (1:1 com arena), **sem nenhuma policy de RLS** (somente `service_role`):
  `arena_id`, `provedor`, `api_key_cifrada`, `sandbox`, `webhook_token`, `conta_nome`, `validada_em`.
  - A chave Asaas é cifrada na aplicação (AES-256-GCM, chave em `PAGAMENTO_CREDENCIAIS_SECRET`). Um vazamento de
    backup ou uma consulta no SQL Editor não expõe chaves utilizáveis.
  - O navegador nunca recebe a chave de volta; a tela mostra só "Conectado à conta **{conta_nome}**".

### 3.2. Conectar Asaas (somente `proprietario`)

`POST /api/admin/pagamentos/asaas` (sessão Supabase + papel `proprietario` validado no servidor):
1. Valida a chave chamando `GET /myAccount` no Asaas (sandbox ou produção conforme o prefixo/flag).
2. Gera `webhook_token` aleatório e registra o webhook **na conta da arena** via `POST /webhooks`, apontando para
   `/api/webhooks/pagamentos/asaas/{arenaId}`. O dono não precisa configurar nada no painel do Asaas.
3. Grava a credencial cifrada e muda `modo_pagamento` para `asaas`.

`DELETE` na mesma rota desconecta (remove o webhook no Asaas, apaga a credencial, volta para `manual`).

### 3.3. Gateway por arena

- `obterPaymentGateway()` passa a receber a arena: `obterGatewayDaArena(arena)` carrega e decifra a credencial no
  servidor. A `ASAAS_API_KEY` global deixa de ser usada para cobranças de arenas.
- Webhook por arena: `/api/webhooks/pagamentos/asaas/[arenaId]` valida `asaas-access-token` contra o
  `webhook_token` **daquela arena** e só confirma reservas com o mesmo `arena_id` (um token de uma arena não
  confirma reservas de outra).
- A rota antiga `/api/webhooks/pagamentos` continua só para o gateway simulado.

### 3.4. Pix manual

Fluxo do atleta:
1. Checkout igual ao atual; em vez do QR do gateway, o `ModalPix` mostra um **Pix copia-e-cola estático com o valor
   exato** (BR Code EMV gerado no servidor, CRC16, `txid` = código curto da reserva) e o QR correspondente.
2. Botão **"Já paguei"** → `POST /api/reservas/{id}/pagamento-informado` (protegido pelo `checkout_token`): grava
   `pagamento_informado_em` e estende o lock (`expira_em`) até `agora + prazo_confirmacao_manual` (padrão 2 h).
3. A reserva continua `em_processamento` — a grade pública já trata isso como ocupado enquanto o lock vale; não há
   status novo.

Fluxo do balcão:
- Badge "Pagamentos a confirmar (n)" no Dashboard e na Agenda; lista com nome, valor, horário e há quanto tempo.
- **Confirmar recebimento** → mesmo caso de uso do webhook (`processarConfirmacaoPagamento`), registrando quem
  confirmou. **Recusar** → cancela e libera o horário, com motivo.

### 3.5. Edge cases

| Caso | Tratamento |
|------|-----------|
| Atleta paga o Pix manual mas não clica "Já paguei" | Lock vence no prazo normal (10 min). O balcão consegue achar a reserva cancelada pelo nome e reativá-la se o horário ainda estiver livre ("Reativar e confirmar"). Se já foi ocupado, a tela orienta o estorno manual. |
| Atleta clica "Já paguei" sem pagar para segurar o horário | O lock máximo é de 2 h; o balcão recusa. Reincidência → bloqueio de usuário (já existe). |
| Balcão não confirma dentro do prazo estendido | A reserva **não** é liberada automaticamente se `pagamento_informado_em` estiver preenchido; ela fica no topo da fila com destaque "vencida". Liberar o horário de quem diz ter pago é pior que segurá-lo. |
| Arena troca de `asaas` para `manual` com Pix em aberto | Cobranças já emitidas continuam válidas (o webhook da arena permanece até a desconexão terminar). A desconexão é bloqueada enquanto houver reserva `em_processamento` com cobrança Asaas vigente. |
| Chave Asaas revogada pelo dono no Asaas | A emissão falha com 502 → o checkout mostra "pagamento online indisponível, fale com a arena" e o admin recebe aviso na tela de Pagamentos. Sem fallback silencioso para outro modo. |
| Arena sem nenhum dado de Pix configurado | O checkout online fica desabilitado no portal com aviso; o setup só é dado como concluído quando houver um modo de pagamento válido. |
| Webhook duplicado / fora de ordem | `processarConfirmacaoPagamento` já é idempotente; os testes passam a cobrir também o escopo por arena. |

---

## 4. Módulo M2 — Equipe e papéis (RBAC aplicado)

### 4.1. Matriz de acesso

| Área | operador | gerente | proprietario |
|------|:-:|:-:|:-:|
| Agenda, reservas manuais, bloqueios, confirmar pagamento manual | ✅ | ✅ | ✅ |
| Dashboard (sem valores financeiros para operador) | ✅* | ✅ | ✅ |
| Usuários/atletas (consultar, bloquear) | ✅ | ✅ | ✅ |
| Grupos/contratos, escolinhas | ✅ | ✅ | ✅ |
| Quadras e preços, institucional, fidelidade | — | ✅ | ✅ |
| Financeiro | — | ✅ | ✅ |
| Configurações da arena, Pagamentos (Asaas/Pix), Equipe | — | — | ✅ |

### 4.2. Implementação

- `lib/admin/permissoes.ts`: matriz única (`podeAcessar(role, view)` e `podeExecutar(role, acao)`), usada pela
  sidebar, pelo `AdminShell` e pelas rotas de API — uma só fonte de verdade, coberta por testes.
- **Defesa no banco:** `UPDATE` em `arenas` e escrita em `quadras`/`quadras_precos` exigem papel
  `proprietario`/`gerente` via função `papel_na_arena(arena_id)` nas policies de RLS. Ler valores de reservas
  continua permitido ao operador (ele precisa ver o preço no balcão); esconder o Financeiro é uma regra de interface.
- **Tela Equipe** (proprietário): listar membros, convidar (nome, e-mail, papel), mudar papel, desativar.
  `POST /api/admin/equipe` cria o usuário no Supabase Auth com senha temporária (mesmo padrão do provisionamento) e
  devolve um link `wa.me` com a mensagem pronta para enviar o acesso. No primeiro login, a troca de senha é obrigatória.
- Regras: não é possível rebaixar nem desativar o **último** proprietário ativo; ninguém altera o próprio papel; um
  e-mail que já é membro de outra arena recebe só o vínculo novo (a senha não é alterada).

---

## 5. Módulo M3 — Recuperação de acesso

- **Dono e equipe (e-mail real):** "Esqueci minha senha" no `AdminLogin` → `resetPasswordForEmail` com retorno para
  `/admin/redefinir-senha` no subdomínio da arena. **Pré-requisito de infraestrutura:** SMTP próprio no Supabase
  (o SMTP padrão só envia para membros do time do projeto). Recomendado: Resend (plano gratuito). Ver §9.
- **Fallback sem e-mail:** o proprietário redefine a senha de membros da equipe na tela Equipe; o Super Admin
  redefine a senha do proprietário em `/super-admin`.
- **Atleta (login por WhatsApp, sem e-mail):** "Esqueci minha senha" abre o WhatsApp da arena com mensagem pronta.
  Gerente ou proprietário usa "Redefinir senha" no cadastro do atleta → senha temporária + link `wa.me`. A ação é
  registrada em auditoria (quem, quando, qual atleta). Só é permitida para atletas com reserva na própria arena.
  - Risco aceito: a conta do atleta é da plataforma (vale em todas as arenas); um operador mal-intencionado poderia
    assumi-la. O impacto é baixo (histórico e selos) e a ação fica auditada. A solução definitiva (OTP por WhatsApp)
    já está no backlog.

---

## 6. Módulo M4 — Termos de Uso e Privacidade (LGPD)

- Páginas `/termos` e `/privacidade`, no nível da plataforma, com o nome e o contato da arena preenchidos quando
  acessadas por um subdomínio. Papéis LGPD: **a arena é controladora** dos dados dos atletas; **o Reservei é operador**.
- Aceite obrigatório (checkbox) no cadastro do atleta e no checkout de quem não tem conta: grava `termos_aceitos_em` e
  `termos_versao` em `usuarios` (ou na reserva, para checkout sem conta).
- A política de cancelamento da arena (`arenas.politica_cancelamento`, texto livre editável em Configurações) é exibida
  no checkout antes do pagamento.
- Os textos são modelos e **devem ser revisados por um advogado** antes do primeiro contrato.

---

## 7. Módulo M5 — Vitrine comercial e arena demo

- **Página comercial** em `/para-arenas` (funciona em qualquer host, inclusive `vercel.app`): problema → solução →
  módulos → como funciona a implantação → contato por WhatsApp do fundador. Sem preço público (venda consultiva).
  Quando houver domínio, a raiz do domínio (`dominio.com.br`) passa a renderizar essa página.
- **Arena vitrine** (`arena-demo`): script SQL de seed idempotente com 4 quadras de modalidades diferentes, preços por
  faixa (horário nobre), reservas nas próximas 2 semanas (ocupação realista ~60%), um contrato mensalista, campanha de
  fidelidade, galeria e escolinha. `modo_pagamento = 'simulado'` (botão "Simular pagamento").
- **Login de demonstração** para o admin da arena vitrine, com papel `gerente` (mostra tudo menos credenciais).
- `docs/ROTEIRO_DEMO.md`: roteiro de 10 minutos (atleta reserva pelo celular → aparece na agenda → balcão confirma →
  financeiro atualiza).

---

## 8. Módulo M6 — Domínio e marca

- O redirecionamento `/{slug}` → subdomínio só acontece quando `NEXT_PUBLIC_ROOT_DOMAIN` está definido e o host é
  esse domínio. Sem domínio configurado, `/{slug}` não redireciona para um domínio que não é nosso (corrige B6).
- Nome do produto centralizado em `lib/marca.ts` (`NOME_PRODUTO`, contato comercial), substituindo os ~40 textos
  fixos "Reservei" nas telas. Trocar o nome passa a ser: alterar a constante e o domínio.
- **Exceção que nunca muda:** `DOMINIO_EMAIL_SINTETICO = "auth.reservei.com.br"` é a identidade de login dos atletas
  no Supabase Auth. Mudá-la desloga e "perde" todas as contas. Vira uma constante interna documentada como imutável.

---

## 9. Ações manuais do fundador (infraestrutura)

| Quando | Ação | Custo aproximado |
|--------|------|------------------|
| Antes do 1º contrato | Decidir o nome e comprar o domínio (`.com.br` no registro.br) | ~R$ 40/ano |
| Antes do 1º contrato | Vercel → Domains: adicionar `dominio.com.br` e `*.dominio.com.br`; no registro.br, apontar os nameservers para a Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), obrigatório para o wildcard. Definir `NEXT_PUBLIC_ROOT_DOMAIN`. | — |
| Antes do 1º contrato | Supabase **Pro**: o plano gratuito pausa o projeto após 7 dias sem uso e não tem backup diário | ~US$ 25/mês |
| Antes do 1º contrato | SMTP próprio no Supabase (Resend) com o domínio verificado | gratuito até 3 mil e-mails/mês |
| Agora | Variáveis `PAGAMENTO_CREDENCIAIS_SECRET` (32 bytes aleatórios) e `PAGAMENTO_SIMULADO_HABILITADO=true` na Vercel | — |
| Agora | Executar a migração SQL da §10 no SQL Editor do Supabase | — |

---

## 10. Migração SQL (Fase 8)

Entregue junto da implementação, sincronizada em `src/lib/supabase/schema.sql`: colunas de pagamento e política de
cancelamento em `arenas`; tabela `arena_credenciais_pagamento` (RLS ativo, sem policies); `pagamento_informado_em`,
`pagamento_confirmado_por` em `reservas`; `termos_aceitos_em`/`termos_versao` em `usuarios` e `reservas`; tabela
`auditoria_admin`; função `papel_na_arena(arena_id)`; policies de escrita por papel; seed da arena vitrine (arquivo
separado `src/lib/supabase/seed-arena-demo.sql`).

---

## 11. Fora de escopo (permanece no BACKLOG.md)

WhatsApp/Evolution API e IA, OTP por WhatsApp, estorno automático, checkout self-service B2B, migração para VPS,
comanda de bar, rate limiting com Redis.

---

## 12. Ordem de execução e critérios de aceite

1. **M6** (proxy e marca): `/{slug}` em `vercel.app` não redireciona para domínio alheio; nenhum "Reservei" fixo nas telas.
2. **M2** (papéis e equipe): operador não vê nem acessa Financeiro/Configurações/Quadras (UI + API + RLS); convite gera acesso funcional.
3. **M1** (pagamentos): Pix de uma arena Asaas cai na conta dela; webhook de outra arena não confirma a reserva; fluxo manual completo com fila no balcão.
4. **M3** (recuperação): dono redefine por e-mail (com SMTP) ou pelo Super Admin; atleta é redefinido pela arena com auditoria.
5. **M4** (LGPD): aceite registrado com versão; política de cancelamento visível no checkout.
6. **M5** (vitrine): seed aplicável duas vezes sem erro; roteiro de demo executável de ponta a ponta em `reserveei.vercel.app`.

Cada módulo: testes de regra de negócio (sucesso, erro, permissão), `tsc` limpo, suíte verde e build ok antes do próximo.
Os 21 erros de lint antigos ficam fora desta spec (backlog).

---

## 13. Registro de implementação (22/10/2026)

Decisões tomadas durante a implementação, diferentes do texto acima:

- **Pix manual (§3.4):** em vez de estender o lock por 2 h, o "Já fiz o Pix" segura o horário **até o fim da partida**
  (mínimo de 30 min). A grade pública, `grade_publica` e o `LockService` não precisaram mudar, e quem informou o
  pagamento nunca perde o horário por demora do balcão. A fila destaca avisos com mais de 30 min.
- **Domínio (§8):** sem domínio próprio, o host serve uma arena inteira (portal e admin) definida por
  `NEXT_PUBLIC_ARENA_RAIZ_SLUG`. Com `NEXT_PUBLIC_ROOT_DOMAIN`, a raiz mostra a página comercial.
- **RBAC no banco (§4.2):** as policies de `arenas`, `quadras` e `quadras_precos` já restringiam escrita por papel
  (Fase 3); nenhuma policy nova foi necessária.
- **Convite de e-mail existente (§4.2):** retorna 409 com orientação; o vínculo de conta existente foi para o backlog.
- **Achados fora do plano e corrigidos:**
  - `token_convite` era legível por visitantes anônimos (linha pública de `arenas`). Agora só o hash SHA-256 fica no banco.
  - Mensagens de WhatsApp diziam "Complexo Esportivo Reservei" e "Quadra q1" em vez do nome da arena e da quadra.
  - O catálogo de esportes não tinha Beach Tennis, Futevôlei, Vôlei de Praia, Futebol Society, Tênis e Padel.
  - `schema.sql` não rodava num banco novo (tabela `profiles` legada, `END IF` faltando, comparação `uuid = text`).
  - Next.js 16.3.7 tinha vulnerabilidade crítica (atualizado para 16.4.2); `shadcn` saiu das dependências de produção.
- **Validação do SQL:** `schema.sql`, a migração e o seed foram executados duas vezes num PostgreSQL em WASM (PGlite)
  partindo de um banco vazio.

