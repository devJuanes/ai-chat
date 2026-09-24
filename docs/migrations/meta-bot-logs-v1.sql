-- Meta bot operational logs (errors + skips that explain missing auto-replies)
-- Run in MatuDB after meta-bots.sql

CREATE TABLE IF NOT EXISTS meta_bot_logs (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  bot_id UUID,
  conversation_id UUID,
  channel TEXT,
  external_user_id TEXT,
  external_message_id TEXT,
  -- pipeline stage where the event happened
  stage TEXT NOT NULL DEFAULT 'unknown',
  -- error | warn | info
  severity TEXT NOT NULL DEFAULT 'error'
    CHECK (severity IN ('error', 'warn', 'info')),
  -- stable machine code: no_connection, no_bot, upstream_error, send_failed, usage_quota, ...
  code TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_bot_logs_created_idx
  ON meta_bot_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS meta_bot_logs_org_created_idx
  ON meta_bot_logs (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS meta_bot_logs_severity_created_idx
  ON meta_bot_logs (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS meta_bot_logs_code_created_idx
  ON meta_bot_logs (code, created_at DESC);

CREATE INDEX IF NOT EXISTS meta_bot_logs_channel_created_idx
  ON meta_bot_logs (channel, created_at DESC);

-- Useful daily review:
-- SELECT created_at, channel, severity, code, message, external_user_id
-- FROM meta_bot_logs
-- WHERE created_at > NOW() - INTERVAL '1 day'
-- ORDER BY created_at DESC
-- LIMIT 200;
