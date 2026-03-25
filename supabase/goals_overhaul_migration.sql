-- Goals table overhaul: add domain/metric_id/unit/starred/status columns

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS domain     TEXT,
  ADD COLUMN IF NOT EXISTS metric_id  TEXT,
  ADD COLUMN IF NOT EXISTS unit       TEXT,
  ADD COLUMN IF NOT EXISTS starred    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'active';

-- Backfill from existing columns for old rows
UPDATE goals
SET
  domain    = category,
  metric_id = metric_name,
  unit      = target_unit,
  status    = CASE WHEN is_active THEN 'active' ELSE 'archived' END
WHERE domain IS NULL;
