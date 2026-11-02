# SPEC — Revisão completa do painel administrativo

- **Data:** 02/11/2026
- **Status:** em execução. Plano A concluído em 02/11/2026
- **Origem:** revisão das 12 telas no navegador (desktop e celular) e do código em `src/components/admin`, `src/hooks`, `src/lib/supabase` e `schema.sql`
- **Objetivo:** o painel tem que funcionar sem surpresas para o dono e o balcão, mostrar números corretos e ter aparência sóbria e igual para todas as arenas (só o nome da arena muda)

---

## 1. Diagnóstico (o que a revisão encontrou)

### 1.1 Bugs visíveis

| # | Tela | Problema | Causa no código |
|---|---|---|---|
| B1 | Detalhe da reserva (`/admin/reserva/[id]`) | Quadra aparece como "Quadra" | Página fora do `AdminShell`; `descreverQuadra` lê o catálogo, que não foi carregado (`useCatalogoArenaStore.ts:99`) |
| B2 | Detalhe da reserva e Financeiro | "Sinal pago (40%)", "Pendente no local (60%)", "Balcão (60%)" fixos | Texto fixo em `AdminReservaDetalhes.tsx:638/652`, `ModalDetalhesReserva.tsx:593/607`, `AdminFinanceiroPage.tsx:232`; a arena usa `percentual_sinal_minimo` (50%) |
| B3 | Detalhe da reserva | "Confirmação enviada pelo portal" sem ter enviado nada | Texto fixo; não existe envio automático de WhatsApp |
| B4 | Detalhe da reserva | Duas telas quase iguais (765 e 735 linhas) que já divergem | `AdminReservaDetalhes.tsx` e `ModalDetalhesReserva.tsx` |
| B5 | Agenda, grade do dia | "Todas as Quadras (3)" fixo; botões "Quadra 1…4" em vez do nome | `VisaoDiaGrade.tsx:127` e `:139` |
| B6 | Agenda, timeline | Nomes cortados ("Diego ..."); linhas "Q1 / Quadra 1" | Coluna de 1h estreita e rótulo pelo número |
| B7 | Todas as telas | F5 volta para o Dashboard; Voltar sai do painel; sem link por tela | A tela atual é `useState` no `AdminShell`, não rota |
| B8 | Quadras | "R$ 80.00/h" (ponto) | `toFixed(2)` em `AdminQuadrasPage.tsx:339/404` |
| B9 | Configurações | Link "localhost:3000" e sufixo ".reservei.com" | `construirUrlArena` com porta e domínio errados |
| B10 | Fidelidade | Mostra `#rsv_demo` e UUID do usuário em vez do nome | Tabela de selos sem junção com reservas e usuários |
| B11 | Equipe | Nome do membro = e-mail, repetido | Convite não guarda nome, ou a lista não o lê |
| B12 | Grupos | Botão "Novo grupo" quebra em duas linhas | Falta `whitespace-nowrap` |
| B13 | Celular | Abas da Agenda saem da tela | Barra de abas sem rolagem e sem layout próprio |
| B14 | Quitar no balcão | Tela mostra "pago" mesmo se o banco recusar | `confirmarPagamentoRestante` atualiza antes e ignora o erro (`void`) |
| B15 | Dashboard e Detalhe | Data "1 De Novembro De 2026" | Capitalização palavra a palavra |
| B16 | Usuários | "Excluir" não exclui nada (a RLS só deixa o próprio atleta apagar o perfil), **desconecta o próprio admin** (`supabase.auth.signOut()`) e mostra "excluída com sucesso" | `excluirContaSupabase` é a função da conta do atleta, reaproveitada no painel |
| B17 | Usuários | "Editar" e "Bloquear" não gravam no banco (RLS de `usuarios` só permite o próprio perfil); a tela mostra sucesso porque grava no `localStorage` | `atualizarPerfilSupabase` ignora o erro do banco e cai no fallback local |

### 1.2 Números enganosos

| # | Problema |
|---|---|
| N1 | "Total arrecadado" e "Faturamento bruto" somam reservas futuras (dezembro) e não têm período |
| N2 | O gráfico "Últimos 7 dias" mostra R$ 0 em quase todos os dias e contradiz o total |
| N3 | "Pendente" na tela significa "sinal pago, resto no balcão", mas o dono lê como "não pagou" |
| N4 | "Valores por quadra" mostra bruto e líquido iguais, duas vezes |
| N5 | O Financeiro lista todas as reservas (776 linhas) sem paginação |
| N6 | Selos decorativos que não verificam nada: "Auditoria em Tempo Real", "Sincronização Ativa" |

