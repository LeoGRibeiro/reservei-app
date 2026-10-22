# Especificação Técnica: Arquitetura Multi-Tenant, Quadras Dinâmicas e Segurança RLS (Fase 1)

**Data:** 14/10/2026  
**Status:** Aprovado para Implementação  
**Escopo:** Transição da arquitetura mono-estabelecimento (estática) para plataforma Multi-Tenant escalável com isolamento estrito de dados, precificação dinâmica por horários/dias e blindagem de segurança no PostgreSQL.

---

## 1. Contexto e Motivação

O **Reservei** foi originalmente concebido com configurações estáticas de quadras codificadas no repositório (`src/lib/quadras.ts`), operando com 3 quadras idênticas de piso PU e valor fixo de R$ 90,00/hora.

Para converter o sistema em um Micro-SaaS comercializável e pronto para produção, o sistema precisa:
1. Suportar múltiplas arenas esportivas independentes (*tenants*).
2. Permitir que cada arena configure sua própria quantidade de quadras, tipos de piso (Areia/Beach Tennis, Grama Sintética/Society, Saibro, PU) e modalidades esportivas.
3. Suportar **tabela de preços dinâmicos** (ex: horários diurnos vs. horários noturnos com refletores, dias de semana vs. finais de semana).
4. Garantir **isolamento absoluto de dados** entre arenas através de chaves estrangeiras e políticas de segurança em nível de linha (**Row Level Security - RLS**) no banco de dados.
5. Manter retrocompatibilidade total com as reservas, contratos e testes já implementados através de um *Seed Tenant* padrão (`arena-padrao`).

---

## 2. Modelagem do Banco de Dados (PostgreSQL / Supabase)

### 2.1. Novas Tabelas Core

#### A. Tabela `public.arenas`
Entidade central do tenant.
* `id` (`TEXT PRIMARY KEY`): Identificador único da arena (ex: `uuid` ou slug-id).
* `slug` (`TEXT UNIQUE NOT NULL`): Identificador textual para rotas dinâmicas no frontend (ex: `praia-Central`, `arena-belem`).
* `nome` (`TEXT NOT NULL`): Nome comercial do complexo esportivo.
* `cnpj_cpf` (`TEXT`): Documento fiscal do proprietário.
* `telefone` (`TEXT NOT NULL DEFAULT ''`): Telefone fixo ou de contato.
* `whatsapp` (`TEXT NOT NULL DEFAULT ''`): WhatsApp oficial utilizado para notificações e atendimento.
* `email` (`TEXT`): E-mail administrativo.
* `endereco`, `cidade`, `estado`, `cep` (`TEXT`): Localização física da arena.
* `logo_url` (`TEXT`): URL da marca da arena no Supabase Storage.
* `horario_abertura` (`TEXT NOT NULL DEFAULT '06:00'`): Horário de início das atividades.
* `horario_fechamento` (`TEXT NOT NULL DEFAULT '23:00'`): Horário de encerramento das atividades.
* `intervalo_minutos` (`INTEGER NOT NULL DEFAULT 60`): Duração dos blocos de locação (padrão: 60 minutos).
* `percentual_sinal_minimo` (`NUMERIC(5, 2) NOT NULL DEFAULT 50.00`): Percentual exigido no Pix para confirmação da reserva.
* `antecedencia_minima_minutos` (`INTEGER NOT NULL DEFAULT 60`): Tempo mínimo prévio para reserva online.
* `ativo` (`BOOLEAN NOT NULL DEFAULT TRUE`): Status de ativação da assinatura SaaS da arena.
* `criado_em`, `atualizado_em` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).

#### B. Tabela `public.quadras`
Configuração heterogênea de quadras por arena.
* `id` (`TEXT PRIMARY KEY`): Identificador único da quadra (ex: `q1`, `q2` ou UUID).
* `arena_id` (`TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE`): Vínculo com o tenant.
* `numero` (`INTEGER NOT NULL`): Número sequencial para exibição.
* `nome` (`TEXT NOT NULL`): Nome da quadra (ex: *"Quadra 1 (Areia Central)"*).
* `descricao` (`TEXT`): Comodidades ou detalhes específicos.
* `tipo_piso` (`TEXT NOT NULL DEFAULT 'areia'`): `'areia' | 'society' | 'saibro' | 'pu_cimentado' | 'madeira' | 'outro'`.
* `esportes` (`TEXT[] NOT NULL DEFAULT '{}'`): Modalidades aceitas (ex: `['Beach Tennis', 'Futevôlei', 'Vôlei']`).
* `coberta` (`BOOLEAN NOT NULL DEFAULT FALSE`): Indica se a quadra é coberta (protegida de chuva).
* `iluminacao` (`BOOLEAN NOT NULL DEFAULT TRUE`): Indica disponibilidade de iluminação noturna.
* `valor_hora_padrao` (`NUMERIC(10, 2) NOT NULL DEFAULT 90.00`): Tarifa padrão de referência.
* `ordem` (`INTEGER NOT NULL DEFAULT 0`): Ordem de ordenação na grade.
* `ativa` (`BOOLEAN NOT NULL DEFAULT TRUE`): Habilita/desabilita agendamentos.
* `criado_em`, `atualizado_em` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).

#### C. Tabela `public.quadras_precos`
Motor de preços dinâmicos por dia da semana e faixa horária.
* `id` (`TEXT PRIMARY KEY`): UUID do registro de preço.
* `arena_id` (`TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE`).
* `quadra_id` (`TEXT NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE`).
* `dias_semana` (`INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}'`): Dias em que a tarifa se aplica (0=Dom, 1=Seg... 6=Sáb).
* `hora_inicio` (`TEXT NOT NULL`): Ex: `'18:00'`.
* `hora_fim` (`TEXT NOT NULL`): Ex: `'23:00'`.
* `valor_hora` (`NUMERIC(10, 2) NOT NULL`): Valor em reais para aquele período (ex: R$ 130.00).
* `descricao` (`TEXT`): Rótulo da tarifa (ex: *"Horário Nobre com Refletores"*).
* `ativo` (`BOOLEAN NOT NULL DEFAULT TRUE`).
* `criado_em` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).

