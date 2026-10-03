import { getDb } from '../db.js';

const STATEMENTS = [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_slug TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_views INT NOT NULL DEFAULT 0`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS tech TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS code TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_posts ADD COLUMN IF NOT EXISTS accepted_comment_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_comments ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE edu_courses ADD COLUMN IF NOT EXISTS price_coins INT NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS edu_post_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_post_reactions_user_idx ON edu_post_reactions (post_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_post_saves (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_post_saves_user_idx ON edu_post_saves (post_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_enrollments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_enrollments_user_idx ON edu_enrollments (user_id, course_id)`,
  `CREATE TABLE IF NOT EXISTS edu_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    tech TEXT NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_challenge_members (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_challenge_members_idx ON edu_challenge_members (challenge_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    tech TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_project_members_idx ON edu_project_members (project_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    invite_code TEXT NOT NULL,
    starts_at TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_groups_invite_idx ON edu_groups (invite_code)`,
  `CREATE TABLE IF NOT EXISTS edu_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_group_members_idx ON edu_group_members (group_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_group_courses (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_group_courses_idx ON edu_group_courses (group_id, course_id)`,
  `CREATE TABLE IF NOT EXISTS edu_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    price_coins INT NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_event_rsvps (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    ticket_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_event_rsvps_idx ON edu_event_rsvps (event_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_event_certs (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    learner_name TEXT NOT NULL,
    code TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS edu_event_certs_idx ON edu_event_certs (event_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS edu_wallets (
    user_id TEXT PRIMARY KEY,
    balance INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_coin_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INT NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_coin_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coins INT NOT NULL,
    amount_cents INT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'info',
    read_at TEXT NOT NULL DEFAULT '',
    email_at TEXT NOT NULL DEFAULT '',
    fire_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS edu_streaks (
    user_id TEXT PRIMARY KEY,
    current INT NOT NULL DEFAULT 0,
    best INT NOT NULL DEFAULT 0,
    last_day TEXT NOT NULL DEFAULT '',
    show_progress INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

let pending = null;

export function ensureEduSchema() {
  if (!pending) {
    pending = (async () => {
      const db = getDb();
      for (const sql of STATEMENTS) {
        const { error } = await db.rpc(sql);
        if (error) console.warn('[edu] schema', error.message || error);
      }
    })().catch((err) => {
      pending = null;
      console.warn('[edu] schema', err?.message || err);
    });
  }
  return pending;
}
