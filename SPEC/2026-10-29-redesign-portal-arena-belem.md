# SPEC: Redesign Visual do Portal (Anti-Vibecode) & Vitrine Completa da Arena Belém

- **Data:** 29/10/2026
- **Autor:** Antigravity (CTO / Arquiteto Principal)
- **Implementador:** Claude (Engenheiro Full Stack & Design Engineer)
- **Skills Ativas Recomendadas:** `design-taste-frontend` + `impeccable` (Direção de Arte e Layout) + `emil-design-eng` (Movimento, Micro-interações e Acabamento) + `Playwright MCP` (Inspeção Visual no Navegador)
- **Status:** Aprovado para Implementação

---

## 1. Diagnóstico Técnico & Visual (O que deu errado na versão anterior)

### 1.1. Por que várias seções sumiram na página da Arena Belém?
Nos commits `5abac9a` e `2ab2bca`, foram adicionadas travas em `src/components/portal/PortalCliente.tsx`:
```tsx
const temFotosEstrutura = galeria.some((foto) => foto.isActive !== false);
const exibirEscolinhas = temEscolinhas && escolinhasAtivas.length > 0;
```
Ao mesmo tempo, no arquivo `src/lib/supabase/seed-arena-belem.sql`, **não foram populadas fotos na tabela `galeria_estrutura`** e **foram removidas as escolinhas** da `arena-belem`.
Como consequência:
1. A seção **"O Local e Estrutura"** (fotos das quadras, bar, vestiários e área de lazer) desapareceu completamente da página e do menu de navegação.
2. A seção **"Escolinhas e Aulas Esportivas"** desapareceu completamente da página e do menu de navegação.
3. O portal ficou reduzido apenas à grade de botões de horários e ao rodapé, parecendo incompleto e quebrado.

### 1.2. Por que o visual atual parece "Vibecode" (AI Slop)?
1. **Repetição Mecânica de Padrões de IA:** Todas as seções usam exatamente o mesmo cabeçalho centralizado com uma pílula verde no topo (`inline-flex rounded-full bg-emerald-500/10 border-emerald-500/20`), seguida de um `h2` branco e um subtítulo `text-slate-400`.
2. **Iluminação Artificial Clichê:** Uso repetitivo de bolhas decorativas desfocadas (`w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl`) espalhadas pelo fundo de todas as seções.
3. **Monotonia de Superfícies:** Tudo é um card `bg-slate-900 border border-slate-800 rounded-3xl` sobre um fundo `bg-slate-950`, sem contraste de superfície, sem ritmo editorial e sem fotografia integrada ao topo.
4. **Falta de Personalidade da Arena Contratante:** O cabeçalho (`LogoReservei.tsx`) ignora o campo `logo_url` da arena e exibe apenas um emoji genérico `🏟️`. Além disso, não há suporte a cores customizadas por arena (como o tema visual próprio da Arena Belém).

---

## 2. Objetivos do Redesign & Customização da Arena Belém

1. **Idealização Estética Original (Zero Vibecode):** Redesenhar o portal do atleta aplicando os princípios de **`design-taste-frontend`**, **`impeccable`** e **`emil-design-eng`**, criando uma interface com alma de clube esportivo moderno (*Courtside / Athletic Club Editorial*).
2. **Restauração Completa das Seções na Arena Belém:** Garantir que todas as seções (**Agendamento de Quadras**, **Mural de Partidas/Vagas**, **O Local e Estrutura com Fotos**, **Escolinhas e Aulas** e **Localização & Contato**) estejam visíveis, populadas e navegáveis pelo menu.
3. **Personalização White-Label por Arena (Logo, Cores e Fotos):**
   - Exibir o **Logotipo da Arena** (`logoUrl`) no cabeçalho e no rodapé (com fallback elegante para monograma/ícone vetorial quando a arena não tiver imagem, eliminando o emoji `🏟️` cru).
   - Permitir que cada arena defina sua **Cor Primária de Marca (`corPrimaria`)** via CSS Custom Properties (`--arena-primary`), aplicando a identidade visual da **Arena Belém** nos destaques, botões de ação, seletores de horário e badges.

---

## 3. Modelagem de Dados e Banco (`schema.sql` e `seed-arena-belem.sql`)