### 1.3 Dados e arquitetura

| # | Problema | Risco |
|---|---|---|
| D1 | `fetchReservasSupabase` traz **todo o histórico** da arena para o navegador | O Supabase devolve no máximo 1.000 linhas por padrão. Com ~25 reservas/dia isso estoura em ~40 dias, e Dashboard, Agenda e Financeiro ficam incompletos **sem erro** |
| D2 | `enriquecerReservasComUsuarios` grava no banco durante a leitura (`atualizarReservaSupabase`) | Toda abertura do painel dispara escritas; ligação de reserva com conta feita pelo navegador de quem estiver logado |
| D3 | Telas gigantes que misturam dados, regra e visual: Usuários (1.140), Detalhe (765), Agenda (729), Quadras (707), Financeiro (704) | Manutenção cara e bugs como o B2 se repetindo |
| D4 | Lint de `components/admin` e `hooks`: 16 erros e 58 avisos | Ruído que esconde problemas reais |

### 1.4 Lacunas de função (o balcão precisa e não tem)

| # | Falta |
|---|---|
| F1 | **Cancelar uma reserva pelo painel.** Só o atleta cancela, pelo portal |
| F2 | **Remarcar** (trocar dia, horário ou quadra mantendo o pagamento) |
| F3 | **Registrar como o restante foi pago** (dinheiro, Pix, cartão) e quem recebeu |
| F4 | **Marcar "não compareceu"** |
| F5 | **Histórico de quem fez o quê** (quem quitou, cancelou, bloqueou) quando há operadores |
| F6 | Horário de funcionamento por dia da semana (hoje há um único abrir/fechar) |

### 1.5 Segurança e permissões

| # | Problema | Gravidade |
|---|---|---|
| S1 | A política `"Permitir modificação apenas por proprietarios"` deixa o dono fazer UPDATE em **qualquer coluna** de `arenas`, inclusive `slug`, `modulos_ativos` (módulos pagos), `ativo`, `token_convite` e `modo_pagamento = 'simulado'`. Basta uma chamada direta à API com o token dele | **Alta**: o dono liga módulos que não contratou e muda o subdomínio, quebrando links divulgados |
| S2 | A tela Configurações deixa o dono editar o subdomínio | Alta (consequência do S1) |
| S3 | O Super Admin é uma página com senha fixa (`SUPER_ADMIN_SECRET`) que só cria arena e redefine a senha do dono. Não lista arenas nem muda módulos, slug ou status | Média: hoje isso se faz por SQL manual |
| S4 | A tela Usuários tinha "Excluir conta de atleta" para qualquer papel (ver B16) | Média. **Resolvido no Plano A:** o botão saiu do painel. A conta do atleta é da plataforma (vale em todas as arenas) e a exclusão é direito dele, pelo portal (LGPD); a arena só bloqueia |

### 1.6 Visual ("cara de feito por IA")

1. Cada tela tem um topo diferente: ícone em caixa, ícone solto ou nenhum, títulos de tamanhos diferentes e larguras diferentes.
2. Tudo é card com borda, brilho e selo, até dentro de outro card.
3. Cinco cores de destaque sem significado (verde, amarelo, roxo, azul, vermelho).
4. A mesma ação repetida até três vezes na mesma tela (Grade do dia: "Bloquear horário" e "Nova reserva").
5. Texto de desenvolvedor: "Agenda Completa do Admin", "Grade do Dia (Simplificada)", "Timeline Operacional (Gantt)", "Slug para a URL", "Institucional & LP", "Tabela Bruta", "Reserva ID".
6. Cards de número em toda tela, mesmo quando não ajudam a decidir nada.
7. Menu com 12 itens soltos, cada um numa caixa com borda.

---

## 2. Hierarquia de acesso: o que existe e o que muda

### 2.1 Já existe (implementado e testado)

Papéis por arena em `arena_usuarios.role`, matriz única em `src/lib/admin/permissoes.ts`:

