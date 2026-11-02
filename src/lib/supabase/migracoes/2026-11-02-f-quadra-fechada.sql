-- ==============================================================================
-- Quadra inteira fechada por um período (SPEC/2026-11-02-admin-ajustes-demo.md §8.4)
--
-- Reforma, evento ou torneio: a quadra fecha de uma data até outra, ou "até eu liberar"
-- (bloqueio_fim vazio). O site mostra os horários como "Indisponível", o checkout recusa e esta
-- trava no banco impede qualquer reserva nova (portal, balcão, contrato ou reativação) no período.
-- Reservas que já existiam no período continuam valendo: o painel lista para o dono decidir.
--
-- Pré-requisito: 2026-11-02-e-antecedencia-zero.sql. Idempotente.
-- ==============================================================================

ALTER TABLE public.quadras
  ADD COLUMN IF NOT EXISTS bloqueio_inicio DATE,
  ADD COLUMN IF NOT EXISTS bloqueio_fim DATE,
  ADD COLUMN IF NOT EXISTS bloqueio_motivo TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quadras_bloqueio_periodo_check') THEN
    ALTER TABLE public.quadras ADD CONSTRAINT quadras_bloqueio_periodo_check
      CHECK ((bloqueio_inicio IS NOT NULL OR bloqueio_fim IS NULL)
             AND (bloqueio_fim IS NULL OR bloqueio_fim >= bloqueio_inicio));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quadras_bloqueio_motivo_check') THEN
    ALTER TABLE public.quadras ADD CONSTRAINT quadras_bloqueio_motivo_check
      CHECK (bloqueio_motivo IS NULL OR char_length(bloqueio_motivo) <= 120);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.impedir_reserva_quadra_fechada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_motivo TEXT;
  v_fechada BOOLEAN := false;
BEGIN
  -- Bloqueio de horário do próprio painel e reservas que não ocupam horário passam
  IF NEW.tipo_reserva = 'manutencao_bloqueio' OR NOT public.reserva_ocupa_horario(NEW.status, NEW.expira_em) THEN
    RETURN NEW;
  END IF;

  -- Reserva que já ocupava a mesma quadra e dia (ex.: quitação, troca de horário no mesmo dia)
  IF TG_OP = 'UPDATE'
     AND public.reserva_ocupa_horario(OLD.status, OLD.expira_em)
     AND OLD.quadra_id = NEW.quadra_id AND OLD.data = NEW.data THEN
    RETURN NEW;
  END IF;

  SELECT true, q.bloqueio_motivo INTO v_fechada, v_motivo
    FROM public.quadras q
   WHERE q.id = NEW.quadra_id
     AND q.bloqueio_inicio IS NOT NULL
     AND NEW.data >= q.bloqueio_inicio
     AND (q.bloqueio_fim IS NULL OR NEW.data <= q.bloqueio_fim);

  IF v_fechada THEN
    RAISE EXCEPTION 'Quadra fechada nesta data (%).', coalesce(nullif(trim(v_motivo), ''), 'sem motivo informado')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.impedir_reserva_quadra_fechada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_impedir_reserva_quadra_fechada ON public.reservas;
CREATE TRIGGER trg_impedir_reserva_quadra_fechada
  BEFORE INSERT OR UPDATE OF status, quadra_id, data, horarios, expira_em ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.impedir_reserva_quadra_fechada();
