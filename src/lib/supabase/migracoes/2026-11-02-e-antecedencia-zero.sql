-- ==============================================================================
-- Antecedência mínima padrão = 0 (SPEC/2026-11-02-admin-ajustes-demo.md §7)
--
-- "Até o horário começar": às 12:35 o atleta ainda reserva as 13:00. Cada arena ajusta em
-- Configurações ("Quanto tempo antes do horário o site para de aceitar reservas").
-- A Arena Belém (demonstração) passa a usar 0; as outras arenas mantêm o valor que já têm.
--
-- Pré-requisito: 2026-11-02-d-clientes-bloqueio.sql. Idempotente.
-- ==============================================================================

ALTER TABLE public.arenas ALTER COLUMN antecedencia_minima_minutos SET DEFAULT 0;

UPDATE public.arenas
   SET antecedencia_minima_minutos = 0
 WHERE id = 'arena-belem'
   AND antecedencia_minima_minutos <> 0;
