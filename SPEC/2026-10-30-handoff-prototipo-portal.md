# Handoff: protótipo do portal da Arena Belém (continuação)

> Documento de passagem entre sessões. Atualizado em 30/10/2026.
> Spec de origem: `SPEC/2026-10-29-redesign-portal-arena-belem.md`.
> **Protótipo aprovado em 30/10/2026.** O plano de implementação está em `SPEC/2026-10-30-implementacao-template-portal.md`.

## 1. Regra estrita desta etapa

**Não editar nenhum componente de produção, hook, serviço ou banco de dados.** Tudo acontece no protótipo estático até o dono do projeto aprovar o visual. O protótipo provavelmente não vai para o repositório. Ele serve de referência visual para a implementação real.

## 2. Como abrir

1. `cd src` e `npm run dev`.
2. Abrir http://localhost:3000/preview-portal.html.

**Armadilha conhecida:** o `src/proxy.ts` trata `/pasta/arquivo.js|css|pdf|woff2` dentro de `public/` como se a pasta fosse uma arena e devolve um 301 para `pasta.localhost`. Por isso o Lenis está em `/preview-lenis.min.js`, na raiz de `public`, e o CSS fica dentro do HTML. Imagens (`.jpg`, `.png`) em subpastas funcionam normalmente.

## 3. Arquivos

| Arquivo | O que é |
|---|---|
| `src/public/preview-portal.html` | **O protótipo atual**, com cerca de 3240 linhas. HTML, CSS e JS num arquivo só. O CSS de cada rodada fica num bloco próprio no fim do `<style>` ("Rodada 4", "Rodada 5"), fácil de reverter. Cópia de antes da rodada 5 no scratchpad da sessão de 30/10. |
| `src/public/preview-portal-regras.html` | Página separada de Regras e dúvidas (regras, cancelamento e chuva, FAQ em `<details>`). Mesmo topo azul e mesmo Lenis. **Sem termos de uso** (decisão de 30/10). |
| `src/public/preview-lenis.min.js` | Lenis 1.3.26, copiado de `node_modules`. |
| `src/public/preview-redesign/real/` | Fotos reais: `logo.png` (recortada, "ARENA" branco), `areia-lounge.jpg`, `aula-beach.jpg`, `bar-corredor.jpg`, `society.jpg`, `society-bar.jpg`, `professores.png` (foto dos 7 professores) e `prof-{beach,futevolei,volei,falcao}.png` (recortes 220×275). |
| `src/public/preview-ideias.html`, `preview-redesign.html`, `preview-redesign/` | Rodadas anteriores, rejeitadas. Servem só de histórico. |

## 4. O que já está aprovado no protótipo

**Topo**
- Azul-marinho e fixo.
- Logo do escudo e o nome "Arena Belém" na fonte padrão da página (Archivo 700). O usuário testou 9 fontes alternativas e **mandou reverter**.
- Menu **centralizado** a partir de 1100px: Reservar, Escolinhas, Estrutura, Contato.
- Visitante vê "Entrar / Criar conta". Cliente logado vê "Minhas reservas" e o avatar com menu (carimbos do Clube 6/10, voucher, links, Sair).
- Abaixo de 1100px, o menu vira o botão de três linhas.
- A barra escura do protótipo, acima do topo, tem a alternância "Visitante / Cliente logado".

**#reservar**
- Título "Reserve sua quadra".
- Fichas de data com até **31 dias à frente**, marcadores de mês ("out", "nov") e setas.
- Legenda: Livre, Selecionado, Ocupado e Aula.
- 4 cards de quadra com foto e **todos os horários e preços visíveis**, separados em Manhã, Tarde e Noite, sem clique extra.
- Ticket de papel fixo na lateral (azul, com picote).
- O mural **"Partidas procurando jogadores"** fica recolhido em `<details>`, embaixo do ticket (no celular, depois das quadras). **Nunca mostrar quantas vagas** a partida tem. Horários com partida aberta aparecem como "Ocupado".
- O respiro até a seção seguinte é de `padding-bottom: 56px`. Já foi testado: 64px ficou grande demais e 8px pequeno demais.

**#escolinhas** (azul, **antes** de Estrutura, porque é mais rentável para a arena)
- Grade de 2 colunas no desktop. Abaixo de 960px vira 1 coluna.
- Cada escola tem:
  - Foto retangular do professor, 104×130, com cantos de 12px e **borda amarela de 1.5px**.
  - Nome do esporte e, embaixo, o **nome do professor**.
  - Uma descrição curta.
  - A tabela de turmas (dia, horário e nível).
  - O botão "Quero uma vaga", logo abaixo das turmas.
