-- ==============================================================================
-- Hora grátis do Clube com aprovação do dono (SPEC/2026-11-02-admin-ajustes-demo.md §10)
--
-- Bateu a meta: o voucher nasce "em_analise". O dono (ou gerente) libera ("disponivel", que o
-- checkout já entende) ou recusa ("recusado", com motivo). Só depois de liberado o atleta vê e usa.
--
-- Segurança: a equipe da arena passa a só LER vouchers. Gravar (emitir, liberar, recusar, consumir)
-- é só pelo servidor (service_role), que confere o papel; antes, qualquer membro (inclusive o
-- operador de balcão) conseguia alterar o status direto pela API.
--
-- Pré-requisito: 2026-11-02-f-quadra-fechada.sql. Idempotente.
-- ==============================================================================

ALTER TABLE public.fidelidade_vouchers
  ADD COLUMN IF NOT EXISTS analisado_por UUID,
  ADD COLUMN IF NOT EXISTS analisado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_analise TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fidelidade_vouchers_status_check') THEN
    ALTER TABLE public.fidelidade_vouchers ADD CONSTRAINT fidelidade_vouchers_status_check
      CHECK (status IN ('em_analise', 'disponivel', 'recusado', 'utilizado', 'expirado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fidelidade_vouchers_motivo_check') THEN
    ALTER TABLE public.fidelidade_vouchers ADD CONSTRAINT fidelidade_vouchers_motivo_check
      CHECK (motivo_analise IS NULL OR char_length(motivo_analise) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fidelidade_vouchers_recusa_check') THEN
    ALTER TABLE public.fidelidade_vouchers ADD CONSTRAINT fidelidade_vouchers_recusa_check
      CHECK (status <> 'recusado' OR coalesce(trim(motivo_analise), '') <> '');
  END IF;
END $$;

-- Fila do painel: pedidos em análise por arena
CREATE INDEX IF NOT EXISTS idx_fidelidade_vouchers_arena_status ON public.fidelidade_vouchers (arena_id, status);

-- Equipe só lê; gravação só pelo servidor
DROP POLICY IF EXISTS "Gestão de vouchers por operadores" ON public.fidelidade_vouchers;
DROP POLICY IF EXISTS "Equipe lê os vouchers da arena" ON public.fidelidade_vouchers;
CREATE POLICY "Equipe lê os vouchers da arena"
  ON public.fidelidade_vouchers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_vouchers.arena_id AND au.user_id = (SELECT auth.uid()) AND au.ativo = true));
