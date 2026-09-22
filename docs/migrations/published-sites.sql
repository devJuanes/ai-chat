-- Sites publicados desde el preview HTML de MatuAI
-- Ejecutar en el proyecto MatuDB de MatuAI (ai-chat)

CREATE TABLE IF NOT EXISTS published_sites (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS published_sites_slug_idx ON published_sites (slug);
CREATE INDEX IF NOT EXISTS published_sites_user_idx ON published_sites (user_id, updated_at DESC);
