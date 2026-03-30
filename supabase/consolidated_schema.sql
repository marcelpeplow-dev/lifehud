-- ============================================================
-- Life HUD — Consolidated Database Schema
-- This file documents the FULL schema in dependency order.
-- It is NOT meant to be run on a fresh database (use the
-- individual migration files for incremental changes).
-- Last updated: 2026-03-25
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id                    UUID         REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name          TEXT,
  date_of_birth         DATE,
  gender                TEXT         CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm             NUMERIC,
  weight_kg             NUMERIC,
  timezone              TEXT         DEFAULT 'America/New_York',
  onboarding_completed  BOOLEAN      DEFAULT FALSE,
  has_seen_tour         BOOLEAN      DEFAULT FALSE,
  -- Chess integrations
  chess_username        TEXT,
  last_chess_sync       TIMESTAMPTZ,
  -- Lichess integration
  lichess_username      TEXT,
  last_lichess_sync     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- DEVICE CONNECTIONS (Terra wearables)
-- ============================================================
CREATE TABLE public.device_connections (
  id             UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID         REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  terra_user_id  TEXT         NOT NULL,
  provider       TEXT         NOT NULL,  -- 'FITBIT', 'APPLE', 'GARMIN', 'OURA', 'WHOOP'
  connected_at   TIMESTAMPTZ  DEFAULT NOW(),
  last_sync_at   TIMESTAMPTZ,
  is_active      BOOLEAN      DEFAULT TRUE
);

ALTER TABLE public.device_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own devices"   ON public.device_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own devices" ON public.device_connections FOR ALL    USING (auth.uid() = user_id);

