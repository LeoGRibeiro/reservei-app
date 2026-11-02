-- ==============================================================================
-- Campos da plataforma só pelo suporte (SPEC/2026-11-02-admin-revisao.md, Plano A)
--
-- A policy "Permitir modificação apenas por proprietarios" deixa o dono fazer UPDATE em qualquer
-- coluna de `arenas`. Este trigger barra, para quem não é o servidor (service_role) nem o SQL Editor,
-- a mudança de:
--   slug, modulos_ativos (módulos pagos), ativo, token_convite, setup_concluido_em, slug_anterior
--   e a troca do modo de pagamento para 'simulado' (demonstração).
-- O dono continua editando nome, contatos, endereço, horários, sinal, política etc.
--
-- `slug_anterior` guarda o último endereço da arena: quem acessar o endereço antigo é redirecionado
-- (301) para o novo. Só o último é guardado.
--
-- Pré-requisito: 2026-10-31-escolinhas-site.sql. Idempotente.
-- ==============================================================================

ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS slug_anterior TEXT;

-- Um endereço antigo aponta para uma única arena
CREATE UNIQUE INDEX IF NOT EXISTS idx_arenas_slug_anterior
  ON public.arenas (slug_anterior)
  WHERE slug_anterior IS NOT NULL;

CREATE OR REPLACE FUNCTION public.proteger_campos_plataforma_arena()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Servidor da plataforma (service_role) e SQL Editor (postgres) podem tudo
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.slug_anterior IS DISTINCT FROM OLD.slug_anterior
     OR NEW.modulos_ativos IS DISTINCT FROM OLD.modulos_ativos
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.token_convite IS DISTINCT FROM OLD.token_convite
     OR NEW.setup_concluido_em IS DISTINCT FROM OLD.setup_concluido_em
     OR (NEW.modo_pagamento = 'simulado' AND OLD.modo_pagamento IS DISTINCT FROM 'simulado')
  THEN
    RAISE EXCEPTION 'Este dado só pode ser alterado pelo suporte da plataforma.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_campos_plataforma_arena() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_campos_plataforma_arena ON public.arenas;
CREATE TRIGGER trg_proteger_campos_plataforma_arena
  BEFORE UPDATE ON public.arenas
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_plataforma_arena();
