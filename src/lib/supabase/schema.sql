-- ==============================================================================
-- Schema da Tabela 'reservas' para o Supabase (PostgreSQL)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reservas (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  quadra_id TEXT NOT NULL,
  nome_cliente TEXT NOT NULL DEFAULT '',
  whatsapp_cliente TEXT NOT NULL DEFAULT '',
  telefone_cliente TEXT DEFAULT '',
  cpf_cliente TEXT NOT NULL DEFAULT '',
  data DATE NOT NULL,
  horarios TEXT[] NOT NULL DEFAULT '{}',
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  valor_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_sinal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_pendente NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_processamento',
  status_whatsapp TEXT NOT NULL DEFAULT 'nao_enviado',
  esporte TEXT,
  observacoes TEXT,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração incremental caso a coluna user_id não exista em bases já criadas
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS valor_original NUMERIC(10, 2);
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS desconto_fidelidade NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS vouchers_utilizados TEXT[] DEFAULT '{}';
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS reserva_gratuita_fidelidade BOOLEAN DEFAULT false;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT DEFAULT 'pix';


-- Tabela de Usuários para Login com WhatsApp e Senha (sem exigência de provedor de SMS pago)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  telefone TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  data_nascimento DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_telefone ON public.usuarios (telefone);

-- Habilitar RLS em usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuarios' AND policyname = 'Permitir acesso completo a usuarios'
  ) THEN
    CREATE POLICY "Permitir acesso completo a usuarios"
      ON public.usuarios FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Índices para consultas otimizadas da agenda e prevenção de double booking
CREATE INDEX IF NOT EXISTS idx_reservas_data_quadra ON public.reservas (data, quadra_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON public.reservas (status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para a Anon Key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'Permitir leitura pública de reservas'
  ) THEN
    CREATE POLICY "Permitir leitura pública de reservas"
      ON public.reservas FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'Permitir inserção de novas reservas'
  ) THEN
    CREATE POLICY "Permitir inserção de novas reservas"
      ON public.reservas FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'Permitir atualização de reservas'
  ) THEN
    CREATE POLICY "Permitir atualização de reservas"
      ON public.reservas FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'Permitir remoção de reservas'
  ) THEN
    CREATE POLICY "Permitir remoção de reservas"
      ON public.reservas FOR DELETE
      USING (true);
  END IF;
END $$;

-- Habilitar RLS em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir leitura de perfis'
  ) THEN
    CREATE POLICY "Permitir leitura de perfis"
      ON public.profiles FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir inserção e atualização do próprio perfil'
  ) THEN
    CREATE POLICY "Permitir inserção e atualização do próprio perfil"
      ON public.profiles FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Habilita Realtime na publicação padrão do Supabase
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- Reservas recorrentes (Escolinhas e Grupos Comuns)
-- Spec: SPEC/2026-10-05-reservas-recorrentes.md
-- ==============================================================================

-- Campos que ligam cada ocorrência (reserva materializada) ao seu contrato
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS contrato_id TEXT;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS tipo_reserva TEXT DEFAULT 'avulsa';
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS aviso_cancelamento_em DATE;

CREATE INDEX IF NOT EXISTS idx_reservas_contrato ON public.reservas (contrato_id);

-- Contratos recorrentes: um registro por escolinha ou grupo
CREATE TABLE IF NOT EXISTS public.contratos_recorrentes (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('escolinha', 'grupo')),
  nome TEXT NOT NULL,
  esporte TEXT,
  descricao TEXT,
  responsavel_nome TEXT NOT NULL DEFAULT '',
  contato_whatsapp TEXT NOT NULL DEFAULT '',
  quadra_id TEXT NOT NULL,
  dias_semana INTEGER[] NOT NULL DEFAULT '{}',
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  meses INTEGER NOT NULL DEFAULT 6,
  foto_url TEXT,
  faixa_etaria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contratos_recorrentes ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE public.contratos_recorrentes ADD COLUMN IF NOT EXISTS faixa_etaria TEXT;

