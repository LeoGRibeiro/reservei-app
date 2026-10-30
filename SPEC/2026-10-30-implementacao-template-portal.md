# SPEC: Implementação do template do portal da arena (e do site da Arena Belém)

- **Data:** 30/10/2026
- **Referência visual e de comportamento:** `src/public/preview-portal.html` e `src/public/preview-portal-regras.html`, aprovados pelo dono do projeto em 30/10/2026.
- **Contexto do protótipo:** `SPEC/2026-10-30-handoff-prototipo-portal.md`.
- **Plataforma:** MarcArena, o novo nome do Reservei. O domínio ainda não foi definido.

## 1. Objetivo

Levar o protótipo para produção como um **template multiarena**. A primeira arena a usar o template é a Arena Belém, que serve de apresentação comercial.

Regras inegociáveis:

1. **Igual ao protótipo, sem nada a mais nem a menos.** Vale para layout, textos, componentes, estados vazios, animações (só Lenis, hover de cor e `scale(.97)` no clique) e comportamento. Isso inclui o comportamento em celular, tablet e computador.
2. **O template não conhece a Arena Belém.** Nome, cores, logo, fotos, textos, quadras, preços, escolinhas, eventos, regras e Instagram vêm do banco, por `arena_id`. Nenhuma string "Arena Belém" fica no código do template.
3. **Primeiro o template, depois a Arena Belém.** O template é implementado com tema neutro e dados de exemplo genéricos. A Arena Belém entra numa fase própria, só com dados e tema: seed, fotos e cores.
4. **Nada de produção é apagado antes de o equivalente novo estar pronto e validado.**

### 1.1 Decisões do dono (30/10/2026, depois da primeira versão desta SPEC)

1. **Escopo desta SPEC: só o front do atleta.** É o portal público, a área do atleta e a página de regras. O redesign visual do admin fica para uma SPEC futura. O admin só recebe ajustes **funcionais** quando forem necessários para a demonstração (ver item 3), sem mudar o visual.
2. **Nenhuma integração paga ou com custo.** Não fazer:
   - API do WhatsApp da Meta;
   - gateway de pagamento real (estorno incluído);
   - API do Instagram;
   - SMS;
   - qualquer serviço cobrado.

   No lugar, tudo funciona de verdade dentro do sistema, em modo de demonstração:
   - **Código de acesso:** só o provedor `demonstracao` do §5.1 (código fixo por variável de ambiente, só em arena com `modo_pagamento = simulado` ou em desenvolvimento). O provedor `meta` fica só como interface vazia, documentada.
   - **Pagamento:** só `simulado`. O botão "Simular pagamento" confirma a reserva de verdade no banco, pelo mesmo caminho que um webhook usaria.
   - **Reembolso:** ao cancelar com mais de 24 horas, a reserva vai para "reembolsada" (simulado) no banco. Não chama gateway.
   - **Instagram:** posts cadastrados por seed na tabela `instagram_posts`.
3. **A demonstração tem que ser real.** Na apresentação, o atleta cria a conta, reserva, paga (simulado), pede vaga, cancela; **ao mesmo tempo**, o admin aberto em outra tela vê a reserva aparecer e os dados mudarem sem recarregar. Para isso:
   - **Reservas:** o tempo real do Supabase já existe (`reservasService.ts`, publicação `supabase_realtime` em `reservas`). Conferir que o admin atualiza agenda, lista e totais na hora para reserva nova, pagamento confirmado e cancelamento.
   - **Outras tabelas:** se o admin mostra pedidos de vaga (`interesses_vagas`), carimbos e horas grátis (`fidelidade_*`) ou dados do atleta, incluir essas tabelas na publicação de tempo real e assinar no admin. É uma mudança só de comportamento.
   - **Roteiro da apresentação:** escrever em `docs/ROTEIRO_DEMONSTRACAO.md`, passo a passo (atleta no celular, admin no computador), e validar ponta a ponta com dois navegadores no Playwright.
