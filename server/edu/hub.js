import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import { sendAppMail } from '../email-verify.js';
import { CommunityError, avatarMap, slugifyTitle } from './community.js';

export const REWARDS = {
  post: 15,
  reply: 8,
  challenge_create: 20,
  challenge_join: 10,
  challenge_done: 40,
  project_create: 20,
  project_join: 10,
  group_create: 15,
  group_join: 10,
  lesson: 5,
  module: 25,
  course: 100,
};

export const COIN_RATE = { per: 1000, cop: 5000, usd: 2, min: 100, max: 100000 };

export function quoteCoins(raw) {
  const coins = Math.round(Number(raw));
  if (!Number.isInteger(coins) || coins < COIN_RATE.min || coins > COIN_RATE.max) return null;
  const cop = Math.round((coins * COIN_RATE.cop) / COIN_RATE.per);
  const usdCents = Math.round((coins * COIN_RATE.usd * 100) / COIN_RATE.per);
  if (cop < 1 || usdCents < 1) return null;
  return { coins, cop, usdCents, usd: usdCents / 100 };
}

const LIMITS = { groupsCreated: 8, groupsJoined: 20, members: 40 };

function list(data) {
  return Array.isArray(data) ? data : data ? [data] : [];
}

async function stampAvatars(db, rows) {
  const faces = await avatarMap(db, rows.map((row) => row.user_id));
  return rows.map((row) => ({ ...row, avatar_url: faces[row.user_id] || '' }));
}

function text(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function personName(profile, user) {
  const display = String(profile?.display_name || user?.name || '').trim();
  if (display && !display.includes('@')) return display.slice(0, 80);
  const email = String(profile?.email || user?.email || '');
  return email.split('@')[0] || 'Estudiante';
}

function isAdmin(profile) {
  return profile?.is_admin === true || profile?.is_admin === 'true' || profile?.is_admin === 1;
}

function duplicate(error) {
  return /duplicate|unique|already/i.test(error?.message || '');
}

export function bogotaDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(date);
}

function shiftDay(day, delta) {
  const [year, month, date] = String(day).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, date));
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

