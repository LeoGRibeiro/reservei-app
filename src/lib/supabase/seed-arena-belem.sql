-- ==============================================================================
-- Arena Belém (Av. Roberto Camelier, 580 - Jurunas, Belém/PA): demonstração com os mesmos dados e
-- fotos do protótipo aprovado em 30/10/2026. Pagamento simulado e fora dos buscadores (noindex).
-- DADOS A CONFIRMAR COM A ARENA: ver SPEC/2026-10-30-handoff-prototipo-portal.md, seção 5.
--
-- Pré-requisito: migrações 2026-10-22-fase8, 2026-10-30-a-auditoria-rls e 2026-10-30-b-portal-template.
-- Idempotente: rodar de novo renova as reservas de exemplo dos próximos 31 dias.
-- A última consulta devolve o link de ativação do dono (só enquanto a arena não tiver proprietário).
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

-- 1. Arena (demonstração: pagamento simulado e fora dos buscadores)
INSERT INTO public.arenas (
  id, slug, nome, telefone, whatsapp, endereco, bairro, endereco_referencia, cidade, estado, cep,
  horario_abertura, horario_fechamento, intervalo_minutos, percentual_sinal_minimo, antecedencia_minima_minutos,
  ativo, modulos_ativos, modo_pagamento, politica_cancelamento, logo_url, instagram, latitude, longitude,
  google_maps_url, google_place_id, mapa_url, tema
) VALUES (
  'arena-belem', 'arena-belem', 'Arena Belém', '(91) 98498-2865', '(91) 98498-2865',
  'Av. Roberto Camelier, 580', 'Jurunas', 'Esquina com a Rua dos Caripunas', 'Belém', 'PA', '66033-420',
  '07:00', '23:00', 60, 50, 60,
  true, '{agendamento_core,fidelidade,vagas,escolinhas,contratos,eventos,instagram}', 'simulado',
  'Cancelamentos com mais de 24 horas de antecedência: você recebe o sinal de volta no Pix. Com menos de 24 horas, o sinal não é devolvido. Em caso de chuva forte, a arena remarca sem custo.',
  '/arenas/arena-belem/logo.png', 'arenabelem', -1.4663397, -48.4906044,
  'https://www.google.com/maps/place/Arena+Bel%C3%A9m/@-1.4663397,-48.4906044,17z/data=!4m6!3m5!1s0x92a48f48ea496ed7:0x16dca8251ba0b465!8m2!3d-1.4663397!4d-48.4906044',
  NULL, '/arenas/arena-belem/mapa.jpg',
  '{"marca": "#1e2d6b", "marca_escura": "#131d47", "marca_clara": "#e7eaf5", "destaque": "#f4b41a", "destaque_hover": "#e3a20c", "fundo_suave": "#f4f1ea", "papel": "#fffdf8"}'
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, whatsapp = EXCLUDED.whatsapp, endereco = EXCLUDED.endereco,
  bairro = EXCLUDED.bairro, endereco_referencia = EXCLUDED.endereco_referencia, cidade = EXCLUDED.cidade,
  estado = EXCLUDED.estado, cep = EXCLUDED.cep, horario_abertura = EXCLUDED.horario_abertura,
  horario_fechamento = EXCLUDED.horario_fechamento, percentual_sinal_minimo = EXCLUDED.percentual_sinal_minimo,
  antecedencia_minima_minutos = EXCLUDED.antecedencia_minima_minutos, modulos_ativos = EXCLUDED.modulos_ativos,
  modo_pagamento = EXCLUDED.modo_pagamento, politica_cancelamento = EXCLUDED.politica_cancelamento,
  logo_url = EXCLUDED.logo_url, instagram = EXCLUDED.instagram, latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude, google_maps_url = EXCLUDED.google_maps_url, google_place_id = EXCLUDED.google_place_id,
  mapa_url = EXCLUDED.mapa_url, tema = EXCLUDED.tema, ativo = true, atualizado_em = NOW();

-- 2. Quadras com os nomes do sistema da arena, fotos e enquadramentos do protótipo
INSERT INTO public.quadras (id, arena_id, numero, nome, descricao, tipo_piso, esportes, coberta, iluminacao, valor_hora_padrao, ordem, ativa, foto_url, foto_posicao, foto_descricao)
VALUES
  ('arena-belem-q1', 'arena-belem', 1, 'Areia 1 · Terraço', 'Areia tratada e iluminação LED.', 'areia', ARRAY['Beach Tennis'], false, true, 80, 1, true,
   '/arenas/arena-belem/areia-lounge.jpg', '50% 62%', 'Quadra de areia com deck de grama e mesas de madeira'),
  ('arena-belem-q2', 'arena-belem', 2, 'Areia 2 · Terraço', 'Areia tratada e iluminação LED.', 'areia', ARRAY['Beach Tennis'], false, true, 80, 2, true,
   '/arenas/arena-belem/aula-beach.jpg', '50% 40%', 'Alunos de beach tennis na areia diante do painel da arena'),
  ('arena-belem-q3', 'arena-belem', 3, 'Areia 3', 'Areia tratada, rede de futevôlei e vôlei.', 'areia', ARRAY['Futevôlei', 'Vôlei', 'Beach Tennis'], false, true, 80, 3, true,
   '/arenas/arena-belem/areia-lounge.jpg', '6% 50%', 'Quadra de areia dentro do galpão'),
  ('arena-belem-q4', 'arena-belem', 4, 'Campo Society', 'Grama sintética e iluminação LED.', 'society', ARRAY['Futebol Society'], false, true, 150, 4, true,
   '/arenas/arena-belem/society.jpg', '50% 55%', 'Campo society de grama sintética')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, tipo_piso = EXCLUDED.tipo_piso, esportes = EXCLUDED.esportes,
  valor_hora_padrao = EXCLUDED.valor_hora_padrao, ordem = EXCLUDED.ordem, foto_url = EXCLUDED.foto_url,
  foto_posicao = EXCLUDED.foto_posicao, foto_descricao = EXCLUDED.foto_descricao, ativa = true;

-- 3. Preços: noite (18h às 23h, todos os dias) e fim de semana de dia; no resto vale o valor padrão
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

-- 4. Clube: a cada 10 horas, 1 hora grátis (até R$ 100, vale 60 dias); cada carimbo vale 3 meses
INSERT INTO public.fidelidade_campanha (id, arena_id, nome, horas_necessarias, meses_validade, dias_validade_voucher, valor_teto_voucher, ativo)
VALUES ('campanha-arena-belem', 'arena-belem', 'Clube Arena Belém', 10, 3, 60, 100, true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, horas_necessarias = EXCLUDED.horas_necessarias,
  meses_validade = EXCLUDED.meses_validade, dias_validade_voucher = EXCLUDED.dias_validade_voucher,
  valor_teto_voucher = EXCLUDED.valor_teto_voucher, ativo = true;

-- 5. Textos do site, regras e perguntas frequentes
INSERT INTO public.arena_conteudo (arena_id, intro_reserva, intro_escolinhas, intro_eventos, intro_estrutura, destaques_estrutura, regras, faq)
VALUES (
  'arena-belem',
  'Três quadras de areia e um campo society no Jurunas. Escolha o dia, toque nos horários livres e pague o sinal no Pix.',
  'Aulas na areia e no society, com turmas por nível e idade. Para entrar numa turma, fale com a arena no WhatsApp.',
  'Torneios para todos os níveis e encontros para a galera da arena. Para assistir, a entrada é livre.',
  'Areia tratada, campo de grama sintética, iluminação de LED e um bar para a resenha depois do jogo.',
  '[{"destaque": "3 quadras de areia", "resto": "tratada"},
    {"destaque": "Campo society", "resto": "de grama sintética"},
    {"destaque": "Iluminação de LED", "resto": "para jogar à noite"},
    {"destaque": "Bar", "resto": "com bebida gelada e jogo na TV"},
    {"destaque": "Duchas", "resto": "e vestiários"}]',
  '[{"titulo": "Chegue 10 minutos antes.", "texto": "O horário começa e termina na hora marcada, mesmo com atraso."},
    {"titulo": "Calçado certo para cada piso.", "texto": "Na areia, jogue descalço ou de meia de areia. No society, use chuteira society ou tênis. Trava de alumínio não entra."},
    {"titulo": "Libere a quadra no fim do horário.", "texto": "O próximo grupo também reservou. Para jogar mais, reserve a hora seguinte."},
    {"titulo": "Bebida e comida de fora não entram.", "texto": "O bar da arena funciona o dia todo."},
    {"titulo": "Crianças jogam com um responsável.", "texto": "A regra não vale nas aulas das escolinhas, que têm professor."},
    {"titulo": "Cuide da estrutura.", "texto": "Danos a redes, iluminação e equipamentos são cobrados de quem fez a reserva."}]',
  '[{"pergunta": "Preciso pagar tudo na hora de reservar?", "resposta": "Não. Você paga um sinal de 50% no Pix para garantir o horário e o restante na arena. Se preferir, dá para pagar o valor integral de uma vez."},
    {"pergunta": "Preciso criar conta para reservar?", "resposta": "Não. Basta informar nome e WhatsApp. Com a conta, você acompanha suas reservas e junta carimbos no Clube Arena Belém."},
    {"pergunta": "Como funciona o Clube Arena Belém?", "resposta": "Cada hora reservada com a sua conta vira um carimbo. Com 10 carimbos, você ganha 1 hora grátis, até R$ 100. Cada carimbo vale por 3 meses, e a hora grátis, por 60 dias."},
    {"pergunta": "A arena empresta raquete e bola?", "resposta": "As bolas de beach tennis, futevôlei e vôlei ficam na quadra. Raquetes de beach tennis podem ser alugadas no bar."},
    {"pergunta": "E se chover?", "resposta": "Em caso de chuva forte, a arena remarca o seu horário sem custo. É só chamar no WhatsApp."},
    {"pergunta": "Como entro numa partida que está procurando jogadores?", "resposta": "Na página de reservas, abra \"Partidas procurando jogadores\" e toque em \"Quero jogar\". O organizador recebe o pedido e confirma com você pelo WhatsApp."},
    {"pergunta": "Como entro numa turma das escolinhas?", "resposta": "Toque em \"Quero uma vaga\" na escolinha que você quer. A arena responde no WhatsApp com os valores e as vagas das turmas."},
    {"pergunta": "Como me inscrevo num torneio?", "resposta": "Em Campeonatos e eventos, toque em \"Inscrever-se\". O botão abre o formulário do torneio ou o WhatsApp da arena com a mensagem pronta."}]'
)
ON CONFLICT (arena_id) DO UPDATE SET intro_reserva = EXCLUDED.intro_reserva, intro_escolinhas = EXCLUDED.intro_escolinhas,
  intro_eventos = EXCLUDED.intro_eventos, intro_estrutura = EXCLUDED.intro_estrutura,
  destaques_estrutura = EXCLUDED.destaques_estrutura, regras = EXCLUDED.regras, faq = EXCLUDED.faq, atualizado_em = NOW();

