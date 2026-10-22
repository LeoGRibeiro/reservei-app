# 🏛️ Architecture Decision Records (ADRs) — Reservei

> **Status:** Ativo  
> **Propósito:** Registro formal das decisões técnicas de engenharia, justificativas e consequências arquiteturais.

---

## ADR-001: Resolução de Tenants Exclusivamente por Subdomínios Estritos

### Status: Aprovado (20/10/2026)
### Contexto
O Reservei é uma plataforma multi-tenant *white-label*. Inicialmente, cogitou-se suportar tanto rotas por caminho (`reservei.com/arena1`) quanto por subdomínio (`arena1.reservei.com`).

### Decisão
- A plataforma utilizará **exclusivamente subdomínios dinâmicos** no formato `https://[slug].reservei.com` (ex: `https://arenadoze.reservei.com`).
- O acesso a rotas por caminho (`reservei.com/arena1`) será interceptado pelo Next.js Middleware e redirecionado com status HTTP 301 (Permanente) para o subdomínio canônico.
- Em desenvolvimento local, utiliza-se `http://[slug].localhost:3000`.
- Na Vercel, configura-se um Wildcard DNS (`*.reservei.com`).

### Consequências
- **Positivas:** Isolamento estrito de cookies e contexto visual; percepção de valor corporativo de software *white-label*; ativação de novas arenas em tempo real sem redeploy.
- **Atenção:** Requer configuração adequada de wildcard SSL na Vercel e manipulação precisa do cabeçalho `Host` no middleware.

---

## ADR-002: Fluxo Determinístico de Reservas no WhatsApp + IA Opcional de Consulta

### Status: Aprovado (20/10/2026)
### Contexto
A automação de atendimento via WhatsApp é o principal canal de agendamento de quadras no Brasil. O uso irrestrito de LLMs para criação autônoma de reservas é arriscado (alucinações de datas/valores e condições de corrida transacionais).

### Decisão
1. **Reserva Principal (Determinística):** O processo de agendamento será 100% determinístico através de componentes interativos nativos do WhatsApp (Quick Reply Buttons e List Messages), garantindo precisão matemática de horários e emissão de Pix Copia-e-Cola.
2. **WhatsApp AI Concierge (Opcional):** A IA generativa com Tool Calling atuará como um módulo adicional contratável, focada estritamente em responder perguntas gerais da arena (regras, estacionamento, horários vagos, eventos). A IA nunca emite nem finaliza a reserva diretamente; ela redireciona o cliente para o menu interativo determinístico.

### Consequências
- **Positivas:** Risco zero de double booking ou alucinação financeira causada pelo modelo de linguagem; alta confiabilidade operacional; valor agregado modulável por cliente.
- **Atenção:** Requer integração com APIs de mensageria (Evolution API / Z-API) compatíveis com mensagens interativas.

---

## ADR-003: Multi-Tenancy Modular via Feature Flags

### Status: Aprovado (20/10/2026)
### Contexto
Na venda direta porta a porta, diferentes complexos esportivos possuem demandas distintas (alguns querem apenas locação de quadras, outros querem escolinhas parceiras, clube de fidelidade ou inteligência artificial).

### Decisão
- As arenas possuem uma coluna `modulos_ativos TEXT[]` ou estrutura JSONB de flags ativas.
- As interfaces de cliente e administrativo (`/admin`) renderizam condicionalmente apenas as abas e funcionalidades contratadas pela respectiva arena.

### Consequências
- **Positivas:** Permite cobrar pacotes diferenciados de mensalidade (Starter, Pro, Enterprise); reduz sobrecarga cognitiva em clientes que só querem o básico.

---

## ADR-004: Modelo Comercial de Venda Direta com Onboarding Assistido

### Status: Aprovado (20/10/2026)
### Contexto
Avaliou-se a criação de um fluxo de checkout público e self-service (Stripe) na landing page para qualquer arena assinar.

### Decisão
- A prioridade comercial atual é a **venda direta presencial/consultiva ("porta a porta")**, com cobrança de taxa de setup + mensalidade negociada diretamente pelo fundador via Pix/boleto PJ.
- O provisionamento de novas arenas será feito internamente pelo Super Admin (via painel administrativo central ou script seguro), sem necessidade de checkout público automatizado de SaaS no momento.

### Consequências
- **Positivas:** Ciclo de fechamento com ticket mais alto e menor atrito tecnológico inicial; relacionamento próximo com os primeiros clientes para colher feedbacks reais.
- **Atenção:** Tarefa de checkout self-service movida para `BACKLOG.md` para implementação na fase de escala nacional.

