-- ==============================================================================
-- Bloqueio de cliente por arena (SPEC/2026-11-02-admin-revisao.md, Plano F, tela Clientes)
--
-- O `usuarios.bloqueado` é da conta do atleta, que vale em todas as arenas: uma arena não pode
-- bloquear o atleta nas outras. O bloqueio passa a ser por arena e pelo WhatsApp (vale também para
-- quem reserva sem conta). O checkout confere esta tabela antes de criar a reserva.
--
-- Leitura pela equipe da arena; gravação só pelo servidor (rota do painel confere o papel).
--
-- Pré-requisito: 2026-11-02-c-balcao-reservas.sql. Idempotente.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.arena_clientes_bloqueados (
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  motivo TEXT NOT NULL,
  bloqueado_por UUID,
  bloqueado_por_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (arena_id, telefone),
  CONSTRAINT arena_clientes_bloqueados_telefone_check CHECK (telefone ~ '^[0-9]{10,11}$'),
  CONSTRAINT arena_clientes_bloqueados_motivo_check CHECK (length(motivo) BETWEEN 3 AND 300)
);

ALTER TABLE public.arena_clientes_bloqueados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe da arena vê os clientes bloqueados" ON public.arena_clientes_bloqueados;
CREATE POLICY "Equipe da arena vê os clientes bloqueados"
  ON public.arena_clientes_bloqueados FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.arena_usuarios au
     WHERE au.arena_id = arena_clientes_bloqueados.arena_id AND au.user_id = auth.uid() AND au.ativo = true
  ));

REVOKE ALL ON public.arena_clientes_bloqueados FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.arena_clientes_bloqueados FROM authenticated;
GRANT SELECT ON public.arena_clientes_bloqueados TO authenticated;