-- 6. Escolinhas e turmas (dados a confirmar com a arena: ver o handoff do protótipo, seção 5)
INSERT INTO public.landing_page_schools (id, arena_id, sport_name, teacher_name, teacher_image_url, schedule_info, whatsapp_number, descricao, turmas, ordem, is_active)
VALUES
  ('arena-belem-esc-beach', 'arena-belem', 'Beach tennis', 'Italo Bianck', '/arenas/arena-belem/prof-beach.png', 'Seg e Qua 16h; Ter e Qui 7h, 8h e 19h', '91984982865',
   'Do primeiro saque ao jogo competitivo. Turmas pequenas, com raquete e bolas da arena para quem está começando.',
   '[{"dias": "Seg e Qua", "horas": "16h", "nivel": "Avançado"}, {"dias": "Ter e Qui", "horas": "7h e 8h", "nivel": "Iniciante"}, {"dias": "Ter e Qui", "horas": "19h", "nivel": "Intermediário"}]', 1, true),
  ('arena-belem-esc-futevolei', 'arena-belem', 'Futevôlei', 'Diego Moraes', '/arenas/arena-belem/prof-futevolei.png', 'Seg a Sex, fim de tarde', '91984982865',
   'Fundamentos, dupla e leitura de jogo. A turma juvenil é para quem tem de 12 a 17 anos.',
   '[{"dias": "Seg e Qua", "horas": "17h e 18h", "nivel": "Livre"}, {"dias": "Ter e Qui", "horas": "17h", "nivel": "Juvenil"}, {"dias": "Ter e Qui", "horas": "18h e 19h", "nivel": "Livre"}, {"dias": "Sex", "horas": "17h, 18h e 19h", "nivel": "Livre"}]', 2, true),
  ('arena-belem-esc-volei', 'arena-belem', 'Vôlei', 'Lucas Andrade', '/arenas/arena-belem/prof-volei.png', 'Sábado 9h a 11h', '91984982865',
   'Toque, manchete e saque na areia, em duplas e quartetos. Aos sábados, a turma é aberta a todos os níveis.',
   '[{"dias": "Sábado", "horas": "9h, 10h e 11h", "nivel": "Livre"}, {"dias": "Seg e Qua", "horas": "19h", "nivel": "Iniciante"}, {"dias": "Ter e Qui", "horas": "20h", "nivel": "Intermediário"}]', 3, true),
  ('arena-belem-esc-falcao', 'arena-belem', 'CT Falcão 12', 'Marcos Falcão', '/arenas/arena-belem/prof-falcao.png', 'Ter e Qui e Sábado', '91984982865',
   'Futebol society para crianças e adolescentes: técnica, posicionamento e jogo coletivo, com treinos separados por idade e amistosos ao longo do ano.',
   '[{"dias": "Ter e Qui", "horas": "8h e 9h", "nivel": "6 a 10 anos"}, {"dias": "Ter e Qui", "horas": "16h", "nivel": "11 a 14 anos"}, {"dias": "Sábado", "horas": "8h", "nivel": "Todas as idades"}]', 4, true)