4. **Arquivos `preview-*`:** continuam publicados em `src/public` até a Fase 7. Na limpeza, vão para `docs/referencia-visual/`.
5. **`@playwright/test`** entra como devDependency, só para a comparação visual e o teste ponta a ponta da demonstração.
6. **Telas do admin** para editar eventos, regras, Instagram e tema: SPEC separada, depois da apresentação.

## 2. Princípio técnico: portar, não reescrever

Reescrever o CSS do protótipo em Tailwind tem alto risco de diferença visual. O caminho escolhido:

- **CSS:** o CSS do protótipo vira um arquivo único `src/components/portal-arena/portal-arena.css`, escopado sob a classe raiz `.pa`. Os nomes de classe são mantidos: `.topo`, `.quadra`, `.slot`, `.ticket`, `.ck`, `.rsv`, `.cartela`. O Tailwind e o tema atual (`globals.css`) continuam valendo para o admin e o super-admin, sem conflito.
- **Cores:** viram variáveis de tema por arena. As do protótipo têm nome de cor (`--navy`, `--yellow`); no template passam a ter nome de papel:

| Protótipo | Template | Arena Belém |
|---|---|---|
| `--navy` | `--pa-marca` | `#1e2d6b` |
| `--navy-deep` | `--pa-marca-escura` | `#131d47` |
| `--navy-tint` | `--pa-marca-clara` | `#e7eaf5` |
| `--yellow` | `--pa-destaque` | `#f4b41a` |
| `--yellow-press` | `--pa-destaque-hover` | `#e3a20c` |
| `--sand` | `--pa-fundo-suave` | `#f4f1ea` |
| `--paper` | `--pa-papel` | `#fffdf8` |

  As demais cores (texto, linhas, vermelho, verde de "pago") continuam fixas no template.
- **Fonte:** Archivo, via `next/font/google`, com os mesmos eixos (`wdth` 62..125, `wght` 100..900).
- **Ícones:** o protótipo usa caminhos do Lucide. Em produção usa-se `lucide-react`, já instalado, com o mesmo traço (2 px; nos checks dos ícones, 3 px).
- **Lenis:** reaproveitar `SmoothScrollProvider` com a mesma configuração (duration 0.85, wheelMultiplier 1.35, touchMultiplier 1.8, easing expo). Antes de rolar até uma âncora, sempre chamar `lenis.resize()`.
- **Toast:** o protótipo usa um aviso próprio, escuro e centralizado embaixo. Portar esse componente em vez de usar o `sonner` no portal; o admin continua com o `sonner`.
- **Componentes:** organizados em Clean Architecture, como pede o `AGENTS.md`.
  - `src/components/portal-arena/`: apresentação.
  - `src/hooks/`: estado e casos de uso.
  - `src/lib/**`: serviços e repositórios tipados, com try/catch.
  - Componentes e funções públicas com JSDoc.

## 3. Mapa: cada parte do protótipo, de onde vem o dado e o que falta

Legenda: **existe** = dado e serviço já existem; **ajuste** = existe mas precisa de coluna ou regra nova; **novo** = tabela, rota ou serviço novo.

### 3.1 Estrutura da página

| Parte | Componente novo | Dado | Situação |
|---|---|---|---|
| Topo azul fixo: logo e nome, menu centralizado ≥1100px, botão de três linhas abaixo disso, sombra ao rolar | `TopoArena` | `arenas.nome`, `logo_url` | ajuste (logo por arena já existe) |
| Menu: Reservar, Escolinhas, Campeonatos, Estrutura, Contato, com scroll spy (sem marcação nas seções fora do menu) | `MenuSecoes` + `useSecaoAtiva` | módulos ativos | ajuste: cada item some quando a seção não existe para a arena |
| Visitante: Entrar e Criar conta. Logado: Minhas reservas e avatar com menu (nome, WhatsApp, mini-cartela, Minhas reservas · N próximas, Meu Clube, Meus dados, Sair) | `ContaTopo`, `MenuPerfil` | sessão, fidelidade, reservas | existe |
| Menu do perfil no celular: fixo, logo abaixo do topo, rolagem própria | `MenuPerfil` | — | comportamento do protótipo |
| Menu do celular com Criar conta e Entrar (visitante) ou Minhas reservas (logado) | `MenuCelular` | — | — |
| Botão "voltar ao topo" depois de 700 px | `BotaoSubir` | — | existe (`BotaoVoltarAoTopo`); ajustar o visual |
| Rodapé: marca e endereço; colunas "Na página", "Ajuda" (botão Regras e dúvidas, Cancelamento e chuva, Perguntas frequentes) e "Contato" (WhatsApp, Instagram, horário); linha final com "Reservas online com MarcArena · tenha um site assim na sua arena" e o crédito do mapa | `RodapeArena` | arena, `instagram` | ajuste |