export function parseWhen(value, label) {
  const raw = String(value || '').trim();
  if (!raw) throw new CommunityError(`Falta ${label}.`);
  const zoned = /Z$|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw.length === 16 ? `${raw}:00` : raw}-05:00`;
  const date = new Date(zoned);
  if (Number.isNaN(date.getTime())) throw new CommunityError(`${label} no es una fecha válida.`);
  return date.toISOString();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function profileOf(db, userId) {
  const { data, error } = await db
    .from('profiles')
    .select('id, email, display_name, is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function walletOf(db, userId) {
  const { data, error } = await db.from('edu_wallets').select('user_id, balance').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return { balance: Number(data.balance) || 0 };
  const { error: insertError } = await db.from('edu_wallets').insert({
    user_id: userId,
    balance: 0,
    updated_at: new Date().toISOString(),
  });
  if (insertError && !duplicate(insertError)) throw new Error(insertError.message);
  return { balance: 0 };
}

async function putBalance(db, userId, balance) {
  const { error } = await db.from('edu_wallets').eq('user_id', userId).update({
    balance,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function writeLedger(db, { userId, amount, reason, ref }) {
  const { error } = await db.from('edu_coin_ledger').insert({
    id: newId(),
    user_id: userId,
    amount,
    reason,
    ref: ref || '',
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function award(db, { userId, amount, reason, ref }) {
  const coins = Math.round(Number(amount) || 0);
  if (!userId || coins <= 0 || !reason) return walletOf(db, userId);
  const prior = await db
    .from('edu_coin_ledger')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', reason)
    .eq('ref', ref || '')
    .limit(1);
  if (prior.error) throw new Error(prior.error.message);
  if (list(prior.data).length) return walletOf(db, userId);
  const current = await walletOf(db, userId);
  const balance = current.balance + coins;
  await putBalance(db, userId, balance);
  await writeLedger(db, { userId, amount: coins, reason, ref });
  return { balance };
}

export async function spend(db, { userId, amount, reason, ref }) {
  const coins = Math.round(Number(amount) || 0);
  if (coins <= 0) return walletOf(db, userId);
  const current = await walletOf(db, userId);
  if (current.balance < coins) {
    throw new CommunityError(`Necesitas ${coins} Edu Coins y tienes ${current.balance}.`, 402);
  }
  const balance = current.balance - coins;
  await putBalance(db, userId, balance);
  await writeLedger(db, { userId, amount: -coins, reason, ref });
  return { balance };
}

async function deliverMail(db, row) {
  const profile = await profileOf(db, row.user_id);
  const to = String(profile?.email || '').trim();
  if (!to) {
    await db.from('edu_notifications').eq('id', row.id).update({ email_at: 'sin-correo' });
    return;
  }
  const href = row.href ? `${config.publicAppUrl}${row.href}` : config.publicAppUrl;
  try {
    await sendAppMail({
      to,
      subject: row.title,
      text: `${row.body}\n\n${href}`,
      html: `<p>${escapeHtml(row.body)}</p><p><a href="${escapeHtml(href)}">Abrir en EduCreator</a></p>`,
    });
    await db.from('edu_notifications').eq('id', row.id).update({ email_at: new Date().toISOString() });
  } catch (err) {
    console.warn('[edu] correo', err?.message || err);
  }
}

export async function notify(db, { userId, title, body, href, kind, fireAt, email }) {
  const when = fireAt ? new Date(fireAt) : new Date();
  const row = {
    id: newId(),
    user_id: userId,
    title: text(title, 140),
    body: text(body, 500),
    href: String(href || '').slice(0, 240),
    kind: kind || 'info',
    read_at: '',
    email_at: email ? '' : 'off',
    fire_at: when.toISOString(),
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('edu_notifications').insert(row);
  if (error) {
    console.warn('[edu] aviso', error.message);
    return null;
  }
  if (email && when.getTime() <= Date.now()) await deliverMail(db, row);
  return row;
}

async function scheduleReminder(db, { userId, title, body, href, startsAt }) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return;
  const fire = new Date(start.getTime() - 15 * 60 * 1000);
  await notify(db, {
    userId,
    title,
    body,
    href,
    kind: 'reminder',
    fireAt: fire.toISOString(),
    email: true,
  });
}

export async function touchStreak(db, userId) {
  const today = bogotaDay();
  const yesterday = shiftDay(today, -1);
  const { data, error } = await db.from('edu_streaks').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  let current = 1;
  let best = 1;
  if (!data) {
    await db.from('edu_streaks').insert({
      user_id: userId,
      current,
      best,
      last_day: today,
      show_progress: 0,
      updated_at: new Date().toISOString(),
    });
    return { current, best, last_day: today };
  }
  if (data.last_day === today) {
    return { current: Number(data.current) || 0, best: Number(data.best) || 0, last_day: today };
  }
  current = data.last_day === yesterday ? Number(data.current || 0) + 1 : 1;
  best = Math.max(Number(data.best) || 0, current);
  await db.from('edu_streaks').eq('user_id', userId).update({
    current,
    best,
    last_day: today,
    updated_at: new Date().toISOString(),
  });
  return { current, best, last_day: today };
}

export async function onLessonCompleted(db, { userId, courseId, lessonId, moduleId }) {
  try {
    await touchStreak(db, userId);
    await award(db, { userId, amount: REWARDS.lesson, reason: 'lesson', ref: lessonId });
    const [{ data: lessons, error: lessonError }, { data: progress, error: progressError }] = await Promise.all([
      db.from('edu_lessons').select('id, module_id').eq('course_id', courseId).limit(400),
      db.from('edu_progress').select('lesson_id, completed').eq('user_id', userId).eq('course_id', courseId).limit(400),
    ]);
    if (lessonError || progressError) return;
    const done = new Set(
      list(progress)
        .filter((row) => Number(row.completed) === 1)
        .map((row) => row.lesson_id)
    );
    done.add(lessonId);
    const all = list(lessons);
    const moduleLessons = all.filter((row) => row.module_id === moduleId);
    if (moduleId && moduleLessons.length && moduleLessons.every((row) => done.has(row.id))) {
      await award(db, { userId, amount: REWARDS.module, reason: 'module', ref: moduleId });
    }
    if (all.length && all.every((row) => done.has(row.id))) {
      await award(db, { userId, amount: REWARDS.course, reason: 'course', ref: courseId });
      await notify(db, {
        userId,
        title: 'Completaste un curso',
        body: `Sumaste ${REWARDS.course} Edu Coins por terminar el curso.`,
        href: `/edu/cursos/${courseId}`,
        email: true,
      });
    }
  } catch (err) {
    console.warn('[edu] lección', err?.message || err);
  }
}

export async function studyAllowed(db, userId, course) {
  if (!course) return false;
  if (course.user_id === userId) return true;
  const enrolled = await db
    .from('edu_enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', course.id)
    .limit(1);
  if (list(enrolled.data).length) return true;
  const links = await db.from('edu_group_courses').select('group_id').eq('course_id', course.id).limit(20);
  const groupIds = list(links.data).map((row) => row.group_id);
  if (!groupIds.length) return false;
  const members = await db.from('edu_group_members').select('group_id, user_id').eq('user_id', userId).limit(40);
  return list(members.data).some((row) => groupIds.includes(row.group_id));
}

export async function enrollCourse(db, { userId, course, name }) {
  if (!course || Number(course.is_public) !== 1 || course.status !== 'ready') {
    throw new CommunityError('Ese curso no está abierto para inscribirse.');
  }
  if (course.user_id === userId) throw new CommunityError('Este curso ya es tuyo.');
  const existing = await db
    .from('edu_enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', course.id)
    .limit(1);
  if (list(existing.data).length) return { enrolled: true, already: true, balance: (await walletOf(db, userId)).balance };
  const price = Math.max(0, Number(course.price_coins) || 0);
  let balance = (await walletOf(db, userId)).balance;
  if (price) balance = (await spend(db, { userId, amount: price, reason: 'course_fee', ref: course.id })).balance;
  const { error } = await db.from('edu_enrollments').insert({
    id: newId(),
    user_id: userId,
    course_id: course.id,
    created_at: new Date().toISOString(),
  });
  if (error && !duplicate(error)) {
    if (price) await award(db, { userId, amount: price, reason: 'course_refund', ref: course.id });
    throw new Error(error.message);
  }
  await notify(db, {
    userId,
    title: 'Inscripción lista',
    body: `Ya puedes estudiar ${course.title || 'el curso'}.`,
    href: `/edu/cursos/${course.id}`,
    email: true,
  });
  return { enrolled: true, balance, learner: name };
}

export async function listSubscriptions(db, userId) {
  const { data, error } = await db.from('edu_enrollments').select('course_id, created_at').eq('user_id', userId).limit(80);
  if (error) throw new Error(error.message);
  const ids = list(data).map((row) => row.course_id);
  if (!ids.length) return [];
  const courses = await db
    .from('edu_courses')
    .select('id, title, summary, prompt, level, status, cover_url, author_name, price_coins, user_id, created_at')
    .in('id', ids);
  if (courses.error) throw new Error(courses.error.message);
  const rows = list(courses.data).filter((row) => row.user_id !== userId);
  if (!rows.length) return [];
  const courseIds = rows.map((row) => row.id);
  const [lessons, progress] = await Promise.all([
    db.from('edu_lessons').select('id, course_id').in('course_id', courseIds).limit(800),
    db.from('edu_progress').select('course_id, completed').eq('user_id', userId).in('course_id', courseIds).limit(800),
  ]);
  const totals = {};
  const done = {};
  for (const lesson of list(lessons.data)) totals[lesson.course_id] = (totals[lesson.course_id] || 0) + 1;
  for (const row of list(progress.data)) {
    if (Number(row.completed) === 1) done[row.course_id] = (done[row.course_id] || 0) + 1;
  }
  return rows.map((row) => {
    const total = totals[row.id] || 0;
    const finished = done[row.id] || 0;
    return { ...row, pct: total ? Math.round((finished / total) * 100) : 0 };
  });
}

async function loadCourse(db, courseId) {
  const { data, error } = await db.from('edu_courses').select('*').eq('id', courseId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function presentChallenge(row, members, userId) {
  const people = members.filter((item) => item.challenge_id === row.id);
  const mine = people.find((item) => item.user_id === userId);
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    tech: row.tech || '',
    user_id: row.user_id || '',
    author_name: row.author_name || 'Estudiante',
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    image_url: row.image_url || '',
    members: people.length,
    joined: Boolean(mine),
    done: Boolean(mine?.completed_at),
    mine: row.user_id === userId,
  };
}

export async function listChallenges(db, userId) {
  const [{ data, error }, members] = await Promise.all([
    db.from('edu_challenges').select('*').order('starts_at', { ascending: true }).limit(80),
    db.from('edu_challenge_members').select('challenge_id, user_id, completed_at').limit(500),
  ]);
  if (error) throw new Error(error.message);
  if (members.error) throw new Error(members.error.message);
  const rows = list(members.data);
  return stampAvatars(db, list(data).map((row) => presentChallenge(row, rows, userId)));
}

export async function createChallenge(db, { userId, name, payload }) {
  const title = text(payload?.title, 140);
  const body = text(payload?.body, 4000);
  if (title.length < 4) throw new CommunityError('El reto necesita un título.');
  if (body.length < 4) throw new CommunityError('Cuenta en qué consiste el reto.');
  const starts_at = parseWhen(payload?.starts_at, 'el inicio');
  const ends_at = parseWhen(payload?.ends_at, 'el cierre');
  if (new Date(ends_at) <= new Date(starts_at)) throw new CommunityError('El cierre tiene que ser después del inicio.');
  const row = {
    id: newId(),
    user_id: userId,
    author_name: name,
    title,
    body,
    tech: text(payload?.tech, 40),
    starts_at,
    ends_at,
    image_url: String(payload?.image_url || '').slice(0, 400),
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('edu_challenges').insert(row);
  if (error) throw new Error(error.message);
  await db.from('edu_challenge_members').insert({
    id: newId(),
    challenge_id: row.id,
    user_id: userId,
    joined_at: row.created_at,
    completed_at: '',
  });
  await award(db, { userId, amount: REWARDS.challenge_create, reason: 'challenge_create', ref: row.id });
  await scheduleReminder(db, {
    userId,
    title: 'Tu reto empieza en 15 minutos',
    body: row.title,
    href: '/edu/comunidad/retos',
    startsAt: starts_at,
  });
  return presentChallenge(row, [{ challenge_id: row.id, user_id: userId, completed_at: '' }], userId);
}

async function challengeOrThrow(db, id) {
  const { data, error } = await db.from('edu_challenges').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new CommunityError('Ese reto no está.', 404);
  return data;
}

export async function joinChallenge(db, { userId, challengeId }) {
  const challenge = await challengeOrThrow(db, challengeId);
  const existing = await db
    .from('edu_challenge_members')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .limit(1);
  if (list(existing.data).length) return { joined: true, already: true };
  const { error } = await db.from('edu_challenge_members').insert({
    id: newId(),
    challenge_id: challengeId,
    user_id: userId,
    joined_at: new Date().toISOString(),
    completed_at: '',
  });
  if (error && !duplicate(error)) throw new Error(error.message);
  await award(db, { userId, amount: REWARDS.challenge_join, reason: 'challenge_join', ref: challengeId });
  await notify(db, {
    userId,
    title: 'Quedaste en el reto',
    body: challenge.title,
    href: '/edu/comunidad/retos',
    email: true,
  });
  await scheduleReminder(db, {
    userId,
    title: 'El reto empieza en 15 minutos',
    body: challenge.title,
    href: '/edu/comunidad/retos',
    startsAt: challenge.starts_at,
  });
  return { joined: true };
}

export async function completeChallenge(db, { userId, challengeId }) {
  const challenge = await challengeOrThrow(db, challengeId);
  const found = await db
    .from('edu_challenge_members')
    .select('id, completed_at')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .limit(1);
  const row = list(found.data)[0];
  if (!row) throw new CommunityError('Primero únete al reto.');
  if (!row.completed_at) {
    await db.from('edu_challenge_members').eq('id', row.id).update({ completed_at: new Date().toISOString() });
    await award(db, { userId, amount: REWARDS.challenge_done, reason: 'challenge_done', ref: challengeId });
  }
  return { done: true, title: challenge.title };
}

function presentProject(row, members, userId) {
  const people = members.filter((item) => item.project_id === row.id);
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    tech: row.tech || '',
    link: row.link || '',
    image_url: row.image_url || '',
    user_id: row.user_id || '',
    author_name: row.author_name || 'Estudiante',
    created_at: row.created_at,
    members: people.length,
    joined: people.some((item) => item.user_id === userId),
    mine: row.user_id === userId,
  };
}

export async function listProjects(db, userId) {
  const [{ data, error }, members] = await Promise.all([
    db.from('edu_projects').select('*').order('created_at', { ascending: false }).limit(80),
    db.from('edu_project_members').select('project_id, user_id').limit(500),
  ]);
  if (error) throw new Error(error.message);
  if (members.error) throw new Error(members.error.message);
  const rows = list(members.data);
  return stampAvatars(db, list(data).map((row) => presentProject(row, rows, userId)));
}

export async function createProject(db, { userId, name, payload }) {
  const title = text(payload?.title, 140);
  const body = text(payload?.body, 4000);
  if (title.length < 4 || body.length < 4) throw new CommunityError('El proyecto necesita título y descripción.');
  const link = String(payload?.link || '').trim().slice(0, 240);
  if (link && !/^https:\/\//i.test(link)) throw new CommunityError('El enlace del proyecto tiene que ser https.');
  const row = {
    id: newId(),
    user_id: userId,
    author_name: name,
    title,
    body,
    tech: text(payload?.tech, 40),
    link,
    image_url: String(payload?.image_url || '').slice(0, 400),
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('edu_projects').insert(row);
  if (error) throw new Error(error.message);
  await db.from('edu_project_members').insert({
    id: newId(),
    project_id: row.id,
    user_id: userId,
    joined_at: row.created_at,
  });
  await award(db, { userId, amount: REWARDS.project_create, reason: 'project_create', ref: row.id });
  return presentProject(row, [{ project_id: row.id, user_id: userId }], userId);
}

export async function joinProject(db, { userId, projectId }) {
  const { data, error } = await db.from('edu_projects').select('*').eq('id', projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new CommunityError('Ese proyecto no está.', 404);
  const existing = await db.from('edu_project_members').select('id').eq('project_id', projectId).eq('user_id', userId).limit(1);
  if (list(existing.data).length) return { joined: true, already: true };
  const { error: insertError } = await db.from('edu_project_members').insert({
    id: newId(),
    project_id: projectId,
    user_id: userId,
    joined_at: new Date().toISOString(),
  });
  if (insertError && !duplicate(insertError)) throw new Error(insertError.message);
  await award(db, { userId, amount: REWARDS.project_join, reason: 'project_join', ref: projectId });
  return { joined: true, title: data.title };
}

function presentGroup(row, members, userId) {
  const people = members.filter((item) => item.group_id === row.id);
  const mine = people.find((item) => item.user_id === userId);
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    image_url: row.image_url || '',
    user_id: row.user_id || '',
    author_name: row.author_name || 'Estudiante',
    starts_at: row.starts_at || '',
    members: people.length,
    joined: Boolean(mine),
    owner: row.user_id === userId,
    invite_path: mine ? `/edu/comunidad/grupos/unirse/${row.invite_code}` : '',
  };
}

export async function listGroups(db, userId) {
  const [{ data, error }, members] = await Promise.all([
    db.from('edu_groups').select('*').order('created_at', { ascending: false }).limit(80),
    db.from('edu_group_members').select('group_id, user_id, role').limit(800),
  ]);
  if (error) throw new Error(error.message);
  if (members.error) throw new Error(members.error.message);
  const rows = list(members.data);
  return stampAvatars(db, list(data).map((row) => presentGroup(row, rows, userId)));
}

export async function createGroup(db, { userId, name, payload }) {
  const owned = await db.from('edu_groups').select('id').eq('user_id', userId).limit(LIMITS.groupsCreated);
  if (list(owned.data).length >= LIMITS.groupsCreated) {
    throw new CommunityError(`Puedes crear hasta ${LIMITS.groupsCreated} grupos.`);
  }
  const title = text(payload?.title, 140);
  const body = text(payload?.body, 2000);
  if (title.length < 4 || body.length < 4) throw new CommunityError('El grupo necesita nombre y para qué se reúnen.');
  const row = {
    id: newId(),
    user_id: userId,
    author_name: name,
    title,
    body,
    invite_code: newId().replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase(),
    starts_at: payload?.starts_at ? parseWhen(payload.starts_at, 'la sesión') : '',
    image_url: String(payload?.image_url || '').slice(0, 400),
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('edu_groups').insert(row);
  if (error) throw new Error(error.message);
  await db.from('edu_group_members').insert({
    id: newId(),
    group_id: row.id,
    user_id: userId,
    role: 'owner',
    joined_at: row.created_at,
  });
  await award(db, { userId, amount: REWARDS.group_create, reason: 'group_create', ref: row.id });
  if (row.starts_at) {
    await scheduleReminder(db, {
      userId,
      title: 'Tu grupo se reúne en 15 minutos',
      body: row.title,
      href: `/edu/comunidad/grupos/${row.id}`,
      startsAt: row.starts_at,
    });
  }
  return presentGroup(row, [{ group_id: row.id, user_id: userId, role: 'owner' }], userId);
}

async function groupBy(db, field, value) {
  const { data, error } = await db.from('edu_groups').select('*').eq(field, value).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function assertMemberRoom(db, groupId) {
  const members = await db.from('edu_group_members').select('id').eq('group_id', groupId).limit(LIMITS.members + 1);
  if (list(members.data).length >= LIMITS.members) {
    throw new CommunityError(`Este grupo ya llegó a ${LIMITS.members} personas.`);
  }
}

async function assertJoinCapacity(db, userId) {
  const mine = await db.from('edu_group_members').select('id').eq('user_id', userId).limit(LIMITS.groupsJoined + 1);
  if (list(mine.data).length >= LIMITS.groupsJoined) {
    throw new CommunityError(`Puedes estar en hasta ${LIMITS.groupsJoined} grupos.`);
  }
}

async function addGroupMember(db, { userId, group }) {
  const existing = await db
    .from('edu_group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .limit(1);
  if (list(existing.data).length) return { joined: true, already: true, id: group.id };
  await assertMemberRoom(db, group.id);
  await assertJoinCapacity(db, userId);
  const { error } = await db.from('edu_group_members').insert({
    id: newId(),
    group_id: group.id,
    user_id: userId,
    role: 'member',
    joined_at: new Date().toISOString(),
  });
  if (error && !duplicate(error)) throw new Error(error.message);
  await award(db, { userId, amount: REWARDS.group_join, reason: 'group_join', ref: group.id });
  await notify(db, {
    userId,
    title: 'Entraste al grupo',
    body: group.title,
    href: `/edu/comunidad/grupos/${group.id}`,
    email: true,
  });
  if (group.starts_at) {
    await scheduleReminder(db, {
      userId,
      title: 'El grupo se reúne en 15 minutos',
      body: group.title,
      href: `/edu/comunidad/grupos/${group.id}`,
      startsAt: group.starts_at,
    });
  }
  return { joined: true, id: group.id };
}

export async function joinGroup(db, { userId, groupId, code }) {
  const group = code ? await groupBy(db, 'invite_code', String(code).trim().toLowerCase()) : await groupBy(db, 'id', groupId);
  if (!group) throw new CommunityError('Ese grupo no está.', 404);
  return addGroupMember(db, { userId, group });
}

export async function readGroup(db, { userId, groupId }) {
  const group = await groupBy(db, 'id', groupId);
  if (!group) throw new CommunityError('Ese grupo no está.', 404);
  const [members, links] = await Promise.all([
    db.from('edu_group_members').select('user_id, role, joined_at').eq('group_id', groupId).limit(LIMITS.members),
    db.from('edu_group_courses').select('course_id').eq('group_id', groupId).limit(40),
  ]);
  if (members.error) throw new Error(members.error.message);
  const people = list(members.data);
  const joined = people.some((row) => row.user_id === userId);
  const ids = list(links.data).map((row) => row.course_id);
  let courses = [];
  if (ids.length) {
    const found = await db
      .from('edu_courses')
      .select('id, title, summary, cover_url, author_name, status, price_coins')
      .in('id', ids);
    courses = list(found.data);
  }
  const names = people.length
    ? await db.from('profiles').select('id, display_name').in(
        'id',
        people.map((row) => row.user_id)
      ).limit(LIMITS.members)
    : { data: [] };
  const byName = Object.fromEntries(list(names.data).map((row) => [row.id, row.display_name]));
  const faces = await avatarMap(db, people.map((row) => row.user_id));
  return {
    ...presentGroup(group, people.map((row) => ({ ...row, group_id: groupId })), userId),
    joined,
    courses: joined || group.user_id === userId ? courses : [],
    people: people.map((row) => ({
      user_id: row.user_id,
      avatar_url: faces[row.user_id] || '',
      name: byName[row.user_id] || 'Estudiante',
      role: row.role,
      mine: row.user_id === userId,
    })),
  };
}

export async function attachGroupCourse(db, { userId, groupId, courseId }) {
  if (!groupId) return;
  const group = await groupBy(db, 'id', groupId);
  if (!group) return;
  const member = await db.from('edu_group_members').select('id').eq('group_id', groupId).eq('user_id', userId).limit(1);
  if (!list(member.data).length) throw new CommunityError('Solo quien está en el grupo puede dejar un curso ahí.');
  const { error } = await db.from('edu_group_courses').insert({
    id: newId(),
    group_id: groupId,
    course_id: courseId,
    created_at: new Date().toISOString(),
  });
  if (error && !duplicate(error)) throw new Error(error.message);
}

function presentEvent(row, rsvps, userId) {
  const people = rsvps.filter((item) => item.event_id === row.id);
  const mine = people.find((item) => item.user_id === userId);
  const started = new Date(row.starts_at).getTime() <= Date.now();
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    place: row.place || '',
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    price_coins: Number(row.price_coins) || 0,
    image_url: row.image_url || '',
    members: people.length,
    joined: Boolean(mine),
    ticket_code: mine?.ticket_code || '',
    certificate: Boolean(mine) && started,
  };
}

export async function listEvents(db, userId) {
  const [{ data, error }, rsvps] = await Promise.all([
    db.from('edu_events').select('*').order('starts_at', { ascending: true }).limit(80),
    db.from('edu_event_rsvps').select('event_id, user_id, ticket_code').limit(800),
  ]);
  if (error) throw new Error(error.message);
  if (rsvps.error) throw new Error(rsvps.error.message);
  const rows = list(rsvps.data);
  return list(data).map((row) => presentEvent(row, rows, userId));
}

export async function createEvent(db, { userId, profile, payload }) {
  if (!isAdmin(profile)) throw new CommunityError('Los eventos los publica el administrador.', 403);
  const title = text(payload?.title, 140);
  const body = text(payload?.body, 4000);
  if (title.length < 4 || body.length < 4) throw new CommunityError('El evento necesita título y descripción.');
  const starts_at = parseWhen(payload?.starts_at, 'el inicio');
  const ends_at = parseWhen(payload?.ends_at, 'el cierre');
  if (new Date(ends_at) <= new Date(starts_at)) throw new CommunityError('El cierre tiene que ser después del inicio.');
  const price = Math.max(0, Math.round(Number(payload?.price_coins) || 0));
  const row = {
    id: newId(),
    user_id: userId,
    title,
    body,
    place: text(payload?.place, 140),
    starts_at,
    ends_at,
    price_coins: price,
    image_url: String(payload?.image_url || '').slice(0, 400),
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('edu_events').insert(row);
  if (error) throw new Error(error.message);
  return presentEvent(row, [], userId);
}

export async function joinEvent(db, { userId, eventId, name }) {
  const { data, error } = await db.from('edu_events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new CommunityError('Ese evento no está.', 404);
  const existing = await db.from('edu_event_rsvps').select('ticket_code').eq('event_id', eventId).eq('user_id', userId).limit(1);
  const prior = list(existing.data)[0];
  if (prior) return { joined: true, already: true, ticket_code: prior.ticket_code };
  const price = Number(data.price_coins) || 0;
  if (price) await spend(db, { userId, amount: price, reason: 'event_fee', ref: eventId });
  const ticket_code = `EVT-${newId().slice(0, 8).toUpperCase()}`;
  const { error: insertError } = await db.from('edu_event_rsvps').insert({
    id: newId(),
    event_id: eventId,
    user_id: userId,
    ticket_code,
    created_at: new Date().toISOString(),
  });
  if (insertError) {
    if (price && !duplicate(insertError)) await award(db, { userId, amount: price, reason: 'event_refund', ref: eventId });
    if (!duplicate(insertError)) throw new Error(insertError.message);
  }
  await notify(db, {
    userId,
    title: 'Ticket de evento',
    body: `${data.title}. Tu código es ${ticket_code}.`,
    href: '/edu/eventos',
    email: true,
  });
  await scheduleReminder(db, {
    userId,
    title: 'El evento empieza en 15 minutos',
    body: data.title,
    href: '/edu/eventos',
    startsAt: data.starts_at,
  });
  return { joined: true, ticket_code, learner: name };
}

export async function listTickets(db, userId) {
  const { data, error } = await db.from('edu_event_rsvps').select('*').eq('user_id', userId).limit(80);
  if (error) throw new Error(error.message);
  const rsvps = list(data);
  if (!rsvps.length) return [];
  const events = await db.from('edu_events').select('*').in('id', rsvps.map((row) => row.event_id));
  const byId = Object.fromEntries(list(events.data).map((row) => [row.id, row]));
  return rsvps
    .map((row) => {
      const event = byId[row.event_id];
      if (!event) return null;
      const started = new Date(event.starts_at).getTime() <= Date.now();
      return {
        id: row.id,
        ticket_code: row.ticket_code,
        created_at: row.created_at,
        event_id: event.id,
        title: event.title,
        place: event.place,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        certificate: started,
      };
    })
    .filter(Boolean);
}

export async function eventCertificate(db, { userId, eventId, name }) {
  const rsvp = await db.from('edu_event_rsvps').select('id').eq('event_id', eventId).eq('user_id', userId).limit(1);
  if (!list(rsvp.data).length) throw new CommunityError('No tienes ticket para ese evento.', 404);
  const { data: event, error } = await db.from('edu_events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) throw new CommunityError('Ese evento no está.', 404);
  if (new Date(event.starts_at).getTime() > Date.now()) {
    throw new CommunityError('La constancia se abre cuando el evento haya empezado.');
  }
  const existing = await db.from('edu_event_certs').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
  if (existing.data) {
    return {
      code: existing.data.code,
      learner_name: existing.data.learner_name,
      title: event.title,
      issued_at: existing.data.issued_at,
    };
  }
  const row = {
    id: newId(),
    event_id: eventId,
    user_id: userId,
    learner_name: name || 'Estudiante',
    code: `EVT-${newId().slice(0, 8).toUpperCase()}`,
    issued_at: new Date().toISOString(),
  };
  const { error: insertError } = await db.from('edu_event_certs').insert(row);
  if (insertError && !duplicate(insertError)) throw new Error(insertError.message);
  return { code: row.code, learner_name: row.learner_name, title: event.title, issued_at: row.issued_at };
}

export async function activityOf(db, userId) {
  const [courses, challenges, projects, groups, tickets] = await Promise.all([
    listSubscriptions(db, userId),
    listChallenges(db, userId),
    listProjects(db, userId),
    listGroups(db, userId),
    listTickets(db, userId),
  ]);
  const items = [
    ...courses.map((row) => ({
      id: `course-${row.id}`,
      kind: 'curso',
      title: row.title || row.prompt,
      href: `/edu/cursos/${row.id}`,
      at: row.created_at,
    })),
    ...challenges
      .filter((row) => row.joined)
      .map((row) => ({
        id: `challenge-${row.id}`,
        kind: 'reto',
        title: row.title,
        href: '/edu/comunidad/retos',
        at: row.starts_at,
      })),
    ...projects
      .filter((row) => row.joined)
      .map((row) => ({
        id: `project-${row.id}`,
        kind: 'proyecto',
        title: row.title,
        href: '/edu/comunidad/proyectos',
        at: row.created_at,
      })),
    ...groups
      .filter((row) => row.joined)
      .map((row) => ({
        id: `group-${row.id}`,
        kind: 'grupo',
        title: row.title,
        href: `/edu/comunidad/grupos/${row.id}`,
        at: row.starts_at || '',
      })),
    ...tickets.map((row) => ({
      id: `event-${row.id}`,
      kind: 'evento',
      title: row.title,
      href: '/edu/eventos',
      at: row.starts_at,
    })),
  ];
  return items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

const CADENCE = new Set(['', 'daily', 'weekdays', 'weekly']);

function weekdayOf(day) {
  const date = new Date(`${day}T12:00:00-05:00`);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short' }).format(date);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[label] || 1;
}

function sessionOn(day, course) {
  const cadence = String(course.cadence || '');
  const time = String(course.session_time || '').slice(0, 5);
  if (!cadence || !/^\d{2}:\d{2}$/.test(time)) return null;
  const weekday = weekdayOf(day);
  if (cadence === 'weekdays' && weekday > 5) return null;
  if (cadence === 'weekly' && weekday !== (Number(course.session_weekday) || 1)) return null;
  if (!CADENCE.has(cadence) || cadence === '') return null;
  const start = new Date(`${day}T${time}:00-05:00`);
  if (Number.isNaN(start.getTime())) return null;
  const minutes = Math.min(180, Math.max(15, Number(course.session_minutes) || 45));
  return {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + minutes * 60 * 1000).toISOString(),
  };
}

function planPayload(row) {
  return {
    id: row.id,
    title: row.title || 'Curso',
    cadence: row.cadence || '',
    session_time: String(row.session_time || '').slice(0, 5),
    session_weekday: Number(row.session_weekday) || 1,
    session_minutes: Number(row.session_minutes) || 45,
    href: `/edu/cursos/${row.id}`,
  };
}

async function myCoursePlans(db, userId) {
  const { data, error } = await db
    .from('edu_courses')
    .select('id, title, cadence, session_time, session_weekday, session_minutes, status')
    .eq('user_id', userId)
    .limit(40);
  if (error) {
    if (/cadence|column/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }
  return list(data).map(planPayload);
}

async function plannedCourses(db, userId) {
  const fields = 'id, title, user_id, cadence, session_time, session_weekday, session_minutes, status';
  const owned = await db.from('edu_courses').select(fields).eq('user_id', userId).limit(40);
  if (owned.error) {
    if (/cadence|column/i.test(owned.error.message || '')) return [];
    throw new Error(owned.error.message);
  }
  const enroll = await db.from('edu_enrollments').select('course_id').eq('user_id', userId).limit(40);
  const ids = list(enroll.data).map((row) => row.course_id).filter((id) => !list(owned.data).some((row) => row.id === id));
  let extra = [];
  if (ids.length) {
    const found = await db.from('edu_courses').select(fields).in('id', ids);
    if (found.error) throw new Error(found.error.message);
    extra = list(found.data);
  }
  return [...list(owned.data), ...extra].filter((row) => row.cadence && row.session_time);
}

export function readCoursePlan(body) {
  const cadence = String(body?.cadence || '');
  if (!CADENCE.has(cadence)) throw new CommunityError('Esa constancia no existe.');
  const time = String(body?.session_time || '').trim().slice(0, 5);
  if (cadence && !/^\d{2}:\d{2}$/.test(time)) throw new CommunityError('Escribe la hora como 19:00.');
  const [hour, minute] = time ? time.split(':').map(Number) : [0, 0];
  if (cadence && (hour > 23 || minute > 59)) throw new CommunityError('Esa hora no es válida.');
  const weekday = Math.min(7, Math.max(1, Math.round(Number(body?.session_weekday) || 1)));
  const minutes = Math.min(180, Math.max(15, Math.round(Number(body?.session_minutes) || 45)));
  return {
    cadence,
    session_time: cadence ? time : '',
    session_weekday: weekday,
    session_minutes: minutes,
    updated_at: new Date().toISOString(),
  };
}

export async function saveCoursePlan(db, courseId, body) {
  const patch = readCoursePlan(body);
  const { error } = await db.from('edu_courses').eq('id', courseId).update(patch);
  if (error) {
    if (/cadence|column/i.test(error.message || '')) {
      throw new CommunityError('Falta la migración edu-calendar.sql en MatuDB.');
    }
    throw new Error(error.message);
  }
  return patch;
}

async function lessonHistory(db, userId) {
  const progress = await db
    .from('edu_progress')
    .select('lesson_id, course_id, updated_at, completed')
    .eq('user_id', userId)
    .limit(160);
  if (progress.error) return [];
  const done = list(progress.data).filter((row) => Number(row.completed) === 1 && row.updated_at);
  if (!done.length) return [];
  const lessonIds = done.map((row) => row.lesson_id);
  const lessons = await db.from('edu_lessons').select('id, title, course_id').in('id', lessonIds);
  const byId = Object.fromEntries(list(lessons.data).map((row) => [row.id, row]));
  return done.map((row) => {
    const lesson = byId[row.lesson_id];
    return {
      id: `done-${row.lesson_id}`,
      kind: 'leccion',
      title: lesson?.title || 'Lección terminada',
      starts_at: row.updated_at,
      ends_at: row.updated_at,
      href: `/edu/cursos/${row.course_id}?l=${row.lesson_id}`,
    };
  });
}

export async function calendarOf(db, userId) {
  const [challenges, groups, tickets, courses, history, plans] = await Promise.all([
    listChallenges(db, userId),
    listGroups(db, userId),
    listTickets(db, userId),
    plannedCourses(db, userId),
    lessonHistory(db, userId),
    myCoursePlans(db, userId),
  ]);
  const items = [...history];
  for (const row of challenges) {
    if (!row.joined) continue;
    items.push({
      id: row.id,
      kind: 'reto',
      title: row.title,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      href: '/edu/comunidad/retos',
    });
  }
  for (const row of groups) {
    if (!row.joined || !row.starts_at) continue;
    items.push({
      id: row.id,
      kind: 'grupo',
      title: row.title,
      starts_at: row.starts_at,
      ends_at: row.starts_at,
      href: `/edu/comunidad/grupos/${row.id}`,
    });
  }
  for (const row of tickets) {
    items.push({
      id: row.event_id,
      kind: 'evento',
      title: row.title,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      href: '/edu/eventos',
    });
  }
  const today = bogotaDay();
  for (const course of courses) {
    for (let offset = -14; offset <= 45; offset += 1) {
      const slot = sessionOn(shiftDay(today, offset), course);
      if (!slot) continue;
      items.push({
        id: `${course.id}-${slot.starts_at}`,
        kind: 'curso',
        title: course.title || 'Curso',
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        href: `/edu/cursos/${course.id}`,
      });
    }
  }
  items.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return { items, plans };
}

async function remindSessions(db) {
  const courses = await db
    .from('edu_courses')
    .select('id, title, user_id, cadence, session_time, session_weekday, session_minutes')
    .limit(200);
  if (courses.error) return;
  const today = bogotaDay();
  const now = Date.now();
  for (const course of list(courses.data)) {
    const slot = sessionOn(today, course);
    if (!slot) continue;
    const left = new Date(slot.starts_at).getTime() - now;
    if (left <= 0 || left > 15 * 60 * 1000) continue;
    const enroll = await db.from('edu_enrollments').select('user_id').eq('course_id', course.id).limit(80);
    const users = new Set([course.user_id, ...list(enroll.data).map((row) => row.user_id)].filter(Boolean));
    for (const userId of users) {
      const id = `${userId}:${course.id}:${slot.starts_at}`;
      const mark = await db.from('edu_session_reminders').insert({
        id,
        user_id: userId,
        course_id: course.id,
        session_at: slot.starts_at,
        created_at: new Date().toISOString(),
      });
      if (mark.error) continue;
      await notify(db, {
        userId,
        title: 'Tu clase empieza en 15 minutos',
        body: `${course.title || 'Tu curso'} es a las ${String(course.session_time).slice(0, 5)}.`,
        href: `/edu/cursos/${course.id}`,
        kind: 'reminder',
        email: true,
      });
    }
  }
}

export async function streakBoard(db, userId) {
  const { data, error } = await db.from('edu_streaks').select('*').limit(200);
  if (error) throw new Error(error.message);
  const today = bogotaDay();
  const yesterday = shiftDay(today, -1);
  const rows = list(data).map((row) => {
    const alive = row.last_day === today || row.last_day === yesterday;
    return {
      user_id: row.user_id,
      current: alive ? Number(row.current) || 0 : 0,
      best: Number(row.best) || 0,
      show_progress: Number(row.show_progress) === 1,
      mine: row.user_id === userId,
    };
  });
  const ids = rows.map((row) => row.user_id);
  const names = ids.length
    ? await db.from('profiles').select('id, display_name').in('id', ids).limit(200)
    : { data: [] };
  const byName = Object.fromEntries(list(names.data).map((row) => [row.id, row.display_name || 'Estudiante']));
  const faces = await avatarMap(db, ids);
  let lessons = {};
  if (rows.some((row) => row.show_progress)) {
    const progress = await db.from('edu_progress').select('user_id, completed').limit(2000);
    for (const row of list(progress.data)) {
      if (Number(row.completed) === 1) lessons[row.user_id] = (lessons[row.user_id] || 0) + 1;
    }
  }
  const board = rows
    .map((row) => ({
      user_id: row.user_id,
      avatar_url: faces[row.user_id] || '',
      name: byName[row.user_id] || 'Estudiante',
      current: row.current,
      best: row.best,
      mine: row.mine,
      lessons: row.show_progress ? lessons[row.user_id] || 0 : null,
    }))
    .sort((a, b) => b.current - a.current || b.best - a.best)
    .slice(0, 40);
  const mine = rows.find((row) => row.mine);
  return {
    board,
    mine: mine
      ? { current: mine.current, best: mine.best, show_progress: mine.show_progress }
      : { current: 0, best: 0, show_progress: false },
  };
}

export async function setProgressPublic(db, userId, show) {
  const existing = await db.from('edu_streaks').select('user_id').eq('user_id', userId).maybeSingle();
  if (!existing.data) {
    await db.from('edu_streaks').insert({
      user_id: userId,
      current: 0,
      best: 0,
      last_day: '',
      show_progress: show ? 1 : 0,
      updated_at: new Date().toISOString(),
    });
  } else {
    await db.from('edu_streaks').eq('user_id', userId).update({
      show_progress: show ? 1 : 0,
      updated_at: new Date().toISOString(),
    });
  }
  return { show_progress: Boolean(show) };
}

export async function pulseOf(db, userId, profile) {
  const [balance, notes, streak, groups, challenges] = await Promise.all([
    walletOf(db, userId),
    db.from('edu_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(12),
    db.from('edu_streaks').select('current, last_day').eq('user_id', userId).maybeSingle(),
    db.from('edu_group_members').select('id').eq('user_id', userId).limit(LIMITS.groupsJoined),
    listChallenges(db, userId).catch(() => []),
  ]);
  const today = bogotaDay();
  const yesterday = shiftDay(today, -1);
  const alive = streak.data && (streak.data.last_day === today || streak.data.last_day === yesterday);
  const notifications = list(notes.data).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href,
    created_at: row.created_at,
    read: Boolean(row.read_at),
  }));
  const upcoming = challenges.find((row) => new Date(row.ends_at) > new Date()) || challenges[0] || null;
  return {
    balance: balance.balance,
    unread: notifications.filter((row) => !row.read).length,
    streak: alive ? Number(streak.data.current) || 0 : 0,
    groups: list(groups.data).length,
    admin: isAdmin(profile),
    avatar: /^https:\/\//i.test(profile?.avatar_url || '') ? profile.avatar_url : '',
    notifications,
    featured: upcoming ? { id: upcoming.id, title: upcoming.title, members: upcoming.members } : null,
  };
}

export async function markNotifications(db, userId, id) {
  const now = new Date().toISOString();
  if (id) {
    const { error } = await db.from('edu_notifications').eq('id', id).eq('user_id', userId).update({ read_at: now });
    if (error) throw new Error(error.message);
    return;
  }
  const { data, error } = await db.from('edu_notifications').select('id, read_at').eq('user_id', userId).limit(40);
  if (error) throw new Error(error.message);
  for (const row of list(data)) {
    if (row.read_at) continue;
    await db.from('edu_notifications').eq('id', row.id).update({ read_at: now });
  }
}

export async function saveImage(db, { userId, dataUrl }) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new CommunityError('Sube una imagen JPG, PNG o WebP.');
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length || bytes.length > 3_500_000) throw new CommunityError('La imagen tiene que pesar menos de 3 MB.');
  const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const path = `edu/${userId}/${newId()}.${ext}`;
  const file = new Blob([bytes], { type: match[1] });
  const uploaded = await db.storage.upload(path, file);
  if (uploaded?.error) throw new Error(uploaded.error.message || 'No se pudo guardar la imagen.');
  const stored = uploaded?.data?.url || uploaded?.data?.publicUrl || '';
  const pub = db.storage.getPublicUrl(uploaded?.data?.path || uploaded?.data?.filename || path);
  const url = stored || pub?.data?.publicUrl || pub?.publicUrl || '';
  if (!/^https:\/\//i.test(url)) throw new CommunityError('La imagen quedó guardada sin un enlace público.');
  return { url };
}

export async function coinState(db, userId) {
  const balance = await walletOf(db, userId);
  const { data, error } = await db
    .from('edu_coin_ledger')
    .select('id, amount, reason, ref, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return {
    balance: balance.balance,
    ledger: list(data),
    rewards: REWARDS,
    rate: COIN_RATE,
    payments: Boolean(config.wompi.publicKey && config.wompi.integrity && config.wompi.privateKey),
  };
}

function wompiHost() {
  const key = config.wompi.publicKey || '';
  return key.startsWith('pub_test') ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
}

export async function checkoutCoins(db, { userId, coins, currency }) {
  if (!config.wompi.publicKey || !config.wompi.integrity || !config.wompi.privateKey) {
    throw new CommunityError('La recarga está lista en la app, pero falta conectar Wompi (WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY y WOMPI_INTEGRITY).', 503);
  }
  const quote = quoteCoins(coins);
  if (!quote) {
    throw new CommunityError(`Elige entre ${COIN_RATE.min.toLocaleString('es-CO')} y ${COIN_RATE.max.toLocaleString('es-CO')} Edu Coins.`);
  }
  const cur = currency === 'USD' ? 'USD' : 'COP';
  const amount_cents = cur === 'USD' ? quote.usdCents : quote.cop * 100;
  const row = {
    id: newId(),
    user_id: userId,
    coins: quote.coins,
    amount_cents,
    currency: cur,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('edu_coin_orders').insert(row);
  if (error) throw new Error(error.message);
  const signature = crypto
    .createHash('sha256')
    .update(`${row.id}${amount_cents}${cur}${config.wompi.integrity}`)
    .digest('hex');
  return {
    reference: row.id,
    public_key: config.wompi.publicKey,
    currency: cur,
    amount_in_cents: amount_cents,
    signature,
    redirect_url: `${config.publicAppUrl}/edu/monedas`,
    coins: quote.coins,
  };
}

async function creditOrder(db, order, transactionId) {
  if (!order || order.status === 'paid') return order;
  await db.from('edu_coin_orders').eq('id', order.id).update({ status: 'paid' });
  await award(db, { userId: order.user_id, amount: order.coins, reason: 'topup', ref: order.id });
  await notify(db, {
    userId: order.user_id,
    title: 'Edu Coins recargados',
    body: `Sumamos ${order.coins} Edu Coins a tu cuenta.`,
    href: '/edu/monedas',
    email: true,
  });
  return { ...order, status: 'paid', transactionId };
}

export async function syncWompi(db, { userId, transactionId }) {
  if (!config.wompi.privateKey) throw new CommunityError('Wompi no está conectado.', 503);
  const res = await fetch(`${wompiHost()}/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${config.wompi.privateKey}` },
  });
  const json = await res.json().catch(() => ({}));
  const tx = json?.data;
  if (!res.ok || !tx) throw new CommunityError('No pude confirmar el pago.');
  const { data, error } = await db.from('edu_coin_orders').select('*').eq('id', tx.reference).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new CommunityError('Esa recarga no es tuya.', 404);
  if (tx.status !== 'APPROVED') return { status: tx.status, balance: (await walletOf(db, userId)).balance };
  if (Number(tx.amount_in_cents) !== Number(data.amount_cents) || tx.currency !== data.currency) {
    throw new CommunityError('El monto del pago no coincide.');
  }
  await creditOrder(db, data, tx.id);
  return { status: 'APPROVED', balance: (await walletOf(db, userId)).balance };
}

function wompiValue(data, path) {
  const parts = path.split('.');
  let cursor = data;
  for (const part of parts) cursor = cursor?.[part];
  return cursor == null ? '' : String(cursor);
}

export async function wompiWebhook(db, body) {
  const event = body || {};
  const tx = event?.data?.transaction;
  if (!tx?.reference) return { ok: true };
  if (config.wompi.events) {
    const props = event?.signature?.properties || [];
    const joined = props.map((path) => wompiValue(event.data, path)).join('');
    const expected = crypto
      .createHash('sha256')
      .update(`${joined}${event.timestamp}${config.wompi.events}`)
      .digest('hex');
    if (expected !== event?.signature?.checksum) {
      throw new CommunityError('La firma del pago no coincide.', 401);
    }
  }
  if (tx.status !== 'APPROVED') return { ok: true };
  const { data, error } = await db.from('edu_coin_orders').select('*').eq('id', tx.reference).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: true };
  if (Number(tx.amount_in_cents) !== Number(data.amount_cents) || tx.currency !== data.currency) return { ok: true };
  await creditOrder(db, data, tx.id);
  return { ok: true };
}

export async function runEduPulse() {
  const db = getDb();
  const today = bogotaDay();
  const yesterday = shiftDay(today, -1);
  const streaks = await db.from('edu_streaks').select('user_id, current, last_day').limit(500);
  for (const row of list(streaks.data)) {
    if (!row.last_day || row.last_day >= yesterday || !row.current) continue;
    await db.from('edu_streaks').eq('user_id', row.user_id).update({
      current: 0,
      updated_at: new Date().toISOString(),
    });
  }
  const notes = await db.from('edu_notifications').select('*').eq('email_at', '').limit(40);
  const now = Date.now();
  for (const row of list(notes.data)) {
    if (new Date(row.fire_at).getTime() > now) continue;
    await deliverMail(db, row);
  }
  await remindSessions(db);
}

let pulseTimer = null;

export function startEduPulse() {
  if (pulseTimer) return;
  pulseTimer = setInterval(() => {
    runEduPulse().catch((err) => console.warn('[edu] pulso', err?.message || err));
  }, 60_000);
  runEduPulse().catch((err) => console.warn('[edu] pulso', err?.message || err));
}

function fail(res, err) {
  const status = err instanceof CommunityError ? err.status : 500;
  res.status(status).json({ error: { message: err.message || 'No se pudo completar' } });
}

function readInterests(raw) {
  if (Array.isArray(raw)) return raw;
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* texto separado por comas */
  }
  return text.split(',');
}

function cleanInterests(raw) {
  const source = Array.isArray(raw) ? raw : readInterests(raw);
  const seen = new Set();
  const items = [];
  for (const item of source) {
    const label = String(item || '').trim().slice(0, 28);
    const key = label.toLocaleLowerCase('es');
    if (!label || seen.has(key)) continue;
    seen.add(key);
    items.push(label);
    if (items.length >= 8) break;
  }
  return items;
}

function httpsUrl(value) {
  const url = String(value || '').trim();
  return /^https:\/\//i.test(url) ? url : '';
}

function profileHandle(name) {
  const skip = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
  const parts = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part && !skip.has(part));
  if (!parts.length) return 'estudiante';
  if (parts.length === 1) return parts[0].slice(0, 32);
  const surname = parts.length >= 4 ? parts[2] : parts[parts.length - 1];
  return slugifyTitle(`${parts[0]}-${surname}`).slice(0, 48);
}

async function uniqueProfileSlug(db, name, id, current = '') {
  const base = profileHandle(name);
  if (current === base || current.startsWith(`${base}-`)) return current;
  let candidate = base;
  for (let n = 2; n < 8; n += 1) {
    const { data, error } = await db.from('profiles').select('id').eq('profile_slug', candidate).limit(1);
    if (error) return current || base;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.id === id) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${String(id).replace(/-/g, '').slice(0, 4)}`;
}

