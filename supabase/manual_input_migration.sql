-- ============================================================
-- Manual Input System Migration
-- Two tables: manual_entries and user_manual_config
-- Run this in the Supabase SQL editor or via the service client.
-- ============================================================

-- Manual metric entries (generic key-value per metric per day)
CREATE TABLE IF NOT EXISTS manual_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  metric_id TEXT NOT NULL,           -- references MetricDefinition.id from src/lib/metrics/registry.ts
  value NUMERIC NOT NULL,            -- the actual value (number, 0/1 for booleans, hours as decimal for time)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, metric_id)   -- one entry per metric per day
);

-- User's manual domain/metric preferences (which manual metrics they want to track)
CREATE TABLE IF NOT EXISTS user_manual_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  domain TEXT NOT NULL,              -- domain id (e.g., 'caffeine', 'hydration')
  metric_id TEXT NOT NULL,           -- metric id (e.g., 'caffeine_total_daily')
  enabled BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, metric_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manual_entries_user_date   ON manual_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_manual_entries_user_metric ON manual_entries(user_id, metric_id);
CREATE INDEX IF NOT EXISTS idx_manual_config_user         ON user_manual_config(user_id);

-- RLS policies
ALTER TABLE manual_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_manual_config   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual entries"   ON manual_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manual entries" ON manual_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manual entries" ON manual_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own manual entries" ON manual_entries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own manual config"   ON user_manual_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own manual config" ON user_manual_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own manual config" ON user_manual_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own manual config" ON user_manual_config FOR DELETE USING (auth.uid() = user_id);
