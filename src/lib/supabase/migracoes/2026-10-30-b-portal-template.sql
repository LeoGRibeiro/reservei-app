-- ==============================================================================
-- Portal da arena: template multiarena (SPEC/2026-10-30-implementacao-template-portal.md §4 e §5)
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.
-- Requer a Fase 8 e a auditoria de RLS (2026-10-30-a-auditoria-rls.sql).
--
-- Regra de RLS de todas as tabelas novas: leitura pública só do que é público (e ativo); escrita só
-- por proprietário ou gerente da arena (arena_usuarios). `codigos_acesso` é só do servidor.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Colunas novas: tema e contato da arena, foto das quadras, turmas das escolinhas
-- ------------------------------------------------------------------------------
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS tema JSONB,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS mapa_url TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_referencia TEXT;

ALTER TABLE public.quadras
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_posicao TEXT,
  ADD COLUMN IF NOT EXISTS foto_descricao TEXT;

-- turmas: [{ "dias": "Seg e Qua", "horas": "16h", "nivel": "Avançado" }]
ALTER TABLE public.landing_page_schools
  ADD COLUMN IF NOT EXISTS turmas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;

-- Várias turmas (contratos que reservam horários) apontam para a mesma escolinha do site
ALTER TABLE public.contratos_recorrentes ADD COLUMN IF NOT EXISTS escolinha_id TEXT;
CREATE INDEX IF NOT EXISTS idx_contratos_escolinha ON public.contratos_recorrentes (escolinha_id);

-- Teto fixo da hora grátis do Clube (nulo = ticket médio dos carimbos, como antes)
ALTER TABLE public.fidelidade_campanha ADD COLUMN IF NOT EXISTS valor_teto_voucher NUMERIC(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quadras_foto_posicao_check') THEN
    -- object-position seguro: só porcentagens (ex.: '50% 62%'), nunca CSS livre
    ALTER TABLE public.quadras ADD CONSTRAINT quadras_foto_posicao_check
      CHECK (foto_posicao IS NULL OR foto_posicao ~ '^[0-9]{1,3}% [0-9]{1,3}%$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_page_schools_turmas_check') THEN
    ALTER TABLE public.landing_page_schools ADD CONSTRAINT landing_page_schools_turmas_check
      CHECK (jsonb_typeof(turmas) = 'array');
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Conteúdo do site, uma linha por arena
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arena_conteudo (
  arena_id TEXT PRIMARY KEY REFERENCES public.arenas(id) ON DELETE CASCADE,
  intro_reserva TEXT,
  intro_escolinhas TEXT,
  intro_eventos TEXT,
  intro_estrutura TEXT,
  -- [{ "destaque": "3 quadras de areia", "resto": "tratada" }]
  destaques_estrutura JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(destaques_estrutura) = 'array'),
  -- [{ "titulo": "Chegue 10 minutos antes.", "texto": "..." }]
  regras JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(regras) = 'array'),
  -- [{ "pergunta": "...", "resposta": "..." }]
  faq JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(faq) = 'array'),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Campeonatos e eventos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eventos (
  id TEXT PRIMARY KEY,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  modalidade TEXT,
  descricao_curta TEXT,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  horario TEXT,
  status TEXT NOT NULL DEFAULT 'inscricoes' CHECK (status IN ('inscricoes', 'em_andamento', 'encerrado')),
  -- [{ "rotulo": "Inscrição", "valor": "R$ 120 por dupla" }]
  dados JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dados) = 'array'),
  inscricao_tipo TEXT CHECK (inscricao_tipo IS NULL OR inscricao_tipo IN ('formulario', 'whatsapp', 'confirmar_presenca')),
  inscricao_url TEXT,
  mensagem_whatsapp TEXT,
  -- Rolando agora: [{ "rotulo": "Semifinais · sábado, 31/10", "final": false,
  --                   "jogos": [{ "hora": "15h", "lados": ["Dupla A", "Dupla B"] }] }]
  chave JSONB CHECK (chave IS NULL OR jsonb_typeof(chave) = 'array'),
  link_rotulo TEXT,
  link_url TEXT,
  campeoes TEXT,
  rotulo_campeoes TEXT,
  placar_final TEXT,
  foto_url TEXT,
  foto_posicao TEXT CHECK (foto_posicao IS NULL OR foto_posicao ~ '^[0-9]{1,3}% [0-9]{1,3}%$'),
  foto_descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eventos_arena ON public.eventos (arena_id, ativo, status, data_inicio);

-- ------------------------------------------------------------------------------
-- 4. Instagram: posts e perfil exibidos no site (cadastrados pela arena; depois, pela API)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id TEXT PRIMARY KEY,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  imagem_url TEXT NOT NULL,
  imagem_largura INTEGER,
  imagem_altura INTEGER,
  imagem_posicao TEXT CHECK (imagem_posicao IS NULL OR imagem_posicao ~ '^[0-9]{1,3}% [0-9]{1,3}%$'),
  descricao TEXT,
  legenda TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'reels', 'carrossel')),
  link TEXT,
  publicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fixado BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_arena ON public.instagram_posts (arena_id, ativo, fixado DESC, publicado_em DESC);