function publicCard(row) {
  const account = String(row?.display_name || '').trim();
  const chosen = String(row?.public_name || '').trim();
  return {
    id: row.id,
    slug: String(row?.profile_slug || ''),
    name: chosen || account || 'Estudiante',
    avatar_url: httpsUrl(row?.avatar_url),
    cover_url: httpsUrl(row?.cover_url),
    bio: String(row?.bio || '').trim().slice(0, 300),
    interests: cleanInterests(row?.interests),
    views: Number(row?.profile_views) || 0,
    followers: 0,
  };
}

const PROFILE_FIELDS = 'id, display_name, public_name, profile_slug, avatar_url, cover_url, bio, interests, profile_views';

async function readProfileRow(db, key) {
  const byId = /^[0-9a-f-]{16,}$/i.test(String(key || ''));
  const primary = byId ? 'id' : 'profile_slug';
  let { data, error } = await db.from('profiles').select(PROFILE_FIELDS).eq(primary, key).maybeSingle();
  if (error && /profile_slug|cover_url|profile_views|column/i.test(error.message || '')) {
    const fallback = await db.from('profiles').select('id, display_name, public_name, avatar_url, bio, interests').eq('id', key).maybeSingle();
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data;
  }
  if (!data && !byId) {
    const again = await db.from('profiles').select(PROFILE_FIELDS).eq('id', key).maybeSingle();
    if (again.error) throw new Error(again.error.message);
    data = again.data;
    error = null;
  }
  if (error) throw new Error(error.message);
  return data;
}