### 3.2 Reservar (`#reservar`)

| Parte | Dado | Situação |
|---|---|---|
| Título e frase de abertura ("Três quadras de areia e um campo society no Jurunas…") | `arena_conteudo.intro_reserva` | novo |
| Fichas de data: hoje + 30 dias, marcador de mês, fim de semana em vermelho, setas no computador | `datas` (fuso da arena) | existe (`CalendarioSelector`), refazer o visual |
| Linha do dia, aviso "Antes das HH:00 já não dá para reservar hoje" ou "Os horários de hoje já acabaram", legenda | relógio real da arena + `antecedencia_minima_minutos` | existe |
| Card da quadra: foto com enquadramento, nome, esportes, preço de dia e de noite, horários em Manhã/Tarde/Noite (no celular, grade de 4 sem rótulo) | `quadras` + `quadras_precos` | **ajuste:** `quadras.foto_url` e `quadras.foto_posicao` |
| Estados do horário: Livre, Selecionado (com check), Ocupado, Aula (leva até a turma), "Sua reserva" (leva até a reserva na conta), passado (some) | disponibilidade, contratos recorrentes, reservas do atleta | existe; a ligação "Sua reserva → conta" é nova |
| Seleção só de horas seguidas na mesma quadra | regra do protótipo (`alternar`) | portar |
| Ticket de papel fixo no computador (≥1120px), com picote; barra azul fixa embaixo no celular | carrinho | existe (`CarrinhoLateral`), refazer o visual |
| Embaixo do ticket: textos de cancelamento e do Clube, link "Regras da arena e dúvidas" | política + regras | ajuste |
| Mural "Partidas procurando jogadores" recolhido (`<details>`): no computador embaixo do ticket, no celular depois das quadras. **Nunca mostra quantas vagas faltam.** A partida do próprio atleta aparece como "sua partida", com "Ver pedidos (N)". Visitante que toca "Quero jogar" entra na conta e o pedido segue sozinho | `reservas` com vagas + `interesses_vagas` | existe; o fluxo de pedir depois de entrar é novo |

### 3.3 Checkout (diálogo em forma de ticket)

| Etapa | Situação |
|---|---|
| Seus dados: visitante informa nome, WhatsApp e esporte (se a quadra tiver vários). Logado vê "Reservando como…". Opções sinal de 50% ou valor integral, hora grátis do Clube, aceite da política com o texto abrindo no lugar. Visitante vê "Tem conta? Entre…": entra por cima do checkout e volta logado | existe (`useCheckoutReserva`); o visual e o "Tem conta" são novos |
| Pix: QR, valor, 10 minutos guardando o horário, copia e cola, recebedor. "Simular pagamento" e o aviso de demonstração **só** com `modo_pagamento = simulado`; nos outros modos, aguarda a confirmação como hoje | existe (`ModalPix`); visual novo |
| Tempo esgotado: "Escolher de novo" | existe |
| Confirmada: carimbo "Reserva · Confirmada · Nº", "Tudo certo, Nome!", caixa amarela "No dia do jogo · Pague R$ X na arena", Adicionar à agenda (.ics), Ver minhas reservas (logado), caixa do Clube com carimbos novos (logado) ou "Crie sua conta com esse WhatsApp" (visitante), Fechar no fim | ajuste: o .ics e a caixa do Clube são novos no visual |
| Celular: diálogo de tela cheia; o Pix aparece sem o resumo azul, com QR grande no centro; os botões ficam sempre no fim da tela | portar |

