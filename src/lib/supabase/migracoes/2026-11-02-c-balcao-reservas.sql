-- ==============================================================================
-- Balcão: quitar, cancelar, remarcar, "não compareceu" e histórico da reserva
-- (SPEC/2026-11-02-admin-revisao.md, Plano E)
--
-- Novas colunas em `reservas`:
--   forma_pagamento_restante  como o restante foi pago no balcão: dinheiro, pix ou cartao
--   quitada_em / quitada_por  quando e quem recebeu o restante
--   cancelada_por             quem cancelou pelo painel (cancelada_em já existe)
--   motivo_cancelamento       motivo informado pelo balcão
--   nao_compareceu            o cliente não apareceu (o sinal não volta)
-- `reembolso_status` ganha 'retido' (sinal ficou com a arena, fora do prazo da política).
--
-- `reservas_eventos`: linha do tempo da reserva (quem quitou, cancelou, remarcou...). Leitura pela
-- equipe da arena; gravação só pelo servidor (service role), para ninguém forjar histórico.
--
-- Pré-requisito: 2026-11-02-b-dados-painel.sql. Idempotente.
-- ==============================================================================

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS forma_pagamento_restante TEXT,
  ADD COLUMN IF NOT EXISTS quitada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quitada_por UUID,
  ADD COLUMN IF NOT EXISTS cancelada_por UUID,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS nao_compareceu BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_forma_pagamento_restante_check') THEN
    ALTER TABLE public.reservas ADD CONSTRAINT reservas_forma_pagamento_restante_check
      CHECK (forma_pagamento_restante IS NULL OR forma_pagamento_restante IN ('dinheiro', 'pix', 'cartao'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_motivo_cancelamento_check') THEN
    ALTER TABLE public.reservas ADD CONSTRAINT reservas_motivo_cancelamento_check
      CHECK (motivo_cancelamento IS NULL OR length(motivo_cancelamento) <= 300);
  END IF;
END $$;

-- 'retido': o sinal ficou com a arena (cancelamento fora do prazo da política)
ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_reembolso_status_check;
ALTER TABLE public.reservas ADD CONSTRAINT reservas_reembolso_status_check
  CHECK (reembolso_status IS NULL OR reembolso_status IN ('pendente', 'reembolsado', 'retido'));

-- Devoluções que a arena ainda precisa fazer (tela Hoje)
CREATE INDEX IF NOT EXISTS idx_reservas_reembolso_pendente
  ON public.reservas (arena_id)
  WHERE reembolso_status = 'pendente';

CREATE TABLE IF NOT EXISTS public.reservas_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  reserva_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  autor_id UUID,
  autor_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservas_eventos_tipo_check CHECK (
    tipo IN ('quitada', 'cancelada', 'remarcada', 'nao_compareceu', 'compareceu', 'devolucao_registrada')
  )
);

CREATE INDEX IF NOT EXISTS idx_reservas_eventos_reserva ON public.reservas_eventos (reserva_id, criado_em);

ALTER TABLE public.reservas_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe da arena lê o histórico das reservas" ON public.reservas_eventos;
CREATE POLICY "Equipe da arena lê o histórico das reservas"
  ON public.reservas_eventos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.arena_usuarios au
     WHERE au.arena_id = reservas_eventos.arena_id AND au.user_id = auth.uid() AND au.ativo = true
  ));

REVOKE ALL ON public.reservas_eventos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reservas_eventos FROM authenticated;
GRANT SELECT ON public.reservas_eventos TO authenticated;
