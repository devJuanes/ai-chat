-- Meta bots v3: products catalog, client notes, pipeline
-- Run after docs/migrations/meta-bots-v2-leads.sql

-- Company knowledge on bots
ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS company_website TEXT NOT NULL DEFAULT '';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS company_knowledge TEXT NOT NULL DEFAULT '';

-- Pipeline stage on conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'nuevo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_pipeline_stage_check'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_pipeline_stage_check
      CHECK (pipeline_stage IN (
        'nuevo',
        'interesado',
        'en_duda',
        'cita',
        'cerrar',
        'ganado',
        'perdido'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversations_pipeline_idx
  ON conversations (org_id, pipeline_stage, updated_at DESC);

-- Product / service catalog
CREATE TABLE IF NOT EXISTS catalog_products (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'COP',
  product_type TEXT NOT NULL DEFAULT 'service'
    CHECK (product_type IN ('physical', 'digital', 'service')),
  stock INTEGER,
  image_url TEXT NOT NULL DEFAULT '',
  purchase_link TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_products_org_idx
  ON catalog_products (org_id, active, sort_order, updated_at DESC);

-- Which products a bot may sell
CREATE TABLE IF NOT EXISTS bot_product_bindings (
  id UUID PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, product_id)
);

CREATE INDEX IF NOT EXISTS bot_product_bindings_bot_idx
  ON bot_product_bindings (bot_id);

-- Curated client notes / events (not raw logs)
CREATE TABLE IF NOT EXISTS conversation_notes (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT ''
    CHECK (channel IN ('', 'whatsapp', 'messenger', 'instagram')),
  contact_name TEXT NOT NULL DEFAULT '',
  contact_external_id TEXT NOT NULL DEFAULT '',
  note_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (note_type IN (
      'sentiment',
      'meeting',
      'objection',
      'win',
      'lost',
      'handoff',
      'interest',
      'custom'
    )),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sentiment TEXT NOT NULL DEFAULT 'neutral'
    CHECK (sentiment IN ('positive', 'neutral', 'negative', 'critical')),
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'human')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversation_notes_org_created_idx
  ON conversation_notes (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_notes_org_type_idx
  ON conversation_notes (org_id, note_type, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_notes_conversation_idx
  ON conversation_notes (conversation_id)
  WHERE conversation_id IS NOT NULL;