-- ============================================================
-- USER INTEGRATIONS (OAuth — Fitbit)
-- ============================================================
CREATE TABLE public.user_integrations (
  id                UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID         REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider          TEXT         NOT NULL,  -- 'fitbit'
  access_token      TEXT         NOT NULL,
  refresh_token     TEXT         NOT NULL,
  token_expires_at  TIMESTAMPTZ  NOT NULL,
  scopes            TEXT,                   -- comma-separated scopes
  provider_user_id  TEXT,                   -- Fitbit user ID
  last_sync_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own integrations"   ON public.user_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service can manage integrations"   ON public.user_integrations FOR ALL    WITH CHECK (TRUE);

CREATE INDEX idx_integrations_user_provider    ON public.user_integrations(user_id, provider);
CREATE INDEX idx_integrations_provider_expires ON public.user_integrations(provider, token_expires_at);

-- ============================================================
-- SLEEP RECORDS
-- ============================================================
CREATE TABLE public.sleep_records (
  id                  UUID     DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID     REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                DATE     NOT NULL,
  bedtime             TIMESTAMPTZ,
  wake_time           TIMESTAMPTZ,
  duration_minutes    INTEGER,
  deep_sleep_minutes  INTEGER,
  rem_sleep_minutes   INTEGER,
  light_sleep_minutes INTEGER,
  awake_minutes       INTEGER,
  sleep_score         NUMERIC,
  avg_heart_rate      NUMERIC,
  avg_hrv             NUMERIC,
  source              TEXT,
  raw_data            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.sleep_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sleep"  ON public.sleep_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert sleep"  ON public.sleep_records FOR INSERT WITH CHECK (TRUE);

CREATE INDEX idx_sleep_user_date ON public.sleep_records(user_id, date DESC);

-- ============================================================
-- WORKOUTS
-- ============================================================
CREATE TABLE public.workouts (
  id               UUID     DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID     REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date             DATE     NOT NULL,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  duration_minutes INTEGER,
  workout_type     TEXT,
  activity_name    TEXT,
  calories_burned  NUMERIC,
  avg_heart_rate   NUMERIC,
  max_heart_rate   NUMERIC,
  distance_meters  NUMERIC,
  intensity_score  NUMERIC,
  source           TEXT,
  raw_data         JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert workouts" ON public.workouts FOR INSERT WITH CHECK (TRUE);

CREATE INDEX idx_workouts_user_date ON public.workouts(user_id, date DESC);

-- ============================================================
-- DAILY METRICS (wearable aggregates)
-- ============================================================
CREATE TABLE public.daily_metrics (
  id                  UUID     DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID     REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date                DATE     NOT NULL,
  steps               INTEGER,
  active_minutes      INTEGER,
  resting_heart_rate  NUMERIC,
  hrv_average         NUMERIC,
  calories_total      NUMERIC,
  calories_active     NUMERIC,
  stress_score        NUMERIC,
  recovery_score      NUMERIC,
  source              TEXT,
  raw_data            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own metrics"  ON public.daily_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert metrics"  ON public.daily_metrics FOR INSERT WITH CHECK (TRUE);

CREATE INDEX idx_daily_user_date ON public.daily_metrics(user_id, date DESC);

-- ============================================================
-- CHESS GAMES (Chess.com + Lichess)
-- ============================================================
CREATE TABLE public.chess_games (
  id               UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID         REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  game_id          TEXT         NOT NULL,           -- provider game URL/ID
  played_at        TIMESTAMPTZ  NOT NULL,
  date             DATE         NOT NULL,
  time_class       TEXT         NOT NULL,           -- 'bullet','blitz','rapid','daily'
  time_control     TEXT,                            -- e.g. "600" or "180+2"
  player_color     TEXT         NOT NULL,           -- 'white' | 'black'
  player_rating    INTEGER      NOT NULL,
  opponent_rating  INTEGER      NOT NULL,
  result           TEXT         NOT NULL,           -- 'win','loss','draw'
  result_detail    TEXT,                            -- 'checkmate','resignation','timeout',...
  accuracy         NUMERIC,                         -- 0-100 if available
  num_moves        INTEGER,
  duration_seconds INTEGER,
  opening_name     TEXT,
  raw_pgn          TEXT,
  source           TEXT         DEFAULT 'chess.com', -- 'chess.com' | 'lichess'
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chess games"   ON public.chess_games FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert chess games"   ON public.chess_games FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Users can delete own chess games" ON public.chess_games FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_chess_user_date     ON public.chess_games(user_id, date DESC);
CREATE INDEX idx_chess_user_played   ON public.chess_games(user_id, played_at DESC);
CREATE INDEX idx_chess_user_timeclass ON public.chess_games(user_id, time_class);
CREATE INDEX idx_chess_user_source   ON public.chess_games(user_id, source);

-- ============================================================
-- AI INSIGHTS
-- ============================================================
CREATE TABLE public.insights (
  id           UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID         REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date         DATE         NOT NULL,
  category     TEXT         NOT NULL CHECK (category IN (
                 'sleep','fitness','recovery','correlation','goal','general','wellbeing','chess'
               )),
  title        TEXT         NOT NULL,
  body         TEXT         NOT NULL,
  data_points  JSONB,
  priority     INTEGER      DEFAULT 0,
  rarity       TEXT         NOT NULL DEFAULT 'common'
               CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  is_read      BOOLEAN      DEFAULT FALSE,
  is_dismissed BOOLEAN      DEFAULT FALSE,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own insights"   ON public.insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own insights" ON public.insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert insights"   ON public.insights FOR INSERT WITH CHECK (TRUE);

CREATE INDEX idx_insights_user_date ON public.insights(user_id, date DESC);

-- ============================================================
-- DAILY CHECK-INS
-- ============================================================
CREATE TABLE public.daily_checkins (
  id         UUID     DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID     REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date       DATE     NOT NULL,
  mood       INTEGER  NOT NULL CHECK (mood BETWEEN 1 AND 10),
  energy     INTEGER  NOT NULL CHECK (energy BETWEEN 1 AND 10),
  stress     INTEGER  NOT NULL CHECK (stress BETWEEN 1 AND 10),
  notes      TEXT     CHECK (CHAR_LENGTH(notes) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own checkins" ON public.daily_checkins FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_checkins_user_date ON public.daily_checkins(user_id, date DESC);

-- ============================================================
-- GOALS
-- ============================================================
CREATE TABLE public.goals (
  id               UUID     DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID     REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title            TEXT     NOT NULL,
  -- Legacy category (kept for backwards compat)
  category         TEXT     NOT NULL CHECK (category IN ('sleep','fitness','recovery','general')),
  -- New fields from goals overhaul
  domain           TEXT,                            -- domain id from DOMAIN_REGISTRY
  metric_id        TEXT,                            -- MetricDefinition.id
  metric_name      TEXT     NOT NULL,               -- legacy metric key
  target_value     NUMERIC  NOT NULL,
  target_unit      TEXT     NOT NULL,               -- legacy unit
  unit             TEXT,                            -- new unit from metric registry
  target_frequency TEXT     DEFAULT 'weekly',
  current_value    NUMERIC  DEFAULT 0,
  start_date       DATE     DEFAULT CURRENT_DATE,
  target_date      DATE,
  is_active        BOOLEAN  DEFAULT TRUE,
  starred          BOOLEAN  NOT NULL DEFAULT FALSE,
  status           TEXT     NOT NULL DEFAULT 'active', -- 'active' | 'archived'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals" ON public.goals FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_goals_user_active ON public.goals(user_id, is_active);

-- ============================================================
-- DAILY ACTIONS (AI coaching prompts, one per day)
-- ============================================================
CREATE TABLE public.daily_actions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily actions" ON public.daily_actions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage daily actions" ON public.daily_actions FOR ALL
  TO service_role USING (TRUE);

-- ============================================================
-- DASHBOARD CONFIG (customizable stat cards + graph widgets)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_dashboard_config (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  config_type TEXT         NOT NULL,   -- 'stat_card' | 'graph' | 'domain_stat_card' | 'domain_graph'
  position    INT          NOT NULL,   -- 0-3 for stat cards, 0-1 for graphs
  domain      TEXT,                    -- NULL = main dashboard, else domain id
  config      JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, config_type, position, domain)
);

ALTER TABLE user_dashboard_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own dashboard config" ON user_dashboard_config
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- MANUAL ENTRIES (daily key-value for manual-tracked metrics)
-- ============================================================
CREATE TABLE IF NOT EXISTS manual_entries (
  id         UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date       DATE     NOT NULL,
  metric_id  TEXT     NOT NULL,        -- MetricDefinition.id from metrics/registry.ts
  value      NUMERIC  NOT NULL,        -- number; 0/1 for booleans; hours as decimal for time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, metric_id)
);

ALTER TABLE manual_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own manual entries"   ON manual_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manual entries" ON manual_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manual entries" ON manual_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own manual entries" ON manual_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_manual_entries_user_date   ON manual_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_manual_entries_user_metric ON manual_entries(user_id, metric_id);

-- ============================================================
-- USER MANUAL CONFIG (which manual domains/metrics are enabled)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_manual_config (
  id            UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID     REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  domain        TEXT     NOT NULL,     -- domain id (e.g., 'caffeine', 'hydration')
  metric_id     TEXT     NOT NULL,     -- metric id (e.g., 'caffeine_total_daily')
  enabled       BOOLEAN  DEFAULT TRUE,
  display_order INT      DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_id)
);

ALTER TABLE user_manual_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own manual config"   ON user_manual_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manual config" ON user_manual_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manual config" ON user_manual_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own manual config" ON user_manual_config FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_manual_config_user ON user_manual_config(user_id);
