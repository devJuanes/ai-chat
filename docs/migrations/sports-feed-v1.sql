-- Feed deportivo MatuSports Pro
-- Partidos, forma, historial (H2H) y pronósticos internos.
-- Ejecutar en la consola SQL de MatuDB.

CREATE TABLE IF NOT EXISTS sports_api_calls (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  params_key TEXT NOT NULL,
  call_date DATE NOT NULL,
  http_status INTEGER,
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  results_count INTEGER,
  remaining INTEGER,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sports_api_calls_day_idx
  ON sports_api_calls (provider, call_date, created_at DESC);

CREATE INDEX IF NOT EXISTS sports_api_calls_sig_idx
  ON sports_api_calls (provider, params_key, created_at DESC);

CREATE TABLE IF NOT EXISTS sports_fixtures (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league_id TEXT,
  league_name TEXT,
  league_country TEXT,
  season TEXT,
  round TEXT,
  kickoff_at TIMESTAMPTZ,
  status_short TEXT,
  home_team_id TEXT,
  home_team_name TEXT,
  away_team_id TEXT,
  away_team_name TEXT,
  home_score INTEGER,
  away_score INTEGER,
  venue TEXT,
  is_priority BOOLEAN NOT NULL DEFAULT FALSE,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS sports_fixtures_kickoff_idx
  ON sports_fixtures (kickoff_at);

CREATE INDEX IF NOT EXISTS sports_fixtures_priority_idx
  ON sports_fixtures (is_priority, kickoff_at);

CREATE INDEX IF NOT EXISTS sports_fixtures_home_idx
  ON sports_fixtures (provider, home_team_id);

CREATE INDEX IF NOT EXISTS sports_fixtures_away_idx
  ON sports_fixtures (provider, away_team_id);

CREATE TABLE IF NOT EXISTS sports_team_form (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  last_n INTEGER NOT NULL DEFAULT 8,
  played INTEGER,
  wins INTEGER,
  draws INTEGER,
  losses INTEGER,
  goals_for INTEGER,
  goals_against INTEGER,
  btts_rate NUMERIC(6, 3),
  over_rate NUMERIC(6, 3),
  summary JSONB,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, team_id)
);

CREATE TABLE IF NOT EXISTS sports_h2h (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  team_a_id TEXT NOT NULL,
  team_b_id TEXT NOT NULL,
  home_team_id TEXT,
  away_team_id TEXT,
  last_n INTEGER NOT NULL DEFAULT 10,
  meetings INTEGER,
  home_wins INTEGER,
  draws INTEGER,
  away_wins INTEGER,
  btts_count INTEGER,
  summary JSONB,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, team_a_id, team_b_id)
);

CREATE TABLE IF NOT EXISTS sports_forecasts (
  id UUID PRIMARY KEY,
  fixture_id UUID NOT NULL REFERENCES sports_fixtures(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL DEFAULT 'matu-sports-pro',
  home_prob NUMERIC(8, 4),
  draw_prob NUMERIC(8, 4),
  away_prob NUMERIC(8, 4),
  btts_prob NUMERIC(8, 4),
  over_prob NUMERIC(8, 4),
  confidence TEXT,
  no_bet BOOLEAN NOT NULL DEFAULT TRUE,
  summary TEXT,
  drivers JSONB,
  raw_text TEXT,
  inputs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fixture_id)
);

CREATE INDEX IF NOT EXISTS sports_forecasts_created_idx
  ON sports_forecasts (created_at DESC);

CREATE TABLE IF NOT EXISTS sports_sync_runs (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  detail JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