- **Sem preço.** O valor é informado pelo WhatsApp.
- Divisória suave entre as escolas (`1px rgba(255,255,255,.12)`).
- Mensagem do WhatsApp: "Olá! Vim pelo site e quero uma vaga no {esporte} com o Prof. {nome}. Pode me passar os valores e as vagas das turmas?"

**#estrutura**
- Bento com fotos reais e a lista "Na arena".

**#contato**
- Mapa OSM em escala de cinza, com pino.
- Endereço: Av. Roberto Camelier, 580, Jurunas, Belém, esquina com a Rua dos Caripunas.
- Botão do Google Maps aponta para a **página da Arena Belém**: `https://www.google.com/maps/place/Arena+Bel%C3%A9m/@-1.4663397,-48.4906044,17z/data=!4m6!3m5!1s0x92a48f48ea496ed7:0x16dca8251ba0b465!8m2!3d-1.4663397!4d-48.4906044`.
- Botão do Waze vai para as coordenadas `-1.4663397,-48.4906044`.
- Tabela de dados, políticas e WhatsApp (91) 98498-2865.

**Checkout**
- `<dialog>` em forma de ticket de papel, com resumo azul e canhoto.
- Passos: dados → Pix (QR, 10 minutos, copia e cola, simular) → confirmada (carimbo, `.ics`, carimbos do Clube ou criar conta).

**Comportamento**
- Lenis com a mesma configuração do `SmoothScrollProvider` de produção: duration 0.85, wheelMultiplier 1.35, touchMultiplier 1.8, easing expo.
- Âncoras usam `lenis.resize()` antes de `scrollTo`.
- **Nenhuma animação nova.** Só são aceitos hover de cor e `scale(.97)` no clique.

## 5. Dados inventados que a arena precisa confirmar

**Beach tennis** (Prof. Italo Bianck, nome real)
- Seg e Qua 16h, avançado: real, do panfleto.
- Ter e Qui 7h e 8h, iniciante: inventado.
- Ter e Qui 19h, intermediário: inventado.

**Futevôlei**
- Os horários são reais, do panfleto.
- O professor "Diego Moraes" foi **inventado**.

**Vôlei**
- Sábado 9h, 10h e 11h: real, do panfleto. O nível "Livre" foi inventado.
- Seg e Qua 19h e Ter e Qui 20h: inventados.
- O professor "Lucas Andrade" foi **inventado**.

**CT Falcão 12**
- Ter e Qui 8h e 9h (6 a 10 anos), Ter e Qui 16h (11 a 14 anos) e Sábado 8h (todas as idades): inventados.
- O professor "Marcos Falcão" foi **inventado**.

**Professores e textos**
- Não se sabe qual rosto da foto do grupo corresponde a qual escola. A associação foi inventada.
- As 4 descrições das aulas foram inventadas.

**Rodada 4 (30/10/2026): tudo inventado, confirmar com a arena**
- Instagram: o @ `arenabelem` vem do comentário do `seed-arena-belem.sql` e não foi conferido no app. "312 posts" e "4.120 seguidores" são simulados. As 8 legendas e datas são inventadas, e os posts usam as fotos de `real/`.
- Campeonatos "rolando agora": Copa de Outubro de Beach Tennis, semifinais às 15h e 16h e final às 18h de 31/10, na Areia 3. Os nomes das duplas foram tirados do seed.
- Inscrições abertas:
  - Open de Beach Tennis em 21 e 22/11: R$ 120 por dupla, até 32 duplas, prazo 17/11, com formulário.
  - Rei e Rainha do Futevôlei em 5/12: R$ 60 por atleta, até 24 atletas, prazo 1/12, pelo WhatsApp.
  - Resenha de fim de ano em 18/12, às 19h: entrada com 1 kg de alimento.
- Já aconteceu:
  - Copa Society de Setembro (27/09): Resenha FC 4 × 2 Amigos do Jurunas.
  - Futevôlei do Dia dos Pais (09/08): Diego Pinheiro e Lucas Moraes, 18 × 15.
  - Arraiá do Beach Tennis (27/06): Juliana Costa e Vanessa Cruz, 6/3, categoria D.