### 3.4 Seções da página

| Seção | Dado | Situação |
|---|---|---|
| **Escolinhas** (azul): 2 colunas no computador; foto do professor 104×130 com borda amarela; esporte, professor, descrição, tabela de turmas (dia, horas, nível), "Quero uma vaga" com WhatsApp pronto; sem preço | `landing_page_schools` | **ajuste:** coluna `turmas jsonb` com `[{dias, horas, nivel}]` no lugar de `schedule_info` texto |
| **Campeonatos e eventos:** card azul "Rolando agora" com a chave (semis e final); "Inscrições abertas" em ingressos com canhoto da data e botão de formulário ou WhatsApp; "Já aconteceu" com foto, campeões e placar (faixa rolável no celular). Cada bloco some sem dados; a seção inteira some se a arena não tiver eventos | `eventos` | **novo** (tabela + módulo `eventos`) |
| **Clube Arena Belém** (o nome vem de `fidelidade_campanha.nome`): 3 passos e a cartela de 10 casas. Visitante vê casas vazias e "Criar conta e começar a juntar". Logado vê carimbos com o logo da arena, últimos carimbos e hora grátis com "Usar na próxima reserva" | `fidelidade_*` | existe; visual novo |
| **Estrutura:** bento com 4 fotos e legenda + caixa "Na arena" com checks amarelos e a parte principal em negrito | `landing_page_gallery` (4 primeiras ativas) + `arena_conteudo.destaques_estrutura` | ajuste |
| **Instagram:** cabeçalho de perfil (@, posts e seguidores, "Seguir"), grade de 8 posts no computador e 6 no celular, com fixado, Reels e carrossel. Sem filtro e sem "ver todos" | `instagram_posts` (cache) + `arenas.instagram` | **novo**; ver §5.3 |
| **Contato:** mapa em escala de cinza com pino e nome, endereço, botões Google Maps, Waze e "Avaliar no Google" (largura total ≤520px), funcionamento, WhatsApp, pagamento, política recolhida, "Chamar no WhatsApp" | `arenas` | **ajuste:** `latitude`, `longitude`, `google_maps_url`, `google_place_id`, `mapa_url` |

### 3.5 Página de Regras e dúvidas

- **Rota:** `/regras`, por arena.
- **Conteúdo:** topo azul com "Voltar ao site", índice de âncoras, regras numeradas, Cancelamento e chuva (3 casos), FAQ em `<details>` e a caixa "Ficou alguma dúvida?". **Sem termos de uso.** A âncora para a 80 px do topo.
- **Dado:** `arena_conteudo.regras`, `arena_conteudo.faq` e os casos de cancelamento (derivados da política). **Novo.**

### 3.6 Área do atleta

