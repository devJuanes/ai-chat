import { newId } from '../db.js';
import { findCourseCover } from './build.js';

export const POST_KINDS = ['pregunta', 'proyecto', 'logro', 'debate', 'ayuda'];

const RICH_POST =
  'id, user_id, author_name, title, body, created_at, kind, tags, tech, code, image_url, accepted_comment_id, slug';
const BASE_POST = 'id, user_id, author_name, title, body, created_at';

const TOPICS = [
  ['SQL', /\bsql\b|\bjoin\b|\bselect\b|índice|indice|postgres/i],
  ['Git', /\bgit\b/i],
  ['Docker', /docker|contenedor|volumen/i],
  ['Python', /python|\bcsv\b/i],
  ['Inglés', /ingl[eé]s/i],
  ['Cálculo', /c[aá]lculo|l[ií]mite|derivad/i],
  ['Tutor', /\btutor\b/i],
  ['Quiz', /\bquiz\b/i],
];

export class CommunityError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function schemaMiss(error) {
  return /column|does not exist|schema cache|could not find|relation/i.test(error?.message || '');
}

function one(data) {
  return Array.isArray(data) ? data[0] : data;
}

export function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[,#]/);
  const out = [];
  for (const item of list) {
    const tag = String(item || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!tag || out.some((entry) => entry.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length === 4) break;
  }
  return out;
}

export function cleanTech(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function cleanCode(value) {
  return String(value || '').replace(/\u0000/g, '').slice(0, 4000);
}

export async function avatarMap(db, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))].slice(0, 200);
  if (!unique.length) return {};
  const { data, error } = await db.from('profiles').select('id, avatar_url').in('id', unique).limit(200);
  if (error) return {};
  const map = {};
  for (const row of data || []) {
    const url = String(row.avatar_url || '');
    map[row.id] = /^https:\/\//i.test(url) ? url : '';
  }
  return map;
}

export function slugifyTitle(title) {
  const base = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return base || 'hilo';
}

async function uniqueSlug(db, title, id) {
  const base = slugifyTitle(title);
  let candidate = base;
  for (let n = 0; n < 5; n += 1) {
    const { data, error } = await db.from('edu_posts').select('id').eq('slug', candidate).limit(1);
    if (error) return n === 0 ? base : `${base}-${String(id).slice(0, 6)}`;
    const row = one(data);
    if (!row || row.id === id) return candidate;
    candidate = `${base}-${String(id).replace(/[^a-z0-9]/gi, '').slice(0, 4) || n + 2}`;
  }
  return `${base}-${String(id).slice(0, 6)}`;
}

async function withSlugs(db, rows) {
  const out = [];
  for (const row of rows) {
    if (row.slug) {
      out.push(row);
      continue;
    }
    const slug = await uniqueSlug(db, row.title, row.id);
    const { error } = await db.from('edu_posts').eq('id', row.id).update({ slug });
    out.push({ ...row, slug: error ? '' : slug });
  }
  return out;
}

async function loadPost(db, key) {
  const direct = await selectPosts(db, { id: key, limit: 1 });
  if (direct.rows[0] || !key) return direct;
  const { data, error } = await db.from('edu_posts').select(RICH_POST).eq('slug', key).limit(1);
  if (error) {
    if (schemaMiss(error)) return direct;
    throw new Error(error.message);
  }
  if (!(data || []).length) return direct;
  return { rows: data || [], rich: true };
}

export function readImage(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (!/^https:\/\/\S{4,400}$/i.test(url)) {
    throw new CommunityError('La imagen tiene que ser un enlace https.');
  }
  return url.slice(0, 400);
}

function storedTags(raw) {
  if (Array.isArray(raw)) return cleanTags(raw);
  const text = String(raw || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      return cleanTags(JSON.parse(text));
    } catch {
      return cleanTags(text);
    }
  }
  return cleanTags(text);
}

export function inferTags(post) {
  const text = `${post?.title || ''}\n${post?.body || ''}\n${post?.tech || ''}`;
  const tags = [];
  for (const [label, pattern] of TOPICS) {
    if (pattern.test(text)) tags.push(label);
    if (tags.length === 3) break;
  }
  return tags;
}

export function inferKind(post) {
  const stored = String(post?.kind || '').trim();
  if (POST_KINDS.includes(stored)) return stored;
  const title = String(post?.title || '');
  const text = `${title}\n${post?.body || ''}`;
  if (/[?¿]/.test(title) || /alguien más|c[oó]mo usan|pregunta seria/i.test(text)) return 'pregunta';
  if (/certificado|termin[eé]|logr[eé]|pas[eé] el quiz/i.test(text)) return 'logro';
  if (/cre[eé] un curso|arm[eé] un curso|\bproyecto\b/i.test(text)) return 'proyecto';
  if (/no entiendo|me pill[oó]|fall[eé]|atascad|trabad|ayuda|confund/i.test(text)) return 'ayuda';
  return 'debate';
}