- Clube: a regra vem do seed (10 horas, carimbo vale 3 meses, voucher vale 60 dias). O teto de R$ 100 do voucher e o histórico do Rafael (3 × 2h) são do protótipo.
- Página de Regras: as 6 regras, a FAQ de aluguel de raquete ("as bolas ficam na quadra, raquete se aluga no bar") e o texto de termos/LGPD foram inventados. A política de cancelamento é a do seed.

**Sistema real da arena** (diferente do seed)
- Quadras: "Areia 1 Terraço", "Areia 2 Terraço" e "Areia 3".
- R$ 110 das 20h às 00h.
- Falta confirmar quais quadras são cobertas.

## 6. Seções da rodada 4 (feitas em 30/10/2026, aguardando aprovação visual)

**Estado:** as 5 seções abaixo já estão no protótipo e foram validadas no Playwright a 1440, 834 e 390px, sem erro no console e sem rolagem horizontal. A ordem ficou Reservar → Escolinhas → Campeonatos e eventos → Clube → Estrutura → Instagram → Contato → Rodapé. O menu do topo continua com 4 itens. Nas seções fora do menu, nenhum link fica marcado no scroll spy.

O que existe em cada uma:
- **Instagram (`#instagram`):** cabeçalho de perfil (@, contagem simulada, "Seguir") e grade de 8 posts no desktop e 6 no celular, com post fixado e ícones de Reels e carrossel. **Removidos a pedido do usuário (30/10):** o filtro por tema, o link "Ver todos os posts no Instagram" e a variante "Só Reels" com a sua faixa de alternância. Fica só a grade.
- **Avaliar no Google:** terceiro botão em Contato. Aponta para a página do Maps até o Place ID ser descoberto (há um comentário no HTML).
- **Regras e dúvidas:** sem seção no portal. Há 3 links discretos: embaixo do ticket (só no desktop), em Contato e no rodapé. Todos levam a `preview-portal-regras.html`.
- **Clube (`#clube`):** 3 passos e uma cartela de 10 casas no estilo do ticket (topo azul, papel, picote, canhoto azul).
  - Visitante: casas vazias e o botão "Criar conta e começar a juntar".
  - Logado: 6 carimbos com o escudo, os últimos carimbos e o voucher com o botão "Usar na próxima reserva", que marca o voucher e rola até Reservar.
  - Um pagamento simulado soma carimbos na cartela.
- **Campeonatos (`#eventos`):** card azul "Rolando agora" com a chave (semis e final), ingressos com o canhoto da data em "Inscrições abertas" e uma galeria "Já aconteceu" (no celular, vira faixa rolável).

As notas abaixo (6.1 a 6.6) guardam as decisões originais de cada seção. A parte **"Na produção"** do Instagram continua pendente: escrever a SPEC só depois da aprovação visual.

**Referência:** o site atual em produção, https://dsai-ap1-reservei-jykz9j1rz-leo-gr-ibeiro.vercel.app/. Abrir com o Playwright e listar todas as seções e dados que ele tem e o protótipo ainda não tem.

As decisões e dúvidas do usuário, item por item:

### 6.1 Instagram (FOCO PRINCIPAL)

O usuário quer **integração real com o Instagram**, mostrando os posts da arena e "sei lá mais o quê". Cabe ao Claude propor o que mais faz sentido.

**Decisão de 30/10/2026: no protótipo, tudo é simulado (mock).** O usuário ainda não sabe como funciona a integração real. A sessão deve explicar o funcionamento em linguagem simples, como na seção "Na produção" abaixo, antes de propor qualquer coisa de produção.

As imagens do mock podem vir de duas fontes:
- **Preferida:** o usuário salva de 6 a 9 imagens de posts reais do Instagram da arena em `src/public/preview-redesign/real/insta/`. Imagem colada no chat não fica salva em disco.
- **Enquanto isso:** usar as fotos que já estão em `preview-redesign/real/`.
- **Não baixar imagens do Instagram automaticamente com scraping.** Isso viola os termos de uso e quebra com facilidade.

**No protótipo:**
- Uma grade de posts recentes com dados simulados: imagem, legenda curta, ícone de vídeo/Reels e data.
- Cada post leva ao link original.
- Cabeçalho com @ da arena, contagem de seguidores (marcada como simulada) e o botão "Seguir no Instagram".

