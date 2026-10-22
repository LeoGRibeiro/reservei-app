-- ==============================================================================
-- Fase 8: MVP Go-Live (SPEC/2026-10-22-mvp-go-live.md)
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 8.1. Auditoria de ações administrativas sensíveis (M2/M3/M1)
--      Sem policies: só o servidor (service_role) lê e grava.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria_admin (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  alvo_id TEXT,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_admin_arena_data ON public.auditoria_admin (arena_id, criado_em DESC);
ALTER TABLE public.auditoria_admin ENABLE ROW LEVEL SECURITY;