| Parte | Situação |
|---|---|
| **Diálogo de conta** (mesmo ticket do checkout): o lado azul lista as vantagens e mostra uma cartela de exemplo. Abas Entrar e Criar conta. Passo 1: WhatsApp (e, para criar, nome e nascimento opcional). Passo 2: "Digite o código" (6 números, `one-time-code`, "Reenviar em 0:30", "Trocar número"). Depois de reservar sem conta, aparece "Confirme o seu WhatsApp" com os dados da reserva. Nome capitalizado ("ana de souza" vira "Ana de Souza"). No celular, a parte azul fica compacta e os botões ficam no fim da tela | UI nova; backend em §5.1 |
| **`/minha-conta`:** topo em fundo areia com "Voltar para as quadras", avatar, "Olá, Nome", WhatsApp, fichas (Próximo jogo, Clube, Para usar) e abas Reservas, Clube e Meus dados (cada uma com endereço próprio). Visitante vê o cartão "Minha conta · Entrar · Criar conta" | rota existe; tela nova |
| **Reservas:** ingresso por jogo (canhoto com data e hora; dia e hora a 16 px; valores com "Pagar na arena" em amarelo; estado do mural; Adicionar à agenda, Falar com a arena, Cancelar reserva). Histórico com "Jogou" ou "Cancelada" e valor (**sem** "Reservar de novo"). Lateral: Pedidos para jogar e Precisa mudar algo? | existe; visual novo |
| **Clube:** cartela grande, horas grátis com código e Copiar, vencimento dos carimbos (3 meses), histórico de carimbos, "Como funciona o Clube" | existe (`fidelidade_vouchers.codigo` já existe) |
| **Meus dados:** dados com edição, Falar com a arena, Sair, Excluir conta (link vermelho, diálogo que lista o que se perde e avisa dos jogos marcados). **Sem** cartão de senha, sem "sair de todos os aparelhos", sem LGPD ou privacidade | existe |
| **Diálogos simples** (topo azul e papel; no celular, gaveta por baixo): Cancelar reserva (mais de 24 h: "Você recebe de volta os R$ X pagos, no mesmo Pix"; menos: "não são devolvidos"); Procurar jogadores (quantos faltam, termo, publicar; pedidos com Chamar e Combinado; partida completa sai do mural); Excluir conta | existe em parte (`ModalGerenciarVagas`); o reembolso depende do §5.2 |

### 3.7 O que sai de produção (depois da paridade)

| Sai | Destino |
|---|---|
| `CabecalhoReserva`, `LandingHeader`, `LandingFooter`, `SecaoEstrutura`, `SecaoEscolinhas`, `SecaoContato`, `LandingSecoesPlaceholder`, `SecaoPlaceholder`, `CarrinhoLateral`, `FormularioIdentificacao`, `ModalPix`, `ModalPosReservaCadastro`, `MuralVagasAbertas`, `ModalEscolinha` | apagar quando os novos estiverem em uso e testados |
| `/login` e `/cadastro` (senha) | redirecionam para o portal com o diálogo aberto (`?conta=entrar` / `?conta=criar`) |
| Login do atleta por senha, `CartaoAlterarSenha`, "Redefinir senha" de atleta no admin | depois do §5.1 em produção. A equipe da arena continua com senha |
| Botão "Agendar Agora" do topo, abas "Fale Conosco" e "Privacidade & Exclusão" | não existem no protótipo |

**As páginas `/termos` e `/privacidade` continuam existindo.** Elas só não aparecem no portal, por decisão de 30/10.

## 4. Modelagem de dados

Toda tabela nova tem `arena_id` e RLS: leitura pública só do que é público e escrita só por quem tem papel na arena (`arena_usuarios`). Toda mudança entra em `src/lib/supabase/migracoes/` e é sincronizada em `schema.sql`. O SQL limpo é entregue ao usuário para o SQL Editor, com instruções passo a passo.

### 4.0 Primeiro passo obrigatório: auditoria de RLS

As políticas `"Permitir gestão completa de fotos da galeria"` e `"Permitir gestão completa de escolinhas"` (`USING (true)`, em `schema.sql`) **não** estão no `DROP POLICY` da migração multiarena, que remove nomes parecidos. Se ainda existirem no banco, qualquer pessoa pode alterar a galeria e as escolinhas de qualquer arena.

Para conferir:
1. Rodar `select tablename, policyname, cmd, qual from pg_policies where tablename in ('landing_page_gallery','landing_page_schools');`.
2. Se as duas políticas aparecerem, removê-las numa migração.
3. Revisar todas as tabelas que serão usadas pelo template.

### 4.1 Colunas novas

| Tabela | Colunas |
|---|---|
| `arenas` | `tema jsonb` (as 7 cores do §2), `instagram text`, `latitude numeric`, `longitude numeric`, `google_maps_url text`, `google_place_id text`, `mapa_url text`, `bairro text` |
| `quadras` | `foto_url text`, `foto_posicao text` (ex.: `'50% 62%'`) |
| `landing_page_schools` | `turmas jsonb` (`[{ "dias": "Seg e Qua", "horas": "16h", "nivel": "Avançado" }]`), `ordem int` |
| `landing_page_gallery` | já tem `categoria` e `display_order`; o bento usa as 4 primeiras ativas |