**Ideias extras para propor:**
- Destaque para Reels.
- Filtro por tema: torneios, aulas, estrutura.
- Post fixado.

**Na produção** (escrever na SPEC depois da aprovação visual):
- Usar a Instagram API with Instagram Login. A conta precisa ser profissional (Business ou Creator). A Basic Display API foi descontinuada.
- **Conferir a documentação atual da Meta antes de especificar.**
- Endpoint típico: `GET /me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp`.
- Token de longa duração (cerca de 60 dias), renovado automaticamente por cron.
- Token guardado só no servidor, por arena (`arena_id`), sem expor ao cliente, com RLS.
- Cache no servidor (revalidate de 1h ou mais) para não estourar o limite de chamadas da API.
- Se a API falhar, mostrar só o botão "Siga @arena no Instagram", sem quebrar a página.
- Onboarding: o Super Admin ou o dono da arena conecta a conta pelo painel (OAuth da Meta).
- Isso exige um app na Meta, que é uma ação manual do usuário. Explicar passo a passo.
- **Conferido na documentação da Meta em 30/10/2026:**
  - Token de 1h trocado por um de 60 dias (`ig_exchange_token`) e renovado com `refresh_access_token`. A renovação só funciona com o token tendo pelo menos 24h e ainda válido, e tem que rodar no servidor, porque usa o segredo do app.
  - Com Standard Access, só funcionam contas que têm papel no app (admin, dev ou tester). Para atender contas de terceiros (as arenas) é preciso Advanced Access, com App Review e Business Verification.
- **A confirmar antes da SPEC:**
  - A `media_url` do Instagram expira. Por isso o cache precisa ser curto ou as imagens precisam ser copiadas para o Storage.
  - A API não diz qual post está fixado nem traz os Destaques, então "fixado" seria escolha da arena no painel.
- Descobrir o @ real da arena no site atual.

### 6.2 Avaliações do Google

**Decidido em 30/10/2026:** sem seção própria e sem mostrar avaliações. Entra **só o botão "Avaliar no Google"** dentro de #contato, junto dos botões Maps e Waze.

- O botão abre `https://search.google.com/local/writereview?placeid=<PLACE_ID>`.
- O Place ID (formato `ChIJ...`) é diferente do CID que aparece na URL do Maps. É preciso descobrir o Place ID com o Place ID Finder do Google.
- Enquanto o Place ID não for descoberto, o botão aponta para a página da arena no Maps (link da seção 4), onde também há o botão de avaliar.
- **Futuro, já no `BACKLOG.md`:** levar o botão para outros lugares do app, como depois de uma reserva concluída.

### 6.3 Termos, regras e FAQ

**Não viram seção.** Basta um botão ou link num lugar discreto (rodapé e/ou perto do checkout, como "Regras da arena") que leva a uma **página separada**.

No protótipo, isso pode ser:
- Um segundo HTML, `preview-portal-regras.html`, na raiz de `public`.
- Ou um `<dialog>` grande.

A página deve ter o FAQ em `<details>`.

### 6.4 Fidelidade (Clube Arena Belém)

**Vai ter seção.**

- **Regra do seed:** a cada 10h jogadas, o cliente ganha um voucher.
- **O que mostrar:**
  - Como funciona, em 3 passos.
  - Cartela de carimbos visual (10 casas), com o mesmo estilo do ticket de papel.
  - Para o visitante: CTA "Criar conta e começar a juntar".
  - Para o logado: progresso real (6/10) e voucher disponível.
- **Usar a alternância Visitante/Logado** que já existe na barra do protótipo.

### 6.5 Campeonatos e eventos

**Vai ter seção.** Três blocos:
- **Inscrições abertas e próximos:** data, modalidade, categoria, valor da inscrição e vagas, se fizer sentido. O botão "Inscrever-se" abre o link do formulário quando existir, senão abre o WhatsApp com mensagem pronta para inscrição.
- **Rolando agora:** destaque com chave ou fase atual, se houver.
- **Passados:** galeria ou lista com campeões, fotos e placar final.

Os dados serão inventados no protótipo e listados para confirmação.

### 6.6 Ordem sugerida das seções (validar com o usuário)

Reservar → Escolinhas → Campeonatos e eventos → Clube (fidelidade) → Estrutura → Instagram → Contato (com o botão "Avaliar no Google") → Rodapé (links Termos, Regras e FAQ).

