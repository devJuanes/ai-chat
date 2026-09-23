-- ============================================================
-- Usage per model + admin unlimited + usage notifications
-- Run in MatuDB SQL console after previous migrations.
-- ============================================================

-- Platform admin: unlimited usage
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Relax global message walls (enforcement moves to per-model tokens)
UPDATE plans SET monthly_message_limit = -1 WHERE id IN ('free', 'pro', 'team');
UPDATE plans SET monthly_token_limit = 250000 WHERE id = 'free';
UPDATE plans SET monthly_token_limit = 3000000 WHERE id = 'pro';
UPDATE plans SET monthly_token_limit = -1 WHERE id = 'team';

-- Optional: keep a soft global token ceiling as safety net (-1 = off)
-- Free keeps 80k as org-wide soft total; Pro/Team raised.
-- Per-model limits below are the primary gate.

-- Per-model monthly token quotas by plan
CREATE TABLE IF NOT EXISTS plan_model_limits (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  monthly_token_limit INTEGER NOT NULL DEFAULT 10000,
  PRIMARY KEY (plan_id, model_id)
);

-- Free: chat models + MatuBot (Meta) have separate pools
INSERT INTO plan_model_limits (plan_id, model_id, monthly_token_limit) VALUES
  ('free', 'matu', 25000),
  ('free', 'vo0', 15000),
  ('free', 'matu-apex', 20000),
  ('free', 'matu-dev-3-5', 20000),
  ('free', 'matu-space-ultra', 15000),
  ('free', 'matu-commerce', 15000),
  ('free', 'matu-marketing', 15000),
  ('free', 'matu-bot-3-5', 40000),
  ('pro', 'matu', 400000),
  ('pro', 'vo0', 200000),
  ('pro', 'vo5', 300000),
  ('pro', 'matu-apex', 350000),
  ('pro', 'matu-dev-3-5', 350000),
  ('pro', 'matu-space-ultra', 300000),
  ('pro', 'matu-commerce', 300000),
  ('pro', 'matu-marketing', 300000),
  ('pro', 'matu-bot-3-5', 500000),
  ('team', 'matu', -1),
  ('team', 'vo0', -1),
  ('team', 'vo5', -1),
  ('team', 'matu-apex', -1),
  ('team', 'matu-dev-3-5', -1),
  ('team', 'matu-space-ultra', -1),
  ('team', 'matu-commerce', -1),
  ('team', 'matu-marketing', -1),
  ('team', 'matu-bot-3-5', -1)
ON CONFLICT (plan_id, model_id) DO UPDATE
  SET monthly_token_limit = EXCLUDED.monthly_token_limit;

-- Usage breakdown by model
CREATE TABLE IF NOT EXISTS usage_by_model (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  period_ym TEXT NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id, model_id, period_ym)
);

CREATE INDEX IF NOT EXISTS usage_by_model_user_period_idx
  ON usage_by_model (user_id, period_ym);

CREATE INDEX IF NOT EXISTS usage_by_model_org_period_idx
  ON usage_by_model (org_id, period_ym);

-- Threshold alerts (30 / 70 / 90 %)
CREATE TABLE IF NOT EXISTS usage_notifications (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_ym TEXT NOT NULL,
  model_id TEXT NOT NULL,
  threshold INTEGER NOT NULL CHECK (threshold IN (30, 70, 90)),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id, period_ym, model_id, threshold)
);

CREATE INDEX IF NOT EXISTS usage_notifications_user_unread_idx
  ON usage_notifications (user_id, read_at, created_at DESC);

-- ------------------------------------------------------------
-- Make YOUR account admin (unlimited). Replace the email.
-- ------------------------------------------------------------
-- UPDATE profiles
-- SET is_admin = TRUE
-- WHERE lower(email) = lower('tu-correo@ejemplo.com');
