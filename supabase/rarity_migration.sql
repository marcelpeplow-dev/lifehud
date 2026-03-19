-- ============================================================
-- Rarity system + daily actions migration
-- Run this in the Supabase SQL editor before deploying the
-- rarity feature.
-- ============================================================

-- Add rarity column to insights
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'common'
  CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'));

-- Daily coaching actions (one per user per day)
CREATE TABLE IF NOT EXISTS daily_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE daily_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily actions"
  ON daily_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage daily actions"
  ON daily_actions FOR ALL
  TO service_role
  USING (true);
