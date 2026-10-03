-- Comunidad de EduCreator: tipo de publicación, reacciones y guardados.
-- Si edu_posts ya existe, este archivo alcanza.
-- Si todavía no corriste edu-creator.sql, ejecuta ese primero.

ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS tech TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS accepted_comment_id TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS edu_post_reactions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_post_reactions_user_idx
  ON edu_post_reactions (post_id, user_id);

CREATE TABLE IF NOT EXISTS edu_post_saves (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_post_saves_user_idx
  ON edu_post_saves (post_id, user_id);
