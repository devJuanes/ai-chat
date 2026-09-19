-- ============================================================
-- Matu AI SaaS — Chat schema (MatuDB / PostgreSQL)
-- Multi-tenant SaaS: orgs → members → conversations → messages
-- Run once in your MatuDB project SQL console.
-- ============================================================

-- Plans (seeded)
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_message_limit INTEGER NOT NULL DEFAULT 50,
  monthly_token_limit INTEGER NOT NULL DEFAULT 100000,
  max_conversations INTEGER NOT NULL DEFAULT 30,
  models_allowed TEXT NOT NULL DEFAULT 'matu,vo0',
  price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (id, name, monthly_message_limit, monthly_token_limit, max_conversations, models_allowed, price_usd)
VALUES
  ('free', 'Free', 40, 80000, 20, 'matu,vo0,matu-apex,matu-dev-3-5', 0),
  ('pro', 'Pro', 500, 1500000, 200, 'matu,vo0,vo5,matu-apex,matu-dev-3-5', 29),
  ('team', 'Team', 5000, 10000000, 2000, 'matu,vo0,vo5,matu-apex,matu-dev-3-5', 99)
ON CONFLICT (id) DO NOTHING;

-- Organizations (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organizations_plan_idx ON organizations (plan_id);

-- User profiles (id = MatuDB auth user id)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  default_org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);

-- Org membership
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_idx ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS org_members_org_idx ON organization_members (org_id);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nuevo chat',
  model_id TEXT NOT NULL DEFAULT 'matu',
  preview TEXT NOT NULL DEFAULT '',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS conversations_org_updated_idx
  ON conversations (org_id, updated_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  model_id TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at);

-- Feedback (like / dislike)
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_feedback_message_idx ON message_feedback (message_id);

-- Usage counters (per user / org / month)
CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_ym TEXT NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  UNIQUE (org_id, user_id, period_ym)
);

CREATE INDEX IF NOT EXISTS usage_counters_period_idx
  ON usage_counters (org_id, period_ym);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_user_updated_idx
  ON projects (user_id, updated_at DESC);
