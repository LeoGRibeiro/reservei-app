# SPEC: Ajustes do painel para a demonstração (feedback de 02/11/2026)

- **Origem:** teste do dono no localhost depois da revisão (`SPEC/2026-11-02-admin-revisao.md`), com prints.
- **Escopo:** só o que está aqui. "Todo o resto vamos ver depois."
- **Status:** itens 1 a 10 implementados em 02/11/2026 (ver "Execução" no fim).
- **Regras de sempre:** banco local para testes (nunca produção). SQL em migração + `schema.sql` + bloco para o dono colar. Testes, `tsc` e build verdes, validar no navegador (computador e celular 390px). Commit ao fim de cada item, sem push.

---

## 1. Visual: legível, com contraste (não "neutro demais")

**Problema:** textos pequenos e contraste mínimo, difícil de ler (menu, abas, grade, células, legendas).

1. **Tamanho base:** o corpo do painel sobe de `text-sm` (14px) para **16px**.
   - Rótulos de campo: 15px.
   - Texto auxiliar: no mínimo 14px (sem `text-xs` em informação importante).
   - Títulos de página: 24px.
   - Títulos de cartão: 18px.
   - Menu lateral: itens 16px; títulos de grupo 13px, mais escuros.
2. **Contraste** (tokens em `app/(plataforma)/globals.css`, escopo `.painel`):
   - `--painel-suave`: de `#57534e` para algo perto de `#44403c`.
   - `--painel-apagada`: de `#a8a29e` para `#78716c`.
   - Bordas mais visíveis: `--painel-linha` `#d6d3d1`, `--painel-linha-forte` `#a8a29e`.
   - Fundo da página um pouco mais escuro que os cartões, para separar áreas.
   - Meta: contraste AA (4,5:1) em todo texto.
3. **Destaque presente, mas sóbrio:**
   - Menu ativo com faixa/fundo na cor de destaque e texto em negrito.
   - Botões primários maiores (altura 40px).
   - Ainda igual para todas as arenas; só o nome da arena muda.
4. **Grade da Agenda:**
   - Nome do cliente 15–16px em negrito.
   - Status 14px.
   - Células livres com borda tracejada visível.
   - Coluna de hora 14px escura.
   - Legenda com tamanho legível.
5. Conferir com `break-ui`/olho humano em todas as telas (Hoje, Agenda, Detalhe, Clientes, Financeiro, Escolinhas, Grupos, Quadras, Site, Fidelidade, Equipe, Recebimento, Configurações, login).

## 2. Abas com "scroll esquisito"

**Problema:** `Abas` (`components/admin/ui/Estrutura.tsx`) usa `overflow-x-auto` + `-mb-px` e aparece uma barra de rolagem vertical ao lado.
- **Correção:**
  - Sem barra de rolagem: `overflow-hidden` no desktop.
  - No celular, rolagem horizontal escondida (classe `scrollbar-hide`).
  - Sublinhado ativo sem estourar a altura.
- **Onde aparece:** Agenda (Dia/Mês), Escolinhas e qualquer outra tela que usa `Abas`.

## 3. Agenda: bloquear direto no horário vazio

**Hoje:** clicar no horário livre só abre "Nova reserva". Bloquear exige o botão do topo.
- **Depois:** clicar no horário livre abre uma escolha rápida com **Nova reserva** e **Bloquear horário**, as duas já com quadra, dia e hora preenchidos. Pode ser um menu pequeno ancorado na célula ou uma janela com duas opções grandes.
- Manter o botão "Bloquear horário" do topo.
- **Arquivo:** `components/admin/agenda/PaginaAgenda.tsx` (`GradeDia`, `aoClicarLivre`).

## 4. Escolinhas: um cadastro só

**Problema:** as abas "No site" e "Horários na agenda" confundem, e o formulário "Editar Escolinha" (contrato) parece redundante.
- **Regra:** escolinha é **um** cadastro:
  - professor, foto, descrição;
  - turmas com dias, horários, categoria e quadra;
  - "Bloquear na agenda";
  - botão "Quero uma vaga".
  É o formulário `FormEscolinhaSite`.
- **Remover:**
  - a aba "Horários na agenda";
  - `HorariosNaAgenda` em `AdminEscolinhasPage.tsx`;
  - o uso de `ModalEditarContrato`/`FormularioContrato` para escolinha.
- O contrato recorrente continua só como mecanismo interno: `useAgendaEscolinha` cria e encerra os contratos das turmas.
- **Na lista de escolinhas,** cada card mostra as turmas e, por turma, "Na agenda · quadra" ou "Só no site".
- **Migração de dados:** contratos `tipo = 'escolinha'` sem `escolinha_id` (cadastrados no formulário antigo) aparecem num aviso "Horários antigos sem escolinha". Ações:
  - "Ligar a uma escolinha" (vira turma dela);
  - ou "Encerrar".
  Nada some sem o dono decidir.