### 3.1. Suporte a Cor Primária e Logo na Tabela `arenas`
A coluna `logo_url TEXT` já existe em `public.arenas`. Adicionar de forma idempotente suporte à cor primária da marca da arena:

```sql
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS cor_primaria TEXT NOT NULL DEFAULT '#10B981';
```

- Na interface `Arena` (`src/lib/arena/types.ts`) e no `arenaRepository.ts`: mapear `logoUrl` (`logo_url`) e `corPrimaria` (`cor_primaria`, padrão `'#10B981'`).
- Em `AdminConfiguracoesPage.tsx`: adicionar campos para o gestor configurar a **URL/Upload da Logo da Arena** e o **Seletor de Cor Principal da Marca** (com presets esportivos rápidos + input de cor hexadecimal).

### 3.2. Dados Reais e Completos no `seed-arena-belem.sql` (e Fallback de Demonstração)
Atualizar `src/lib/supabase/seed-arena-belem.sql` (e os dados de fallback quando `arena.slug === 'arena-belem'`) para incluir:

1. **Identidade Visual da Arena Belém:**
   - `logo_url`: `/arenas/arena-belem/logo.svg` (criar um SVG vetorial esportivo limpo e autêntico para a Arena Belém em `public/arenas/arena-belem/logo.svg`, que o usuário poderá substituir pela imagem PNG/SVG oficial quando desejar).
   - `cor_primaria`: paleta autêntica de areia/sol e esporte (ex.: Âmbar/Ouro Solar `#F59E0B` ou Verde Quadra `#10B981` — parametrizável).

2. **Galeria de Fotos da Estrutura (`public.galeria_estrutura` para `arena-belem`):**
   Popular fotos ativas cobrindo as áreas reais da Arena Belém (Av. Roberto Camelier, 580 - Jurunas):
   - **Quadras de Areia (Beach Tennis & Futevôlei):** 3 quadras com areia tratada e iluminação de LED noturna.
   - **Campo de Futebol Society:** Grama sintética com iluminação profissional e redes de contenção.
   - **Espaço Resenha & Bar da Arena:** Área de convivência pós-jogo com bebidas geladas e transmissão de jogos.
   - **Duchas & Vestiários:** Estrutura de apoio para os atletas entre as partidas.

3. **Escolinhas e Turmas Abertas (`public.escolinhas_arena` e `public.contratos_recorrentes` para `arena-belem`):**
   Popular as modalidades reais da Arena Belém para que a seção **Escolinhas e Aulas** apareça completa no portal:
   - **CT Falcão 12 — Futebol Society (Infantil & Juvenil):** Unidade licenciada na Arena Belém, com turmas de formação no campo society.
   - **Escolinha & Clínica de Beach Tennis:** Turmas iniciante, intermediário e avançado nas quadras de areia.
   - **Treinamento Funcional & Futevôlei:** Fundamentos de futevôlei (ataque, defesa, shark attack) e preparo físico na areia.

> **Importante sobre Fallback Local/Híbrido:** Em `useInstitucionalService.ts` / `institucionalRepository.ts`, caso a consulta ao banco retorne lista vazia para uma arena que possui o módulo `escolinhas` ativo ou para a `galeria`, prover dados padrão contextualizados com as quadras da arena em vez de esconder as seções da página inicial!

---

## 4. Diretrizes de Redesign Visual (Execução com `impeccable`, `design-taste-frontend` e `emil-design-eng`)

O Claude deve primeiro **idealizar a direção de arte** aplicando as skills instaladas e refatorar os seguintes componentes visuais:

### 4.1. Regras Anti-Vibecode Obrigatórias
- **PROIBIDO:** Pílulas de subtítulo idênticas (`inline-flex rounded-full bg-emerald-500/10`) acima de todos os títulos de seção.
- **PROIBIDO:** Bolhas de luz desfocadas (`blur-3xl`) decorativas repetidas no fundo.
- **PROIBIDO:** `transition-all` (usar transições explícitas de `transform`, `opacity`, `background-color`, `border-color` com curvas `cubic-bezier(0.22, 1, 0.36, 1)` de `150ms–220ms`, conforme `emil-design-eng`).
- **PROIBIDO:** Emoji `🏟️` solto como logotipo principal da arena.
- **OBRIGATÓRIO:** `font-variant-numeric: tabular-nums` (`tabular-nums`) em todos os horários (`07:00`, `18:00`), preços (`R$ 80`), contadores e cronômetros de Pix.