**Menu do topo (revisto em 30/10/2026):** Reservar, Escolinhas, **Campeonatos**, Estrutura e Contato, na ordem da página. Clube, Instagram e Regras **não entram no menu**. O `SECOES` do scroll spy tem essas 5 âncoras.

**Regras e dúvidas (revisto em 30/10/2026):** o link discreto ficou escondido demais. Uma faixa azul própria antes de Contato foi testada e **rejeitada**. Ficou **só no rodapé**: a coluna "Ajuda" abre com o botão em destaque "Regras e dúvidas", seguido de Cancelamento e chuva e Perguntas frequentes (o link "Termos de uso" saiu na rodada 5), que levam às âncoras da página separada. As colunas do rodapé têm título (Na página, Ajuda, Contato). O link pequeno em Contato saiu; o link embaixo do ticket continua.

## 6.7 Rodada 5: área do atleta (feita em 30/10/2026, aguardando aprovação visual)

Tudo fica dentro do `preview-portal.html`, para os dados circularem de verdade: uma reserva paga entra em Minhas reservas, os carimbos somam no Clube e o pedido de vaga feito no mural aparece na conta.

**Entrar e criar conta (revisto em 30/10: código no WhatsApp, sem senha).** É um diálogo no mesmo formato de ticket do checkout. O lado azul lista as vantagens da conta e mostra uma cartela de exemplo. O fluxo tem dois passos:
- **Passo 1, conforme o caso:**
  - Entrar: só o WhatsApp.
  - Criar conta: nome, WhatsApp e nascimento (opcional).
  - Depois de reservar sem conta: "Confirme o seu WhatsApp", com os dados da reserva já preenchidos.
- **Passo 2:** "Digite o código", com uma prévia da mensagem da MarcArena no WhatsApp, o campo de 6 números (`autocomplete="one-time-code"`), "Reenviar em 0:30" e "Trocar número".
- **Fora do protótipo:** senha, "Esqueci minha senha", senha temporária, aviso de troca de senha e cartão "Trocar senha". Em Meus dados, entrou o cartão "Como você entra", com "Sair de todos os aparelhos".
- **Só visual:** qualquer código de 6 números funciona. A implementação real está no item 14 do `BACKLOG.md`.
- **Ação pendente continua depois de entrar:** quem pede vaga no mural como visitante entra, e o pedido segue sozinho.

**Minha conta.** O endereço é `#minha-conta`, e cada aba tem o seu (`/clube`, `/dados`). O topo mostra o nome, o WhatsApp e três fichas de resumo: próximo jogo, carimbos e horas grátis. São 3 abas:
- **Reservas:**
  - Cada próximo jogo é um ingresso com canhoto azul (data e hora). Mostra os valores, com destaque amarelo para "Pagar na arena", e o estado do mural (procurando jogadores, pedidos novos ou partida completa).
  - Botões: Adicionar à agenda, Falar com a arena e Cancelar reserva.
  - O histórico mostra "Jogou" ou "Cancelada" e tem o link "Reservar de novo", que abre o próximo dia igual da semana já na quadra certa.
  - Na lateral ficam "Pedidos para jogar" e "Precisa mudar algo?".
- **Clube:** cartela grande, horas grátis com código (`CLUBE-7Q4M`, botão Copiar e validade), aviso de vencimento dos carimbos (3 meses) e histórico de carimbos.
- **Meus dados:** dados com "Editar", troca de senha, "Falar com a arena" e "Sair".
- **Sem LGPD, termos, privacidade nem "Excluir conta"** (decisão de 30/10). Isso já existe em produção, em `/termos`, `/privacidade` e na aba Privacidade & Exclusão.

**Diálogos simples** (topo azul e corpo de papel; no celular abrem por baixo, como gaveta):
- **Cancelar reserva:** mostra o resumo e a consequência certa. Com mais de 24 horas, o valor pago é **reembolsado direto no Pix** (decisão de 30/10: não existe crédito para remarcar). Com menos, o valor não é devolvido.
- **Procurar jogadores:**
  - Para publicar: escolher quantos jogadores faltam (o número não aparece no mural) e marcar o termo do organizador.
  - Com a partida publicada: lista de pedidos com "Chamar" (WhatsApp com a mensagem pronta) e "Combinado".
  - Quando completa, a partida sai do mural sozinha.