### 4.2 Tabelas novas

- **`arena_conteudo`**, uma linha por arena:
  - `arena_id` (PK, FK);
  - `intro_reserva text`, `intro_escolinhas text`, `intro_eventos text`, `intro_estrutura text`;
  - `destaques_estrutura jsonb` (`[{ "destaque": "3 quadras de areia", "resto": "tratada" }]`);
  - `regras jsonb` (`[{ "titulo", "texto" }]`), `faq jsonb` (`[{ "pergunta", "resposta" }]`);
  - `atualizado_em`.
- **`eventos`:**
  - `id`, `arena_id`;
  - `titulo`, `modalidade`, `descricao_curta` (linha cinza);
  - `data_inicio date`, `data_fim date null`, `horario text null`;
  - `status` (`'inscricoes' | 'em_andamento' | 'encerrado'`);
  - `dados jsonb`: lista `[{ "rotulo": "Inscrição", "valor": "R$ 120 por dupla" }]`;
  - `inscricao_tipo` (`'formulario' | 'whatsapp' | 'confirmar_presenca'`), `inscricao_url text null`, `mensagem_whatsapp text null`;
  - `chave jsonb null`: fases e jogos do "Rolando agora";
  - `campeoes text null`, `placar_final text null`, `foto_url text null`;
  - `ordem`, `ativo`, `criado_em`.
- **`instagram_posts`:** cache de exibição.
  - `id`, `arena_id`, `imagem_url`, `legenda`, `tipo` (`'foto' | 'reels' | 'carrossel'`), `link`, `publicado_em`, `fixado bool`, `ordem`, `ativo`.
  - Mais `instagram_perfil (arena_id PK, seguidores int null, total_posts int null, atualizado_em)`.
  - As contagens só aparecem quando existem.

### 4.3 Módulos (feature flags)

Novos valores em `modulos_ativos`: `eventos` e `instagram`. Cada seção e cada item do menu aparecem só quando:
- o módulo está ativo; **e**
- existe dado.

Exemplo: uma arena sem eventos não mostra a seção nem o item "Campeonatos" no menu.

## 5. Decisões de comportamento que dependem de backend

### 5.1 Entrar com código no WhatsApp (BACKLOG item 14)

- **Nesta SPEC só o provedor `demonstracao` é implementado (§1.1).** O `meta` fica para quando o dono decidir pagar a API.
- **UI:** igual ao protótipo desde o primeiro dia.
- **Backend atrás de uma interface `EnvioCodigoAcesso`:**
  - **`meta`:** API oficial do WhatsApp da Meta, com modelo de autenticação aprovado. Depende de ação manual do dono: número da MarcArena, empresa verificada, conta registrada no Brasil.
  - **`demonstracao`:** para arenas com `modo_pagamento = simulado` e em desenvolvimento. Não manda mensagem; aceita um código fixo configurado por variável de ambiente e só para números de teste. **Nunca** fica ativo em arena real.
- **Regras:**
  - o código vale 10 minutos e serve uma vez;
  - até 5 tentativas;
  - no máximo 1 envio a cada 30 s e poucos por hora, por número e por IP;
  - sessão longa no aparelho.
- **Sessão no Supabase:** verificar na documentação atual do Supabase Auth se o login por telefone com "Send SMS Hook" atende, chamando a API da Meta sem Twilio. Se não atender, validar o código numa rota do servidor e criar a sessão pela API administrativa. **Decidir antes de codar e registrar a decisão em `docs/ARCHITECTURE_DECISIONS.md`.**
- **Contas atuais (senha):** quem já tem conta entra pelo WhatsApp do cadastro, sem migrar nada.

### 5.2 Reembolso ao cancelar

