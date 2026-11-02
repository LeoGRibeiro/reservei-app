-- ==============================================================================
-- Dados do painel corretos e escaláveis (SPEC/2026-11-02-admin-revisao.md, Plano C)
--
-- 1. Trava contra reserva dupla no próprio banco: nenhuma reserva nova (portal, balcão, bloqueio,
--    contrato) nem remarcação pode ocupar um horário já ocupado da mesma quadra e data. Ocupa o
--    horário: 'pendente', 'confirmada' e 'em_processamento' com o prazo do Pix ainda valendo.
--    Vale para INSERT, para troca de quadra/data/horários e para quando a reserva PASSA a ocupar
--    (ex.: sessão de grupo reativada, Pix pago depois do prazo). Quem já ocupava e só muda de
--    status (sinal pago → quitada) não é rechecado.
-- 2. resumo_financeiro(arena, início, fim): totais do período calculados no Postgres, pelo dia do
--    jogo (sem trazer milhares de linhas para o navegador).
-- 3. clientes_da_arena(arena): todo mundo que já reservou, agrupado pelo WhatsApp (com ou sem conta).
--
-- As duas funções são SECURITY INVOKER: a RLS de `reservas` decide o que cada um enxerga (só a
-- equipe da arena vê as reservas dela).
--
-- Pré-requisito: 2026-11-02-a-arenas-campos-plataforma.sql. Idempotente.
-- ==============================================================================