| Tela / ação | Operador de balcão | Gerente | Proprietário |
|---|---|---|---|
| Dashboard (sem receita), Agenda, Usuários, Escolinhas, Grupos | ✔ | ✔ | ✔ |
| Ver receita consolidada | — | ✔ | ✔ |
| Quadras e preços, Site, Fidelidade, Financeiro | — | ✔ | ✔ |
| Redefinir senha de atleta | — | ✔ | ✔ |
| Pagamentos (Pix/Asaas), Equipe, Configurações | — | — | ✔ |

- **Equipe:** o dono convida gerente ou operador por e-mail; a senha temporária obriga troca no primeiro login.
- **Banco:** a RLS repete a hierarquia em `arenas` (só o dono), `quadras` e `quadras_precos` (dono e gerente), `reservas` (UPDATE por qualquer membro ativo, DELETE só pelo dono).
- **Super Admin:** página `/super-admin` protegida por senha estática, para criar arena e redefinir a senha do dono.

### 2.2 O que muda

1. **Campos da plataforma ficam só com o Super Admin** (S1, S2): `slug`, `modulos_ativos`, `ativo`, `token_convite`, `setup_concluido_em` e a troca para `modo_pagamento = 'simulado'`. Trigger no banco (§4, Plano A) e campo somente leitura na tela.
2. **Super Admin vira um painel de arenas** (S3): lista, editar subdomínio, módulos, ativar/desativar, modo demonstração, redefinir senha do dono e gerar novo link de ativação.
3. **Exclusão de conta de atleta só pelo dono** (S4). O gerente bloqueia; o operador só consulta e edita contato.
4. **Registro de ações (auditoria simples)** (F5): o dono vê quem quitou, cancelou, remarcou ou bloqueou.
5. **Operador:** continua vendo valores na reserva (precisa para cobrar), mas não vê totais, Financeiro nem Fidelidade. Sem mudança.

---

## 3. Diretrizes de design (iguais para todas as arenas)

**Princípio:** o painel é uma ferramenta de trabalho, não vitrine. Sóbrio, neutro e igual para todas as arenas. A única marca da arena é **o nome dela no topo, sempre visível**.

### 3.1 Estrutura

- **Barra superior fixa:** nome da arena (texto, sem logo e sem cor própria) · papel do usuário · e-mail · "Ver site" · "Sair".
- **Menu lateral agrupado**, sem caixas em volta dos itens; o item ativo tem só fundo leve e texto forte:
  - **Operação:** Hoje · Agenda · Clientes
  - **Turmas e fixos:** Escolinhas · Grupos
  - **Dinheiro:** Financeiro
  - **Arena:** Quadras e preços · Site · Fidelidade
  - **Ajustes:** Equipe · Recebimento · Configurações
- **No celular:** barra superior com o nome da arena e botão de menu; o menu abre por cima.
- **Toda tela usa o mesmo `CabecalhoPagina`:** título (sem ícone), uma frase curta opcional e ações à direita (no máximo uma primária). A largura máxima é a mesma em todas as telas.

### 3.2 Visual

- **Tema claro neutro** (recomendado: o balcão usa de dia, em ambiente iluminado). Fundo cinza muito claro, superfícies brancas, texto quase preto, bordas finas cinza. Decisão em aberto no §7.
- **Uma cor de destaque** para ação primária e item ativo. Fora isso, cor só para **status**.
- **Status com nome de negócio e cor fixa** (`StatusReserva`, um componente só):

  | Status no banco | Rótulo | Cor |
  |---|---|---|
  | `em_processamento` | Aguardando Pix | cinza |
  | `pendente` | Sinal pago · falta R$ X | âmbar |
  | `confirmada` | Quitada | verde |
  | `cancelada` | Cancelada | vermelho suave |
  | bloqueio | Bloqueado | cinza escuro |
  | contrato escolinha/grupo | Aula / Grupo | azul neutro |

- **Tabelas densas** com cabeçalho fixo, paginação e busca, no lugar de cards empilhados. Card só para agrupar formulário ou resumo.
- **Números:** no máximo 3 ou 4 por tela, só onde ajudam a decidir. Sem ícone colorido em cada um.
- **Fonte:** sem serifa do sistema (a mesma do portal). Monoespaçada só para horário e código.
- **Sem animação nova** (regra do projeto). Só transição de cor em hover.
- **Texto:** frases do dono, não de desenvolvedor. Ex.: "Agenda", "Dia", "Semana", "Mês", "Endereço do site", "Fotos do site".

### 3.3 Componentes base (`src/components/admin/ui/`)

