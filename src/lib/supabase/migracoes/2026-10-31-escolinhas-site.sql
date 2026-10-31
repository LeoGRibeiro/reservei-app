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
