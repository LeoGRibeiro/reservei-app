-- ==============================================================================
-- Atleta de demonstração do protótipo (modo "Cliente logado"): Rafael Souza.
-- Só para a comparação visual e os testes ponta a ponta (não vai para o seed da arena).
-- Datas relativas a hoje no fuso da arena, como no protótipo.
-- ==============================================================================

-- Conta (entra pelo código de demonstração: conta marcada como de demonstração)
INSERT INTO auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, email_confirmed_at)
VALUES ('00000000-0000-4000-8000-0000000000a1', '91998765432@auth.reservei.com.br', 'senha-local',
        '{"conta_demo": true}', '{"nome": "Rafael Souza"}', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios (id, auth_user_id, nome, telefone, data_nascimento)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'Rafael Souza', '91998765432', '1994-03-12')
ON CONFLICT (id) DO NOTHING;

-- Os horários do Rafael não podem ter ocupação sorteada
DELETE FROM public.reservas r
USING (VALUES ('arena-belem-q2', 1, '19:00'), ('arena-belem-q2', 1, '20:00'), ('arena-belem-q4', 6, '20:00')) AS h(quadra, em, hora)
WHERE r.arena_id = 'arena-belem' AND r.id LIKE 'demo-belem-%' AND r.quadra_id = h.quadra
  AND r.data = (now() AT TIME ZONE 'America/Belem')::date + h.em AND h.hora = ANY(r.horarios);

-- Reservas: 2 próximas (K7P2 no mural, M3XQ toda paga) e 4 no histórico (uma cancelada)
INSERT INTO public.reservas (id, arena_id, user_id, quadra_id, data, horarios, hora_inicio, hora_fim, nome_cliente, whatsapp_cliente,
  telefone_cliente, esporte, tipo_reserva, valor_original, valor_total, valor_sinal, valor_pendente, status, status_whatsapp,
  metodo_pagamento, gateway_provedor, permite_vagas, vagas_abertas, pago_em, criada_em)
SELECT 'rsv_demo_rafael_' || r.cod, 'arena-belem', '00000000-0000-4000-8000-0000000000a1', r.quadra,
       (now() AT TIME ZONE 'America/Belem')::date + r.em, r.horarios, r.horarios[1],
       lpad((split_part(r.horarios[array_length(r.horarios, 1)], ':', 1)::int + 1)::text, 2, '0') || ':00',
       'Rafael Souza', '91998765432', '91998765432', r.esporte, 'avulsa', r.total, r.total, r.pago, r.total - r.pago, r.status,
       'enviado', 'pix', 'mock', r.vagas > 0, r.vagas, NOW() - interval '2 days', NOW() - interval '2 days'
FROM (VALUES
  ('k7p2', 1,   'arena-belem-q2', ARRAY['19:00', '20:00'], 'Beach Tennis',    200::numeric, 100::numeric, 'pendente',   2),
  ('m3xq', 6,   'arena-belem-q4', ARRAY['20:00'],          'Futebol Society', 180::numeric, 180::numeric, 'confirmada', 0),
  ('f9a1', -6,  'arena-belem-q2', ARRAY['18:00', '19:00'], 'Beach Tennis',    200::numeric, 200::numeric, 'confirmada', 0),
  ('b2c8', -16, 'arena-belem-q1', ARRAY['19:00', '20:00'], 'Beach Tennis',    200::numeric, 200::numeric, 'confirmada', 0),
  ('t5r0', -21, 'arena-belem-q3', ARRAY['20:00'],          'Futevôlei',       100::numeric,  50::numeric, 'cancelada',  0),
  ('q1w4', -27, 'arena-belem-q4', ARRAY['19:00', '20:00'], 'Futebol Society', 360::numeric, 360::numeric, 'confirmada', 0)
) AS r(cod, em, quadra, horarios, esporte, total, pago, status, vagas)
ON CONFLICT (id) DO NOTHING;

-- Pedidos para jogar na partida K7P2 (dois novos, um já chamado)
INSERT INTO public.interesses_vagas (id, reserva_id, usuario_id, nome_usuario, telefone_usuario, status, created_at)
VALUES
  ('int_demo_lucas',  'rsv_demo_rafael_k7p2', 'demo-lucas',  'Lucas Moraes',   '5591981112233', 'pendente',  NOW() - interval '2 hours'),
  ('int_demo_camila', 'rsv_demo_rafael_k7p2', 'demo-camila', 'Camila Rocha',   '5591992224455', 'pendente',  NOW() - interval '5 hours'),
  ('int_demo_diego',  'rsv_demo_rafael_k7p2', 'demo-diego',  'Diego Pinheiro', '5591983336677', 'contatado', NOW() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- Clube: 6 carimbos (3 jogos de 2 horas) e 1 hora grátis
INSERT INTO public.fidelidade_selos (id, arena_id, usuario_id, reserva_id, horas_contabilizadas, valor_por_hora, valor_total_reserva,
  data_jogo, expira_em, resgatado)
SELECT 'selo_demo_' || s.cod, 'arena-belem', '00000000-0000-4000-8000-0000000000a1', 'rsv_demo_rafael_' || s.cod, 2, s.valor / 2, s.valor,
       (now() AT TIME ZONE 'America/Belem')::date + s.em, ((now() AT TIME ZONE 'America/Belem')::date + s.em + interval '3 months')::date, false
FROM (VALUES ('f9a1', -6, 200::numeric), ('b2c8', -16, 200::numeric), ('q1w4', -27, 360::numeric)) AS s(cod, em, valor)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fidelidade_vouchers (id, arena_id, codigo, usuario_id, valor_teto, status, expira_em)
VALUES ('voucher_demo_rafael', 'arena-belem', 'CLUBE-7Q4M', '00000000-0000-4000-8000-0000000000a1', 100, 'disponivel',
        (now() AT TIME ZONE 'America/Belem')::date + 52)
ON CONFLICT (id) DO NOTHING;