async function writeProfile(db, userId, patch) {
  const { error } = await db.from('profiles').eq('id', userId).update(patch);
  if (!error) return;
  if (!/profile_slug|cover_url|profile_views|column/i.test(error.message || '')) throw new Error(error.message);
  const basic = { ...patch };
  delete basic.profile_slug;
  delete basic.cover_url;
  delete basic.profile_views;
  if (!Object.keys(basic).length) return;
  const again = await db.from('profiles').eq('id', userId).update(basic);
  if (again.error) throw new Error(again.error.message);
}

export async function publicProfile(db, key, viewerId = '') {
  const row = await readProfileRow(db, key);
  if (!row) throw new CommunityError('Ese perfil no está.', 404);
  const slug = await uniqueProfileSlug(db, row.public_name || row.display_name, row.id, row.profile_slug || '');
  if (slug && slug !== row.profile_slug) {
    await writeProfile(db, row.id, { profile_slug: slug });
    row.profile_slug = slug;
  }
  if (viewerId && viewerId !== row.id && (String(key) === String(row.profile_slug) || !row.profile_slug)) {
    const views = (Number(row.profile_views) || 0) + 1;
    await writeProfile(db, row.id, { profile_views: views });
    row.profile_views = views;
  }
  return publicCard(row);
}

