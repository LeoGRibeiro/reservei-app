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
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Tabela legada: só existe em bases antigas (o perfil atual fica em public.usuarios)
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

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
  END IF;
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
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT;


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
  modulos_ativos TEXT[] NOT NULL DEFAULT '{agendamento_core,fidelidade,vagas,escolinhas,contratos}',
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
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  arena_id TEXT NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- ==============================================================================
-- Fase 3: Supabase Auth real, RBAC multi-tenant e blindagem RLS
-- Spec: SPEC/2026-10-21-auth-supabase-rbac-subdominios.md
-- Script idempotente: pode ser executado mais de uma vez no SQL Editor.
-- ==============================================================================

-- 3.1. Feature Flags por arena (módulos contratados)
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS modulos_ativos TEXT[] NOT NULL
  DEFAULT '{agendamento_core,fidelidade,vagas,escolinhas,contratos}';

-- 3.2. RBAC: alinha public.arena_usuarios (bases antigas tinham user_id TEXT sem FK)
ALTER TABLE public.arena_usuarios ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

DO $$
BEGIN
  -- Converte user_id para UUID; remove vínculos de teste cujo user_id nunca foi um UUID válido
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'arena_usuarios'
      AND column_name = 'user_id' AND data_type <> 'uuid'
  ) THEN
    DELETE FROM public.arena_usuarios
    WHERE user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE public.arena_usuarios ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
  END IF;

  -- Vincula user_id a auth.users (descarta vínculos órfãos antes de criar a FK)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arena_usuarios_user_id_fkey') THEN
    DELETE FROM public.arena_usuarios WHERE user_id NOT IN (SELECT id FROM auth.users);
    ALTER TABLE public.arena_usuarios
      ADD CONSTRAINT arena_usuarios_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_arena_usuarios_rbac ON public.arena_usuarios (arena_id, user_id, ativo);

-- 3.3. Perfil de atletas: remove a senha em texto puro e vincula ao Supabase Auth
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS senha;
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_auth_user_id
  ON public.usuarios (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 3.4. Blindagem RLS ---------------------------------------------------------

-- public.arenas
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura pública de arenas" ON public.arenas;
DROP POLICY IF EXISTS "Permitir leitura pública de arenas ativas" ON public.arenas;
DROP POLICY IF EXISTS "Permitir modificação apenas por administradores" ON public.arenas;
DROP POLICY IF EXISTS "Permitir gestão de arenas para administradores" ON public.arenas;
DROP POLICY IF EXISTS "Permitir modificação apenas por proprietarios" ON public.arenas;

CREATE POLICY "Permitir leitura pública de arenas ativas"
  ON public.arenas FOR SELECT
  USING (ativo = true);

CREATE POLICY "Permitir modificação apenas por proprietarios"
  ON public.arenas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.arenas.id
        AND au.user_id = auth.uid()
        AND au.role = 'proprietario'
        AND au.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.arenas.id
        AND au.user_id = auth.uid()
        AND au.role = 'proprietario'
        AND au.ativo = true
    )
  );

-- public.quadras e public.quadras_precos
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de quadras" ON public.quadras;
DROP POLICY IF EXISTS "Permitir leitura pública de quadras ativas" ON public.quadras;
DROP POLICY IF EXISTS "Permitir gestão de quadras por administradores" ON public.quadras;
DROP POLICY IF EXISTS "Gestão de quadras por operadores da arena" ON public.quadras;
DROP POLICY IF EXISTS "Permitir leitura pública de precos" ON public.quadras_precos;
DROP POLICY IF EXISTS "Permitir leitura pública de tarifas" ON public.quadras_precos;
DROP POLICY IF EXISTS "Permitir gestão de tarifas por administradores" ON public.quadras_precos;
DROP POLICY IF EXISTS "Gestão de precos por operadores da arena" ON public.quadras_precos;

CREATE POLICY "Permitir leitura pública de quadras"
  ON public.quadras FOR SELECT
  USING (ativa = true);

CREATE POLICY "Permitir leitura pública de precos"
  ON public.quadras_precos FOR SELECT
  USING (ativo = true);

CREATE POLICY "Gestão de quadras por operadores da arena"
  ON public.quadras FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.quadras.arena_id
        AND au.user_id = auth.uid()
        AND au.role IN ('proprietario', 'gerente')
        AND au.ativo = true
    )
  );

