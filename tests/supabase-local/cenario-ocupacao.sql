-- ==============================================================================
-- SÓ PARA TESTES: ocupação de exemplo da Arena Belém igual à do protótipo (turmas na agenda, partidas do
-- mural e horários ocupados sorteados). Roda depois de src/lib/supabase/seed-arena-belem.sql.
-- Em produção a agenda começa vazia.
-- ==============================================================================

-- Sorteio determinístico do protótipo (FNV-1a de 32 bits), só nesta sessão
CREATE OR REPLACE FUNCTION pg_temp.sorteio_prototipo(chave TEXT) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  x BIGINT := 2166136261;
  b BYTEA := convert_to(chave, 'UTF8');
BEGIN
  FOR i IN 0..length(b) - 1 LOOP
    x := (x # get_byte(b, i)) & 4294967295;
    x := (x * 16777619) & 4294967295;
  END LOOP;
  RETURN (x % 10000) / 10000.0;
END $$;

-- 1. Turmas que ocupam horário na grade (contratos de escolinha), como no protótipo
INSERT INTO public.contratos_recorrentes (id, arena_id, tipo, nome, esporte, responsavel_nome, contato_whatsapp, quadra_id,
  dias_semana, hora_inicio, hora_fim, data_inicio, meses, ativo, escolinha_id)
SELECT c.id, 'arena-belem', 'escolinha', c.nome, c.esporte, c.professor, '91984982865', c.quadra, c.dias, c.inicio, c.fim,
       (now() AT TIME ZONE 'America/Belem')::date - 30, 6, true, c.escolinha
FROM (VALUES
  ('arena-belem-ct-beach',      'Beach tennis', 'Beach Tennis', 'Italo Bianck',  'arena-belem-q1', '{1,3}'::int[], '16:00', '17:00', 'arena-belem-esc-beach'),
  ('arena-belem-ct-fute-sq',    'Futevôlei',    'Futevôlei',    'Diego Moraes',  'arena-belem-q3', '{1,3}'::int[], '17:00', '19:00', 'arena-belem-esc-futevolei'),
  ('arena-belem-ct-fute-tq',    'Futevôlei',    'Futevôlei',    'Diego Moraes',  'arena-belem-q3', '{2,4}'::int[], '17:00', '20:00', 'arena-belem-esc-futevolei'),
  ('arena-belem-ct-fute-sex',   'Futevôlei',    'Futevôlei',    'Diego Moraes',  'arena-belem-q3', '{5}'::int[],   '17:00', '20:00', 'arena-belem-esc-futevolei'),
  ('arena-belem-ct-volei',      'Vôlei',        'Vôlei',        'Lucas Andrade', 'arena-belem-q3', '{6}'::int[],   '09:00', '12:00', 'arena-belem-esc-volei')
) AS c(id, nome, esporte, professor, quadra, dias, inicio, fim, escolinha)
ON CONFLICT (id) DO UPDATE SET quadra_id = EXCLUDED.quadra_id, dias_semana = EXCLUDED.dias_semana,
  hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim, escolinha_id = EXCLUDED.escolinha_id, ativo = true;

-- 2. Reservas de exemplo dos próximos 31 dias: aulas, partidas do mural e ocupação sorteada
DELETE FROM public.reservas WHERE arena_id = 'arena-belem' AND id LIKE 'demo-belem-%';

-- 2.1 Aulas (uma reserva por dia de turma, com todas as horas)
INSERT INTO public.reservas (id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
  telefone_cliente, esporte, tipo_reserva, contrato_id, valor_original, valor_total, valor_sinal, valor_pendente, status,
  status_whatsapp, metodo_pagamento, gateway_provedor, criada_em)
SELECT 'demo-belem-aula-' || c.id || '-' || to_char(d.data, 'YYYYMMDD'), 'arena-belem', c.quadra_id, d.data,
       ARRAY(SELECT lpad(h::text, 2, '0') || ':00' FROM generate_series(split_part(c.hora_inicio, ':', 1)::int, split_part(c.hora_fim, ':', 1)::int - 1) h),
       c.hora_inicio, c.hora_fim, c.nome, '91984982865', '91984982865', c.esporte, 'escolinha', c.id, 0, 0, 0, 0, 'confirmada',
       'enviado', 'pix', 'mock', NOW()
FROM public.contratos_recorrentes c
CROSS JOIN LATERAL (
  SELECT ((now() AT TIME ZONE 'America/Belem')::date + n) AS data FROM generate_series(0, 30) n
) d
WHERE c.arena_id = 'arena-belem' AND c.tipo = 'escolinha' AND c.ativo AND EXTRACT(DOW FROM d.data)::int = ANY(c.dias_semana);

-- 2.2 Partidas procurando jogadores (o mural nunca mostra quantas vagas faltam)
INSERT INTO public.reservas (id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
  telefone_cliente, esporte, tipo_reserva, valor_original, valor_total, valor_sinal, valor_pendente, status, status_whatsapp,
  metodo_pagamento, gateway_provedor, permite_vagas, vagas_abertas, pago_em, criada_em)
SELECT 'demo-belem-partida-' || p.n, 'arena-belem', p.quadra, (now() AT TIME ZONE 'America/Belem')::date + p.em,
       ARRAY[lpad(p.h::text, 2, '0') || ':00'], lpad(p.h::text, 2, '0') || ':00', lpad((p.h + 1)::text, 2, '0') || ':00',
       p.nome, p.whats, p.whats, p.esporte, 'avulsa', p.valor, p.valor, p.valor / 2, p.valor / 2, 'pendente', 'enviado', 'pix', 'mock',
       true, p.faltam, NOW() - interval '1 day', NOW() - interval '1 day'
FROM (VALUES
  (1, 0, 'arena-belem-q1', 20, 'Beach Tennis',    'Thiago Barros',  '91900000001', 2, 100::numeric),
  (2, 1, 'arena-belem-q4', 19, 'Futebol Society', 'Bruno Lima',     '91900000002', 3, 180::numeric),
  (3, 2, 'arena-belem-q2', 8,  'Beach Tennis',    'Carla Mendes',   '91900000003', 1, 80::numeric),
  (4, 4, 'arena-belem-q3', 21, 'Futevôlei',       'Diego Pinheiro', '91900000004', 2, 100::numeric)
) AS p(n, em, quadra, h, esporte, nome, whats, faltam, valor);

-- 2.3 Ocupação sorteada (mesma função e mesmas chances do protótipo), sem cobrir aulas e partidas
WITH quadras AS (
  SELECT * FROM (VALUES ('arena-belem-q1', 'areia-1', true), ('arena-belem-q2', 'areia-2', true),
                        ('arena-belem-q3', 'areia-3', true), ('arena-belem-q4', 'society', false)) AS q(id, chave, areia)
),
grade AS (
  SELECT ((now() AT TIME ZONE 'America/Belem')::date + n) AS data, q.id AS quadra_id, q.chave, q.areia, h AS hora
  FROM generate_series(0, 30) n CROSS JOIN quadras q CROSS JOIN generate_series(7, 22) h
),
sorteada AS (
  SELECT g.*, EXTRACT(DOW FROM g.data)::int AS dow,
         pg_temp.sorteio_prototipo(to_char(g.data, 'YYYY-MM-DD') || '|' || g.chave || '|' || g.hora) AS sorteio
  FROM grade g
),
nomes AS (
  SELECT ARRAY['Lucas Moraes', 'Ana Beatriz', 'Rafael Souza', 'Juliana Costa', 'Bruno Lima', 'Camila Rocha',
               'Diego Pinheiro', 'Fernanda Alves', 'Gustavo Melo', 'Larissa Santos', 'Marcelo Dias',
               'Patrícia Nunes', 'Thiago Barros', 'Vanessa Cruz', 'Pedro Henrique', 'Bianca Ferreira'] AS lista
)
INSERT INTO public.reservas (id, arena_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
  telefone_cliente, esporte, tipo_reserva, valor_original, valor_total, valor_sinal, valor_pendente, status, status_whatsapp,
  metodo_pagamento, gateway_provedor, pago_em, criada_em)
SELECT 'demo-belem-' || to_char(s.data, 'YYYYMMDD') || '-' || right(s.quadra_id, 2) || '-' || lpad(s.hora::text, 2, '0'),
       'arena-belem', s.quadra_id, s.data, ARRAY[lpad(s.hora::text, 2, '0') || ':00'], lpad(s.hora::text, 2, '0') || ':00',
       lpad((s.hora + 1)::text, 2, '0') || ':00',
       (SELECT lista[1 + (floor(s.sorteio * 10000)::int % array_length(lista, 1))] FROM nomes),
       '9190000' || lpad((floor(s.sorteio * 10000)::int % 10000)::text, 4, '0'),
       '9190000' || lpad((floor(s.sorteio * 10000)::int % 10000)::text, 4, '0'),
       CASE WHEN NOT s.areia THEN 'Futebol Society' WHEN s.quadra_id = 'arena-belem-q3' THEN 'Futevôlei' ELSE 'Beach Tennis' END,
       'avulsa', v.valor, v.valor, round(v.valor / 2, 2), round(v.valor / 2, 2), 'pendente', 'enviado', 'pix', 'mock',
       NOW() - interval '1 day', NOW() - interval '1 day'
FROM sorteada s
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN s.hora >= 18 THEN (CASE WHEN s.areia THEN 100 ELSE 180 END)
    WHEN s.dow IN (0, 6) THEN (CASE WHEN s.areia THEN 90 ELSE 160 END)
    ELSE (CASE WHEN s.areia THEN 80 ELSE 150 END)
  END::numeric AS valor
) v
WHERE s.sorteio < CASE
    WHEN s.hora BETWEEN 18 AND 21 THEN (CASE WHEN s.dow IN (0, 6) THEN 0.5 ELSE 0.6 END)
    WHEN s.hora = 22 THEN 0.35
    WHEN s.hora < 10 THEN (CASE WHEN s.dow IN (0, 6) THEN 0.5 ELSE 0.3 END)
    WHEN s.hora < 16 THEN (CASE WHEN s.dow IN (0, 6) THEN 0.45 ELSE 0.22 END)
    ELSE 0.4
  END
  AND NOT EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.arena_id = 'arena-belem' AND r.quadra_id = s.quadra_id AND r.data = s.data
      AND (lpad(s.hora::text, 2, '0') || ':00') = ANY(r.horarios) AND r.status <> 'cancelada'
  );