`LayoutPainel`, `BarraSuperior`, `MenuLateral`, `CabecalhoPagina`, `Botao` (primário, secundário, perigo, fantasma), `Campo` (rótulo, ajuda, erro), `Selecao`, `Tabela` (com paginação e estado vazio), `StatusReserva`, `Janela` (em portal, como a de escolinha), `Confirmacao`, `Abas`, `EstadoVazio`, `Aviso`, `Moeda` (formata `pt-BR` sempre), `DataExtensa` (capitalização correta).

Tokens em CSS (`--painel-fundo`, `--painel-superficie`, `--painel-borda`, `--painel-texto`, `--painel-texto-suave`, `--painel-destaque`, `--status-*`), em escopo próprio do admin para não afetar o portal.

---

## 4. Planos de execução

Ordem recomendada: **A → B → C → D → E → F → G**. Cada plano termina com `npm test`, `tsc`, build e verificação no navegador (banco local, nunca produção), e vira um commit.

### Plano A — Segurança e permissões

**Objetivo:** o dono não altera campos da plataforma; o Super Admin passa a gerenciar as arenas.

1. **Migração `2026-11-02-a-arenas-campos-plataforma.sql`** (também em `schema.sql`):

```sql
-- Campos da plataforma: só o servidor (service_role) altera. O dono continua editando o resto.
CREATE OR REPLACE FUNCTION public.proteger_campos_plataforma_arena()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.modulos_ativos IS DISTINCT FROM OLD.modulos_ativos
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.token_convite IS DISTINCT FROM OLD.token_convite
     OR NEW.setup_concluido_em IS DISTINCT FROM OLD.setup_concluido_em
     OR (NEW.modo_pagamento = 'simulado' AND OLD.modo_pagamento IS DISTINCT FROM 'simulado')
  THEN
    RAISE EXCEPTION 'Este dado só pode ser alterado pelo suporte da plataforma.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_plataforma_arena ON public.arenas;
CREATE TRIGGER trg_proteger_campos_plataforma_arena
  BEFORE UPDATE ON public.arenas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_plataforma_arena();
```

   Validar com PGlite e stubs de `auth.role()`: o dono muda o nome e passa; o dono muda o slug e recebe 42501; o service_role muda o slug e passa.

2. **Configurações:** o subdomínio vira texto somente leitura ("Para mudar o endereço, fale com o suporte"). O payload de salvar não envia mais `slug`. Corrigir `construirUrlArena` (sem porta fixa, domínio vindo de `NEXT_PUBLIC_DOMINIO_RAIZ`).
3. **Pagamentos:** o dono não escolhe "Demonstração". O card aparece só como informação quando o modo já é simulado ("Ativado pelo suporte para apresentações").
4. **Super Admin, painel de arenas** (`/super-admin`, mesma senha por enquanto):
   - Lista de arenas: nome, subdomínio, status, módulos, modo de pagamento, dono, criada em.
   - Editar arena: subdomínio (com aviso "links antigos param de funcionar"), módulos (checkboxes), ativa/inativa, modo demonstração liga/desliga.
   - Ações: redefinir a senha do dono e gerar novo link de ativação (já existem como funções; viram botões na linha).
   - Rotas: `GET /api/super-admin/arenas` (lista) e `PATCH /api/super-admin/arenas/[id]` (validação com regex de slug, unicidade e módulos conhecidos).
5. **Exclusão de atleta sai do painel** (B16/S4): a conta é da plataforma e só o próprio atleta a exclui, pelo portal. Editar contato e bloquear (B17) passam para rotas de servidor no Plano F (Clientes), com bloqueio **por arena** (o `usuarios.bloqueado` atual é global e deixaria uma arena bloquear o atleta em todas).
6. **Testes:** trigger (PGlite), rotas do Super Admin (401 sem senha, 400 com slug inválido, 409 com slug repetido, 200), `permissoes` (nova ação), Configurações sem campo de slug editável.

**Aceite:** pelo console do navegador, logado como dono, `supabase.from('arenas').update({ modulos_ativos: [...] })` falha com a mensagem do suporte. O Super Admin muda módulos e o menu da arena reflete isso.

### Plano B — Fundação: rotas, layout e componentes base

**Objetivo:** cada tela tem endereço próprio e todas usam os mesmos componentes.