- **Regra (30/10):** com mais de 24 horas, reembolso **direto no Pix**; com menos de 24 horas, sem devolução; chuva forte, a arena remarca sem custo.
- **Nesta SPEC só o modo `simulado` é implementado (§1.1).** Os outros dois ficam registrados para depois.
- **Por modo de pagamento:**
  - `asaas`: estorno pelo gateway.
  - `manual`: a reserva fica "reembolso pendente" e aparece no admin para a arena devolver.
  - `simulado`: marca como reembolsado na hora.
- Fecha o item "Política de reembolso no cancelamento pelo atleta" do BACKLOG.

### 5.3 Instagram

- **Primeira versão:** a arena (ou o super-admin) cadastra os 8 posts no painel (foto, legenda, tipo, link, fixado) e o @. A grade fica igual à do protótipo.
- **Depois:** integração automática pela API (BACKLOG item 13) preenchendo a mesma tabela `instagram_posts`. Assim a UI não muda.

### 5.4 Painel da arena para o conteúdo novo

Eventos, conteúdo (`arena_conteudo`), fotos e enquadramento das quadras, turmas das escolinhas, posts do Instagram e tema são editados no admin. **Ficam numa SPEC própria, depois desta.** Para o template e para a apresentação da Arena Belém, o conteúdo entra por seed SQL.

## 6. Fases de implementação

Cada fase termina com `npm test`, `npm run typecheck`, `npm run build` e a verificação visual do §7 verdes. A próxima fase só começa depois disso.

**Fase 0. Preparação**
- Auditoria de RLS (§4.0).
- Script de comparação visual (§7).
- Copiar as fotos usadas no protótipo para `src/public/arenas/arena-belem/`: logo, quadras, estrutura, professores, Instagram e mapa. O template usa `src/public/arenas/exemplo/` com imagens neutras.

**Fase 1. Fundação do template**
- `portal-arena.css` escopado, variáveis de tema por arena (injetadas no `<div class="pa">` a partir de `arenas.tema`, com tema neutro de reserva) e fonte Archivo.
- Componentes base:
  - botões: amarelo, azul, com borda, com borda clara, perigo, link-perigo;
  - ticket com picote e notches;
  - diálogo ticket;
  - diálogo simples / gaveta;
  - aviso (toast);
  - ingresso com canhoto;
  - cartela de carimbos.

**Fase 2. Dados**
- Migrações do §4, RLS, módulos, repositórios e serviços tipados.
- Seed de **arena de exemplo** neutra, que é o template.

**Fase 3. Portal público**
- Topo, menu e scroll spy, Reservar completo, checkout completo (inclusive o modo simulado), Escolinhas, Campeonatos, Clube, Estrutura, Instagram, Contato, rodapé e `/regras`.

**Fase 4. Área do atleta**
- Diálogo de conta com o fluxo de código pelo provedor `demonstracao`.
- `/minha-conta` com as 3 abas.
- Os 3 diálogos simples.
- Pedir vaga depois de entrar.
- Login pelo checkout.
- Redirecionar `/login` e `/cadastro`.

**Fase 5. Backend de demonstração e tempo real** (§1.1 itens 2 e 3; §5.1, §5.2)
- **Código de acesso:** provedor `demonstracao` completo, com as regras de validade, tentativas e limite de envio, e a sessão real no Supabase. O provedor `meta` fica só como interface.
- **Cancelamento:** reembolso simulado gravado no banco.
- **Tempo real no admin:** reservas, pedidos de vaga e Clube, sem mexer no visual do admin.
- **Roteiro da demonstração** (`docs/ROTEIRO_DEMONSTRACAO.md`) e teste ponta a ponta com dois navegadores: atleta reservando e admin vendo na hora.

**Fase 6. Arena Belém (apresentação)**
- Seed `seed-arena-belem.sql` atualizado com:
  - tema;
  - quadras com nomes reais (Areia 1 · Terraço, Areia 2 · Terraço, Areia 3, Campo Society), fotos e enquadramentos do protótipo;
  - preços do seed;
  - escolinhas com turmas;
  - eventos;
  - conteúdo;
  - 8 posts;
  - regras e FAQ.
