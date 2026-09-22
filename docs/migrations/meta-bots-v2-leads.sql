-- Meta bots v2: company identity + lead forms
-- Run after docs/migrations/meta-bots.sql

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS products_services TEXT NOT NULL DEFAULT '';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS welcome_message TEXT NOT NULL DEFAULT '';

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS form_id UUID;

ALTER TABLE channel_threads
  ADD COLUMN IF NOT EXISTS contact_username TEXT NOT NULL DEFAULT '';

ALTER TABLE channel_threads
  ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';

-- Lead capture forms
CREATE TABLE IF NOT EXISTS lead_forms (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_forms_org_idx
  ON lead_forms (org_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS lead_form_fields (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'email', 'phone', 'number', 'select', 'textarea')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  options TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, field_key)
);

CREATE INDEX IF NOT EXISTS lead_form_fields_form_idx
  ON lead_form_fields (form_id, sort_order);

CREATE TABLE IF NOT EXISTS lead_submissions (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES channel_threads(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_external_id TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'partial'
    CHECK (status IN ('partial', 'complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_submissions_org_idx
  ON lead_submissions (org_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS lead_submissions_form_idx
  ON lead_submissions (form_id, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bots_form_id_fkey'
  ) THEN
    ALTER TABLE bots
      ADD CONSTRAINT bots_form_id_fkey
      FOREIGN KEY (form_id) REFERENCES lead_forms(id) ON DELETE SET NULL;
  END IF;
END $$;
