-- Mensajes del formulario de contacto (landing, /contacto y EduCreator /edu/acerca).
-- Ejecutar en el proyecto MatuDB de Matu AI.

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'contacto'
    CHECK (source IN ('landing', 'contacto', 'educreator', 'other')),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'replied', 'archived')),
  user_agent TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_idx
  ON contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON contact_messages (status, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_email_idx
  ON contact_messages (email);

-- Si la tabla ya existía, el CHECK viejo rechaza source = 'educreator'.
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_source_check;
ALTER TABLE contact_messages
  ADD CONSTRAINT contact_messages_source_check
  CHECK (source IN ('landing', 'contacto', 'educreator', 'other'));