---

## ADR-005: Erradicação de Métricas Acadêmicas em Favor de Engenharia Limpa

### Status: Aprovado (20/10/2026)
### Contexto
O projeto se originou de um trabalho de faculdade que continha metas arbitrárias (como atingir 100 mil linhas de código) e facilitadores de teste (como `admin123` e senhas em texto puro).

### Decisão
- Eliminar completamente o objetivo de inflar linhas de código.
- O padrão de código passa a ser regido por princípios corporativos de Clean Architecture, código enxuto, manutenível, seguro e com alta cobertura de testes no Vitest.
- Substituir autenticação mockada por **Supabase Auth** e fechar todas as políticas de Row Level Security (RLS) no PostgreSQL.

---

## ADR-006: Onboarding Seguro via Token de Convite Único e Emissão de Pix no Servidor

### Status: Aprovado (21/10/2026)
### Contexto
O peer review da arquitetura de primeiro acesso apontou duas fragilidades:
1. Setup aberto por ordem de chegada: qualquer visitante que acessasse o subdomínio antes do dono poderia executar o cadastro de administrador.
2. Políticas RLS fechadas em `reservas`: o frontend anônimo falhava ao tentar registrar metadados de cobrança Pix diretamente no banco.

### Decisão
1. **Token de Convite no Onboarding:** A rota `/super-admin` gera um token único e atômico (`token_convite` em `arenas`). O primeiro acesso do dono exige a URL com token (`/admin?token=...`), invalidado imediatamente após o cadastro.
2. **Emissão de Pix no Servidor (`POST /api/pagamentos/pix`):** Toda geração de cobrança Pix e mutação de metadados transacionais em `reservas` é executada exclusivamente via API route com privilégios de `service_role`.
3. **Escopo Automático de Subdomínio:** O hook `useArena` resolve o subdomínio da URL ativa no cliente por padrão, eliminando fallbacks indevidos para a arena demo dentro do painel administrativo.

### Consequências
- **Positivas:** Risco zero de sequestro de arena; conformidade financeira e transacional com RLS ativo; experiência de venda nobre com envio de link de ativação via WhatsApp.


---

## ADR-007: Escrita Pública Somente pelo Servidor, Escopo Estrito por Arena e Fidelidade Emitida no Servidor

### Status: Aprovado e implementado (21/10/2026)
### Contexto
Com o RLS fechado (Fases 3 a 6), a validação no navegador mostrou que o checkout público, a fidelidade e
várias telas falhavam em silêncio: o navegador tentava gravar em `reservas`, `fidelidade_selos` e
`fidelidade_vouchers` sem permissão, e consultas/gravações não usavam `arena_id`. Antes do RLS, as mesmas
escritas permitiam fraude (reserva "confirmada" por R$ 0, vouchers forjados). Detalhes em
`SPEC/2026-10-21-checkout-servidor-escopo-arena.md`.

### Decisão
1. **Toda escrita de visitantes e atletas passa por rotas de API com `service_role`**, que validam e recalculam
   tudo com dados do banco: checkout (`/api/reservas/checkout`), Pix, acompanhamento e desistência (protegidos
   por um `checkout_token` secreto), vínculo de conta, cancelamento, vagas, fidelidade e cadastro de atleta.
   O navegador de operadores continua gravando direto, autorizado pelo RLS.
2. **Escopo estrito por arena no cliente**: `arenaAtiva.ts` resolve o `arena_id` do subdomínio uma vez por aba;
   todos os serviços filtram e gravam com ele. A grade pública é a função `grade_publica(arena_id, ...)`.
3. **Catálogo e marca da arena ativa** (`useCatalogoArenaStore`): quadras, horários, preços, sinal, antecedência,
   nome e contato vêm da arena, nunca de constantes do código.
4. **Módulos contratados valem no portal e no servidor**, não só no menu do admin (complementa o ADR-003).

### Consequências
- **Positivas:** fecha as fraudes de preço/status/voucher; cada arena enxerga só seus dados; white-label real;
  regras de negócio críticas testáveis em casos de uso de servidor (Clean Architecture).
- **Atenção:** a grade pública não recebe eventos Realtime de reservas de terceiros (RLS); o portal a atualiza a
  cada 30 s. Locks expirados são ignorados na disponibilidade, e `liberarLocksExpirados()` pode ser agendado num
  cron para limpar o banco.