-- ── 1. Trava contra reserva dupla ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserva_ocupa_horario(p_status TEXT, p_expira_em TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_status IN ('pendente', 'confirmada')
      OR (p_status = 'em_processamento' AND (p_expira_em IS NULL OR p_expira_em > now()));
$$;

CREATE OR REPLACE FUNCTION public.impedir_reserva_dupla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_conflito TEXT;
BEGIN
  IF NOT public.reserva_ocupa_horario(NEW.status, NEW.expira_em) OR coalesce(array_length(NEW.horarios, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  -- Já ocupava o mesmo horário e só mudou outro dado (ex.: quitação): nada a conferir
  IF TG_OP = 'UPDATE'
     AND public.reserva_ocupa_horario(OLD.status, OLD.expira_em)
     AND OLD.quadra_id = NEW.quadra_id AND OLD.data = NEW.data AND OLD.horarios = NEW.horarios THEN
    RETURN NEW;
  END IF;

  -- Serializa gravações na mesma quadra e dia (duas pessoas no mesmo segundo não passam juntas)
  PERFORM pg_advisory_xact_lock(hashtext(NEW.quadra_id || '|' || NEW.data::text));

  SELECT r.id INTO v_conflito
    FROM public.reservas r
   WHERE r.quadra_id = NEW.quadra_id
     AND r.data = NEW.data
     AND r.id <> NEW.id
     AND r.horarios && NEW.horarios
     AND public.reserva_ocupa_horario(r.status, r.expira_em)
   LIMIT 1;

  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Horário já ocupado nesta quadra (reserva %).', v_conflito
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.impedir_reserva_dupla() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_impedir_reserva_dupla_insert ON public.reservas;
DROP TRIGGER IF EXISTS trg_impedir_reserva_dupla_remarcacao ON public.reservas;
DROP TRIGGER IF EXISTS trg_impedir_reserva_dupla ON public.reservas;
CREATE TRIGGER trg_impedir_reserva_dupla
  BEFORE INSERT OR UPDATE OF quadra_id, data, horarios, status, expira_em ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.impedir_reserva_dupla();

-- ── 2. Resumo financeiro do período ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resumo_financeiro(p_arena_id TEXT, p_inicio DATE, p_fim DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT r.*,
           coalesce(r.valor_total, 0) AS total,
           coalesce(r.valor_pendente, 0) AS falta,
           coalesce(r.desconto_fidelidade, 0) AS desconto,
           CASE WHEN coalesce(r.valor_original, 0) > 0 THEN r.valor_original
                ELSE coalesce(r.valor_total, 0) + coalesce(r.desconto_fidelidade, 0) END AS tabela
      FROM public.reservas r
     WHERE r.arena_id = p_arena_id
       AND r.data BETWEEN p_inicio AND p_fim
       AND coalesce(r.tipo_reserva, 'avulsa') <> 'manutencao_bloqueio'
  ),
  ativas AS (SELECT * FROM base WHERE status IN ('pendente', 'confirmada')),
  canceladas AS (SELECT * FROM base WHERE status = 'cancelada')
  SELECT jsonb_build_object(
    'reservas', (SELECT count(*) FROM ativas),
    'recebido', (SELECT coalesce(sum(total - falta), 0) FROM ativas),
    'a_receber', (SELECT coalesce(sum(falta), 0) FROM ativas WHERE status = 'pendente'),
    'valor_tabela', (SELECT coalesce(sum(tabela), 0) FROM ativas),
    'descontos', (SELECT coalesce(sum(desconto), 0) FROM ativas),
    'aguardando_pix', (SELECT count(*) FROM base WHERE status = 'em_processamento'),
    'canceladas', (SELECT count(*) FROM canceladas),
    'devolvido', (SELECT coalesce(sum(coalesce(reembolso_valor, 0)), 0) FROM canceladas WHERE reembolso_status = 'reembolsado'),
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object('data', d.data, 'recebido', d.recebido, 'a_receber', d.a_receber) ORDER BY d.data)
        FROM (SELECT data, sum(total - falta) AS recebido, sum(CASE WHEN status = 'pendente' THEN falta ELSE 0 END) AS a_receber
                FROM ativas GROUP BY data) d
    ), '[]'::jsonb),
    'por_quadra', coalesce((
      SELECT jsonb_agg(jsonb_build_object('quadra_id', q.quadra_id, 'reservas', q.n, 'recebido', q.recebido, 'a_receber', q.a_receber) ORDER BY q.recebido DESC)
        FROM (SELECT quadra_id, count(*) AS n, sum(total - falta) AS recebido, sum(CASE WHEN status = 'pendente' THEN falta ELSE 0 END) AS a_receber
                FROM ativas GROUP BY quadra_id) q
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.resumo_financeiro(TEXT, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_financeiro(TEXT, DATE, DATE) TO authenticated;

-- ── 3. Clientes da arena (com e sem conta), agrupados pelo WhatsApp ──────────

CREATE OR REPLACE FUNCTION public.clientes_da_arena(p_arena_id TEXT)
RETURNS TABLE (
  telefone TEXT,
  nome TEXT,
  outros_nomes TEXT[],
  usuario_id TEXT,
  reservas BIGINT,
  canceladas BIGINT,
  ultima_data DATE,
  proxima_data DATE,
  total_gasto NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH r AS (
    SELECT
      CASE WHEN length(d) > 11 AND d LIKE '55%' THEN substr(d, 3) ELSE d END AS tel,
      res.nome_cliente, res.user_id::text AS uid, res.status, res.data, res.criada_em,
      coalesce(res.valor_total, 0) - coalesce(res.valor_pendente, 0) AS pago
    FROM public.reservas res
    CROSS JOIN LATERAL (SELECT regexp_replace(coalesce(res.whatsapp_cliente, ''), '\D', '', 'g') AS d) n
    WHERE res.arena_id = p_arena_id
      AND coalesce(res.tipo_reserva, 'avulsa') IN ('avulsa', 'admin_manual')
  )
  SELECT
    tel,
    (array_agg(nome_cliente ORDER BY criada_em DESC))[1],
    coalesce(array_remove(array_agg(DISTINCT nome_cliente), (array_agg(nome_cliente ORDER BY criada_em DESC))[1]), '{}'),
    max(uid),
    count(*) FILTER (WHERE status IN ('pendente', 'confirmada')),
    count(*) FILTER (WHERE status = 'cancelada'),
    max(data) FILTER (WHERE status IN ('pendente', 'confirmada') AND data <= CURRENT_DATE),
    min(data) FILTER (WHERE status IN ('pendente', 'confirmada') AND data > CURRENT_DATE),
    coalesce(sum(pago) FILTER (WHERE status IN ('pendente', 'confirmada')), 0)
  FROM r
  WHERE length(tel) >= 10
  GROUP BY tel;
$$;

REVOKE ALL ON FUNCTION public.clientes_da_arena(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clientes_da_arena(TEXT) TO authenticated;