CREATE POLICY "Gestão de precos por operadores da arena"
  ON public.quadras_precos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.quadras_precos.arena_id
        AND au.user_id = auth.uid()
        AND au.role IN ('proprietario', 'gerente')
        AND au.ativo = true
    )
  );

-- public.arena_usuarios
ALTER TABLE public.arena_usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir consulta de vínculos de operadores" ON public.arena_usuarios;
DROP POLICY IF EXISTS "Usuário consulta seus próprios vínculos de arena" ON public.arena_usuarios;

CREATE POLICY "Usuário consulta seus próprios vínculos de arena"
  ON public.arena_usuarios FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- public.reservas
-- ATENÇÃO: a cláusula de leitura pública por status mantém a grade de horários funcionando
-- com a anon key, mas expõe também CPF/telefone das reservas ativas. Mitigação planejada:
-- servir a disponibilidade por view/RPC sem colunas sensíveis e remover essa cláusula.
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leitura pública de reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir inserção de novas reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir atualização de reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir remoção de reservas" ON public.reservas;
DROP POLICY IF EXISTS "Leitura de reservas por clientes ou operadores" ON public.reservas;
DROP POLICY IF EXISTS "Criação de reservas para arenas ativas" ON public.reservas;
DROP POLICY IF EXISTS "Atualização de reservas por operadores" ON public.reservas;
DROP POLICY IF EXISTS "Exclusão de reservas por proprietarios" ON public.reservas;

CREATE POLICY "Leitura de reservas por clientes ou operadores"
  ON public.reservas FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id::text = auth.uid()::text)
    OR
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.ativo = true
    ))
    OR
    (status IN ('confirmada', 'pendente', 'em_processamento'))
  );

CREATE POLICY "Criação de reservas para arenas ativas"
  ON public.reservas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.arenas a
      WHERE a.id = public.reservas.arena_id
        AND a.ativo = true
    )
  );

CREATE POLICY "Atualização de reservas por operadores"
  ON public.reservas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.ativo = true
    )
  );

CREATE POLICY "Exclusão de reservas por proprietarios"
  ON public.reservas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.role = 'proprietario'
        AND au.ativo = true
    )
  );

-- public.usuarios (atletas)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso completo a usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Cliente acessa seu próprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Operadores consultam clientes da arena" ON public.usuarios;

CREATE POLICY "Cliente acessa seu próprio perfil"
  ON public.usuarios FOR ALL
  TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid()::text)
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid()::text);

CREATE POLICY "Operadores consultam clientes da arena"
  ON public.usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservas r
      JOIN public.arena_usuarios au ON au.arena_id = r.arena_id
      WHERE (r.user_id::text = public.usuarios.id OR r.whatsapp_cliente = public.usuarios.telefone)
        AND au.user_id = auth.uid()
        AND au.ativo = true
    )
  );

-- ==============================================================================
-- Fase 4: Setup de onboarding, webhooks via service role e LGPD na grade pública
-- Spec: SPEC/2026-10-21-setup-onboarding-admin-superadmin.md
-- Script idempotente. Requer a Fase 3 já aplicada.
-- ==============================================================================

-- View pública de slots ocupados: expõe apenas o necessário para desenhar a grade
-- (sem nome, telefone, CPF ou valores). Executa com os privilégios do dono da view,
-- por isso consegue ler a tabela base mesmo com o RLS fechado para visitantes.
-- OBS: substituída na Fase 7 pela função public.grade_publica(arena_id, ...), que exige a arena.
CREATE OR REPLACE VIEW public.view_grade_publica AS
SELECT
  id,
  arena_id,
  quadra_id,
  data,
  horarios,
  hora_inicio,
  hora_fim,
  status,
  esporte
FROM public.reservas
WHERE status IN ('confirmada', 'pendente', 'em_processamento');

GRANT SELECT ON public.view_grade_publica TO anon, authenticated;

-- Revoga a leitura pública direta da tabela base (dados sensíveis)
DROP POLICY IF EXISTS "Leitura de reservas por clientes ou operadores" ON public.reservas;

CREATE POLICY "Leitura de reservas por clientes ou operadores"
  ON public.reservas FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id::text = auth.uid()::text)
    OR
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.arena_usuarios au
      WHERE au.arena_id = public.reservas.arena_id
        AND au.user_id = auth.uid()
        AND au.ativo = true
    ))
  );

-- ==============================================================================
-- Fase 5: Token de convite do proprietário e trava de proprietário único
-- Spec: SPEC/2026-10-21-fechamento-convite-pix-escopo-arena.md
-- Script idempotente. Requer as Fases 3 e 4 já aplicadas.
-- ==============================================================================