CREATE TABLE IF NOT EXISTS public.instagram_perfil (
  arena_id TEXT PRIMARY KEY REFERENCES public.arenas(id) ON DELETE CASCADE,
  seguidores INTEGER,
  total_posts INTEGER,
  -- Contagens digitadas para demonstração aparecem com "(simulado)"
  contagem_simulada BOOLEAN NOT NULL DEFAULT FALSE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Entrar com código no WhatsApp (§5.1): só o servidor lê e grava (sem policies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.codigos_acesso (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  arena_id TEXT REFERENCES public.arenas(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  ip TEXT,
  codigo_hash TEXT NOT NULL,
  provedor TEXT NOT NULL CHECK (provedor IN ('demonstracao', 'meta')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_codigos_acesso_telefone ON public.codigos_acesso (telefone, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_codigos_acesso_ip ON public.codigos_acesso (ip, criado_em DESC);
ALTER TABLE public.codigos_acesso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.codigos_acesso FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6. Reservas: reembolso no cancelamento (§5.2) e partida completa no mural
--    O status continua 'cancelada'; o reembolso fica em colunas próprias.
-- ------------------------------------------------------------------------------
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS reembolso_status TEXT,
  ADD COLUMN IF NOT EXISTS reembolso_valor NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS reembolsado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vagas_completa BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_reembolso_status_check') THEN
    ALTER TABLE public.reservas ADD CONSTRAINT reservas_reembolso_status_check
      CHECK (reembolso_status IS NULL OR reembolso_status IN ('pendente', 'reembolsado'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. RLS das tabelas novas
-- ------------------------------------------------------------------------------
ALTER TABLE public.arena_conteudo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública do conteúdo da arena" ON public.arena_conteudo;
DROP POLICY IF EXISTS "Gestão do conteúdo por operadores" ON public.arena_conteudo;
DROP POLICY IF EXISTS "Leitura pública de eventos ativos" ON public.eventos;
DROP POLICY IF EXISTS "Gestão de eventos por operadores" ON public.eventos;
DROP POLICY IF EXISTS "Leitura pública de posts ativos" ON public.instagram_posts;
DROP POLICY IF EXISTS "Gestão de posts por operadores" ON public.instagram_posts;
DROP POLICY IF EXISTS "Leitura pública do perfil do Instagram" ON public.instagram_perfil;
DROP POLICY IF EXISTS "Gestão do perfil do Instagram por operadores" ON public.instagram_perfil;

CREATE POLICY "Leitura pública do conteúdo da arena"
  ON public.arena_conteudo FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_conteudo.arena_id AND a.ativo = true));

CREATE POLICY "Gestão do conteúdo por operadores"
  ON public.arena_conteudo FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = arena_conteudo.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = arena_conteudo.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true));

CREATE POLICY "Leitura pública de eventos ativos"
  ON public.eventos FOR SELECT TO public
  USING (ativo = true);

CREATE POLICY "Gestão de eventos por operadores"
  ON public.eventos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = eventos.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = eventos.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true));

CREATE POLICY "Leitura pública de posts ativos"
  ON public.instagram_posts FOR SELECT TO public
  USING (ativo = true);

CREATE POLICY "Gestão de posts por operadores"
  ON public.instagram_posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = instagram_posts.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = instagram_posts.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true));

CREATE POLICY "Leitura pública do perfil do Instagram"
  ON public.instagram_perfil FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = instagram_perfil.arena_id AND a.ativo = true));

CREATE POLICY "Gestão do perfil do Instagram por operadores"
  ON public.instagram_perfil FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = instagram_perfil.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = instagram_perfil.arena_id AND au.user_id = (SELECT auth.uid())
      AND au.role IN ('proprietario', 'gerente') AND au.ativo = true));

-- ------------------------------------------------------------------------------
-- 8. Grade pública: inclui a partida completa e a turma (escolinha) de cada horário de aula
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.grade_publica(TEXT, DATE, DATE);
CREATE OR REPLACE FUNCTION public.grade_publica(
  p_arena_id TEXT, p_data_inicio DATE DEFAULT NULL, p_data_fim DATE DEFAULT NULL)
RETURNS TABLE (
  id TEXT, arena_id TEXT, quadra_id TEXT, data DATE, horarios TEXT[], hora_inicio TEXT, hora_fim TEXT,
  status TEXT, esporte TEXT, tipo_reserva TEXT, contrato_id TEXT, expira_em TIMESTAMPTZ,
  permite_vagas BOOLEAN, vagas_abertas INTEGER, user_id TEXT, nome_cliente TEXT, whatsapp_cliente TEXT,
  escolinha_id TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.arena_id, r.quadra_id, r.data, r.horarios, r.hora_inicio, r.hora_fim, r.status, r.esporte,
         r.tipo_reserva, r.contrato_id, r.expira_em,
         COALESCE(r.permite_vagas, false), COALESCE(r.vagas_abertas, 0),
         CASE WHEN r.permite_vagas THEN r.user_id::text END,
         CASE WHEN r.tipo_reserva = 'escolinha' THEN r.nome_cliente
              WHEN r.permite_vagas THEN split_part(COALESCE(r.nome_cliente, ''), ' ', 1) END,
         CASE WHEN r.tipo_reserva = 'escolinha' THEN r.whatsapp_cliente END,
         c.escolinha_id
  FROM public.reservas r
  JOIN public.arenas a ON a.id = r.arena_id AND a.ativo = true
  LEFT JOIN public.contratos_recorrentes c ON c.id = r.contrato_id AND c.tipo = 'escolinha'
  WHERE r.arena_id = p_arena_id
    AND r.status IN ('confirmada', 'pendente', 'em_processamento')
    AND (p_data_inicio IS NULL OR r.data >= p_data_inicio)
    AND (p_data_fim IS NULL OR r.data <= p_data_fim);
$$;
REVOKE ALL ON FUNCTION public.grade_publica(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_publica(TEXT, DATE, DATE) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 9. Tempo real no painel: pedidos de vaga e Clube (além de reservas, que já estava)
--    O Realtime respeita o RLS: o operador recebe só o que pode ler da própria arena.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  tabela TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  FOREACH tabela IN ARRAY ARRAY['reservas', 'interesses_vagas', 'fidelidade_selos', 'fidelidade_vouchers'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tabela
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabela);
    END IF;
  END LOOP;
END $$;