1. **Rotas reais** com layout compartilhado (ler `node_modules/next/dist/docs/` antes, por causa do Next 16):
   - `src/app/(plataforma)/admin/(painel)/layout.tsx` carrega sessão, arena, papel, catálogo de quadras e horários uma vez; renderiza `LayoutPainel`; trata login, primeiro acesso e troca obrigatória de senha (lógica que hoje está no `AdminShell`).
   - Páginas: `/admin` (Hoje), `/admin/agenda`, `/admin/clientes`, `/admin/escolinhas`, `/admin/grupos`, `/admin/financeiro`, `/admin/quadras`, `/admin/site`, `/admin/fidelidade`, `/admin/equipe`, `/admin/recebimento`, `/admin/configuracoes`, `/admin/reservas/[id]`.
   - Redirecionamentos: `/admin/dashboard` → `/admin`; `/admin/reserva/[id]` → `/admin/reservas/[id]`.
   - Proteção por papel e módulo no layout (reaproveita `viewDisponivel`): tela não permitida redireciona para `/admin` com aviso.
   - Filtros na URL onde fizer sentido: `/admin/agenda?data=2026-11-02&visao=dia`, `/admin/financeiro?mes=2026-11`.
2. **Componentes base** do §3.3 e tokens. Menu lateral agrupado e barra superior com o nome da arena.
3. **Uma única tela de detalhe da reserva:** `DetalheReserva` usado pela página `/admin/reservas/[id]` e pela janela da Agenda. Apagar `ModalDetalhesReserva.tsx` e `AdminReservaDetalhes.tsx` (B1, B4).
4. **Formatadores centrais:** `formatarMoeda` (vírgula), `DataExtensa` ("domingo, 1 de novembro de 2026") (B8, B15).
5. **Testes:** layout redireciona sem login; operador acessando `/admin/financeiro` cai em `/admin`; módulo desligado esconde o menu e bloqueia a rota; menu marca o item da rota atual.

**Aceite:** F5 mantém a tela; Voltar funciona; o link copiado da Agenda abre a Agenda no mesmo dia.

### Plano C — Dados corretos e escaláveis

**Objetivo:** os números batem, sem limite de 1.000 linhas e sem gravação na leitura.

1. **Reservas por janela de datas:** `listarReservasPeriodo(inicio, fim)` substitui `fetchReservasSupabase` no painel. Hoje busca o dia; a Agenda busca a semana ou o mês visível; o Detalhe busca por id. O tempo real assina só `arena_id` e atualiza a janela carregada.
2. **Resumo financeiro no banco:** RPC `resumo_financeiro(p_inicio date, p_fim date)` com `SECURITY INVOKER` (a RLS filtra a arena) que devolve, só para reservas **já jogadas ou do período escolhido**:
   - recebido (sinais + quitações), a receber no balcão, valor de tabela, descontos de fidelidade, cancelamentos com e sem devolução;
   - totais por dia e por quadra.

   Lista do Financeiro paginada no servidor (`range`), com filtros de período, quadra, status e forma de pagamento.
3. **Fim da gravação na leitura (D2):** a ligação reserva ↔ conta do atleta passa para o servidor no cadastro e no login do atleta (`cadastroAtletaServidorService` / acesso), por WhatsApp normalizado. Remover `enriquecerReservasComUsuarios`.
4. **Mutações com erro tratado (B14):** quitar, cancelar, remarcar e bloquear só atualizam a tela depois do OK do banco. Em caso de erro, toast com a mensagem e nada muda.
5. **Testes:** RPC no PGlite (soma correta, ignora futuras fora do período, ignora canceladas); paginação; mutação com erro não altera o estado.

**Aceite:** com 2.000 reservas no banco local, o Financeiro de novembro mostra a soma igual à do SQL de conferência; o Dashboard de hoje mostra só hoje.

### Plano D — Correção dos bugs restantes

B2, B3, B5, B6, B9, B10, B11, B12, B13 e N3, N4, N6, cada um com teste:

- **B2:** percentuais vêm de `valorSinal / valorTotal` da própria reserva ("Sinal pago · R$ 50,00 de R$ 100,00"), sem número fixo.
- **B3:** remover "Confirmação enviada pelo portal". Os botões de WhatsApp ficam como "Abrir conversa com mensagem pronta" (é o que fazem).
- **B5/B6:** nomes reais das quadras; contagem dinâmica; timeline com tooltip e nome completo no clique.
- **B10:** selos com nome do cliente, data e quadra.
- **B11:** gravar e mostrar o nome do membro da equipe.
- **N3:** `StatusReserva` com os rótulos do §3.2 em todo o painel.
- **N6:** remover selos decorativos.

