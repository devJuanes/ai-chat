-- Constancia de un curso y aviso único 15 minutos antes de la clase.
-- Ejecutar en el proyecto MatuDB de Matu AI.

ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS session_time TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS session_weekday INT NOT NULL DEFAULT 1;
ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS session_minutes INT NOT NULL DEFAULT 45;

CREATE TABLE IF NOT EXISTS edu_session_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  session_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_session_reminders_idx
  ON edu_session_reminders (user_id, course_id, session_at);