CREATE INDEX IF NOT EXISTS idx_contratos_tipo ON public.contratos_recorrentes (tipo, ativo);

ALTER TABLE public.contratos_recorrentes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contratos_recorrentes' AND policyname = 'Permitir acesso completo a contratos'
  ) THEN
    CREATE POLICY "Permitir acesso completo a contratos"
      ON public.contratos_recorrentes FOR ALL
      USING (true)
      WITH CHECK (true);
END $$;

-- ==============================================================================
-- Sistema de Vagas Abertas para Jogadores
-- Spec: SPEC/2026-10-05-sistema-vagas-jogadores.md
-- ==============================================================================

-- 1. Colunas adicionais na tabela 'reservas'
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS permite_vagas BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS vagas_abertas INTEGER DEFAULT 0;

-- 2. Tabela de Interesses de Vagas
CREATE TABLE IF NOT EXISTS public.interesses_vagas (
  id TEXT PRIMARY KEY,
  reserva_id TEXT NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL,
  nome_usuario TEXT NOT NULL DEFAULT '',
  telefone_usuario TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas otimizadas
CREATE INDEX IF NOT EXISTS idx_interesses_reserva ON public.interesses_vagas (reserva_id);
CREATE INDEX IF NOT EXISTS idx_interesses_usuario ON public.interesses_vagas (usuario_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.interesses_vagas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'interesses_vagas' AND policyname = 'Permitir acesso completo a interesses_vagas'
  ) THEN
    CREATE POLICY "Permitir acesso completo a interesses_vagas"
      ON public.interesses_vagas FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- Sistema de Fidelidade (Ticket Médio e Recompensas)
-- Spec: SPEC/2026-10-05-sistema-fidelidade.md
-- ==============================================================================

-- 1. Tabela de Configuração da Campanha
CREATE TABLE IF NOT EXISTS public.fidelidade_campanha (
  id TEXT PRIMARY KEY DEFAULT 'campanha_padrao',
  nome TEXT NOT NULL DEFAULT 'Fidelidade Campeão Reservei',
  horas_necessarias INTEGER NOT NULL DEFAULT 12,
  meses_validade INTEGER NOT NULL DEFAULT 3,
  dias_validade_voucher INTEGER NOT NULL DEFAULT 60,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insere campanha padrão se não existir
INSERT INTO public.fidelidade_campanha (id, nome, horas_necessarias, meses_validade, dias_validade_voucher, ativo)
VALUES ('campanha_padrao', 'Fidelidade Campeão Reservei', 12, 3, 60, true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS em fidelidade_campanha
ALTER TABLE public.fidelidade_campanha ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fidelidade_campanha' AND policyname = 'Permitir acesso completo a fidelidade_campanha'
  ) THEN
    CREATE POLICY "Permitir acesso completo a fidelidade_campanha"
      ON public.fidelidade_campanha FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Tabela de Selos de Horas Concluídas
CREATE TABLE IF NOT EXISTS public.fidelidade_selos (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  reserva_id TEXT NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  horas_contabilizadas INTEGER NOT NULL DEFAULT 1,
  valor_por_hora NUMERIC(10, 2) NOT NULL DEFAULT 0,
  valor_total_reserva NUMERIC(10, 2) NOT NULL DEFAULT 0,
  data_jogo DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em DATE NOT NULL,
  resgatado BOOLEAN NOT NULL DEFAULT FALSE,
  voucher_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_fidelidade_selos_usuario ON public.fidelidade_selos (usuario_id, resgatado, expira_em);
CREATE INDEX IF NOT EXISTS idx_fidelidade_selos_reserva ON public.fidelidade_selos (reserva_id);

-- Habilitar RLS em fidelidade_selos
ALTER TABLE public.fidelidade_selos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fidelidade_selos' AND policyname = 'Permitir acesso completo a fidelidade_selos'
  ) THEN
    CREATE POLICY "Permitir acesso completo a fidelidade_selos"
      ON public.fidelidade_selos FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Tabela de Vouchers Conquistados
CREATE TABLE IF NOT EXISTS public.fidelidade_vouchers (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  usuario_id TEXT NOT NULL,
  valor_teto NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disponivel', -- 'disponivel' | 'utilizado' | 'expirado'
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em DATE NOT NULL,
  reserva_utilizada_id TEXT REFERENCES public.reservas(id) ON DELETE SET NULL,
  utilizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fidelidade_vouchers_usuario ON public.fidelidade_vouchers (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_fidelidade_vouchers_codigo ON public.fidelidade_vouchers (codigo);

-- Habilitar RLS em fidelidade_vouchers
ALTER TABLE public.fidelidade_vouchers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fidelidade_vouchers' AND policyname = 'Permitir acesso completo a fidelidade_vouchers'
  ) THEN
    CREATE POLICY "Permitir acesso completo a fidelidade_vouchers"
      ON public.fidelidade_vouchers FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;



-- ==============================================================================
-- Bloqueio de Usu�rios
-- Spec: SPEC/2026-10-06-bloqueio-usuarios.md
-- ==============================================================================

-- Adiciona os campos � tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;


ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT FALSE;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;


-- ==============================================================================
-- Landing Page: Conteúdo Institucional (Estrutura e Escolinhas)
-- Spec: SPEC/2026-10-06-lp-conteudo-institucional.md
-- ==============================================================================

-- 1. Tabela de Galeria de Fotos da Estrutura Física
CREATE TABLE IF NOT EXISTS public.landing_page_gallery (
  id TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'quadras',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_gallery_order ON public.landing_page_gallery (display_order, is_active);
CREATE INDEX IF NOT EXISTS idx_lp_gallery_categoria ON public.landing_page_gallery (categoria);

-- Habilitar RLS em landing_page_gallery
ALTER TABLE public.landing_page_gallery ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'landing_page_gallery' AND policyname = 'Permitir leitura pública de fotos da galeria'
  ) THEN
    CREATE POLICY "Permitir leitura pública de fotos da galeria"
      ON public.landing_page_gallery FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'landing_page_gallery' AND policyname = 'Permitir gestão completa de fotos da galeria'
  ) THEN
    CREATE POLICY "Permitir gestão completa de fotos da galeria"
      ON public.landing_page_gallery FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Tabela de Escolinhas Esportivas
CREATE TABLE IF NOT EXISTS public.landing_page_schools (
  id TEXT PRIMARY KEY,
  contrato_id TEXT,
  sport_name TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  teacher_image_url TEXT NOT NULL,
  schedule_info TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  descricao TEXT,
  faixa_etaria TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.landing_page_schools ADD COLUMN IF NOT EXISTS contrato_id TEXT;
CREATE INDEX IF NOT EXISTS idx_lp_schools_active ON public.landing_page_schools (is_active, sport_name);
CREATE INDEX IF NOT EXISTS idx_lp_schools_contrato ON public.landing_page_schools (contrato_id);

-- Habilitar RLS em landing_page_schools
ALTER TABLE public.landing_page_schools ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'landing_page_schools' AND policyname = 'Permitir leitura pública de escolinhas'
  ) THEN
    CREATE POLICY "Permitir leitura pública de escolinhas"
      ON public.landing_page_schools FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'landing_page_schools' AND policyname = 'Permitir gestão completa de escolinhas'
  ) THEN
    CREATE POLICY "Permitir gestão completa de escolinhas"
      ON public.landing_page_schools FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Storage Bucket para fotos institucionais
INSERT INTO storage.buckets (id, name, public)
VALUES ('institucional', 'institucional', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Permitir leitura pública do bucket institucional'
  ) THEN
    CREATE POLICY "Permitir leitura pública do bucket institucional"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'institucional');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Permitir upload no bucket institucional'
  ) THEN
    CREATE POLICY "Permitir upload no bucket institucional"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'institucional');
  END IF;