### Plano E — Funções novas da reserva (balcão)

**Objetivo:** o balcão resolve tudo pela tela da reserva, com formulários completos no padrão das escolinhas (validação, explicação clara, erro do banco visível).

1. **Quitar restante** (substitui o botão atual): forma de pagamento (Dinheiro, Pix, Cartão) e valor recebido (padrão: o restante; permite desconto com motivo).
   - Colunas novas em `reservas`: `forma_pagamento_restante TEXT CHECK (IN ('dinheiro','pix','cartao'))`, `quitada_em TIMESTAMPTZ`, `quitada_por UUID`.
2. **Cancelar pelo painel:** motivo (lista + texto) e devolução do sinal:
   - **Qualquer modo de pagamento (decisão de 02/11):** só registro. "Devolvi o sinal (Pix/dinheiro)" ou "Sinal retido (fora do prazo)", com aviso da política da arena. Sem estorno automático pelo Asaas por enquanto (BACKLOG);
   - **Grátis/voucher:** devolve o voucher.

   Libera o horário na hora. Rota `POST /api/admin/reservas/[id]/cancelar`, com papel mínimo operador.
3. **Remarcar:** escolher data, horário e quadra mostrando só horários livres (mesma regra de conflito e lock do checkout). Mantém pagamento e histórico; recalcula a diferença se a tarifa mudar (mostra "diferença a cobrar R$ X" ou "crédito R$ X"). Rota `POST /api/admin/reservas/[id]/remarcar`.
4. **Não compareceu:** marca a reserva; entra no histórico do cliente; não devolve sinal.
5. **Registro de ações** (F5): tabela `reservas_eventos (id, arena_id, reserva_id, tipo, detalhes JSONB, autor_id, criado_em)`. RLS: leitura para membros da arena; INSERT só pelo servidor. Aparece no Detalhe como linha do tempo ("Sinal pago via Pix · 31/10 12:00", "Quitada em dinheiro por Ana · 01/11 19:05").
6. **Reserva manual (balcão):** revisar o formulário. Cliente existente (busca por nome/WhatsApp) ou novo; repetir por N semanas; pagamento já recebido (nada, sinal ou integral, e forma).
7. **SQL** no próprio plano ao implementar (migração `2026-11-xx-b-reservas-balcao.sql` + `schema.sql`), entregue para colar no Supabase.

**Aceite:** pelo navegador local, o operador cancela com devolução, remarca para outro dia e quita em dinheiro, e o dono vê as três ações no histórico da reserva.

### Plano F — Redesign tela a tela (ordem de uso)

| Tela | Conteúdo novo | Corta |
|---|---|---|
| **Hoje** (era Dashboard) | Faixa "Agora em quadra" por quadra (quem está, até que horas, falta pagar?); "Próximas" (2h seguintes); "A cobrar hoje" (total e lista, com botão quitar); Pix aguardando confirmação; aulas e grupos do dia. Gerente/dono: recebido hoje e ocupação do dia | Lista longa de 31 linhas iguais; 4 cards decorativos |
| **Agenda** | Três visões com nomes simples: **Dia** (colunas por quadra, linhas por hora, nome legível; padrão no computador), **Semana** e **Mês**; filtros de quadra; clique em horário livre abre "Nova reserva" ou "Bloquear" no ponto clicado. Celular: visão Dia em lista por quadra | Ações triplicadas; "Sincronização Ativa"; cards de número |
| **Detalhe da reserva** | Cabeçalho (cliente, status, quadra · data · horário); bloco Pagamento (total, pago, falta, forma); ações (Quitar, Remarcar, Cancelar, Não compareceu, WhatsApp); histórico | Ícone em cada linha, progresso decorativo, texto falso de notificação |
| **Clientes** (era Usuários) | Tabela: nome, WhatsApp, reservas, última vez, total gasto (gerente+), status; filtro "com conta / só balcão"; detalhe com histórico. Opcional: incluir quem reservou no balcão sem conta, agrupado por WhatsApp | Cards de número no topo |
| **Escolinhas / Grupos** | Só adaptar aos componentes base; o formulário de escolinha fica como está | — |
| **Financeiro** | Seletor de mês ou período; 3 números (Recebido, A receber no balcão, Descontos/devoluções); gráfico simples por dia; tabela paginada com filtros; exportar CSV | Título "& Fidelidade", selo "Auditoria", bruto = líquido |
| **Quadras e preços** | Lista compacta; formulário em janela com tarifas por faixa e dia; "copiar tarifas desta quadra para…" | Badges coloridos por atributo |
| **Site** (era Institucional & LP) | Abas: Fotos (galeria atual); depois Estrutura, Campeonatos e Instagram (BACKLOG) | Botão-aba isolado "Galeria do Complexo (4)" |
| **Fidelidade** | Configuração da campanha + tabela de clientes com saldo de horas e vouchers (nome, não id) | Cards de taxa sem uso |
| **Equipe** | Igual, com nome do membro e "último acesso" | — |
| **Recebimento** (era Pagamentos) | Pix direto ou Asaas; modo demonstração só informativo | Escolha do modo simulado pelo dono |
| **Configurações** | Seções: Dados da arena · Contato e endereço · Funcionamento (abertura/fechamento **por dia da semana**, F6) · Reservas (sinal %, antecedência, intervalo) · Política de cancelamento. Endereço do site somente leitura | Edição de subdomínio |

