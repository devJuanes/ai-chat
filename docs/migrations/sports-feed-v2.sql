-- Logos, porcentaje de victoria y fecha del pronóstico.
-- Ejecutar en la consola SQL de MatuDB después de sports-feed-v1.sql

ALTER TABLE sports_fixtures ADD COLUMN IF NOT EXISTS home_logo TEXT;
ALTER TABLE sports_fixtures ADD COLUMN IF NOT EXISTS away_logo TEXT;
ALTER TABLE sports_fixtures ADD COLUMN IF NOT EXISTS league_logo TEXT;

ALTER TABLE sports_forecasts ADD COLUMN IF NOT EXISTS win_prob NUMERIC(8, 4);
ALTER TABLE sports_forecasts ADD COLUMN IF NOT EXISTS pick_label TEXT;
ALTER TABLE sports_forecasts ADD COLUMN IF NOT EXISTS slate_date DATE;
ALTER TABLE sports_forecasts ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS sports_forecasts_slate_idx
  ON sports_forecasts (slate_date, win_prob DESC);