END $$;

-- ==============================================================================
-- Fase 1: Arquitetura Multi-Tenant, Quadras Dinâmicas e Segurança RLS
-- Spec: SPEC/2026-10-14-arquitetura-multi-tenant-seguranca.md
-- ==============================================================================

-- 1. Tabela de Arenas (Tenants)
CREATE TABLE IF NOT EXISTS public.arenas (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cnpj_cpf TEXT,
  telefone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  email TEXT,
  endereco TEXT,
  cidade TEXT NOT NULL DEFAULT 'Belém',
  estado TEXT NOT NULL DEFAULT 'PA',
  cep TEXT,
  logo_url TEXT,
  horario_abertura TEXT NOT NULL DEFAULT '06:00',
  horario_fechamento TEXT NOT NULL DEFAULT '23:00',
  intervalo_minutos INTEGER NOT NULL DEFAULT 60,
  percentual_sinal_minimo NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  antecedencia_minima_minutos INTEGER NOT NULL DEFAULT 60,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arenas_slug ON public.arenas (slug);
CREATE INDEX IF NOT EXISTS idx_arenas_ativo ON public.arenas (ativo);

-- 2. Tabela de Quadras Heterogêneas e Dinâmicas
CREATE TABLE IF NOT EXISTS public.quadras (
  id TEXT PRIMARY KEY,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo_piso TEXT NOT NULL DEFAULT 'areia',
  esportes TEXT[] NOT NULL DEFAULT '{}',
  coberta BOOLEAN NOT NULL DEFAULT FALSE,
  iluminacao BOOLEAN NOT NULL DEFAULT TRUE,
  valor_hora_padrao NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quadras_arena ON public.quadras (arena_id, ativa, ordem);

-- 3. Tabela de Preços Dinâmicos por Faixa e Dia da Semana
CREATE TABLE IF NOT EXISTS public.quadras_precos (
  id TEXT PRIMARY KEY,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  quadra_id TEXT NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  dias_semana INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  valor_hora NUMERIC(10, 2) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quadras_precos_quadra ON public.quadras_precos (quadra_id, ativo);
CREATE INDEX IF NOT EXISTS idx_quadras_precos_arena ON public.quadras_precos (arena_id);

-- 4. Tabela de Vínculo de Usuários com Arenas (RBAC Inicial)
CREATE TABLE IF NOT EXISTS public.arena_usuarios (
  id TEXT PRIMARY KEY,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('proprietario', 'gerente', 'operador')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(arena_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_arena_usuarios_lookup ON public.arena_usuarios (user_id, arena_id);

-- 5. Seed da Arena Padrão (Retrocompatibilidade)
INSERT INTO public.arenas (
  id, slug, nome, telefone, whatsapp, cidade, estado, horario_abertura, horario_fechamento, ativo
)
VALUES (
  'arena-padrao', 'arena-demo', 'Arena Reservei Demo', '(91) 98123-4567', '(91) 98123-4567', 'Belém', 'PA', '08:00', '22:00', true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quadras (
  id, arena_id, numero, nome, descricao, tipo_piso, esportes, coberta, iluminacao, valor_hora_padrao, ordem, ativa
)
VALUES 
  ('q1', 'arena-padrao', 1, 'Quadra 1 - Poliesportiva', 'Quadra coberta com piso PU de alta aderência', 'pu_cimentado', ARRAY['Futsal', 'Vôlei', 'Basquete', 'Handebol'], true, true, 90.00, 1, true),
  ('q2', 'arena-padrao', 2, 'Quadra 2 - Poliesportiva', 'Quadra coberta com piso PU de alta aderência', 'pu_cimentado', ARRAY['Futsal', 'Vôlei', 'Basquete', 'Handebol'], true, true, 90.00, 2, true),
  ('q3', 'arena-padrao', 3, 'Quadra 3 - Poliesportiva', 'Quadra coberta com piso PU de alta aderência', 'pu_cimentado', ARRAY['Futsal', 'Vôlei', 'Basquete', 'Handebol'], true, true, 90.00, 3, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Adição da coluna arena_id nas tabelas existentes e migração de registros órfãos
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.reservas SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservas_arena_data ON public.reservas (arena_id, data);

ALTER TABLE public.contratos_recorrentes ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.contratos_recorrentes SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_contratos_arena ON public.contratos_recorrentes (arena_id, tipo, ativo);

ALTER TABLE public.fidelidade_campanha ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.fidelidade_campanha SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fidelidade_campanha_arena ON public.fidelidade_campanha (arena_id);

ALTER TABLE public.fidelidade_selos ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.fidelidade_selos SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fidelidade_selos_arena ON public.fidelidade_selos (arena_id, usuario_id);

ALTER TABLE public.fidelidade_vouchers ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.fidelidade_vouchers SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_fidelidade_vouchers_arena ON public.fidelidade_vouchers (arena_id, usuario_id);

ALTER TABLE public.landing_page_gallery ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.landing_page_gallery SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;

ALTER TABLE public.landing_page_schools ADD COLUMN IF NOT EXISTS arena_id TEXT;
UPDATE public.landing_page_schools SET arena_id = 'arena-padrao' WHERE arena_id IS NULL;

-- 7. Habilitar RLS nas novas tabelas
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_usuarios ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS
DO $$
BEGIN
  -- arenas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'arenas' AND policyname = 'Permitir leitura pública de arenas ativas') THEN
    CREATE POLICY "Permitir leitura pública de arenas ativas" ON public.arenas FOR SELECT USING (ativo = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'arenas' AND policyname = 'Permitir gestão de arenas para administradores') THEN
    CREATE POLICY "Permitir gestão de arenas para administradores" ON public.arenas FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- quadras
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quadras' AND policyname = 'Permitir leitura pública de quadras ativas') THEN
    CREATE POLICY "Permitir leitura pública de quadras ativas" ON public.quadras FOR SELECT USING (ativa = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quadras' AND policyname = 'Permitir gestão de quadras por administradores') THEN
    CREATE POLICY "Permitir gestão de quadras por administradores" ON public.quadras FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- quadras_precos
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quadras_precos' AND policyname = 'Permitir leitura pública de tarifas') THEN
    CREATE POLICY "Permitir leitura pública de tarifas" ON public.quadras_precos FOR SELECT USING (ativo = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quadras_precos' AND policyname = 'Permitir gestão de tarifas por administradores') THEN
    CREATE POLICY "Permitir gestão de tarifas por administradores" ON public.quadras_precos FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- arena_usuarios
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'arena_usuarios' AND policyname = 'Permitir consulta de vínculos de operadores') THEN
    CREATE POLICY "Permitir consulta de vínculos de operadores" ON public.arena_usuarios FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==============================================================================
-- Fase 2: Motor de Pagamento Pix Real e Lock Transacional de Concorrência
-- Spec: SPEC/2026-10-16-pagamento-pix-lock-concorrencia.md
-- ==============================================================================

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS pix_txid TEXT;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS pix_copia_cola TEXT;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS pix_qr_code_url TEXT;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS gateway_provedor TEXT DEFAULT 'mock';
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS gateway_transacao_id TEXT;

-- Índice para consultas otimizadas de expiração de locks e status transacionais
CREATE INDEX IF NOT EXISTS idx_reservas_lock_expira ON public.reservas (status, expira_em);
CREATE INDEX IF NOT EXISTS idx_reservas_pix_txid ON public.reservas (pix_txid);