ON CONFLICT (id) DO UPDATE SET sport_name = EXCLUDED.sport_name, teacher_name = EXCLUDED.teacher_name,
  teacher_image_url = EXCLUDED.teacher_image_url, descricao = EXCLUDED.descricao, turmas = EXCLUDED.turmas,
  ordem = EXCLUDED.ordem, whatsapp_number = EXCLUDED.whatsapp_number, is_active = true;

-- 7. Turmas que ocupam horário na grade (contratos de escolinha), como no protótipo
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

-- 8. Reservas de exemplo dos próximos 31 dias: aulas, partidas do mural e ocupação sorteada
DELETE FROM public.reservas WHERE arena_id = 'arena-belem' AND id LIKE 'demo-belem-%';

-- 8.1 Aulas (uma reserva por dia de turma, com todas as horas)
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

-- 8.2 Partidas procurando jogadores (o mural nunca mostra quantas vagas faltam)
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

-- 8.3 Ocupação sorteada (mesma função e mesmas chances do protótipo), sem cobrir aulas e partidas
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

-- 9. Campeonatos e eventos (dados a confirmar com a arena)
DELETE FROM public.eventos WHERE arena_id = 'arena-belem' AND id LIKE 'arena-belem-ev-%';
INSERT INTO public.eventos (id, arena_id, titulo, modalidade, descricao_curta, descricao, data_inicio, data_fim, horario, status, dados,
  inscricao_tipo, inscricao_url, mensagem_whatsapp, chave, link_rotulo, link_url, campeoes, rotulo_campeoes, placar_final,
  foto_url, foto_posicao, foto_descricao, ordem, ativo)
