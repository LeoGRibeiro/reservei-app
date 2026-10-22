# Especificação Técnica: Checkout no Servidor, Escopo Estrito por Arena e Fidelidade Antifraude (Etapa 4)

**Data:** 21/10/2026
**Status:** Implementado, validado no navegador e aplicado no Supabase (Fase 7 do `schema.sql`)
**Responsável:** Claude (implementação e arquitetura nesta etapa, com autonomia concedida pelo dono do projeto)

---

## 1. Diagnóstico (validação no navegador + leitura do código após a Fase 6 de RLS)

Com o RLS fechado, a aplicação continuou renderizando sem erros visíveis, mas vários fluxos passaram
a falhar **em silêncio** (o código ignora o `error` do Supabase e mantém só o estado local):

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Checkout público faz `UPDATE`/`DELETE` em `reservas` pelo navegador (identificação, valores, desconto, confirmação, liberar lock). O RLS só permite operadores. | Reserva fica sem nome/WhatsApp; lock não é liberado; confirmação não persiste. |
| 2 | `INSERT` anônimo em `reservas` aceita qualquer `status`, `valor_total` e `desconto`. | **Fraude:** visitante grava reserva "confirmada" por R$ 0. |
| 3 | Fidelidade é calculada e gravada no navegador do atleta (selos, vouchers, marcação de uso). | Antes do RLS: atleta forjava vouchers. Depois: nada é gravado (atleta só tem SELECT). |
| 4 | Consultas e gravações de contratos, fidelidade, galeria, escolinhas e reservas **não filtram nem gravam `arena_id`**. | Operador de duas arenas vê dados misturados; gravações com `arena_id NULL` são rejeitadas pelo RLS. |
| 5 | `view_grade_publica` (SECURITY DEFINER) expõe a grade de **todas** as arenas e não traz `expira_em`, vagas nem dados de escolinha. | Advisor de segurança em nível ERROR; mural de vagas vazio para visitantes; locks expirados nunca liberam a grade. |
| 6 | `contratos_recorrentes` tem leitura pública de todos os contratos ativos. | Vaza nome e WhatsApp de mensalistas (LGPD). |
| 7 | Webhook com gateway simulado confirma qualquer `txid` recebido; segredo do Asaas é opcional. | Em produção sem Asaas, qualquer pessoa confirma qualquer reserva. |
| 8 | Subdomínio inexistente (`naoexiste.reservei.com.br`) exibe a arena demo. | Confunde clientes e quebra o white-label. |
| 9 | `middleware.ts` está obsoleto no Next.js 16 (renomeado para `proxy.ts`). | Aviso de depreciação; quebra futura. |
| 10 | `rls_auto_enable()` executável por `anon`/`authenticated` via RPC. | Advisor de segurança (WARN). |
| 11 | Painel e portal usavam quadras (`q1`–`q3`), horários, preços (rótulos), sinal (40%) e antecedência (10 min) fixos no código. | Arena real com outras quadras não via reservas na agenda; cliente via um preço e pagava outro. |
| 12 | Marca, endereço e WhatsApp fixos (`Reservei · Complexo Esportivo`, `(11) 99999-0000`). | Quebra o white-label. |
| 13 | `auth.signUp` com e-mail sintético é recusado pelo Supabase ("Email address is invalid"). | **Nenhum atleta conseguia criar conta.** |
| 14 | Portal exibia mural de vagas e vouchers mesmo para arenas sem esses módulos contratados. | Viola o ADR-003 (venda modular). |
| 15 | Bucket `institucional` aceitava upload anônimo, sem limite de tamanho nem de tipo. | Abuso como hospedagem gratuita de arquivos. |
| 16 | Financeiro só somava reservas `confirmada` (ignorava sinal pago = `pendente`). | Caixa e "a receber no balcão" zerados. |

---

## 2. Decisões

### 2.1. Toda escrita pública passa pelo servidor
O navegador de visitantes e atletas **nunca** escreve em `reservas`, `fidelidade_selos` ou
`fidelidade_vouchers`. Rotas de API com `service_role` validam e recalculam tudo:

| Rota | Quem chama | O que faz |
|------|------------|-----------|
| `POST /api/reservas/checkout` | Visitante ou atleta | Valida arena, quadra, data, horários, conflito com reservas e locks vigentes, bloqueio do telefone e antecedência. **Recalcula o preço no servidor** (`calcularPrecoReserva`). Valida vouchers do atleta autenticado e aplica o desconto. Grava a reserva `em_processamento` (lock de 10 min) com um `checkout_token` secreto. Reserva 100% coberta por vouchers já nasce confirmada. |
| `GET /api/reservas/[id]/status?token=` | Quem fez o checkout | Retorna só o status (para o ModalPix acompanhar a confirmação do webhook). |
| `DELETE /api/reservas/[id]?token=` | Quem fez o checkout | Libera o lock (`cancelada`) se ainda estiver `em_processamento`. |
| `POST /api/reservas/[id]/vincular` | Atleta recém-cadastrado | Vincula a reserva ao atleta (exige `checkout_token`, para que ninguém reivindique reserva alheia só sabendo o telefone). |
| `POST /api/reservas/[id]/cancelar` | Atleta dono | Cancela a própria reserva respeitando a tolerância de 24h. |
| `POST /api/reservas/[id]/vagas` | Atleta dono | Abre, altera ou fecha vagas da própria reserva. |
| `POST /api/fidelidade/sincronizar` | Atleta autenticado | Executa no servidor a regra de selos e o resgate automático de vouchers, gravando com `service_role`. |
| `POST /api/pagamentos/simular` | Somente desenvolvimento | Confirma o Pix no gateway simulado. Desabilitado em produção. |

Autenticação do atleta nas rotas: cabeçalho `Authorization: Bearer <access_token>` do Supabase Auth,
validado com `supabaseAdmin.auth.getUser(token)`.

### 2.2. Confirmação de pagamento
- O webhook compara o valor pago com a reserva: valor ≥ total → `confirmada` (quitada); valor menor (sinal)
  → `pendente` (restante no balcão). Os vouchers anotados na reserva só são consumidos na confirmação.
- Gateway simulado: o webhook só aceita eventos fora de produção. Asaas: `ASAAS_WEBHOOK_SECRET` passa a ser
  obrigatório em produção.

### 2.3. Escopo estrito por arena no cliente
Novo módulo `src/lib/arena/arenaAtiva.ts` resolve **uma vez por aba** o `arena_id` do subdomínio atual
(memoizado) e é usado por todos os serviços do navegador:
- leituras: `.eq("arena_id", id)`;
- gravações de operadores: `arena_id` sempre preenchido;
- Realtime: filtro `arena_id=eq.<id>`.

Sem subdomínio (localhost puro ou domínio raiz), usa a arena demo apenas como ambiente de desenvolvimento.

### 2.4. Grade pública por função, não por view
`view_grade_publica` é substituída pela função `public.grade_publica(p_arena_id, p_data_inicio, p_data_fim)`
(SECURITY DEFINER, `search_path` fixo), que **exige a arena** e devolve só colunas seguras: horários, status,
`expira_em`, tipo, vagas abertas, primeiro nome do organizador (só quando há vagas) e nome/contato comercial
de escolinhas.

### 2.5. Contratos
Leitura pública restrita a `tipo = 'escolinha'` (dados comerciais). Contratos de grupos/mensalistas ficam
visíveis só para operadores.

### 2.6. Arena inexistente
`/[slug]` e o layout de `/admin` chamam `notFound()` quando o subdomínio não corresponde a uma arena ativa.
A tela 404 (`app/not-found.tsx`) orienta o visitante.

### 2.7. Catálogo da arena ativa (white-label real)
`src/store/useCatalogoArenaStore.ts` guarda a arena carregada, suas quadras ativas, os horários de
funcionamento (`gerarHorariosOperacionais`) e a antecedência mínima. É preenchido pelo `useArena` e lido por
toda a interface (agenda, reserva manual, bloqueios, contratos, vagas, minha conta) e pelas regras de domínio.
Marca, endereço, WhatsApp e percentual do sinal vêm da arena (`useConfiguracaoSiteArena`). A grade do portal
mostra o preço real de cada faixa pela tabela da quadra.

### 2.8. Cadastro de atleta no servidor
`POST /api/atletas/cadastro` cria a conta via `auth.admin.createUser` (já confirmada, sem envio de e-mail) e o
perfil em `usuarios`; o navegador faz o login em seguida. Dispensa o "Confirm email" desligado e contorna a
recusa do e-mail sintético pelo `auth.signUp` público.

### 2.9. Módulos contratados também no portal e no servidor
Mural de vagas, vouchers e seção de escolinhas só aparecem se a arena contratou o módulo; as rotas de
fidelidade, vouchers no checkout e vagas recusam a operação quando o módulo está desligado.

### 2.10. Proxy do Next.js 16
`src/middleware.ts` foi renomeado para `src/proxy.ts` (função `proxy`), conforme a convenção do Next.js 16.

---

## 3. Migração SQL (Fase 7)

A versão final aplicada está no fim de `src/lib/supabase/schema.sql` ("Fase 7"). Além do bloco abaixo, ela
inclui: política para o organizador ver e responder os interessados da própria partida; índice único de selo
por reserva; restrição de upload no Storage a operadores (imagens de até 5 MB).

