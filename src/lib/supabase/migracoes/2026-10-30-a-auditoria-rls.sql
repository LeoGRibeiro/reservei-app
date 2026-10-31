-- ==============================================================================
-- Auditoria de RLS do portal (SPEC/2026-10-30-implementacao-template-portal.md §4.0)
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.
--
-- Policies criadas nas primeiras versões do schema com USING (true) nunca foram removidas, porque a
-- Fase 6 derrubou nomes parecidos ("Permitir acesso a ...") e não estes ("Permitir acesso completo
-- a ..."). Como policies permissivas somam (OR), qualquer uma delas abre a tabela inteira para
-- qualquer visitante: ler e alterar galeria, escolinhas, contratos, fidelidade e pedidos de vaga
-- (com nome e telefone) de todas as arenas.
--
-- Para conferir antes e depois:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' and (qual = 'true' or with_check = 'true') order by 1, 2;
-- Depois desta migração, a consulta não deve devolver nenhuma linha.
-- As policies corretas de cada tabela (Fases 6 e 7) continuam valendo.
-- ==============================================================================

DROP POLICY IF EXISTS "Permitir gestão completa de fotos da galeria" ON public.landing_page_gallery;
DROP POLICY IF EXISTS "Permitir leitura pública de fotos da galeria" ON public.landing_page_gallery;
DROP POLICY IF EXISTS "Permitir gestão completa de escolinhas" ON public.landing_page_schools;
DROP POLICY IF EXISTS "Permitir leitura pública de escolinhas" ON public.landing_page_schools;
DROP POLICY IF EXISTS "Permitir acesso completo a contratos" ON public.contratos_recorrentes;
DROP POLICY IF EXISTS "Permitir acesso completo a fidelidade_campanha" ON public.fidelidade_campanha;
DROP POLICY IF EXISTS "Permitir acesso completo a fidelidade_selos" ON public.fidelidade_selos;
DROP POLICY IF EXISTS "Permitir acesso completo a fidelidade_vouchers" ON public.fidelidade_vouchers;
DROP POLICY IF EXISTS "Permitir acesso completo a interesses_vagas" ON public.interesses_vagas;

-- Tabela legada (bases antigas): perfis abertos para leitura e escrita de qualquer visitante
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Permitir leitura de perfis" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Permitir inserção e atualização do próprio perfil" ON public.profiles';
  END IF;
END $$;
