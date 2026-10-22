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

-- ------------------------------------------------------------------------------
-- 8.2. Segurança: convites de onboarding guardados apenas como hash SHA-256
--      A linha de arenas é legível publicamente (portal); com o token puro, qualquer
--      visitante poderia concluir o setup de uma arena recém-criada no lugar do dono.
-- ------------------------------------------------------------------------------
UPDATE public.arenas
SET token_convite = encode(sha256(convert_to(token_convite, 'UTF8')), 'hex')
WHERE token_convite IS NOT NULL AND length(token_convite) <> 64;

-- ------------------------------------------------------------------------------
-- 8.3. Recebimento na conta da própria arena (M1)
-- ------------------------------------------------------------------------------
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS modo_pagamento TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS pix_chave TEXT,
  ADD COLUMN IF NOT EXISTS pix_tipo_chave TEXT,
  ADD COLUMN IF NOT EXISTS pix_nome_recebedor TEXT,
  ADD COLUMN IF NOT EXISTS pix_cidade_recebedor TEXT,
  ADD COLUMN IF NOT EXISTS politica_cancelamento TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arenas_modo_pagamento_check') THEN
    -- Arenas que já existiam operavam com o gateway global de testes: passam ao modo demonstração.
    -- Arenas novas nascem no modo manual (chave Pix da própria arena).
    UPDATE public.arenas SET modo_pagamento = 'simulado';
    ALTER TABLE public.arenas
      ADD CONSTRAINT arenas_modo_pagamento_check CHECK (modo_pagamento IN ('asaas', 'manual', 'simulado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arenas_pix_tipo_chave_check') THEN
    ALTER TABLE public.arenas
      ADD CONSTRAINT arenas_pix_tipo_chave_check
      CHECK (pix_tipo_chave IS NULL OR pix_tipo_chave IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria'));
  END IF;
END $$;

-- Credenciais dos gateways das arenas: chave e token cifrados pela aplicação (AES-256-GCM).
-- RLS ativo e nenhuma policy: só o servidor (service_role) lê e grava.
CREATE TABLE IF NOT EXISTS public.arena_credenciais_pagamento (
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  provedor TEXT NOT NULL CHECK (provedor IN ('asaas')),
  api_key_cifrada TEXT NOT NULL,
  webhook_token_cifrado TEXT NOT NULL,
  webhook_id TEXT,
  sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  conta_nome TEXT,
  validada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (arena_id, provedor)
);
ALTER TABLE public.arena_credenciais_pagamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_credenciais_pagamento FROM anon, authenticated;
REVOKE ALL ON public.auditoria_admin FROM anon, authenticated;

-- Pix manual: aviso do atleta, valor cobrado e quem confirmou no balcão
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS pagamento_informado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pix_valor NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_reservas_pix_manual_informado
  ON public.reservas (arena_id, pagamento_informado_em)
  WHERE status = 'em_processamento' AND pagamento_informado_em IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 8.4. LGPD: registro do aceite dos Termos de Uso e da Política de Privacidade (M4)
-- ------------------------------------------------------------------------------
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termos_versao TEXT;

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termos_versao TEXT;