### 4.2. Cabeçalho (`LandingHeader.tsx`) e Identidade de Topo (`CabecalhoReserva.tsx`)
- Renderizar o **Logo da Arena** (`arena.logoUrl`) ou um emblema tipográfico/vetorial da arena ao lado do nome e bairro/cidade (`Arena Belém · Jurunas, Belém/PA`).
- Exibir um cabeçalho de boas-vindas com atmosfera esportiva real: informações rápidas da estrutura (ex.: *"3 Quadras de Areia · 1 Campo Society · Estacionamento & Bar"*), status de funcionamento e atalho rápido para agendar ou ver a estrutura.
- Garantir que o menu de navegação mostre todos os links das seções da página: **Reservar**, **Estrutura**, **Escolinhas**, **Partidas Abertas** e **Localização**.

### 4.3. Grade de Agendamento (`CalendarioSelector.tsx`, `QuadraHorarioItem.tsx`, `CarrinhoLateral.tsx`)
- **Seletor de Dias:** Design tátil com distinção clara do dia ativo, indicador de "Hoje" e fim de semana, usando a cor primária da arena (`var(--arena-primary)`).
- **Cards de Quadra (`QuadraHorarioItem.tsx`):**
  - Diferenciar visualmente o tipo de piso (**Areia** vs. **Grama Sintética / Society**) com tags técnicas elegantes (sem excesso de poluição visual), mostrando comodidades (Iluminação LED, Esportes aceitos) e faixa de preço clara.
  - Botões de horário (`07:00` às `22:00`) desenhados como células de placar/grade técnica com feedback imediato de clique (`active:scale-[0.97]`), diferenciando claramente: *Livre*, *Selecionado*, *Ocupado* e *Horário de Escolinha*.
- **Resumo de Reserva (`CarrinhoLateral.tsx`):** Visual de "Ticket / Passaporte de Partida" limpo e de alta conversão, sem aparência de caixa cinza vazia.

### 4.4. Seção "O Local e Estrutura" (`SecaoEstrutura.tsx`)
- Substituir o grid uniforme de 3x2 por um **Bento Grid Editorial Assimétrico** (ex.: card principal panorâmico de 2 colunas destacando as quadras iluminadas + cards complementares para Campo Society, Bar/Resenha e Vestiários).
- Filtros por ambiente com indicador deslizante ou contraste tipográfico limpo.
- Fotos com tratamento de legenda editorial (sobreposição em gradiente escuro suave na base da foto com título e descrição concisa).

### 4.5. Seção "Escolinhas e Aulas Esportivas" (`SecaoEscolinhas.tsx`)
- Layout de vitrine esportiva com destaque visual para a modalidade (**CT Falcão 12 · Futebol Society**, **Beach Tennis**, **Futevôlei**), foto/avatar do professor responsável, grade de dias e horários em formato de tabela/chips legíveis, faixa etária e botão de inscrição via WhatsApp.

### 4.6. Seção "Localização e Contato" (`SecaoContato.tsx`) e Rodapé (`LandingFooter.tsx`)
- Apresentação clara do endereço (`Av. Roberto Camelier, 580 - Jurunas, Belém/PA`), horários de funcionamento, link direto para abrir no Google Maps / Waze e botão de WhatsApp da Arena Belém.

---

## 5. Validação Obrigatória no Navegador (Playwright MCP)

Após implementar o redesign e atualizar os dados da Arena Belém:
1. O Claude deve subir o servidor local (`npm run dev`) e abrir a página no **Playwright MCP** tanto em viewport **Desktop (`1440x900`)** quanto **Mobile (`390x844`)**.
2. Verificar visualmente (com screenshots) que **todas as 5 seções** aparecem na página inicial:
   - [x] Topo + Grade de Reserva de Quadras (3 Quadras de Areia + 1 Campo Society)
   - [x] Mural de Vagas / Partidas Abertas
   - [x] Seção "O Local e Estrutura" (com todas as fotos carregando sem erro)
   - [x] Seção "Escolinhas e Aulas Esportivas" (com CT Falcão 12, Beach Tennis e Futevôlei visíveis)
   - [x] Seção "Localização e Contato" + Rodapé
3. Executar `npm test`, `npm run typecheck` e `npm run build` garantindo 100% dos testes passando.

