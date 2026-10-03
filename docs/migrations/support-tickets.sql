-- Tickets y novedades del centro de ayuda (app /soporte)
-- Run on MatuDB project for Matu AI

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'ticket'
    CHECK (kind IN ('ticket', 'incident')),
  category TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON support_tickets (user_id, created_at DESC);

-- Permite PQR además de ticket e incidente.
-- Ejecutar en MatuDB si la tabla ya existía con el CHECK anterior.
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_kind_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_kind_check
  CHECK (kind IN ('ticket', 'incident', 'pqr'));

-- Estados del centro de ayuda: abierto, visto, en revisión, cerrado.
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'seen', 'review', 'closed'));
