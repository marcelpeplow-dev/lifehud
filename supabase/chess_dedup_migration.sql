-- ============================================================
-- Fix chess_games deduplication to be per-user
-- ============================================================
-- Problem: If the chess_games table was created with UNIQUE(game_id) only,
-- upserts with onConflict:"user_id,game_id" silently skip games when another
-- user already has the same game_id (e.g. seed data, or two users playing
-- each other). The constraint must be UNIQUE(user_id, game_id).
--
-- This migration is idempotent: safe to run even if the compound constraint
-- already exists.
-- ============================================================

-- Step 1: Drop the single-column unique constraint on game_id if it exists
-- (PostgreSQL auto-names it chess_games_game_id_key)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'chess_games'
      AND c.contype = 'u'
      AND c.conname = 'chess_games_game_id_key'
  ) THEN
    ALTER TABLE public.chess_games DROP CONSTRAINT chess_games_game_id_key;
    RAISE NOTICE 'Dropped single-column unique constraint chess_games_game_id_key';
  ELSE
    RAISE NOTICE 'Single-column constraint chess_games_game_id_key not found, skipping drop';
  END IF;
END $$;

-- Step 2: Add compound unique constraint on (user_id, game_id) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'chess_games'
      AND c.contype = 'u'
      AND c.conname = 'chess_games_user_id_game_id_key'
  ) THEN
    ALTER TABLE public.chess_games ADD CONSTRAINT chess_games_user_id_game_id_key UNIQUE (user_id, game_id);
    RAISE NOTICE 'Added compound unique constraint chess_games_user_id_game_id_key';
  ELSE
    RAISE NOTICE 'Compound constraint chess_games_user_id_game_id_key already exists, skipping';
  END IF;
END $$;
