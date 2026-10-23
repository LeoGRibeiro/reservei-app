-- ==============================================================================
-- Demonstração personalizada: Arena Belém (Av. Roberto Camelier, 580 - Jurunas, Belém/PA)
--
-- Dados públicos da arena (Instagram @arenabelem, Letzplay, Total Beach Tennis): endereço, telefone,
-- 3 quadras de areia + 1 society, beach tennis / futevôlei / vôlei de praia / futebol, escolinha
-- licenciada do CT Falcão12. PREÇOS E HORÁRIOS SÃO ESTIMATIVAS para a apresentação: ajuste no painel
-- (Quadras e Configurações) com os valores reais da arena.
--
-- Pré-requisito: migração da Fase 8 (2026-10-22-fase8-mvp-go-live.sql).
-- Idempotente: rodar de novo renova as reservas de exemplo das próximas 2 semanas.
-- A última consulta devolve o link de ativação do dono (só enquanto a arena não tiver proprietário).
-- ==============================================================================

-- 1. Arena (modo demonstração: pagamento simulado, nada é cobrado)
INSERT INTO public.arenas (
  id, slug, nome, telefone, whatsapp, endereco, cidade, estado, cep,
  horario_abertura, horario_fechamento, intervalo_minutos, percentual_sinal_minimo,
  antecedencia_minima_minutos, ativo, modulos_ativos, modo_pagamento, politica_cancelamento
) VALUES (
  'arena-belem', 'arena-belem', 'Arena Belém', '(91) 98498-2865', '(91) 98498-2865',
  'Av. Roberto Camelier, 580 - Jurunas', 'Belém', 'PA', '66033-420',
  '07:00', '23:00', 60, 50,
  60, true, '{agendamento_core,fidelidade,vagas,escolinhas,contratos}', 'simulado',
  'Cancelamentos com mais de 24 horas de antecedência: o sinal vira crédito para remarcar. Com menos de 24 horas, o sinal não é devolvido. Em caso de chuva forte, a arena remarca sem custo.'
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  telefone = EXCLUDED.telefone,
  whatsapp = EXCLUDED.whatsapp,
  endereco = EXCLUDED.endereco,
  cidade = EXCLUDED.cidade,
  estado = EXCLUDED.estado,
  cep = EXCLUDED.cep,
  horario_abertura = EXCLUDED.horario_abertura,
  horario_fechamento = EXCLUDED.horario_fechamento,
  modulos_ativos = EXCLUDED.modulos_ativos,
  modo_pagamento = EXCLUDED.modo_pagamento,
  politica_cancelamento = EXCLUDED.politica_cancelamento,
  ativo = true,
  atualizado_em = NOW();

-- 2. Quadras: 3 de areia (beach tennis, futevôlei, vôlei de praia) e 1 society
INSERT INTO public.quadras (id, arena_id, numero, nome, descricao, tipo_piso, esportes, coberta, iluminacao, valor_hora_padrao, ordem, ativa)
VALUES
  ('arena-belem-q1', 'arena-belem', 1, 'Quadra 1 · Areia', 'Areia tratada, rede de beach tennis e futevôlei, iluminação LED.', 'areia', ARRAY['Beach Tennis', 'Futevôlei', 'Vôlei de Praia'], false, true, 80, 1, true),
  ('arena-belem-q2', 'arena-belem', 2, 'Quadra 2 · Areia', 'Areia tratada, rede de beach tennis e futevôlei, iluminação LED.', 'areia', ARRAY['Beach Tennis', 'Futevôlei', 'Vôlei de Praia'], false, true, 80, 2, true),
  ('arena-belem-q3', 'arena-belem', 3, 'Quadra 3 · Areia', 'Areia tratada, rede de beach tennis e futevôlei, iluminação LED.', 'areia', ARRAY['Beach Tennis', 'Futevôlei', 'Vôlei de Praia'], false, true, 80, 3, true),
  ('arena-belem-q4', 'arena-belem', 4, 'Campo Society', 'Grama sintética, traves de society, iluminação LED.', 'society', ARRAY['Futebol Society'], false, true, 150, 4, true)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, tipo_piso = EXCLUDED.tipo_piso,
  esportes = EXCLUDED.esportes, valor_hora_padrao = EXCLUDED.valor_hora_padrao, ordem = EXCLUDED.ordem, ativa = true;

-- 3. Preços: horário nobre à noite (todos os dias) e fim de semana de dia
INSERT INTO public.quadras_precos (id, arena_id, quadra_id, dias_semana, hora_inicio, hora_fim, valor_hora, descricao, ativo)
SELECT 'arena-belem-' || q.id || '-' || p.sufixo, 'arena-belem', q.id, p.dias, p.inicio, p.fim,
       CASE WHEN q.id = 'arena-belem-q4' THEN p.valor_society ELSE p.valor_areia END, p.descricao, true
FROM (VALUES ('arena-belem-q1'), ('arena-belem-q2'), ('arena-belem-q3'), ('arena-belem-q4')) AS q(id)
CROSS JOIN (VALUES
  ('noite', '{0,1,2,3,4,5,6}'::int[], '18:00', '23:00', 100::numeric, 180::numeric, 'Horário nobre (noite)'),
  ('fds',   '{0,6}'::int[],           '07:00', '18:00',  90::numeric, 160::numeric, 'Fim de semana')
) AS p(sufixo, dias, inicio, fim, valor_areia, valor_society, descricao)
ON CONFLICT (id) DO UPDATE SET valor_hora = EXCLUDED.valor_hora, dias_semana = EXCLUDED.dias_semana,
  hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim, ativo = true;

-- 4. Clube de fidelidade da arena
INSERT INTO public.fidelidade_campanha (id, arena_id, nome, horas_necessarias, meses_validade, dias_validade_voucher, ativo)
VALUES ('campanha-arena-belem', 'arena-belem', 'Clube Arena Belém', 10, 3, 60, true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, ativo = true;

-- 5. Escolinhas: não entram no seed. No portal elas vêm de contratos recorrentes (que reservam horários
--    fixos); cadastre uma ao vivo em Admin -> Escolinhas durante a demonstração.

-- 6. Reservas de exemplo nas próximas 2 semanas (ocupação maior à noite e no fim de semana)
DELETE FROM public.reservas WHERE arena_id = 'arena-belem' AND id LIKE 'demo-belem-%';

WITH nomes AS (
  SELECT ARRAY['Lucas Moraes', 'Ana Beatriz', 'Rafael Souza', 'Juliana Costa', 'Bruno Lima', 'Camila Rocha',
               'Diego Pinheiro', 'Fernanda Alves', 'Gustavo Melo', 'Larissa Santos', 'Marcelo Dias',
               'Patrícia Nunes', 'Thiago Barros', 'Vanessa Cruz', 'Pedro Henrique', 'Bianca Ferreira'] AS lista
),
grade AS (
  SELECT (CURRENT_DATE + d) AS data, q.id AS quadra_id, q.areia, h AS hora,
         abs(hashtext('belem' || d || q.id || h)) % 100 AS sorteio
  FROM generate_series(0, 13) AS d
  CROSS JOIN (VALUES ('arena-belem-q1', true), ('arena-belem-q2', true), ('arena-belem-q3', true), ('arena-belem-q4', false)) AS q(id, areia)
  CROSS JOIN generate_series(7, 22) AS h
),
escolhidas AS (
  SELECT g.*,
         EXTRACT(DOW FROM g.data)::int AS dow,
         CASE
           WHEN g.hora >= 18 THEN 72
           WHEN EXTRACT(DOW FROM g.data) IN (0, 6) THEN 45
           WHEN g.hora < 9 THEN 30
           ELSE 12
         END AS chance
  FROM grade g
)
INSERT INTO public.reservas (
  id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente, telefone_cliente,
  esporte, tipo_reserva, valor_original, valor_total, valor_sinal, valor_pendente, status, status_whatsapp,
  metodo_pagamento, gateway_provedor, pago_em, criada_em
)
SELECT
  'demo-belem-' || to_char(e.data, 'YYYYMMDD') || '-' || right(e.quadra_id, 2) || '-' || lpad(e.hora::text, 2, '0'),
  'arena-belem', e.quadra_id, e.data,
  ARRAY[lpad(e.hora::text, 2, '0') || ':00'],
  lpad(e.hora::text, 2, '0') || ':00',
  lpad((e.hora + 1)::text, 2, '0') || ':00',
  (SELECT lista[1 + (e.sorteio % array_length(lista, 1))] FROM nomes),
  '9190000' || lpad((e.sorteio * 37 % 10000)::text, 4, '0'),
  '9190000' || lpad((e.sorteio * 37 % 10000)::text, 4, '0'),
  CASE WHEN NOT e.areia THEN 'Futebol Society'
       WHEN e.sorteio % 3 = 0 THEN 'Futevôlei'
       WHEN e.sorteio % 7 = 0 THEN 'Vôlei de Praia'
       ELSE 'Beach Tennis' END,
  'avulsa',
  v.valor, v.valor,
  CASE WHEN e.sorteio % 4 = 0 THEN v.valor ELSE round(v.valor / 2, 2) END,
  CASE WHEN e.sorteio % 4 = 0 THEN 0 ELSE round(v.valor / 2, 2) END,
  CASE WHEN e.sorteio % 4 = 0 THEN 'confirmada' ELSE 'pendente' END,
  'enviado', 'pix', 'mock', NOW() - interval '1 day', NOW() - interval '1 day'
FROM escolhidas e
CROSS JOIN LATERAL (
  SELECT CASE
           WHEN e.hora >= 18 THEN (CASE WHEN e.areia THEN 100 ELSE 180 END)
           WHEN e.dow IN (0, 6) THEN (CASE WHEN e.areia THEN 90 ELSE 160 END)
           ELSE (CASE WHEN e.areia THEN 80 ELSE 150 END)
         END::numeric AS valor
) v
WHERE e.sorteio < e.chance;

-- 7. Um Pix manual aguardando conferência (mostra a fila "Pagamentos a confirmar" no balcão)
DELETE FROM public.reservas
WHERE arena_id = 'arena-belem' AND id = 'demo-belem-' || to_char(CURRENT_DATE + 1, 'YYYYMMDD') || '-q2-22';

INSERT INTO public.reservas (
  id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente, telefone_cliente,
  esporte, tipo_reserva, valor_original, valor_total, valor_sinal, valor_pendente, status, status_whatsapp,
  metodo_pagamento, gateway_provedor, gateway_transacao_id, pix_valor, pagamento_informado_em, expira_em, criada_em
)
SELECT 'demo-belem-pix-manual', 'arena-belem', 'arena-belem-q2', CURRENT_DATE + 1, ARRAY['22:00'], '22:00', '23:00',
       'Rodrigo Teixeira', '91900001234', '91900001234', 'Beach Tennis', 'avulsa', 100, 100, 50, 50,
       'em_processamento', 'nao_enviado', 'pix', 'manual', 'demo-belem-pix-manual', 50,
       NOW() - interval '12 minutes', (CURRENT_DATE + 1 + time '23:00') AT TIME ZONE 'America/Belem', NOW() - interval '15 minutes'
ON CONFLICT (id) DO UPDATE SET status = 'em_processamento', pagamento_informado_em = EXCLUDED.pagamento_informado_em,
  expira_em = EXCLUDED.expira_em, data = EXCLUDED.data;

-- 8. Link de ativação do dono (gerado só se a arena ainda não tiver proprietário)
WITH novo AS (SELECT gen_random_uuid()::text AS token)
UPDATE public.arenas a
SET token_convite = encode(sha256(convert_to(novo.token, 'UTF8')), 'hex'), setup_concluido_em = NULL
FROM novo
WHERE a.id = 'arena-belem'
  AND NOT EXISTS (SELECT 1 FROM public.arena_usuarios au WHERE au.arena_id = a.id AND au.ativo = true)
RETURNING '/admin?token=' || novo.token AS link_de_ativacao_do_dono;
