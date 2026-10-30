-- ==============================================================================
-- Arena de exemplo do template do portal (dados neutros, sem marca real)
--
-- Serve para ver o template com todas as seções preenchidas e para testar mudanças no portal sem
-- tocar nos dados de uma arena real. Acesso: subdomínio arena-exemplo (ex.: arena-exemplo.localhost:3000).
--
-- Pré-requisito: migrações 2026-10-30-a-auditoria-rls.sql e 2026-10-30-b-portal-template.sql.
-- Idempotente: pode ser executado mais de uma vez.
-- ==============================================================================

-- 1. Arena (pagamento simulado: nada é cobrado; tema nulo = tema neutro do template)
INSERT INTO public.arenas (
  id, slug, nome, telefone, whatsapp, endereco, bairro, endereco_referencia, cidade, estado, cep,
  horario_abertura, horario_fechamento, intervalo_minutos, percentual_sinal_minimo, antecedencia_minima_minutos,
  ativo, modulos_ativos, modo_pagamento, politica_cancelamento, logo_url, instagram, mapa_url, tema
) VALUES (
  'arena-exemplo', 'arena-exemplo', 'Arena Exemplo', '(11) 90000-0000', '(11) 90000-0000',
  'Rua do Exemplo, 100', 'Centro', 'Ao lado da praça', 'Cidade Exemplo', 'SP', '01000-000',
  '08:00', '22:00', 60, 50, 60,
  true, '{agendamento_core,fidelidade,vagas,escolinhas,contratos,eventos,instagram}', 'simulado',
  'Cancelamentos com mais de 24 horas de antecedência: você recebe o sinal de volta no Pix. Com menos de 24 horas, o sinal não é devolvido. Em caso de chuva forte, a arena remarca sem custo.',
  '/arenas/exemplo/logo.svg', 'arenaexemplo', '/arenas/exemplo/mapa.svg', NULL
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, endereco = EXCLUDED.endereco, bairro = EXCLUDED.bairro,
  endereco_referencia = EXCLUDED.endereco_referencia, modulos_ativos = EXCLUDED.modulos_ativos,
  modo_pagamento = EXCLUDED.modo_pagamento, politica_cancelamento = EXCLUDED.politica_cancelamento,
  logo_url = EXCLUDED.logo_url, instagram = EXCLUDED.instagram, mapa_url = EXCLUDED.mapa_url,
  tema = EXCLUDED.tema, ativo = true, atualizado_em = NOW();

-- 2. Quadras e preços
INSERT INTO public.quadras (id, arena_id, numero, nome, tipo_piso, esportes, coberta, iluminacao, valor_hora_padrao, ordem, ativa, foto_url, foto_posicao, foto_descricao)
VALUES
  ('arena-exemplo-q1', 'arena-exemplo', 1, 'Quadra de Areia 1', 'areia', ARRAY['Beach Tennis', 'Futevôlei'], false, true, 70, 1, true, '/arenas/exemplo/quadra-areia.svg', '50% 50%', 'Ilustração de quadra de areia'),
  ('arena-exemplo-q2', 'arena-exemplo', 2, 'Quadra de Areia 2', 'areia', ARRAY['Beach Tennis'], false, true, 70, 2, true, '/arenas/exemplo/quadra-areia.svg', '50% 50%', 'Ilustração de quadra de areia'),
  ('arena-exemplo-q3', 'arena-exemplo', 3, 'Society', 'society', ARRAY['Futebol Society'], false, true, 120, 3, true, '/arenas/exemplo/quadra-society.svg', '50% 50%', 'Ilustração de campo society')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, esportes = EXCLUDED.esportes, foto_url = EXCLUDED.foto_url,
  foto_posicao = EXCLUDED.foto_posicao, foto_descricao = EXCLUDED.foto_descricao, ativa = true;

INSERT INTO public.quadras_precos (id, arena_id, quadra_id, dias_semana, hora_inicio, hora_fim, valor_hora, descricao, ativo)
SELECT 'arena-exemplo-' || q.id || '-noite', 'arena-exemplo', q.id, '{0,1,2,3,4,5,6}', '18:00', '22:00', q.noite, 'Noite', true
FROM (VALUES ('arena-exemplo-q1', 90::numeric), ('arena-exemplo-q2', 90::numeric), ('arena-exemplo-q3', 150::numeric)) AS q(id, noite)
ON CONFLICT (id) DO UPDATE SET valor_hora = EXCLUDED.valor_hora, ativo = true;

-- 3. Textos do site, regras e perguntas frequentes
INSERT INTO public.arena_conteudo (arena_id, intro_reserva, intro_escolinhas, intro_eventos, intro_estrutura, destaques_estrutura, regras, faq)
VALUES (
  'arena-exemplo',
  'Duas quadras de areia e um campo society. Escolha o dia, toque nos horários livres e pague o sinal no Pix.',
  'Aulas para todas as idades. Para entrar numa turma, fale com a arena no WhatsApp.',
  'Torneios e encontros para quem joga na arena.',
  'Quadras iluminadas, vestiário e espaço para descansar entre os jogos.',
  '[{"destaque": "2 quadras de areia", "resto": "iluminadas"}, {"destaque": "Campo society", "resto": "de grama sintética"}, {"destaque": "Vestiário", "resto": "com chuveiro"}]',
  '[{"titulo": "Chegue 10 minutos antes.", "texto": "O horário começa e termina na hora marcada."}, {"titulo": "Libere a quadra no fim do horário.", "texto": "O próximo grupo também reservou."}]',
  '[{"pergunta": "Preciso criar conta para reservar?", "resposta": "Não. Basta informar nome e WhatsApp."}, {"pergunta": "E se chover?", "resposta": "Em caso de chuva forte, a arena remarca sem custo."}]'
)
ON CONFLICT (arena_id) DO UPDATE SET intro_reserva = EXCLUDED.intro_reserva, intro_escolinhas = EXCLUDED.intro_escolinhas,
  intro_eventos = EXCLUDED.intro_eventos, intro_estrutura = EXCLUDED.intro_estrutura,
  destaques_estrutura = EXCLUDED.destaques_estrutura, regras = EXCLUDED.regras, faq = EXCLUDED.faq, atualizado_em = NOW();

-- 4. Escolinhas com turmas
INSERT INTO public.landing_page_schools (id, arena_id, sport_name, teacher_name, teacher_image_url, schedule_info, whatsapp_number, descricao, turmas, ordem, is_active)
VALUES
  ('arena-exemplo-esc-1', 'arena-exemplo', 'Beach tennis', 'Ana Exemplo', '/arenas/exemplo/professor.svg', 'Ter e Qui, 18h', '11900000000',
   'Turmas para iniciantes e intermediários.', '[{"dias": "Ter e Qui", "horas": "18h", "nivel": "Iniciante"}, {"dias": "Sábado", "horas": "9h", "nivel": "Intermediário"}]', 1, true),
  ('arena-exemplo-esc-2', 'arena-exemplo', 'Futebol society', 'Bruno Exemplo', '/arenas/exemplo/professor.svg', 'Seg e Qua, 17h', '11900000000',
   'Treinos para crianças e adolescentes.', '[{"dias": "Seg e Qua", "horas": "17h", "nivel": "8 a 12 anos"}]', 2, true)
ON CONFLICT (id) DO UPDATE SET descricao = EXCLUDED.descricao, turmas = EXCLUDED.turmas, ordem = EXCLUDED.ordem, is_active = true;

-- 5. Eventos: um em andamento, um com inscrições abertas e um que já aconteceu
INSERT INTO public.eventos (id, arena_id, titulo, modalidade, descricao_curta, descricao, data_inicio, data_fim, horario, status, dados,
  inscricao_tipo, mensagem_whatsapp, chave, link_rotulo, link_url, campeoes, rotulo_campeoes, placar_final, foto_url, foto_descricao, ordem, ativo)
VALUES
  ('arena-exemplo-ev-1', 'arena-exemplo', 'Torneio de Exemplo', 'Beach tennis', NULL,
   'Semifinais e final no fim de semana. Vem torcer!', CURRENT_DATE, NULL, NULL, 'em_andamento', '[]', NULL, NULL,
   '[{"rotulo": "Semifinais", "final": false, "jogos": [{"hora": "15h", "lados": ["Dupla A", "Dupla B"]}, {"hora": "16h", "lados": ["Dupla C", "Dupla D"]}]}, {"rotulo": "Final", "final": true, "jogos": [{"hora": "18h", "lados": ["Vencedores da semi das 15h", "Vencedores da semi das 16h"]}]}]',
   'Placar ao vivo nos stories', 'https://www.instagram.com/arenaexemplo/', NULL, NULL, NULL, NULL, NULL, 1, true),
  ('arena-exemplo-ev-2', 'arena-exemplo', 'Open de Exemplo', 'Beach tennis', 'Beach tennis · duplas', NULL, CURRENT_DATE + 20, CURRENT_DATE + 21, NULL,
   'inscricoes', '[{"rotulo": "Inscrição", "valor": "R$ 100 por dupla"}, {"rotulo": "Vagas", "valor": "até 16 duplas"}]', 'whatsapp',
   'Olá! Vim pelo site e quero me inscrever no Open de Exemplo. Como faço?', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, true),
  ('arena-exemplo-ev-3', 'arena-exemplo', 'Copa de Exemplo', 'Futebol society', NULL, NULL, CURRENT_DATE - 30, NULL, NULL,
   'encerrado', '[]', NULL, NULL, NULL, NULL, NULL, 'Time Exemplo', 'Campeão', '3 × 1', '/arenas/exemplo/quadra-society.svg', 'Ilustração de campo society', 3, true)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data_inicio = EXCLUDED.data_inicio, data_fim = EXCLUDED.data_fim,
  dados = EXCLUDED.dados, chave = EXCLUDED.chave, ativo = true;

-- 6. Estrutura (as 4 primeiras fotos ativas formam o bento)
INSERT INTO public.landing_page_gallery (id, arena_id, image_url, title, description, categoria, display_order, is_active)
SELECT 'arena-exemplo-foto-' || n, 'arena-exemplo', '/arenas/exemplo/' || arq, legenda, legenda, 'quadras', n, true
FROM (VALUES (1, 'quadra-areia.svg', 'Quadras de areia'), (2, 'estrutura.svg', 'Área de convivência'),
             (3, 'quadra-society.svg', 'Campo society'), (4, 'estrutura.svg', 'Vestiário')) AS f(n, arq, legenda)
ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, title = EXCLUDED.title, is_active = true;

-- 7. Instagram (perfil e posts cadastrados; contagens marcadas como simuladas)
INSERT INTO public.instagram_perfil (arena_id, seguidores, total_posts, contagem_simulada)
VALUES ('arena-exemplo', 1000, 100, true)
ON CONFLICT (arena_id) DO UPDATE SET seguidores = EXCLUDED.seguidores, total_posts = EXCLUDED.total_posts,
  contagem_simulada = EXCLUDED.contagem_simulada, atualizado_em = NOW();

INSERT INTO public.instagram_posts (id, arena_id, imagem_url, descricao, legenda, tipo, publicado_em, fixado, ordem, ativo)
SELECT 'arena-exemplo-post-' || n, 'arena-exemplo', '/arenas/exemplo/' || arq, 'Ilustração da arena', legenda, tipo,
       NOW() - (dias || ' days')::interval, n = 1, n, true
FROM (VALUES (1, 'quadra-areia.svg', 'Inscrições abertas para o Open de Exemplo.', 'carrossel', 3),
             (2, 'quadra-society.svg', 'Final da Copa de Exemplo.', 'reels', 2),
             (3, 'estrutura.svg', 'Nossa área de convivência.', 'foto', 4),
             (4, 'quadra-areia.svg', 'Turma de beach tennis aos sábados.', 'foto', 7),
             (5, 'quadra-society.svg', 'Treino do futebol society.', 'reels', 10),
             (6, 'estrutura.svg', 'Vestiário reformado.', 'foto', 14)) AS p(n, arq, legenda, tipo, dias)
ON CONFLICT (id) DO UPDATE SET legenda = EXCLUDED.legenda, publicado_em = EXCLUDED.publicado_em, ativo = true;

-- 8. Clube (fidelidade): 10 horas = 1 hora grátis, até R$ 100
INSERT INTO public.fidelidade_campanha (id, arena_id, nome, horas_necessarias, meses_validade, dias_validade_voucher, valor_teto_voucher, ativo)
VALUES ('campanha-arena-exemplo', 'arena-exemplo', 'Clube Arena Exemplo', 10, 3, 60, 100, true)
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, horas_necessarias = EXCLUDED.horas_necessarias,
  valor_teto_voucher = EXCLUDED.valor_teto_voucher, ativo = true;