**Outras ligações:**
- "Sua reserva" na grade de horários abre a reserva na conta.
- A partida do próprio atleta aparece no mural como "sua partida", com o botão "Ver pedidos".
- O menu da conta tem os links Minhas reservas, Meu Clube e Meus dados.
- No menu do celular, a área do visitante tem Criar conta e Entrar.
- A barra do protótipo "Cliente logado" sempre volta para o Rafael. "Criar conta" cria um cliente novo e vazio, para mostrar os estados vazios.
- Uma conta nova vem com o nome capitalizado ("marina de souza" vira "Marina de Souza").

**Rodapé:** "Reservas online com **MarcArena** · tenha um site assim na sua arena" leva à página comercial de produção (`/para-arenas`). **Confirmado em 30/10:** MarcArena é o novo nome do Reservei. Falta definir o domínio.

**Dados inventados da rodada 5:**
- Nascimento do Rafael: 12/03/1994.
- Reservas do Rafael:
  - K7P2: amanhã, 19h às 21h, Areia 2. Pagou o sinal e está no mural com 3 pedidos (Lucas, Camila, Diego).
  - M3XQ: daqui a 6 dias, 20h, Society. Tudo pago.
  - Histórico de 4 reservas (uma cancelada).
- Código do voucher: `CLUBE-7Q4M`.
- Regra de cancelamento (decidida em 30/10): com mais de 24 horas, reembolso direto no Pix; com menos de 24 horas, sem devolução; chuva forte, a arena remarca sem custo. Em produção, o estorno precisa da integração com o gateway (ver BACKLOG, item "Política de reembolso no cancelamento pelo atleta").

## 7. Jeito de trabalhar que o usuário aprovou

- Responder em português.
- Terminar sempre com **"🔍 Análise Crítica do Claude (Alternativas & Questionamentos)"**.
- Ações manuais em painéis externos (Meta, Google, Vercel) são explicadas passo a passo, com onde clicar.
- O usuário prefere **ver várias opções rápidas** a poucas muito elaboradas. Quando estiver em dúvida, mostrar alternativas lado a lado ou com um botão de alternância no protótipo.
- Pode inventar dados para preencher, mas sempre listá-los para confirmação. Nunca inventar prova social (avaliações, números de clientes).
- Verificar com o Playwright a 1440, 834 e 390px: sem erro no console e sem rolagem horizontal. Mostrar o resultado antes de responder.
- Ajustes pequenos podem ser feitos direto. Mudanças grandes de layout precisam de um print para o usuário aprovar.
- O usuário reverte o que não gosta. Manter as mudanças fáceis de desfazer.
- Não gerar comandos de commit sem pedido.

## 8. Prompt para colar na próxima sessão

```
Vamos continuar o protótipo do portal da Arena Belém. Leia primeiro
SPEC/2026-10-30-handoff-prototipo-portal.md (estado atual, decisões aprovadas,
dados inventados e próximos passos) e SPEC/2026-10-29-redesign-portal-arena-belem.md.

Regra estrita: NÃO edite nenhum componente de produção, hook, serviço ou banco.
Trabalhe só em src/public/preview-portal.html (e arquivos de preview em src/public).

Tarefa desta sessão: adicionar ao protótipo as seções que faltam, comparando com
o site atual (https://dsai-ap1-reservei-jykz9j1rz-leo-gr-ibeiro.vercel.app/):
1. Instagram (foco principal): seção MOCKADA no protótipo (grade de posts, @,
   botão Seguir). Me explique em linguagem simples como funciona a integração
   real (conta profissional, app na Meta, token, cache) e proponha extras além
   dos posts. Se eu tiver salvo imagens em src/public/preview-redesign/real/insta/,
   use-as; senão, use as fotos que já existem em preview-redesign/real/.
2. Avaliações do Google: SÓ o botão "Avaliar no Google" dentro de Contato, junto
   de Maps/Waze. Sem seção e sem listar avaliações.
3. Termos, regras e FAQ: sem seção — só um link discreto para uma página separada.
4. Fidelidade (Clube Arena Belém): seção com cartela de carimbos, respeitando o
   modo Visitante/Logado do protótipo.
5. Campeonatos e eventos: próximos/inscrições abertas (botão para formulário ou
   WhatsApp), rolando agora e passados (campeões, fotos).
O menu do topo NÃO muda: continua só Reservar, Escolinhas, Estrutura e Contato
(as seções novas não entram no menu). Valide no Playwright em 1440/834/390.
```