#### D. Tabela `public.arena_usuarios` (RBAC Inicial)
Vinculação de operadores e proprietários à respectiva arena.
* `id` (`TEXT PRIMARY KEY`).
* `arena_id` (`TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE`).
* `user_id` (`TEXT NOT NULL`): Referência ao usuário autenticado.
* `role` (`TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('proprietario', 'gerente', 'operador'))`).
* `ativo` (`BOOLEAN NOT NULL DEFAULT TRUE`).
* `criado_em` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
* Constraint `UNIQUE(arena_id, user_id)`.

---

### 2.2. Alteração e Isolamento das Tabelas Existentes

Todas as entidades existentes recebem a coluna `arena_id` com migração automática dos registros existentes para o tenant padrão `'arena-padrao'`:

1. `public.reservas`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE RESTRICT;`
   - `CREATE INDEX IF NOT EXISTS idx_reservas_arena_data ON public.reservas (arena_id, data);`
2. `public.contratos_recorrentes`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE;`
   - `CREATE INDEX IF NOT EXISTS idx_contratos_arena ON public.contratos_recorrentes (arena_id, tipo, ativo);`
3. `public.fidelidade_campanha`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE;`
   - `CREATE INDEX IF NOT EXISTS idx_fidelidade_campanha_arena ON public.fidelidade_campanha (arena_id);`
4. `public.fidelidade_selos`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE;`
   - `CREATE INDEX IF NOT EXISTS idx_fidelidade_selos_arena ON public.fidelidade_selos (arena_id, usuario_id);`
5. `public.fidelidade_vouchers`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE;`
   - `CREATE INDEX IF NOT EXISTS idx_fidelidade_vouchers_arena ON public.fidelidade_vouchers (arena_id, usuario_id);`
6. `public.landing_page_gallery`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE;`
7. `public.landing_page_schools`:
   - `ADD COLUMN IF NOT EXISTS arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE;`

---

## 3. Segurança e Políticas RLS (Row Level Security)

Substituição das políticas abertas `USING (true)` por regras seguras e particionadas:

1. **Arenas (`public.arenas`)**:
   - `SELECT`: Público para qualquer visitante consultar arenas ativas (`ativo = true`).
   - `INSERT / UPDATE / DELETE`: Restrito a administradores globais ou proprietários vinculados em `arena_usuarios`.
2. **Quadras e Preços (`public.quadras`, `public.quadras_precos`)**:
   - `SELECT`: Público para consulta das quadras ativas da arena.
   - `INSERT / UPDATE / DELETE`: Restrito a usuários com permissão em `arena_usuarios` para a respectiva `arena_id`.
3. **Reservas (`public.reservas`)**:
   - `SELECT (Público)`: Visitantes anônimos podem consultar disponibilidade da agenda da arena (apenas `id`, `arena_id`, `quadra_id`, `data`, `hora_inicio`, `hora_fim`, `status`, `esporte`), protegendo `cpf_cliente`, `telefone_cliente` e `nome_cliente`.
   - `INSERT`: Criação de nova reserva associada a uma arena válida com status inicial `'em_processamento'` ou `'aguardando_pagamento'`.
   - `SELECT / UPDATE (Admin)`: Acesso completo restrito a operadores associados àquela `arena_id`.
4. **Fidelidade & Vouchers**:
   - Restrito estritamente ao próprio `usuario_id` e à arena emissora do benefício.

---

## 4. Estrutura de Código e Camadas TypeScript

O projeto manterá rigorosa separação de responsabilidades (Clean Architecture):

```text
src/
├── lib/
│   ├── arena/
│   │   ├── types.ts                   # Interfaces: Arena, Quadra, QuadraPreco, ArenaUsuario
│   │   ├── arenaRepository.ts         # Métodos Supabase com tratamento try/catch e fallback
│   │   ├── arenaService.ts            # Regras de negócio, cálculo de preço dinâmico e validação
│   │   └── defaultArena.ts            # Mock/Fallback seguro para ambiente offline e testes
│   ├── supabase/
│   │   ├── schema.sql                 # DDL completo atualizado e versionado
│   │   └── types.ts                   # Database definitions atualizadas
├── hooks/
│   ├── useArena.ts                    # Hook de consumo da arena ativa e suas quadras
│   └── usePrecoCalculado.ts           # Hook para resolver tarifa exata do horário selecionado
└── app/
    ├── [slug]/                        # Rota dinâmica multi-tenant do portal do cliente
    │   ├── page.tsx                   # Landing page adaptada à arena do slug
    │   └── reservar/page.tsx          # Portal de reservas da arena
    └── admin/                         # Painel administrativo com contexto da arena logada
```

---

## 5. Garantia de Retrocompatibilidade e Testes

* O seed da `'arena-padrao'` garante que os **339 testes automatizados existentes** e o ambiente de demonstração atual permaneçam 100% operacionais sem quebras de build.
* Novos testes unitários e de integração serão adicionados em `tests/lib/arenaService.spec.ts` cobrindo:
  - Cálculo de preços dinâmicos (diurno vs. noturno vs. fins de semana).
  - Isolamento de consultas por tenant.
  - Fallback gracioso para a arena padrão caso a tabela ainda não tenha sido criada no Supabase.