async function withPexelsPhoto(post) {
  if (!post || post.image_url) return post;
  const hint = [post.tech, ...(post.tags || [])].filter(Boolean).join(' ');
  try {
    const image_url = await findCourseCover(post.title || hint, `${hint} ${post.body || ''}`);
    return image_url ? { ...post, image_url } : post;
  } catch {
    return post;
  }
}

async function withPexelsPhotos(posts) {
  return Promise.all((posts || []).map((post) => withPexelsPhoto(post)));
}

export function presentPost(row, extra = {}) {
  const tags = storedTags(row?.tags);
  const image = String(row?.image_url || '');
  return {
    id: row.id,
    user_id: row.user_id || '',
    author_name: row.author_name || 'Estudiante',
    title: row.title,
    body: row.body || '',
    created_at: row.created_at,
    kind: inferKind(row),
    tags: tags.length ? tags : inferTags(row),
    tech: cleanTech(row?.tech),
    code: extra.withCode ? cleanCode(row?.code) : '',
    has_code: Boolean(String(row?.code || '').trim()),
    slug: String(row?.slug || ''),
    image_url: /^https:\/\//i.test(image) ? image : '',
    comments: extra.comments || 0,
    likes: extra.likes || 0,
    liked: Boolean(extra.liked),
    saved: Boolean(extra.saved),
    resolved: Boolean(row?.accepted_comment_id),
    accepted_comment_id: row?.accepted_comment_id || '',
    mine: Boolean(extra.userId) && row.user_id === extra.userId,
  };
}

async function selectPosts(db, { id, limit = 40 } = {}) {
  let query = db.from('edu_posts').select(RICH_POST);
  if (id) query = query.eq('id', id).limit(1);
  else query = query.order('created_at', { ascending: false }).limit(limit);
  let rich = true;
  let { data, error } = await query;
  if (error) {
    rich = false;
    let again = db.from('edu_posts').select(BASE_POST);
    if (id) again = again.eq('id', id).limit(1);
    else again = again.order('created_at', { ascending: false }).limit(limit);
    ({ data, error } = await again);
  }
  if (error) throw new Error(error.message);
  return { rows: data || [], rich };
}

async function loadSignals(db, postIds, userId) {
  const empty = {
    comments: {},
    likes: {},
    liked: {},
    saved: {},
    reactions: false,
    saves: false,
  };
  if (!postIds.length) return { ...empty, reactions: true, saves: true };
  const comments = await db.from('edu_comments').select('post_id').in('post_id', postIds);
  if (comments.error) throw new Error(comments.error.message);
  for (const row of comments.data || []) {
    empty.comments[row.post_id] = (empty.comments[row.post_id] || 0) + 1;
  }

  const reactions = await db
    .from('edu_post_reactions')
    .select('post_id, user_id')
    .in('post_id', postIds);
  if (!reactions.error) {
    empty.reactions = true;
    for (const row of reactions.data || []) {
      empty.likes[row.post_id] = (empty.likes[row.post_id] || 0) + 1;
      if (userId && row.user_id === userId) empty.liked[row.post_id] = true;
    }
  } else if (!schemaMiss(reactions.error)) {
    console.error('[edu] reactions', reactions.error.message);
  }

  const saves = await db.from('edu_post_saves').select('post_id, user_id').in('post_id', postIds);
  if (!saves.error) {
    empty.saves = true;
    for (const row of saves.data || []) {
      if (userId && row.user_id === userId) empty.saved[row.post_id] = true;
    }
  } else if (!schemaMiss(saves.error)) {
    console.error('[edu] saves', saves.error.message);
  }

  return empty;
}

