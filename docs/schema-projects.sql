-- Migration: projects, pin, share, usage exposure
-- Run in MatuDB SQL console after docs/schema.sql

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'briefcase',
  color TEXT NOT NULL DEFAULT 'ink',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_user_updated_idx
  ON projects (user_id, updated_at DESC);

-- Si la tabla ya existía sin icon/color:
ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'briefcase';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'ink';

-- Extend conversations (ignore errors if columns already exist)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

UPDATE plans SET models_allowed = 'matu,vo0,vo5,matu-apex,matu-dev-3-5' WHERE id IN ('pro', 'team');
UPDATE plans SET models_allowed = 'matu,vo0,matu-apex,matu-dev-3-5' WHERE id = 'free';