-- 1. Token de convite (uso único) e data de conclusão do primeiro acesso
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS token_convite TEXT,
  ADD COLUMN IF NOT EXISTS setup_concluido_em TIMESTAMPTZ;

-- 2. Índice para validação eficiente do token
CREATE INDEX IF NOT EXISTS idx_arenas_token_convite
  ON public.arenas (token_convite)
  WHERE token_convite IS NOT NULL;

-- 3. Trava anti-concorrência: no máximo um proprietário ativo por arena
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_usuarios_proprietario_unico
  ON public.arena_usuarios (arena_id)
  WHERE role = 'proprietario' AND ativo = true;

-- 4. Arenas já existentes que ainda não têm nenhum operador (ex.: a arena demo) ganham um
--    convite, senão ninguém conseguiria fazer o primeiro acesso. Consulte-o com:
--    SELECT slug, token_convite FROM public.arenas WHERE token_convite IS NOT NULL;
UPDATE public.arenas a
SET token_convite = gen_random_uuid()::text
WHERE a.token_convite IS NULL
  AND a.setup_concluido_em IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = a.id AND au.ativo = true
  );


-- ==============================================================================
-- Fase 6: Fechamento das políticas abertas (USING true) das tabelas restantes
-- Tabelas: landing_page_gallery, landing_page_schools, contratos_recorrentes,
--          fidelidade_campanha, fidelidade_selos, fidelidade_vouchers, interesses_vagas
-- Regra: leitura pública só do que está ativo; escrita só por operadores da arena
--        (arena_usuarios). Atletas leem apenas os próprios selos, vouchers e interesses.
-- ==============================================================================

DROP POLICY IF EXISTS "Permitir acesso a contratos" ON public.contratos_recorrentes;
DROP POLICY IF EXISTS "Permitir acesso a fidelidade_campanha" ON public.fidelidade_campanha;
DROP POLICY IF EXISTS "Permitir acesso a fidelidade_selos" ON public.fidelidade_selos;
DROP POLICY IF EXISTS "Permitir acesso a fidelidade_vouchers" ON public.fidelidade_vouchers;
DROP POLICY IF EXISTS "Permitir acesso a interesses_vagas" ON public.interesses_vagas;
DROP POLICY IF EXISTS "Permitir gestão da galeria" ON public.landing_page_gallery;
DROP POLICY IF EXISTS "Permitir leitura da galeria" ON public.landing_page_gallery;
DROP POLICY IF EXISTS "Permitir gestão de escolinhas" ON public.landing_page_schools;
DROP POLICY IF EXISTS "Permitir leitura de escolinhas" ON public.landing_page_schools;

-- landing_page_gallery
CREATE POLICY "Leitura pública da galeria ativa"
  ON public.landing_page_gallery FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Gestão da galeria por operadores"
  ON public.landing_page_gallery FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = landing_page_gallery.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = landing_page_gallery.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true));

-- landing_page_schools
CREATE POLICY "Leitura pública das escolinhas ativas"
  ON public.landing_page_schools FOR SELECT TO public
  USING (is_active = true);

CREATE POLICY "Gestão das escolinhas por operadores"
  ON public.landing_page_schools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = landing_page_schools.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = landing_page_schools.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true));

-- contratos_recorrentes
CREATE POLICY "Leitura pública de contratos ativos"
  ON public.contratos_recorrentes FOR SELECT TO public
  USING (ativo = true);

CREATE POLICY "Gestão de contratos por operadores"
  ON public.contratos_recorrentes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = contratos_recorrentes.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = contratos_recorrentes.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true));

-- fidelidade_campanha
CREATE POLICY "Leitura pública de campanha ativa"
  ON public.fidelidade_campanha FOR SELECT TO public
  USING (ativo = true);

CREATE POLICY "Gestão de campanha por operadores"
  ON public.fidelidade_campanha FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_campanha.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_campanha.arena_id AND au.user_id = auth.uid()
      AND au.role IN ('proprietario','gerente') AND au.ativo = true));

-- fidelidade_selos
CREATE POLICY "Atleta lê seus próprios selos"
  ON public.fidelidade_selos FOR SELECT TO authenticated
  USING (usuario_id = auth.uid()::text);

CREATE POLICY "Gestão de selos por operadores"
  ON public.fidelidade_selos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_selos.arena_id AND au.user_id = auth.uid() AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_selos.arena_id AND au.user_id = auth.uid() AND au.ativo = true));

