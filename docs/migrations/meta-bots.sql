-- Meta bots: WhatsApp, Messenger, Instagram
-- Run in MatuDB SQL console after docs/schema.sql

-- Conversations: channel metadata
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS external_thread_id TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS bot_id UUID;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assignee TEXT NOT NULL DEFAULT 'bot';

-- Soft check via app; allow existing rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_source_check'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_source_check
      CHECK (source IN ('app', 'whatsapp', 'messenger', 'instagram'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_assignee_check'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_assignee_check
      CHECK (assignee IN ('bot', 'human'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversations_source_updated_idx
  ON conversations (org_id, source, updated_at DESC);

CREATE INDEX IF NOT EXISTS conversations_bot_idx
  ON conversations (bot_id)
  WHERE bot_id IS NOT NULL;

-- Idempotency for Meta inbound message ids
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uidx
  ON messages (external_id)
  WHERE external_id IS NOT NULL;

-- Connected Meta assets per org
CREATE TABLE IF NOT EXISTS meta_connections (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'messenger', 'instagram')),
  display_name TEXT NOT NULL DEFAULT '',
  page_id TEXT,
  ig_user_id TEXT,
  waba_id TEXT,
  phone_number_id TEXT,
  access_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'error')),
  meta_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_connections_org_idx
  ON meta_connections (org_id, channel);

CREATE UNIQUE INDEX IF NOT EXISTS meta_connections_page_uidx
  ON meta_connections (page_id)
  WHERE page_id IS NOT NULL AND channel = 'messenger';

CREATE UNIQUE INDEX IF NOT EXISTS meta_connections_ig_uidx
  ON meta_connections (ig_user_id)
  WHERE ig_user_id IS NOT NULL AND channel = 'instagram';

CREATE UNIQUE INDEX IF NOT EXISTS meta_connections_phone_uidx
  ON meta_connections (phone_number_id)
  WHERE phone_number_id IS NOT NULL AND channel = 'whatsapp';

-- Sales / support agents
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  business_context TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'profesional y cercano',
  model_id TEXT NOT NULL DEFAULT 'matu-commerce',
  language TEXT NOT NULL DEFAULT 'es',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  handoff_keywords TEXT NOT NULL DEFAULT 'humano,asesor,agente humano,hablar con alguien',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bots_org_idx ON bots (org_id, updated_at DESC);

-- One active bot per Meta connection
CREATE TABLE IF NOT EXISTS bot_channel_bindings (
  id UUID PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  meta_connection_id UUID NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meta_connection_id)
);

CREATE INDEX IF NOT EXISTS bot_bindings_bot_idx ON bot_channel_bindings (bot_id);
CREATE INDEX IF NOT EXISTS bot_bindings_org_idx ON bot_channel_bindings (org_id);

-- External user thread → conversation
CREATE TABLE IF NOT EXISTS channel_threads (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meta_connection_id UUID NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'messenger', 'instagram')),
  contact_name TEXT NOT NULL DEFAULT '',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meta_connection_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS channel_threads_org_idx
  ON channel_threads (org_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS channel_threads_conversation_idx
  ON channel_threads (conversation_id);

-- FK from conversations.bot_id (after bots exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_bot_id_fkey'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_bot_id_fkey
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL;
  END IF;
END $$;
