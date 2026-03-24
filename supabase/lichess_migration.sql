-- ============================================================
-- Lichess Integration Migration
-- ============================================================

-- Add lichess_username and last_lichess_sync to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lichess_username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_lichess_sync timestamptz;

-- Add source column to chess_games (defaults to 'chess.com' for existing rows)
ALTER TABLE public.chess_games ADD COLUMN IF NOT EXISTS source text DEFAULT 'chess.com';

-- Backfill existing rows
UPDATE public.chess_games SET source = 'chess.com' WHERE source IS NULL;

-- Index on source for filtering
CREATE INDEX IF NOT EXISTS idx_chess_user_source ON public.chess_games(user_id, source);