- Testes: `AdminEscolinhasPage.test.tsx` passa a cobrir uma tela só.

## 5. Escolinhas × Grupos (diferença clara)

- **Escolinha:** aparece no site como "Aula", com card e botão "Quero uma vaga".
- **Grupo:** horário fixo de um grupo, que no site aparece **igual a uma reserva comum ("Ocupado")**, sem dizer o porquê.
- **Fazer:**
  - Conferir `grade_publica`, `mapeadores` e `PortalArena.situacaoDoHorario`: grupo nunca pode virar "Aula" nem mostrar nome.
  - Teste no PGlite e no componente.
  - No painel, a tela Grupos ganha uma frase curta explicando isso.
- **Grupos também sai do formulário antigo:** usar um formulário no padrão novo (`Janela` + `Campo`):
  - nome do grupo, responsável, WhatsApp;
  - quadra, dias, horário;
  - período.

## 6. Todas as janelas fecham com Esc

**Problema:** várias janelas não fecham com Esc.
- **Trocar** por `Janela` (`components/admin/ui/Janela.tsx`, que já trata Esc e clique fora):
  - `FormEscolinhaSite`;
  - `ModalEditarContrato` (sai junto com o item 4);
  - os modais de `AdminQuadrasPage` (nova/editar quadra, tarifa);
  - os modais de `AdminInstitucionalPage`;
  - os `Dialog` de `AdminEquipePage`/`AdminFidelidadePage`, se houver.
- Ou, no mínimo, aplicar o mesmo tratamento.
- **Teste:** um teste por janela apertando Esc.

## 7. Portal do atleta: horários do dia

**Problemas:**
- A lista de horários muda de tamanho conforme a hora (os passados somem).
- Às 12:35, as 13:00 não aparecem para reservar. Por quê: `antecedenciaMinimaMinutos` da Arena Belém = 60, e o aviso diz "Antes das 14:00 já não dá para reservar hoje".

**Fazer:**
1. **Mostrar todos os horários do dia**, sempre na mesma grade. Os que já passaram aparecem desabilitados como "Encerrado". Os que estão dentro da antecedência aparecem como "Indisponível", com o motivo no toque.
   - **Arquivos:** `components/portal-arena/PortalArena.tsx` (`situacaoDoHorario`, `avisoDoDia`) e `lib/portal/agenda.ts`.
2. **Antecedência:** às 12:35, as 13:00 devem estar reserváveis.
   - Padrão de antecedência = **0** ("até o horário começar"), ajustável em Configurações com explicação clara ("Quanto tempo antes do horário o site para de aceitar reservas").
   - Seed da Arena Belém com 0.
   - Conferir que o checkout (`checkoutServidorService.validarCalendario`) usa a mesma regra.
3. Testes da regra (horário passado, dentro da antecedência, liberado).

## 8. Quadras: o que o site mostra, o painel edita

**O site mostra por quadra:**
- nome ("Areia 1 · Terraço");
- linha de esportes ("Beach tennis", "Futevôlei, vôlei e beach tennis");
- **foto**;
- preço "R$ 80 de dia · R$ 100 à noite";
- grade de horários.

**Fazer:**
1. **Tirar** "coberta" e "iluminação" do formulário e dos cards. As colunas ficam no banco, sem uso no painel.
2. **Foto da quadra** no cadastro e na edição: upload como nas escolinhas (bucket existente), posição/recorte (`foto_posicao`) e texto alternativo (`foto_descricao`). As colunas já existem em `quadras`.
3. **Editar tarifa** (hoje só cria e exclui): nome, dias, início, fim e valor. Explicar como vira "de dia/à noite" no site.
4. **Bloquear a quadra inteira:** de uma data até outra (ou "até eu liberar"), com motivo (reforma, evento).
   - **Implementação sugerida:** criar bloqueios (`manutencao_bloqueio`) em todos os horários do período. Avisar e listar se houver reservas no caminho.
   - **Alternativa:** coluna `bloqueada_ate` + `motivo_bloqueio`, conferida no checkout e na grade pública. Decidir na implementação; a trava do banco continua valendo.
5. Conferir mais algum campo do site sem edição no painel: ordem das quadras e texto de esportes. Tudo que o site mostra da quadra precisa ser editável.

## 9. Site: só o que aparece em "Estrutura"

**Problemas:**
- As categorias e a descrição da foto não fazem sentido para o dono.
- **Erro ao enviar foto nova** (reproduzir e corrigir: bucket, RLS do storage, tamanho ou tipo).
- Não há onde editar os tópicos "Na arena" ("3 quadras de areia tratada", "Iluminação de LED"...). Eles vêm de `arena_conteudo.destaques_estrutura` (`lib/portal/mapeadores.ts:133`).