O horário por dia da semana (F6) precisa de uma coluna `horarios_funcionamento JSONB` em `arenas`. A grade pública e o checkout passam a respeitá-la; a coluna antiga fica como padrão. SQL no plano ao implementar.

Login, primeiro acesso, troca de senha e redefinir senha usam o mesmo visual neutro.

### Plano G — Limpeza

- Zerar os erros de lint de `components/admin` e `hooks` (avisos de variáveis não usadas incluídos).
- Quebrar telas grandes em `componentes de tela` + `hooks` + `lib/` puro (regra de negócio testável).
- Apagar o que ficou órfão (`AdminShell`, `AdminSidebar` antigos, telas duplicadas, `.next-demo` do tsconfig).
- Atualizar `docs/ROTEIRO_DEMO.md` com o roteiro do novo painel.

---

## 5. Prioridade em relação à demonstração da Arena Belém

| Antes da demo | Depois da demo |
|---|---|
| A (segurança), B (rotas e base), C1–C4 (dados), D (bugs), E1–E3 (quitar, cancelar, remarcar), F: Hoje, Agenda, Detalhe | E4–E7, F: demais telas, horário por dia da semana, G |

---

## 6. Prompt de execução (colar numa sessão nova, um plano por vez)

```
Leia AGENTS.md, src/AGENTS.md e SPEC/2026-11-02-admin-revisao.md.
Execute o Plano <LETRA> inteiro, seguindo as diretrizes do §3 (visual neutro, igual para todas
as arenas, só o nome da arena no topo, sem animação nova).

Regras:
- Banco: nunca rode testes ou scripts contra a produção (.env.local aponta para produção).
  Use o Supabase local de tests/supabase-local (porta 54330) e valide SQL com PGlite.
- Toda mudança de banco: migração em src/lib/supabase/migracoes/, schema.sql sincronizado e
  o SQL entregue na resposta para eu colar no Supabase, com passo a passo.
- Testes de regra de negócio e de tela para cada item; npm test, tsc (em src/) e build verdes.
- Valide no navegador (localhost, dono dono@teste.local / senha-teste-123) em computador e
  celular (390px) e mostre prints das telas alteradas.
- Commit ao final do plano, sem push. Não altere o portal público além do necessário.
- Ao terminar, liste o que mudou, o que ficou pendente e feche com a
  "🔍 Análise Crítica do Claude".
```

---

## 7. Decisões

### Tomadas (02/11/2026)

1. **Tema:** neutro, claro (§3.2).
2. **Devolução no cancelamento:** só registro manual por enquanto. O balcão marca "Devolvi o sinal" ou "Sinal retido"; sem estorno automático pelo Asaas. O estorno automático vai para o BACKLOG.

3. **Clientes sem conta entram já na tela Clientes**, agrupados pelo WhatsApp normalizado. Mostra o nome mais recente e os outros nomes usados naquele número; nunca funde cadastros automaticamente.
4. **Subdomínio antigo redireciona:** ao trocar o slug pelo Super Admin, o anterior fica em `arenas.slug_anterior` e quem acessar o endereço antigo recebe 301 para o novo. Guarda só o último endereço. O `slug_anterior` não pode ser igual ao `slug` de outra arena; a criação ou troca de slug também não pode usar o `slug_anterior` de outra arena.
