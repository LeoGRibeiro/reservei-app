# Escolinhas do site gerenciadas pelo painel (31/10/2026)

## Problema
O site novo lia as escolinhas de `landing_page_schools`, mas o painel ("Institucional & LP → Escolinhas") derivava a vitrine dos contratos da agenda (`contratos_recorrentes`) e nunca gravava nessa tabela. O dono não conseguia alterar o que aparecia no site.

## Decisão
`landing_page_schools` é a vitrine oficial da escolinha no site e é editada pelo painel. Os contratos da agenda continuam sendo os horários que ocupam quadra (aba "Escolinhas" da agenda). O vínculo opcional entre eles é `contratos_recorrentes.escolinha_id`.

## Campos (o que o dono preenche)
| Campo | Coluna | Regra |
|---|---|---|
| Esporte * | `sport_name` | Entra na mensagem pronta |
| Nome da escolinha | `nome` (nova) | Título do card; vazio = esporte. Até 60 caracteres |
| Professor * | `teacher_name` | Gravado sem "Prof." (o site escreve) |
| Foto do professor | `teacher_image_url` | Opcional (silhueta padrão); upload no bucket `institucional` |
| Descrição | `descricao` | Opcional |
| Turmas * | `turmas` (JSON `{dias, horas, nivel}`) | De 1 a 12; dias e horários obrigatórios, categoria opcional. `schedule_info` guarda o resumo |
| Botão | `botao_tipo` (nova) | `whatsapp` ou `link` |
| WhatsApp | `whatsapp_number` | Opcional; vazio = WhatsApp da arena; gravado com 55 |
| Mensagem pronta | `mensagem_whatsapp` (nova) | Vazia = padrão: "Olá! Vim pelo site e quero uma vaga no [esporte] com o Prof. [professor]. Pode me passar os valores e as vagas das turmas?". Igual à padrão é gravada vazia (acompanha mudanças). Até 500 caracteres |
| Link | `botao_url` (nova) | Obrigatório quando o botão é de link; só `https://` (o banco recusa `javascript:` e `http`) |
| Posição / Mostrar no site | `ordem` / `is_active` | |

## Segurança
- RLS existente: leitura pública das escolinhas ativas; escrita só pela equipe da arena (`arena_usuarios`).
- `CHECK` no banco para tipo do botão, https e tamanhos (`landing_page_schools_botao_check`, `_textos_check`).
- O repositório filtra sempre por `arena_id` da arena ativa, além da RLS.

## Implementação
- Migração `src/lib/supabase/migracoes/2026-10-31-escolinhas-site.sql` (também no `schema.sql`).
- Regras puras: `lib/institucional/escolinhasSite.ts`. Repositório: `lib/supabase/escolinhasSiteRepository.ts`. Hook: `hooks/useEscolinhasSite.ts`.
- Painel: menu **Escolinhas** (`AdminEscolinhasPage`), aba **No site** = `components/admin/institucional/AbaEscolinhasSite.tsx`; aba **Horários na agenda** = contratos e `FormEscolinhaSite.tsx` (explicação em cada campo, prévia "Testar no WhatsApp").
- Site: `mapearEscolinha` calcula `titulo` e `hrefBotao`; `SecaoEscolinhas` só exibe.
- O seed da Arena Belém não cria mais reservas nem contratos (agenda começa vazia). A ocupação do protótipo ficou em `tests/supabase-local/cenario-ocupacao.sql`, só para os testes visuais.

## Fora do escopo (BACKLOG)
- Escolher no contrato da agenda a escolinha do site (`escolinha_id`), para a aula na grade levar ao card.
- Painel para Estrutura, Campeonatos e Instagram (por enquanto, dados fixos do seed).