- Usar os **mesmos dados e fotos do protótipo**. Os dados inventados continuam marcados para confirmar (lista na seção 5 do handoff).
- `modo_pagamento = simulado` e `noindex`.

**Fase 7. Limpeza**
- Apagar os componentes do §3.7, os arquivos `preview-*` de `src/public` (depois de copiar a referência para `docs/referencia-visual/`) e o código morto.

## 7. Como provar que ficou igual

1. **Comparação visual automática:** `tests/visual/` com Playwright (`@playwright/test` como devDependency).
   - Abre o protótipo e a implementação lado a lado, com os mesmos dados (arena de demonstração com o seed da Arena Belém), em **1440×900, 834×1112 e 390×844**.
   - Telas: página inteira (visitante e logado), menu do perfil, menu do celular, cada etapa do checkout, cada passo do diálogo de conta, as 3 abas da conta, os 3 diálogos simples e `/regras`.
   - Compara pixel a pixel com tolerância pequena (só antisserrilhado). Datas, relógio e horários ocupados ficam congelados nos dois lados (relógio fixo do Playwright e semente de ocupação igual).
2. **Checagens automáticas por tela**, iguais às da revisão de 30/10: nenhum erro de console, nenhuma rolagem para o lado, nada fora da tela, nenhum texto cortado, nenhuma imagem quebrada e alvos de toque com 44 px ou mais no celular.
3. **Testes de regra** (Vitest, em `tests/`):
   - seleção de horas seguidas;
   - preço por faixa;
   - antecedência e horário de Belém;
   - estados do horário;
   - cálculo de sinal e hora grátis (teto R$ 100);
   - carimbos e vencimento;
   - reembolso por janela de 24 h;
   - regras do código (validade, tentativas, limite de envio);
   - visibilidade das seções por módulo e dado;
   - capitalização do nome;
   - montagem do .ics.
4. **Lista manual final** com o dono, em celular de verdade.

## 7.1 Branch, commits e progresso (autorizado pelo dono em 30/10/2026)

- **Branch:** todo o trabalho fica em `feat/portal-template`, criado a partir de `feat/mvp-go-live`. O merge para `main` só acontece com pedido do dono.
- **Commits autorizados, sem precisar pedir:**
  - um por fase concluída, sempre com testes, typecheck, build e comparação visual verdes;
  - commits menores dentro da fase, quando um pedaço estável ficar pronto. Isso protege contra parar no meio, por exemplo quando o limite de uso acaba.
- **Mensagem:** no padrão do repositório (`feat(portal): ...`, `fix(portal): ...`, `chore: ...`, `docs: ...`), em português e sem acento, como no histórico.
- **Proibido:** commit com teste quebrado, `--no-verify`, push forçado e reescrever o histórico. Push para o remoto só com pedido do dono.
- **Progresso:** ao fim de cada fase, atualizar a tabela abaixo. Ela é o ponto de retomada se a sessão parar (ao continuar, ler esta tabela e o `git log` primeiro).

| Fase | Situação | Commit | Observações |
|---|---|---|---|
| 0. Preparação | pendente | | |
| 1. Fundação do template | pendente | | |
| 2. Dados | pendente | | |
| 3. Portal público | pendente | | |
| 4. Área do atleta | pendente | | |
| 5. Backend de demonstração e tempo real | pendente | | |
| 6. Arena Belém | pendente | | |
| 7. Limpeza | pendente | | |

## 8. Fora do escopo desta SPEC

- Redesign visual do admin e telas do admin para o conteúdo novo (SPECs próprias).
- Qualquer integração com custo: API do WhatsApp da Meta, gateway de pagamento real e estorno, SMS, API do Instagram.
- Integração automática do Instagram (BACKLOG 13).
- Renomear o código e o repositório para MarcArena (BACKLOG 12).
- Escolher e comprar o domínio.
