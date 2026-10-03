-- EduCreator: cursos generados, lecciones, progreso y certificados.
-- Ejecutar en el schema del proyecto MatuDB de Matu AI.

CREATE TABLE IF NOT EXISTS edu_courses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'inicial',
  status TEXT NOT NULL DEFAULT 'building',
  phase TEXT NOT NULL DEFAULT 'inicio',
  activity TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  sources_json TEXT NOT NULL DEFAULT '[]',
  log_json TEXT NOT NULL DEFAULT '[]',
  is_public INT NOT NULL DEFAULT 0,
  author_name TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS edu_courses_user_idx
  ON edu_courses (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS edu_modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  position INT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  plan_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS edu_modules_course_idx
  ON edu_modules (course_id, position);

CREATE TABLE IF NOT EXISTS edu_lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  position INT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'lesson',
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  resources_json TEXT NOT NULL DEFAULT '[]',
  video_json TEXT NOT NULL DEFAULT '{}',
  quiz_json TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS edu_lessons_course_idx
  ON edu_lessons (course_id, position);

CREATE INDEX IF NOT EXISTS edu_lessons_module_idx
  ON edu_lessons (module_id, position);

CREATE TABLE IF NOT EXISTS edu_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed INT NOT NULL DEFAULT 0,
  quiz_score INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_progress_user_lesson_idx
  ON edu_progress (user_id, lesson_id);

CREATE TABLE IF NOT EXISTS edu_certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  learner_name TEXT NOT NULL,
  code TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS edu_certificates_user_course_idx
  ON edu_certificates (user_id, course_id);

ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS is_public INT NOT NULL DEFAULT 0;
ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT '';
ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS edu_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS edu_posts_created_idx
  ON edu_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS edu_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS edu_comments_post_idx
  ON edu_comments (post_id, created_at);

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