export async function listForum(db, userId) {
  const loaded = await selectPosts(db);
  const rows = loaded.rich ? await withSlugs(db, loaded.rows) : loaded.rows;
  const rich = loaded.rich;
  const ids = rows.map((row) => row.id);
  const signals = await loadSignals(db, ids, userId);
  const faces = await avatarMap(db, rows.map((row) => row.user_id));
  const posts = rows.map((row) => ({
    ...presentPost(row, {
      userId,
      comments: signals.comments[row.id] || 0,
      likes: signals.likes[row.id] || 0,
      liked: signals.liked[row.id],
      saved: signals.saved[row.id],
    }),
    avatar_url: faces[row.user_id] || '',
  }));

  let replies = [];
  let recent = await db
    .from('edu_comments')
    .select('id, post_id, user_id, author_name, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  if (recent.error && /user_id|column/i.test(recent.error.message || '')) {
    recent = await db
      .from('edu_comments')
      .select('id, post_id, author_name, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
  }
  if (!recent.error) {
    const byId = Object.fromEntries(posts.map((post) => [post.id, post]));
    const missing = [...new Set((recent.data || []).map((row) => row.post_id).filter((id) => !byId[id]))];
    if (missing.length) {
      const older = await db
        .from('edu_posts')
        .select('id, title, kind, body')
        .in('id', missing);
      for (const row of older.data || []) byId[row.id] = presentPost(row);
    }
    replies = (recent.data || [])
      .map((row) => {
        const post = byId[row.post_id];
        if (!post) return null;
        return {
          id: row.id,
          post_id: row.post_id,
          post_slug: post.slug || '',
          user_id: row.user_id || '',
          author_name: row.author_name || 'Estudiante',
          created_at: row.created_at,
          post_title: post.title,
          kind: post.kind,
        };
      })
      .filter(Boolean);
    const replyFaces = await avatarMap(db, replies.map((row) => row.user_id));
    replies = replies.map((row) => ({ ...row, avatar_url: replyFaces[row.user_id] || '' }));
  }

  return {
    posts: await withPexelsPhotos(posts),
    replies,
    meta: { fields: rich, reactions: signals.reactions, saves: signals.saves },
  };
}

export async function createForumPost(db, { userId, authorName, payload }) {
  const title = String(payload?.title || '').trim().slice(0, 140);
  const body = String(payload?.body || '').trim().slice(0, 4000);
  if (title.length < 4) throw new CommunityError('El título necesita al menos 4 letras.');
  if (body.length < 4) throw new CommunityError('Escribe el mensaje de la publicación.');
  const kind = POST_KINDS.includes(payload?.kind) ? payload.kind : 'debate';
  const tags = cleanTags(payload?.tags);
  const tech = cleanTech(payload?.tech);
  const code = cleanCode(payload?.code);
  const image_url = readImage(payload?.image_url);
  const id = newId();
  const slug = await uniqueSlug(db, title, id);
  const row = {
    id,
    user_id: userId,
    author_name: authorName || 'Estudiante',
    title,
    body,
    slug,
    created_at: new Date().toISOString(),
    kind,
    tags: JSON.stringify(tags),
    tech,
    code,
    image_url,
    accepted_comment_id: '',
  };
  let { error } = await db.from('edu_posts').insert(row);
  if (error && schemaMiss(error)) {
    const slim = {
      id: row.id,
      user_id: row.user_id,
      author_name: row.author_name,
      title: row.title,
      body: row.body,
      created_at: row.created_at,
    };
    ({ error } = await db.from('edu_posts').insert(slim));
    if (error) throw new Error(error.message);
    const faces = await avatarMap(db, [userId]);
    return withPexelsPhoto({
      ...presentPost({ ...slim, slug, kind, tags, tech, code, image_url }, { userId, withCode: true }),
      avatar_url: faces[userId] || '',
    });
  }
  if (error) throw new Error(error.message);
  const faces = await avatarMap(db, [row.user_id]);
  return withPexelsPhoto({
    ...presentPost(row, { userId, withCode: true }),
    avatar_url: faces[row.user_id] || '',
  });
}

export async function readForumPost(db, id, userId) {
  const { rows } = await loadPost(db, id);
  const row = one(rows);
  if (!row) throw new CommunityError('Esa publicación no está.', 404);
  const signals = await loadSignals(db, [row.id], userId);
  const comments = await db
    .from('edu_comments')
    .select('id, user_id, author_name, body, created_at, image_url')
    .eq('post_id', row.id)
    .order('created_at', { ascending: true })
    .limit(200);
  if (comments.error && /user_id|column/i.test(comments.error.message || '')) {
    const again = await db
      .from('edu_comments')
      .select('id, author_name, body, created_at')
      .eq('post_id', row.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (again.error) throw new Error(again.error.message);
    comments.data = again.data;
    comments.error = null;
  }
  if (comments.error) throw new Error(comments.error.message);
  const faces = await avatarMap(db, [row.user_id, ...(comments.data || []).map((item) => item.user_id)]);
  const post = await withPexelsPhoto({
    ...presentPost(row, {
      userId,
      withCode: true,
      comments: signals.comments[row.id] || (comments.data || []).length,
      likes: signals.likes[row.id] || 0,
      liked: signals.liked[row.id],
      saved: signals.saved[row.id],
    }),
    avatar_url: faces[row.user_id] || '',
  });
  return {
    post,
    comments: (comments.data || []).map((item) => ({
      id: item.id,
      user_id: item.user_id || '',
      avatar_url: faces[item.user_id] || '',
      author_name: item.author_name || 'Estudiante',
      body: item.body,
      image_url: /^https:\/\//i.test(item.image_url || '') ? item.image_url : '',
      created_at: item.created_at,
      accepted: Boolean(post.accepted_comment_id) && item.id === post.accepted_comment_id,
      mine: Boolean(userId) && item.user_id === userId,
    })),
    meta: { reactions: signals.reactions, saves: signals.saves },
  };
}

export async function addForumComment(db, { postId, userId, authorName, body, imageUrl }) {
  const text = String(body || '').trim().slice(0, 2000);
  const image_url = readImage(imageUrl);
  if (text.length < 2 && !image_url) throw new CommunityError('Escribe una respuesta.');
  const { rows } = await loadPost(db, postId);
  const post = one(rows);
  if (!post) throw new CommunityError('Esa publicación no está.', 404);
  const row = {
    id: newId(),
    post_id: post.id,
    user_id: userId,
    author_name: authorName || 'Estudiante',
    body: text,
    image_url,
    created_at: new Date().toISOString(),
  };
  let { error } = await db.from('edu_comments').insert(row);
  if (error && schemaMiss(error)) {
    const slim = {
      id: row.id,
      post_id: row.post_id,
      author_name: row.author_name,
      body: row.body,
      created_at: row.created_at,
    };
    ({ error } = await db.from('edu_comments').insert(slim));
  }
  if (error) throw new Error(error.message);
  const faces = await avatarMap(db, [userId]);
  return {
    id: row.id,
    user_id: userId,
    avatar_url: faces[userId] || '',
    author_name: row.author_name,
    body: row.body,
    image_url,
    created_at: row.created_at,
    accepted: false,
    mine: true,
  };
}

async function toggleRow(db, table, { postId, userId, missingMessage }) {
  const found = await db.from(table).select('id, user_id').eq('post_id', postId).limit(400);
  if (found.error && schemaMiss(found.error)) {
    throw new CommunityError(missingMessage, 501);
  }
  if (found.error) throw new Error(found.error.message);
  const rows = found.data || [];
  const mine = rows.find((row) => row.user_id === userId);
  if (mine) {
    const { error } = await db.from(table).eq('id', mine.id).delete();
    if (error) throw new Error(error.message);
    return { on: false, count: Math.max(0, rows.length - 1) };
  }
  const { error } = await db.from(table).insert({
    id: newId(),
    post_id: postId,
    user_id: userId,
    created_at: new Date().toISOString(),
  });
  if (error && schemaMiss(error)) throw new CommunityError(missingMessage, 501);
  if (error) throw new Error(error.message);
  return { on: true, count: rows.length + 1 };
}

export async function toggleForumLike(db, { postId, userId }) {
  const { rows } = await loadPost(db, postId);
  const post = one(rows);
  if (!post) throw new CommunityError('Esa publicación no está.', 404);
  const result = await toggleRow(db, 'edu_post_reactions', {
    postId: post.id,
    userId,
    missingMessage: 'Todavía no se pueden guardar reacciones.',
  });
  return { liked: result.on, likes: result.count };
}

export async function toggleForumSave(db, { postId, userId }) {
  const { rows } = await loadPost(db, postId);
  const post = one(rows);
  if (!post) throw new CommunityError('Esa publicación no está.', 404);
  const result = await toggleRow(db, 'edu_post_saves', {
    postId: post.id,
    userId,
    missingMessage: 'Todavía no se pueden guardar publicaciones.',
  });
  return { saved: result.on };
}

export async function acceptForumAnswer(db, { postId, userId, commentId }) {
  const { rows, rich } = await loadPost(db, postId);
  const post = one(rows);
  if (!post) throw new CommunityError('Esa publicación no está.', 404);
  if (post.user_id !== userId) {
    throw new CommunityError('Solo quien publicó puede aceptar una respuesta.');
  }
  const kind = inferKind(post);
  if (kind !== 'pregunta' && kind !== 'ayuda') {
    throw new CommunityError('Solo una pregunta puede marcarse como resuelta.');
  }
  if (!rich) throw new CommunityError('Todavía no se puede marcar una respuesta aceptada.', 501);
  const comments = await db
    .from('edu_comments')
    .select('id')
    .eq('post_id', post.id)
    .limit(200);
  if (comments.error) throw new Error(comments.error.message);
  const match = (comments.data || []).find((row) => row.id === commentId);
  if (!match) throw new CommunityError('Esa respuesta no está en la publicación.', 404);
  const { error } = await db
    .from('edu_posts')
    .eq('id', post.id)
    .update({ accepted_comment_id: commentId });
  if (error && schemaMiss(error)) {
    throw new CommunityError('Todavía no se puede marcar una respuesta aceptada.', 501);
  }
  if (error) throw new Error(error.message);
  return withPexelsPhoto(presentPost(
    { ...post, accepted_comment_id: commentId, kind },
    { userId, withCode: true }
  ));
}