export async function saveProfile(db, { userId, payload }) {
  const current = await readProfileRow(db, userId);
  if (!current) throw new CommunityError('Ese perfil no está.', 404);
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'name')) {
    const name = String(payload.name || '').trim().slice(0, 80);
    if (name.length < 2) throw new CommunityError('Escribe cómo quieres que te vean.');
    const account = String(current.display_name || '').trim();
    patch.public_name = name === account ? '' : name;
    patch.profile_slug = await uniqueProfileSlug(db, name, userId, current.profile_slug || '');
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'bio')) {
    patch.bio = String(payload.bio || '').trim().slice(0, 300);
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'interests')) {
    patch.interests = JSON.stringify(cleanInterests(payload.interests));
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'avatar_url')) {
    const avatar = String(payload.avatar_url || '').trim();
    if (avatar && !/^https:\/\//i.test(avatar)) throw new CommunityError('La foto tiene que quedar en un enlace seguro.');
    patch.avatar_url = avatar;
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'cover_url')) {
    const cover = String(payload.cover_url || '').trim();
    if (cover && !/^https:\/\//i.test(cover)) throw new CommunityError('La portada tiene que quedar en un enlace seguro.');
    patch.cover_url = cover;
  }
  if (!Object.keys(patch).length) return publicProfile(db, userId, userId);
  await writeProfile(db, userId, patch);
  return publicProfile(db, userId, userId);
}