VALUES
  ('arena-belem-ev-copa-outubro', 'arena-belem', 'Copa de Outubro de Beach Tennis', 'Beach tennis', NULL,
   'Duplas mistas, categoria C. As semifinais e a final são neste sábado, 31 de outubro, na Areia 3. Vem torcer!',
   '2026-10-31', NULL, NULL, 'em_andamento', '[]', NULL, NULL, NULL,
   '[{"rotulo": "Semifinais · sábado, 31/10", "final": false, "jogos": [{"hora": "15h", "lados": ["Ana Beatriz e Pedro Henrique", "Camila Rocha e Thiago Barros"]}, {"hora": "16h", "lados": ["Larissa Santos e Gustavo Melo", "Fernanda Alves e Marcelo Dias"]}]},
     {"rotulo": "Final · sábado, 31/10", "final": true, "jogos": [{"hora": "18h", "lados": ["Vencedores da semi das 15h", "Vencedores da semi das 16h"]}]}]',
   'Placar ao vivo nos stories', 'https://www.instagram.com/arenabelem/', NULL, NULL, NULL, NULL, NULL, NULL, 1, true),
  ('arena-belem-ev-open', 'arena-belem', 'Open de Beach Tennis Arena Belém', 'Beach tennis', 'Beach tennis · duplas · categorias D, C e iniciante', NULL,
   '2026-11-21', '2026-11-22', NULL, 'inscricoes',
   '[{"rotulo": "Quando", "valor": "21 e 22 de novembro"}, {"rotulo": "Inscrição", "valor": "R$ 120 por dupla", "numerico": true}, {"rotulo": "Vagas", "valor": "até 32 duplas", "numerico": true}, {"rotulo": "Prazo", "valor": "até 17/11", "numerico": true}]',
   'formulario', NULL, 'Olá! Vim pelo site e quero me inscrever no Open de Beach Tennis Arena Belém, dias 21 e 22/11. Como faço?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, true),
  ('arena-belem-ev-rei-rainha', 'arena-belem', 'Rei e Rainha do Futevôlei', 'Futevôlei', 'Futevôlei · individual: a dupla muda a cada jogo · masculino e feminino', NULL,
   '2026-12-05', NULL, NULL, 'inscricoes',
   '[{"rotulo": "Inscrição", "valor": "R$ 60 por atleta", "numerico": true}, {"rotulo": "Vagas", "valor": "até 24 atletas", "numerico": true}, {"rotulo": "Prazo", "valor": "até 1/12", "numerico": true}]',
   'whatsapp', NULL, 'Olá! Vim pelo site e quero me inscrever no Rei e Rainha do Futevôlei, dia 5/12. Como faço?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3, true),
  ('arena-belem-ev-resenha', 'arena-belem', 'Resenha de fim de ano', NULL, 'Encontro de alunos, clientes e convidados', NULL,
   '2026-12-18', NULL, 'a partir das 19h', 'inscricoes',
   '[{"rotulo": "Horário", "valor": "a partir das 19h", "numerico": true}, {"rotulo": "Entrada", "valor": "1 kg de alimento não perecível"}]',
   'confirmar_presenca', NULL, 'Olá! Vim pelo site e quero confirmar presença na Resenha de fim de ano, dia 18/12.',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4, true),
  ('arena-belem-ev-copa-society', 'arena-belem', 'Copa Society de Setembro', 'Futebol society', NULL, NULL,
   '2026-09-27', NULL, NULL, 'encerrado', '[]', NULL, NULL, NULL, NULL, NULL, NULL,
   'Resenha FC', 'Campeão', '4 × 2 contra Amigos do Jurunas',
   '/arenas/arena-belem/society.jpg', NULL, 'Campo society de grama sintética, onde foi a final', 5, true),
  ('arena-belem-ev-dia-pais', 'arena-belem', 'Torneio do Dia dos Pais', 'Futevôlei', NULL, NULL,
   '2026-08-09', NULL, NULL, 'encerrado', '[]', NULL, NULL, NULL, NULL, NULL, NULL,
   'Diego Pinheiro e Lucas Moraes', 'Campeões', '18 × 15',
   '/arenas/arena-belem/areia-lounge.jpg', '70% 50%', 'Quadra de areia coberta, com o deck de mesas ao lado', 6, true),
  ('arena-belem-ev-arraia', 'arena-belem', 'Arraiá do Beach Tennis', 'Beach tennis', NULL, NULL,
   '2026-06-27', NULL, NULL, 'encerrado', '[]', NULL, NULL, NULL, NULL, NULL, NULL,
   'Juliana Costa e Vanessa Cruz', 'Campeãs', '6/3, categoria D',
   '/arenas/arena-belem/society-bar.jpg', NULL, 'Bar da arena enfeitado com bandeirinhas, de frente para o campo', 7, true);

-- 10. Estrutura (o bento usa as 4 primeiras fotos ativas)
DELETE FROM public.landing_page_gallery WHERE arena_id = 'arena-belem' AND id LIKE 'arena-belem-foto-%';
INSERT INTO public.landing_page_gallery (id, arena_id, image_url, title, description, categoria, display_order, is_active)
VALUES
  ('arena-belem-foto-1', 'arena-belem', '/arenas/arena-belem/areia-lounge.jpg', 'Deck com mesas ao lado da areia', 'Quadra de areia com deck de grama sintética e mesas de madeira ao lado', 'lazer', 1, true),
  ('arena-belem-foto-2', 'arena-belem', '/arenas/arena-belem/bar-corredor.jpg', 'Bar da arena', 'Corredor do bar da arena', 'bar', 2, true),
  ('arena-belem-foto-3', 'arena-belem', '/arenas/arena-belem/society-bar.jpg', 'O society visto do bar', 'Campo society visto do mezanino do bar', 'bar', 3, true),
  ('arena-belem-foto-4', 'arena-belem', '/arenas/arena-belem/society.jpg', 'Campo society', 'Campo society de grama sintética dentro do galpão', 'quadras', 4, true);

-- 11. Instagram (posts cadastrados; contagens simuladas até a integração com a API)
INSERT INTO public.instagram_perfil (arena_id, seguidores, total_posts, contagem_simulada)
VALUES ('arena-belem', 4120, 312, true)
ON CONFLICT (arena_id) DO UPDATE SET seguidores = EXCLUDED.seguidores, total_posts = EXCLUDED.total_posts,
  contagem_simulada = EXCLUDED.contagem_simulada, atualizado_em = NOW();

DELETE FROM public.instagram_posts WHERE arena_id = 'arena-belem' AND id LIKE 'arena-belem-post-%';
INSERT INTO public.instagram_posts (id, arena_id, imagem_url, imagem_largura, imagem_altura, imagem_posicao, descricao, legenda, tipo, link, publicado_em, fixado, ordem, ativo)
VALUES
  ('arena-belem-post-1', 'arena-belem', '/arenas/arena-belem/aula-beach.jpg', 382, 510, '50% 35%', 'Alunas e professor de beach tennis diante do painel da arena',
   'Inscrições abertas para o Open de Beach Tennis, 21 e 22 de novembro. Duplas nas categorias D, C e iniciante. Link na bio.', 'carrossel', NULL, NOW() - interval '3 days', true, 1, true),
  ('arena-belem-post-2', 'arena-belem', '/arenas/arena-belem/professores.png', 1228, 579, '47% 30%', 'Professores da arena com bolas e raquetes',
   'Esse é o nosso time de professores: beach tennis, futevôlei, vôlei e o CT Falcão 12, tudo na mesma arena.', 'reels', NULL, NOW() - interval '2 days', false, 2, true),
  ('arena-belem-post-3', 'arena-belem', '/arenas/arena-belem/areia-lounge.jpg', 680, 510, '40% 60%', 'Deck de grama sintética com mesas de madeira ao lado da quadra de areia',
   'Deck do lado da areia: mesa, sombra e bebida gelada entre um jogo e outro.', 'foto', NULL, NOW() - interval '4 days', false, 3, true),
  ('arena-belem-post-4', 'arena-belem', '/arenas/arena-belem/society.jpg', 680, 510, '50% 55%', 'Campo society de grama sintética',
   'Final da Copa Society de Setembro: Resenha FC 4 × 2 Amigos do Jurunas. Que jogo!', 'reels', NULL, NOW() - interval '7 days', false, 4, true),
  ('arena-belem-post-5', 'arena-belem', '/arenas/arena-belem/professores.png', 1228, 579, '97% 30%', 'Prof. Italo Bianck com raquete de beach tennis',
   'Turma iniciante de beach tennis com o Prof. Italo, às terças e quintas, 7h e 8h. Raquete e bolas por conta da arena.', 'foto', NULL, NOW() - interval '8 days', false, 5, true),
  ('arena-belem-post-6', 'arena-belem', '/arenas/arena-belem/society-bar.jpg', 680, 510, '50% 50%', 'Mezanino do bar de frente para o campo society',
   'Do mezanino do bar dá para ver o society inteiro. Vem assistir o jogo da galera.', 'carrossel', NULL, NOW() - interval '14 days', false, 6, true),
  ('arena-belem-post-7', 'arena-belem', '/arenas/arena-belem/professores.png', 1228, 579, '6% 30%', 'Professor de vôlei segurando a bola',
   'Toque, manchete e saque: a turma de vôlei de sábado é aberta a todos os níveis.', 'reels', NULL, NOW() - interval '15 days', false, 7, true),
  ('arena-belem-post-8', 'arena-belem', '/arenas/arena-belem/bar-corredor.jpg', 382, 510, '50% 50%', 'Corredor do bar da arena',
   'Resenha depois da final, no bar da arena.', 'reels', NULL, NOW() - interval '21 days', false, 8, true);

-- 12. Link de ativação do dono (gerado só se a arena ainda não tiver proprietário)
WITH novo AS (SELECT gen_random_uuid()::text AS token)
UPDATE public.arenas a
SET token_convite = encode(sha256(convert_to(novo.token, 'UTF8')), 'hex'), setup_concluido_em = NULL
FROM novo
WHERE a.id = 'arena-belem'
  AND NOT EXISTS (SELECT 1 FROM public.arena_usuarios au WHERE au.arena_id = a.id AND au.ativo = true)
RETURNING '/admin?token=' || novo.token AS link_de_ativacao_do_dono;
