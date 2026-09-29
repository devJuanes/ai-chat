-- Verificación de correo (registro y cuentas ya existentes).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS email_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_enc TEXT NOT NULL DEFAULT '',
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_otps_email_idx
  ON email_otps (email, purpose, created_at DESC);