export function registerHubRoutes(app, { authMiddleware, ensureWorkspace }) {
  const guard = (handler) => async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      await handler(req, res, { db, profile, name: personName(profile, req.user) });
    } catch (err) {
      fail(res, err);
    }
  };

  app.get('/api/edu/profile', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ profile: await publicProfile(db, profile.id) });
  }));
  app.post('/api/edu/profile', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json({ profile: await saveProfile(db, { userId: profile.id, payload: req.body }) });
  }));
  app.get('/api/edu/profile/:id', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json({ profile: await publicProfile(db, req.params.id, profile.id) });
  }));

  app.get('/api/edu/pulse', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json(await pulseOf(db, profile.id, profile));
  }));

  app.post('/api/edu/notifications/read', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    await markNotifications(db, profile.id, req.body?.id || '');
    res.json({ ok: true });
  }));

  app.post('/api/edu/media', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await saveImage(db, { userId: profile.id, dataUrl: req.body?.data }));
  }));

  app.get('/api/edu/subscriptions', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ courses: await listSubscriptions(db, profile.id) });
  }));

  app.post('/api/edu/courses/:id/enroll', authMiddleware(true), guard(async (req, res, { db, profile, name }) => {
    const course = await loadCourse(db, req.params.id);
    res.json(await enrollCourse(db, { userId: profile.id, course, name }));
  }));

  app.get('/api/edu/challenges', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ challenges: await listChallenges(db, profile.id) });
  }));
  app.post('/api/edu/challenges', authMiddleware(true), guard(async (req, res, { db, profile, name }) => {
    res.status(201).json({ challenge: await createChallenge(db, { userId: profile.id, name, payload: req.body }) });
  }));
  app.post('/api/edu/challenges/:id/join', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await joinChallenge(db, { userId: profile.id, challengeId: req.params.id }));
  }));
  app.post('/api/edu/challenges/:id/done', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await completeChallenge(db, { userId: profile.id, challengeId: req.params.id }));
  }));

  app.get('/api/edu/projects', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ projects: await listProjects(db, profile.id) });
  }));
  app.post('/api/edu/projects', authMiddleware(true), guard(async (req, res, { db, profile, name }) => {
    res.status(201).json({ project: await createProject(db, { userId: profile.id, name, payload: req.body }) });
  }));
  app.post('/api/edu/projects/:id/join', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await joinProject(db, { userId: profile.id, projectId: req.params.id }));
  }));

  app.get('/api/edu/groups', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ groups: await listGroups(db, profile.id) });
  }));
  app.post('/api/edu/groups', authMiddleware(true), guard(async (req, res, { db, profile, name }) => {
    res.status(201).json({ group: await createGroup(db, { userId: profile.id, name, payload: req.body }) });
  }));
  app.get('/api/edu/groups/:id', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json({ group: await readGroup(db, { userId: profile.id, groupId: req.params.id }) });
  }));
  app.post('/api/edu/groups/join', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await joinGroup(db, { userId: profile.id, code: req.body?.code, groupId: req.body?.group_id }));
  }));

  app.get('/api/edu/events', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ events: await listEvents(db, profile.id), admin: isAdmin(profile) });
  }));
  app.post('/api/edu/events', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.status(201).json({ event: await createEvent(db, { userId: profile.id, profile, payload: req.body }) });
  }));
  app.post('/api/edu/events/:id/join', authMiddleware(true), guard(async (req, res, { db, profile, name }) => {
    res.json(await joinEvent(db, { userId: profile.id, eventId: req.params.id, name }));
  }));
  app.post('/api/edu/events/:id/certificate', authMiddleware(true), guard(async (req, res, { db, profile, name }) => {
    res.json({ certificate: await eventCertificate(db, { userId: profile.id, eventId: req.params.id, name }) });
  }));

  app.get('/api/edu/tickets', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ tickets: await listTickets(db, profile.id) });
  }));
  app.get('/api/edu/activity', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json({ items: await activityOf(db, profile.id) });
  }));
  app.get('/api/edu/calendar', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json(await calendarOf(db, profile.id));
  }));
  app.get('/api/edu/streaks', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json(await streakBoard(db, profile.id));
  }));
  app.post('/api/edu/streaks/share', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await setProgressPublic(db, profile.id, Boolean(req.body?.show)));
  }));
  app.get('/api/edu/coins', authMiddleware(true), guard(async (_req, res, { db, profile }) => {
    res.json(await coinState(db, profile.id));
  }));
  app.post('/api/edu/coins/checkout', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await checkoutCoins(db, { userId: profile.id, coins: req.body?.coins, currency: req.body?.currency }));
  }));
  app.post('/api/edu/coins/sync', authMiddleware(true), guard(async (req, res, { db, profile }) => {
    res.json(await syncWompi(db, { userId: profile.id, transactionId: req.body?.id }));
  }));

  app.post('/api/edu/coins/wompi', async (req, res) => {
    try {
      res.json(await wompiWebhook(getDb(), req.body));
    } catch (err) {
      fail(res, err);
    }
  });
}