**Fazer:**
1. Tela **Site** simplificada em dois blocos:
   - **Fotos da estrutura:** enviar, trocar, reordenar, ocultar, excluir e legenda curta (só se o site mostrar).
   - **"Na arena":** lista editável de tópicos (destaque em negrito + complemento), com adicionar, editar, reordenar e excluir, gravando em `arena_conteudo.destaques_estrutura`.
2. Remover a categoria do formulário; o site não precisa dela, ou usar um valor fixo.
3. Corrigir o upload, com teste.

## 10. Fidelidade: voucher com aprovação do dono

**Hoje:** bateu a meta, o voucher é gerado automático.
- **Depois:**
  - Bateu a meta, o pedido entra **"em análise"**.
  - O dono (ou gerente) vê a fila na tela Fidelidade (e um aviso em Hoje) e **libera** ou **recusa** com motivo.
  - Só depois de liberado o atleta vê o voucher no Clube.
- **Banco:**
  - status do voucher `em_analise` / `liberado` / `recusado`, mais `analisado_por`, `analisado_em` e `motivo`;
  - ou tabela de pedidos.
  - Ajustar `fidelidadeServidorService`/sincronização para não liberar sozinho.
- **Portal:** o Clube mostra "Sua hora grátis está em análise pela arena".
- **Regra de meta** (10 horas é pouco): **depois** (BACKLOG).

---

## Ordem sugerida (para a demonstração)

1. Itens 1 e 2: visual e abas (afetam tudo).
2. Item 6: Esc em todas as janelas.
3. Item 7: horários do portal (o atleta vê na demo).
4. Item 3: bloquear direto na grade.
5. Itens 4 e 5: escolinhas num cadastro só; grupos como "Ocupado".
6. Item 8: quadras.
7. Item 9: Site/Estrutura.
8. Item 10: voucher com aprovação.

## Prompt de execução (sessão nova)

```
Leia AGENTS.md, src/AGENTS.md, SPEC/2026-11-02-admin-revisao.md e SPEC/2026-11-02-admin-ajustes-demo.md.
Execute os itens da SPEC 2026-11-02-admin-ajustes-demo.md na ordem sugerida, um commit por item (sem push).
Banco só local (tests/supabase-local, porta 54330; dono dono@teste.local / senha-teste-123); nunca produção.
Migração + schema.sql + SQL para eu colar quando mexer no banco. Testes, tsc (em src/) e build verdes;
valide cada tela no navegador (1440px e 390px) e mostre prints. Feche com a "🔍 Análise Crítica do Claude".
```


---

## Execução (02/11/2026)

| Item | Commit | Resumo |
|---|---|---|
| 1 e 2 | `07d43f6` | Escala de texto no escopo `.painel` (corpo 16px, mínimo 14px), tokens AA, menu ativo com faixa, botões 40px, grade da Agenda maior; abas com sublinhado por sombra (sem `-mb-px`), `scrollbar-hide` |
| 6 | `9955f7e` | Escolinha, contrato, quadra, tarifa e foto do site na `Janela` (Esc e clique fora) |
| 7 | `4217489` | Grade do dia sempre completa (Encerrado / Indisponível com motivo); antecedência padrão 0; corrigido `\|\| 60` que transformava 0 em 60; migração `e` |
| 3 | `e6307d6` | Escolha rápida no horário livre: Nova reserva ou Bloquear horário, já preenchidos |
| 4 e 5 | `f9e5d37` | Escolinha num cadastro só; contratos casados com as turmas por escolinha + dias + horário; aviso "Horários antigos sem escolinha" (Ligar / Encerrar); Grupos com `JanelaGrupo` e frase "aparece como Ocupado"; `grade_publica` testada no PGlite |
| 8 | `d1facf5` | Quadras: foto (envio, enquadramento, descrição), tarifa editável com efeito no site, ordem, sem coberta/iluminação; fechar a quadra por período ou "até liberar" (decisão: **colunas** `bloqueio_*` + trigger no banco, não bloqueios por horário); migração `f`; Storage no Supabase local |
| 9 | `6b0ef7d` | Site em dois blocos (Fotos da estrutura e "Na arena"); envio reduz fotos grandes e converte HEIC; erros do Storage traduzidos |
| 10 | `d948ddb` | Voucher `em_analise` → liberar/recusar (dono ou gerente) pela rota do servidor; equipe só lê vouchers; Clube mostra "em análise"; migração `g` |

**Causa do "erro ao enviar foto" (item 9):** o Supabase local de testes não tinha Storage (todo envio no localhost falhava). Em produção, as causas prováveis eram foto de celular acima de 5 MB e HEIC do iPhone; as duas passam a ser tratadas no navegador antes do envio.

**Migrações a aplicar em produção, nesta ordem:** `2026-11-02-e-antecedencia-zero.sql`, `2026-11-02-f-quadra-fechada.sql`, `2026-11-02-g-voucher-aprovacao.sql`.
