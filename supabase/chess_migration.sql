-- ============================================================
-- Chess.com Integration Migration
-- ============================================================

-- Add chess_username to profiles
ALTER TABLE public.profiles ADD COLUMN chess_username text;
ALTER TABLE public.profiles ADD COLUMN last_chess_sync timestamptz;

-- ============================================================
-- CHESS GAMES TABLE
-- ============================================================
CREATE TABLE public.chess_games (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  game_id text NOT NULL,              -- chess.com game URL (unique identifier)
  played_at timestamptz NOT NULL,
  date date NOT NULL,                 -- for joining with sleep/workout data
  time_class text NOT NULL,           -- 'bullet', 'blitz', 'rapid', 'daily'
  time_control text,                  -- e.g. "600" or "180+2"
  player_color text NOT NULL,         -- 'white' or 'black'
  player_rating integer NOT NULL,
  opponent_rating integer NOT NULL,
  result text NOT NULL,               -- 'win', 'loss', 'draw'
  result_detail text,                 -- 'checkmate', 'resignation', 'timeout', etc.
  accuracy numeric,                   -- 0-100 if available, null otherwise
  num_moves integer,
  duration_seconds integer,
  opening_name text,
  raw_pgn text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, game_id)
);

-- RLS
ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chess games" ON public.chess_games FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert chess games" ON public.chess_games FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own chess games" ON public.chess_games FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_chess_user_date ON public.chess_games(user_id, date DESC);
CREATE INDEX idx_chess_user_played ON public.chess_games(user_id, played_at DESC);
CREATE INDEX idx_chess_user_timeclass ON public.chess_games(user_id, time_class);

-- Update insights category constraint to include 'chess'
ALTER TABLE public.insights DROP CONSTRAINT IF EXISTS insights_category_check;
ALTER TABLE public.insights ADD CONSTRAINT insights_category_check
  CHECK (category IN ('sleep', 'fitness', 'recovery', 'correlation', 'goal', 'general', 'wellbeing', 'chess'));