-- fidelidade_vouchers
CREATE POLICY "Atleta lê seus próprios vouchers"
  ON public.fidelidade_vouchers FOR SELECT TO authenticated
  USING (usuario_id = auth.uid()::text);

CREATE POLICY "Gestão de vouchers por operadores"
  ON public.fidelidade_vouchers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_vouchers.arena_id AND au.user_id = auth.uid() AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = fidelidade_vouchers.arena_id AND au.user_id = auth.uid() AND au.ativo = true));

-- interesses_vagas (sem arena_id: a arena vem da reserva)
CREATE POLICY "Atleta gerencia seus próprios interesses"
  ON public.interesses_vagas FOR ALL TO authenticated
  USING (usuario_id = auth.uid()::text)
  WITH CHECK (usuario_id = auth.uid()::text);

CREATE POLICY "Operadores gerenciam interesses da arena"
  ON public.interesses_vagas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reservas r
    JOIN public.arena_usuarios au ON au.arena_id = r.arena_id
    WHERE r.id = interesses_vagas.reserva_id AND au.user_id = auth.uid() AND au.ativo = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reservas r
    JOIN public.arena_usuarios au ON au.arena_id = r.arena_id
    WHERE r.id = interesses_vagas.reserva_id AND au.user_id = auth.uid() AND au.ativo = true));


-- ==============================================================================
-- Fase 7: Checkout no servidor, escopo estrito por arena e fidelidade antifraude
-- Spec: SPEC/2026-10-21-checkout-servidor-escopo-arena.md
-- Script idempotente. Requer a Fase 6 já aplicada.
-- ==============================================================================

-- 1. Token secreto do checkout (prova de autoria do lock; nunca exposto em leitura pública)
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS checkout_token TEXT;

-- 2. Visitantes não inserem mais direto: o público usa POST /api/reservas/checkout (service role),
--    que recalcula preço e disponibilidade. Só operadores inserem pelo navegador (balcão/bloqueios).
DROP POLICY IF EXISTS "Criação de reservas para arenas ativas" ON public.reservas;
DROP POLICY IF EXISTS "Criação de reservas por operadores" ON public.reservas;
CREATE POLICY "Criação de reservas por operadores"
  ON public.reservas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.arena_id = reservas.arena_id AND au.user_id = (SELECT auth.uid()) AND au.ativo = true));

-- 3. Grade pública por função com arena obrigatória (substitui a view SECURITY DEFINER).
--    Expõe só o necessário: horários, status, lock, vagas, primeiro nome do organizador (quando há
--    vagas abertas) e nome/contato comercial de escolinhas.
DROP VIEW IF EXISTS public.view_grade_publica;
CREATE OR REPLACE FUNCTION public.grade_publica(
  p_arena_id TEXT, p_data_inicio DATE DEFAULT NULL, p_data_fim DATE DEFAULT NULL)
RETURNS TABLE (
  id TEXT, arena_id TEXT, quadra_id TEXT, data DATE, horarios TEXT[], hora_inicio TEXT, hora_fim TEXT,
  status TEXT, esporte TEXT, tipo_reserva TEXT, contrato_id TEXT, expira_em TIMESTAMPTZ,
  permite_vagas BOOLEAN, vagas_abertas INTEGER, user_id TEXT, nome_cliente TEXT, whatsapp_cliente TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.arena_id, r.quadra_id, r.data, r.horarios, r.hora_inicio, r.hora_fim, r.status, r.esporte,
         r.tipo_reserva, r.contrato_id, r.expira_em,
         COALESCE(r.permite_vagas, false), COALESCE(r.vagas_abertas, 0),
         CASE WHEN r.permite_vagas THEN r.user_id END,
         CASE WHEN r.tipo_reserva = 'escolinha' THEN r.nome_cliente
              WHEN r.permite_vagas THEN split_part(COALESCE(r.nome_cliente, ''), ' ', 1) END,
         CASE WHEN r.tipo_reserva = 'escolinha' THEN r.whatsapp_cliente END
  FROM public.reservas r
  JOIN public.arenas a ON a.id = r.arena_id AND a.ativo = true
  WHERE r.arena_id = p_arena_id
    AND r.status IN ('confirmada', 'pendente', 'em_processamento')
    AND (p_data_inicio IS NULL OR r.data >= p_data_inicio)
    AND (p_data_fim IS NULL OR r.data <= p_data_fim);
$$;
REVOKE ALL ON FUNCTION public.grade_publica(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_publica(TEXT, DATE, DATE) TO anon, authenticated;

-- 4. Contratos: leitura pública só de escolinhas (grupos/mensalistas têm nome e WhatsApp de clientes)
DROP POLICY IF EXISTS "Leitura pública de contratos ativos" ON public.contratos_recorrentes;
DROP POLICY IF EXISTS "Leitura pública de escolinhas ativas" ON public.contratos_recorrentes;
CREATE POLICY "Leitura pública de escolinhas ativas"
  ON public.contratos_recorrentes FOR SELECT TO public
  USING (ativo = true AND tipo = 'escolinha');

-- 5. Mural de vagas: o organizador da partida vê e responde os interessados na própria reserva
DROP POLICY IF EXISTS "Organizador gerencia interessados da sua partida" ON public.interesses_vagas;
CREATE POLICY "Organizador gerencia interessados da sua partida"
  ON public.interesses_vagas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reservas r
    WHERE r.id = interesses_vagas.reserva_id AND r.user_id::text = (SELECT auth.uid())::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reservas r
    WHERE r.id = interesses_vagas.reserva_id AND r.user_id::text = (SELECT auth.uid())::text));