```sql
-- 1. Token secreto do checkout (prova de autoria do lock; nunca exposto em leitura pública)
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS checkout_token TEXT;

-- 2. Visitantes não inserem mais direto: só operadores. O público usa POST /api/reservas/checkout.
DROP POLICY IF EXISTS "Criação de reservas para arenas ativas" ON public.reservas;
DROP POLICY IF EXISTS "Criação de reservas por operadores" ON public.reservas;
CREATE POLICY "Criação de reservas por operadores"
  ON public.reservas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = reservas.arena_id AND au.user_id = (SELECT auth.uid()) AND au.ativo = true));

-- 3. Grade pública por função com arena obrigatória
DROP VIEW IF EXISTS public.view_grade_publica;
CREATE OR REPLACE FUNCTION public.grade_publica(
  p_arena_id TEXT, p_data_inicio DATE DEFAULT NULL, p_data_fim DATE DEFAULT NULL)
RETURNS TABLE (
  id TEXT, arena_id TEXT, quadra_id TEXT, data DATE, horarios TEXT[], hora_inicio TEXT, hora_fim TEXT,
  status TEXT, esporte TEXT, tipo_reserva TEXT, contrato_id TEXT, expira_em TIMESTAMPTZ,
  permite_vagas BOOLEAN, vagas_abertas INTEGER, user_id TEXT, nome_cliente TEXT, whatsapp_cliente TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.arena_id, r.quadra_id, r.data, r.horarios, r.hora_inicio, r.hora_fim, r.status, r.esporte,
         r.tipo_reserva, r.contrato_id, r.expira_em,
         COALESCE(r.permite_vagas, false), COALESCE(r.vagas_abertas, 0),
         CASE WHEN r.permite_vagas THEN r.user_id END,
         CASE WHEN r.tipo_reserva = 'escolinha' THEN r.nome_cliente
              WHEN r.permite_vagas THEN split_part(COALESCE(r.nome_cliente, ''), ' ', 1) END,
         CASE WHEN r.tipo_reserva = 'escolinha' THEN r.whatsapp_cliente END
  FROM public.reservas r
  JOIN public.arenas a ON a.id = r.arena_id AND a.ativo = true
  WHERE r.arena_id = p_arena_id
    AND r.status IN ('confirmada', 'pendente', 'em_processamento')
    AND (p_data_inicio IS NULL OR r.data >= p_data_inicio)
    AND (p_data_fim IS NULL OR r.data <= p_data_fim);
$$;
REVOKE ALL ON FUNCTION public.grade_publica(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_publica(TEXT, DATE, DATE) TO anon, authenticated;

-- 4. Contratos: leitura pública só de escolinhas
DROP POLICY IF EXISTS "Leitura pública de contratos ativos" ON public.contratos_recorrentes;
DROP POLICY IF EXISTS "Leitura pública de escolinhas ativas" ON public.contratos_recorrentes;
CREATE POLICY "Leitura pública de escolinhas ativas"
  ON public.contratos_recorrentes FOR SELECT TO public
  USING (ativo = true AND tipo = 'escolinha');

-- 5. Função interna não deve ser chamável pela API
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 6. Índice de apoio às políticas por operador
CREATE INDEX IF NOT EXISTS idx_arena_usuarios_user_arena
  ON public.arena_usuarios (user_id, arena_id) WHERE ativo = true;
```

---

## 4. Critérios de aceite

Validado em 21/10/2026 numa arena de teste (`teste-claude`), com Edge automatizado (Playwright) e consultas ao banco:

- [x] Visitante reserva, gera Pix e, no modo simulado, confirma o pagamento. A reserva aparece no admin com nome e WhatsApp.
- [x] `INSERT` direto anônimo em `reservas` falha; anônimo não lê nenhuma linha de `reservas`.
- [x] Preço adulterado no navegador não muda o valor gravado (servidor recalcula pela tabela da quadra).
- [x] Horário ocupado, quadra de outra arena, horário fora do funcionamento, data passada, voucher sem login e
      Pix/status/cancelamento sem token são recusados.
- [x] Atleta cria conta, reserva logado, abre vagas, aparece no mural de outro visitante e cancela.
- [x] Partida concluída gera selo, o servidor emite o voucher, e o voucher cobre uma reserva 100% e é consumido.
- [x] Operador vê só os dados da própria arena; reserva manual, escolinha, foto e campanha persistem com `arena_id`.
- [x] Dono de uma arena não entra no painel de outra ("Acesso não autorizado para esta arena").
- [x] `naoexiste.localhost:3000` (portal e `/admin`) responde 404 "Arena não encontrada".
- [x] `npm test` (624 testes), `tsc --noEmit` e `next build` verdes. `eslint` sem erros novos (21 erros antigos
      da regra `react-hooks/set-state-in-effect` registrados no BACKLOG).