-- 6. Fidelidade: no máximo um selo por reserva (a emissão no servidor é idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fidelidade_selos_reserva ON public.fidelidade_selos (reserva_id);

-- 7. Storage: só operadores enviam imagens; somente imagens de até 5 MB
UPDATE storage.buckets
  SET file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  WHERE id = 'institucional';
DROP POLICY IF EXISTS "Permitir upload no bucket institucional" ON storage.objects;
DROP POLICY IF EXISTS "Upload institucional por operadores" ON storage.objects;
CREATE POLICY "Upload institucional por operadores"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'institucional' AND EXISTS (SELECT 1 FROM public.arena_usuarios au
    WHERE au.user_id = (SELECT auth.uid()) AND au.ativo = true));

-- 8. Função interna (event trigger) não deve ser chamável pela API
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 9. Índice de apoio às políticas por operador
CREATE INDEX IF NOT EXISTS idx_arena_usuarios_user_arena
  ON public.arena_usuarios (user_id, arena_id) WHERE ativo = true;


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


-- ==============================================================================
-- Escolinhas do site editáveis pelo dono no painel (SPEC/2026-10-31-escolinhas-admin.md)
--
-- `landing_page_schools` passa a ser a vitrine oficial da escolinha no site:
--   nome              nome da escolinha (ex.: "CT Falcão 12"); vazio = o site mostra o esporte
--   botao_tipo        'whatsapp' (abre conversa com mensagem pronta) ou 'link' (formulário, site etc.)
--   botao_url         endereço do botão quando botao_tipo = 'link' (só https)
--   mensagem_whatsapp mensagem pronta do botão; vazia = mensagem padrão montada com esporte e professor
-- Foto, WhatsApp e o resumo de horários deixam de ser obrigatórios: o site usa a foto padrão, o
-- WhatsApp da arena e as turmas estruturadas (coluna `turmas`).
--
-- Pré-requisito: 2026-10-30-b-portal-template.sql. Idempotente.
-- ==============================================================================

ALTER TABLE public.landing_page_schools
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS botao_tipo TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS botao_url TEXT,
  ADD COLUMN IF NOT EXISTS mensagem_whatsapp TEXT;

ALTER TABLE public.landing_page_schools
  ALTER COLUMN teacher_image_url DROP NOT NULL,
  ALTER COLUMN schedule_info DROP NOT NULL,
  ALTER COLUMN whatsapp_number DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_page_schools_botao_check') THEN
    -- Link só https (nada de javascript: ou http) e obrigatório quando o botão é de link
    ALTER TABLE public.landing_page_schools ADD CONSTRAINT landing_page_schools_botao_check
      CHECK (
        botao_tipo IN ('whatsapp', 'link')
        AND (botao_url IS NULL OR (botao_url ~ '^https://[^[:space:]]+$' AND length(botao_url) <= 500))
        AND (botao_tipo <> 'link' OR botao_url IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_page_schools_textos_check') THEN
    ALTER TABLE public.landing_page_schools ADD CONSTRAINT landing_page_schools_textos_check
      CHECK (
        (nome IS NULL OR length(nome) <= 60)
        AND (mensagem_whatsapp IS NULL OR length(mensagem_whatsapp) <= 500)
        AND jsonb_array_length(turmas) <= 12
      );
  END IF;
END $$;

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
