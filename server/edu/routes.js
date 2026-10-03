import { getDb, newId } from '../db.js';
import { ensureEduSchema } from './schema.js';
import { certificateEmail, sendAppMail } from '../email-verify.js';
import { isEduBuildRunning, kickoffEduBuild, fillLessonText, findVideo, fillMissingVideos, findCourseCover, coverNeedsPhoto } from './build.js';
import { screenCoursePrompt } from './safety.js';
import {
  CommunityError,
  acceptForumAnswer,
  addForumComment,
  avatarMap,
  createForumPost,
  listForum,
  readForumPost,
  toggleForumLike,
  toggleForumSave,
} from './community.js';
import { REWARDS, attachGroupCourse, award, onLessonCompleted, registerHubRoutes, saveCoursePlan, studyAllowed } from './hub.js';

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function dbMessage(err) {
  const msg = String(err?.message || err || 'Error');
  if (/edu_|does not exist|schema cache|could not find|relation/i.test(msg)) {
    return 'Faltan las tablas de EduCreator. Ejecuta docs/migrations/edu-creator.sql en MatuDB.';
  }
  return msg.slice(0, 400);
}

function isEmailDerivedName(value, email) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return false;
  const full = String(email || '').trim().toLowerCase();
  const local = full.split('@')[0];
  if (full && raw === full) return true;
  return Boolean(local) && raw === local;
}

function accountLearnerName(profile, user) {
  const email = profile?.email || user?.email || '';
  const display = String(profile?.display_name ?? '').trim();
  if (display && !isEmailDerivedName(display, email)) return display.slice(0, 120);
  const sessionName = String(user?.name ?? '').trim();
  const schemaEmpty = !display;
  const schemaIsEmail = Boolean(display) && isEmailDerivedName(display, email);
  if ((schemaEmpty || schemaIsEmail) && sessionName && !isEmailDerivedName(sessionName, email)) {
    return sessionName.slice(0, 120);
  }
  return '';
}

async function repairCertificateName(row, profile, user) {
  if (!row?.id) return row;
  const email = profile?.email || user?.email || '';
  const stored = String(row.learner_name || '').trim();
  const next = accountLearnerName(profile, user);
  if (!next) return row;
  if (stored && !isEmailDerivedName(stored, email)) return row;
  if (stored === next) return row;
  const db = getDb();
  const { error } = await db.from('edu_certificates').eq('id', row.id).update({
    learner_name: next,
  });
  if (error) console.error('[edu] learner_name', error.message);
  return { ...row, learner_name: next };
}

function certificatePayload(row) {
  return {
    id: row.id,
    code: row.code,
    learner_name: row.learner_name,
    issued_at: row.issued_at,
  };
}

const CERT_MAIL_COOLDOWN_MS = 30 * 1000;
const lastCertMail = new Map();

function pdfFromBody(body) {
  const raw = String(body?.pdf || '')
    .replace(/^data:application\/pdf;base64,/i, '')
    .replace(/\s/g, '');
  if (raw.length < 100) {
    const err = new Error('No llegó el PDF del certificado.');
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(raw, 'base64');
  if (
    buf.length < 100 ||
    buf.length > 8 * 1024 * 1024 ||
    buf.subarray(0, 5).toString('utf8') !== '%PDF-'
  ) {
    const err = new Error('El archivo adjunto no es un PDF válido.');
    err.status = 400;
    throw err;
  }
  return buf;
}

function issuedLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function withCovers(rows) {
  const db = getDb();
  const out = [];
  let columnOk = true;
  for (const row of rows || []) {
    if (!columnOk || !coverNeedsPhoto(row.cover_url)) {
      out.push(row);
      continue;
    }
    const cover_url = await findCourseCover(row.title || row.prompt, row.prompt);
    if (!cover_url) {
      out.push(row);
      continue;
    }
    const { error } = await db.from('edu_courses').eq('id', row.id).update({ cover_url });
    if (error && /cover_url|column/i.test(error.message || '')) {
      columnOk = false;
      out.push(row);
      continue;
    }
    out.push(error ? row : { ...row, cover_url });
  }
  return out;
}

async function withProgress(userId, rows) {
  const ids = (rows || []).map((row) => row.id).filter(Boolean);
  if (!ids.length) return rows || [];
  const db = getDb();
  const { data: lessons, error } = await db
    .from('edu_lessons')
    .select('id, course_id')
    .in('course_id', ids);
  if (error) return rows;
  const { data: prog } = await db
    .from('edu_progress')
    .select('course_id, completed')
    .eq('user_id', userId)
    .in('course_id', ids);
  const totals = {};
  const done = {};
  for (const lesson of lessons || []) {
    totals[lesson.course_id] = (totals[lesson.course_id] || 0) + 1;
  }
  for (const row of prog || []) {
    if (Number(row.completed) === 1) done[row.course_id] = (done[row.course_id] || 0) + 1;
  }
  return rows.map((row) => {
    const total = totals[row.id] || 0;
    const finished = done[row.id] || 0;
    return {
      ...row,
      lesson_count: total,
      done_count: finished,
      pct: total ? Math.round((finished / total) * 100) : 0,
    };
  });
}

function passNeeded(total) {
  return Math.max(1, Math.round(total * 0.75));
}

function publicQuiz(quiz, revealed) {
  if (!quiz || !Array.isArray(quiz.questions)) return null;
  return {
    title: quiz.title || 'Quiz',
    pass: passNeeded(quiz.questions.length),
    total: quiz.questions.length,
    questions: quiz.questions.map((q) => ({
      prompt: q.prompt,
      choices: q.choices,
      ...(revealed ? { answer: q.answer, why: q.why } : {}),
    })),
  };
}

async function readableCourse(userId, courseId) {
  const own = await ownedCourse(userId, courseId);
  if (own) return { course: own, owner: true };
  const db = getDb();
  const { data, error } = await db
    .from('edu_courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data && Number(data.is_public) === 1 && data.status === 'ready') {
    return { course: data, owner: false };
  }
  return null;
}

async function ownedCourse(userId, courseId) {
  const db = getDb();
  const { data, error } = await db
    .from('edu_courses')
    .select('*')
    .eq('id', courseId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function bundle(userId, course) {
  const db = getDb();
  const [{ data: modules, error: modErr }, { data: lessons, error: lesErr }, { data: progressRows, error: progErr }, { data: cert, error: certErr }] =
    await Promise.all([
      db.from('edu_modules').select('*').eq('course_id', course.id),
      db.from('edu_lessons').select('*').eq('course_id', course.id),
      db.from('edu_progress').select('*').eq('user_id', userId).eq('course_id', course.id),
      db
        .from('edu_certificates')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .maybeSingle(),
    ]);
  if (modErr) throw new Error(modErr.message);
  if (lesErr) throw new Error(lesErr.message);
  if (progErr) throw new Error(progErr.message);
  if (certErr) throw new Error(certErr.message);

  const progress = {};
  for (const row of progressRows || []) {
    progress[row.lesson_id] = {
      completed: row.completed === true || Number(row.completed) === 1,
      quiz_score: row.quiz_score == null || row.quiz_score === '' ? null : Number(row.quiz_score),
    };
  }

  const lessonRows = (lessons || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  const moduleRows = (modules || [])
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((mod) => ({
      id: mod.id,
      position: mod.position,
      title: mod.title,
      summary: mod.summary || '',
      status: mod.status || 'pending',
      plan: parseJson(mod.plan_json, []),
      lessons: lessonRows
        .filter((lesson) => lesson.module_id === mod.id)
        .map((lesson) => {
          const quiz = parseJson(lesson.quiz_json, null);
          const revealed = lesson.kind === 'quiz' && progress[lesson.id]?.completed;
          return {
            id: lesson.id,
            position: lesson.position,
            kind: lesson.kind || 'lesson',
            title: lesson.title,
            body: lesson.body_md || '',
            resources: parseJson(lesson.resources_json, []),
            video: parseJson(lesson.video_json, null),
            quiz: lesson.kind === 'quiz' ? publicQuiz(quiz, revealed) : null,
          };
        }),
    }));

  return {
    course: {
      id: course.id,
      title: course.title || '',
      summary: course.summary || '',
      prompt: course.prompt || '',
      level: course.level || 'inicial',
      status: course.status || 'building',
      phase: course.phase || 'inicio',
      activity: course.activity || '',
      error: course.error || '',
      is_public: Number(course.is_public) === 1,
      price_coins: Number(course.price_coins) || 0,
      cadence: course.cadence || '',
      session_time: String(course.session_time || '').slice(0, 5),
      session_weekday: Number(course.session_weekday) || 1,
      session_minutes: Number(course.session_minutes) || 45,
      author_name: course.author_name || '',
      mine: course.user_id === userId,
      sources: parseJson(course.sources_json, []),
      log: parseJson(course.log_json, []),
      created_at: course.created_at,
      updated_at: course.updated_at,
    },
    modules: moduleRows,
    progress,
    certificate: cert
      ? {
          id: cert.id,
          code: cert.code,
          learner_name: cert.learner_name,
          issued_at: cert.issued_at,
        }
      : null,
  };
}

function allPassed(view) {
  const lessons = view.modules.flatMap((mod) => mod.lessons);
  if (!lessons.length) return false;
  return lessons.every((lesson) => view.progress[lesson.id]?.completed);
}

export function registerEduRoutes(app, deps) {
  const { authMiddleware, ensureWorkspace } = deps;
  registerHubRoutes(app, deps);

  app.get('/api/edu/courses', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      let { data, error } = await db
        .from('edu_courses')
        .select(
          'id, title, summary, prompt, level, status, phase, activity, is_public, author_name, cover_url, created_at, updated_at'
        )
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (error && /is_public|author_name|cover_url|column/i.test(error.message || '')) {
        ({ data, error } = await db
          .from('edu_courses')
          .select('id, title, summary, prompt, level, status, phase, activity, created_at, updated_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }));
      }
      if (error) throw new Error(error.message);
      const covered = await withCovers(data || []);
      const courses = await withProgress(profile.id, covered);
      res.json({ courses });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.post('/api/edu/courses', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const prompt = String(req.body?.prompt || '').trim();
      const level = ['inicial', 'intermedio', 'avanzado'].includes(req.body?.level)
        ? req.body.level
        : 'inicial';
      if (prompt.length < 8) {
        return res.status(400).json({
          error: { message: 'Cuéntame con un poco más de detalle qué quieres aprender.' },
        });
      }
      if (prompt.length > 800) {
        return res.status(400).json({
          error: { message: 'El tema es demasiado largo. Resúmelo en unas líneas.' },
        });
      }
      const blocked = screenCoursePrompt(prompt);
      if (blocked) {
        return res.status(400).json({ error: { message: blocked, code: 'blocked' } });
      }

      const id = newId();
      const now = new Date().toISOString();
      const row = {
        id,
        org_id: org.id,
        user_id: profile.id,
        prompt: prompt.slice(0, 800),
        title: '',
        summary: '',
        level,
        status: 'building',
        phase: 'inicio',
        activity: 'Leyendo lo que quieres aprender…',
        error: '',
        sources_json: '[]',
        log_json: JSON.stringify([
          { at: now, text: 'Leyendo lo que quieres aprender…' },
        ]),
        is_public: req.body?.is_public ? 1 : 0,
        author_name: String(profile.name || req.user?.name || '').slice(0, 120),
        created_at: now,
        updated_at: now,
      };
      const db = getDb();
      let { error } = await db.from('edu_courses').insert(row);
      if (error && /is_public|author_name|column/i.test(error.message || '')) {
        const slim = { ...row };
        delete slim.is_public;
        delete slim.author_name;
        ({ error } = await db.from('edu_courses').insert(slim));
      }
      if (error) throw new Error(error.message);
      const price = Math.max(0, Math.round(Number(req.body?.price_coins) || 0));
      if (price) {
        await db.from('edu_courses').eq('id', id).update({ price_coins: price });
      }
      if (req.body?.cadence) {
        try {
          await saveCoursePlan(db, id, req.body);
        } catch (planErr) {
          if (!/cadence|column/i.test(planErr.message || '')) throw planErr;
        }
      }
      const groupId = String(req.body?.group_id || '').trim();
      if (groupId) {
        await attachGroupCourse(db, { userId: profile.id, groupId, courseId: id });
      }
      kickoffEduBuild({ courseId: id, org, userId: profile.id });
      res.status(201).json({ course: { id, status: 'building', prompt: row.prompt, level } });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.get('/api/edu/public', authMiddleware(true), async (req, res) => {
    try {
      await ensureWorkspace(req.user);
      const db = getDb();
      let { data, error } = await db
        .from('edu_courses')
        .select('id, user_id, title, summary, author_name, level, status, is_public, cover_url, price_coins, created_at')
        .eq('is_public', 1)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(24);
      if (error && /cover_url|column/i.test(error.message || '') && !/is_public/i.test(error.message || '')) {
        ({ data, error } = await db
          .from('edu_courses')
          .select('id, user_id, title, summary, author_name, level, status, is_public, created_at')
          .eq('is_public', 1)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(24));
      }
      if (error) {
        if (/is_public|column/i.test(error.message || '')) return res.json({ courses: [] });
        throw new Error(error.message);
      }
      const courses = await withCovers(data || []);
      const faces = await avatarMap(db, courses.map((course) => course.user_id));
      res.json({
        courses: courses.map((course) => ({ ...course, avatar_url: faces[course.user_id] || '' })),
      });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  const communityError = (res, err) => {
    const status = err instanceof CommunityError ? err.status : 500;
    const message = status === 500 ? dbMessage(err) : err.message;
    res.status(status).json({ error: { message } });
  };

  app.get('/api/edu/forum', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      res.json(await listForum(getDb(), profile.id));
    } catch (err) {
      communityError(res, err);
    }
  });

  app.post('/api/edu/forum', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      const post = await createForumPost(db, {
        userId: profile.id,
        authorName: accountLearnerName(profile, req.user) || 'Estudiante',
        payload: req.body,
      });
      await award(db, { userId: profile.id, amount: REWARDS.post, reason: 'post', ref: post.id }).catch((err) => {
        console.warn('[edu] monedas', err?.message || err);
      });
      res.status(201).json({ post });
    } catch (err) {
      communityError(res, err);
    }
  });

  app.get('/api/edu/forum/:id', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      res.json(await readForumPost(getDb(), req.params.id, profile.id));
    } catch (err) {
      communityError(res, err);
    }
  });

  app.post('/api/edu/forum/:id/comments', authMiddleware(true), async (req, res) => {
    try {
      await ensureEduSchema();
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      const comment = await addForumComment(db, {
        postId: req.params.id,
        userId: profile.id,
        authorName: accountLearnerName(profile, req.user) || 'Estudiante',
        body: req.body?.body,
        imageUrl: req.body?.image_url,
      });
      await award(db, { userId: profile.id, amount: REWARDS.reply, reason: 'reply', ref: comment.id }).catch((err) => {
        console.warn('[edu] monedas', err?.message || err);
      });
      res.status(201).json({ comment });
    } catch (err) {
      communityError(res, err);
    }
  });

  app.post('/api/edu/forum/:id/like', authMiddleware(true), async (req, res) => {
    try {
      await ensureEduSchema();
      const { profile } = await ensureWorkspace(req.user);
      res.json(await toggleForumLike(getDb(), { postId: req.params.id, userId: profile.id }));
    } catch (err) {
      communityError(res, err);
    }
  });

  app.post('/api/edu/forum/:id/save', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      res.json(await toggleForumSave(getDb(), { postId: req.params.id, userId: profile.id }));
    } catch (err) {
      communityError(res, err);
    }
  });

  app.post('/api/edu/forum/:id/accept', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const post = await acceptForumAnswer(getDb(), {
        postId: req.params.id,
        userId: profile.id,
        commentId: String(req.body?.comment_id || ''),
      });
      res.json({ post });
    } catch (err) {
      communityError(res, err);
    }
  });

  app.get('/api/edu/certificates/verify', async (req, res) => {
    try {
      const code = String(req.query.code || '').trim().toUpperCase();
      if (code.length < 4) {
        return res.status(400).json({ error: { message: 'Escribe el código del certificado.' } });
      }
      const db = getDb();
      const { data, error } = await db
        .from('edu_certificates')
        .select('id, course_id, learner_name, code, issued_at')
        .eq('code', code)
        .limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return res.json({ valid: false });
      const course = await db
        .from('edu_courses')
        .select('id, title')
        .eq('id', row.course_id)
        .limit(1);
      const courseRow = Array.isArray(course.data) ? course.data[0] : course.data;
      res.json({
        valid: true,
        certificate: {
          code: row.code,
          learner_name: row.learner_name,
          issued_at: row.issued_at,
          title: courseRow?.title || 'Curso',
        },
      });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.get('/api/edu/certificates', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data, error } = await db
        .from('edu_certificates')
        .select('id, course_id, learner_name, code, issued_at')
        .eq('user_id', profile.id);
      if (error) throw new Error(error.message);
      const named = [];
      for (const row of data || []) {
        named.push(await repairCertificateName(row, profile, req.user));
      }
      const ids = named.map((row) => row.course_id).filter(Boolean);
      let courses = [];
      if (ids.length) {
        const found = await db
          .from('edu_courses')
          .select('id, title, cover_url')
          .in('id', ids);
        if (!found.error) courses = found.data || [];
      }
      const byId = Object.fromEntries(courses.map((course) => [course.id, course]));
      res.json({
        certificates: named.map((row) => ({
          ...row,
          title: byId[row.course_id]?.title || 'Curso',
          cover_url: byId[row.course_id]?.cover_url || '',
        })),
      });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.get('/api/edu/video', authMiddleware(true), async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().slice(0, 160);
      if (q.length < 2) {
        return res.status(400).json({ error: { message: 'Falta el tema del video' } });
      }
      const video = await findVideo(q);
      res.json({ video });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.get('/api/edu/courses/:id', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const found = await readableCourse(profile.id, req.params.id);
      if (!found) {
        return res.status(404).json({ error: { message: 'Curso no encontrado' } });
      }
      const { course, owner } = found;
      if (owner && course.status === 'building' && !isEduBuildRunning(course.id)) {
        kickoffEduBuild({ courseId: course.id, org, userId: profile.id });
      }
      try {
        await fillMissingVideos(course.id);
      } catch (videoErr) {
        console.error('[edu] videos', course.id, videoErr?.message || videoErr);
      }
      const view = await bundle(profile.id, course);
      const allowed = owner || (await studyAllowed(getDb(), profile.id, course));
      view.locked = !allowed;
      view.enrolled = allowed && !owner;
      if (!allowed) {
        view.modules = view.modules.map((mod) => ({
          ...mod,
          lessons: (mod.lessons || []).map((lesson) => ({
            id: lesson.id,
            position: lesson.position,
            kind: lesson.kind,
            title: lesson.title,
            body: '',
            resources: [],
            video: null,
            quiz: null,
          })),
        }));
      }
      if (view.certificate) {
        const fixed = await repairCertificateName(view.certificate, profile, req.user);
        view.certificate = certificatePayload(fixed);
      }
      const faces = await avatarMap(getDb(), [course.user_id]);
      if (view.course) {
        view.course.user_id = view.course.user_id || course.user_id || '';
        view.course.avatar_url = faces[course.user_id] || '';
      }
      res.json(view);
    } catch (err) {
      console.error('[edu] curso', req.params.id, err?.message || err);
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.post('/api/edu/courses/:id/build', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const course = await ownedCourse(profile.id, req.params.id);
      if (!course) {
        return res.status(404).json({ error: { message: 'Curso no encontrado' } });
      }
      if (course.status === 'ready') {
        return res.json({ ok: true, status: 'ready' });
      }
      const db = getDb();
      const { error } = await db.from('edu_courses').eq('id', course.id).update({
        status: 'building',
        phase: course.phase === 'error' ? 'inicio' : course.phase || 'inicio',
        error: '',
        activity: 'Retomando la creación del curso…',
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      kickoffEduBuild({ courseId: course.id, org, userId: profile.id });
      res.json({ ok: true, status: 'building' });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.post('/api/edu/courses/:id/plan', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const course = await ownedCourse(profile.id, req.params.id);
      if (!course) return res.status(404).json({ error: { message: 'Curso no encontrado' } });
      const plan = await saveCoursePlan(getDb(), course.id, req.body);
      res.json({ plan: { id: course.id, title: course.title || 'Curso', ...plan } });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: { message: err.message || 'No se pudo guardar la constancia' } });
    }
  });

  app.delete('/api/edu/courses/:id', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const course = await ownedCourse(profile.id, req.params.id);
      if (!course) {
        return res.status(404).json({ error: { message: 'Curso no encontrado' } });
      }
      const db = getDb();
      const tables = ['edu_progress', 'edu_certificates', 'edu_lessons', 'edu_modules'];
      for (const table of tables) {
        const { data } = await db.from(table).select('id').eq('course_id', course.id);
        for (const row of data || []) {
          await db.from(table).eq('id', row.id).delete();
        }
      }
      await db.from('edu_courses').eq('id', course.id).delete();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.post(
    '/api/edu/courses/:id/lessons/:lessonId/complete',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { profile } = await ensureWorkspace(req.user);
        const found = await readableCourse(profile.id, req.params.id);
        if (!found) {
          return res.status(404).json({ error: { message: 'Curso no encontrado' } });
        }
        const course = found.course;
        const db = getDb();
        const { data: lesson, error } = await db
          .from('edu_lessons')
          .select('*')
          .eq('id', req.params.lessonId)
          .eq('course_id', course.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!lesson) {
          return res.status(404).json({ error: { message: 'Lección no encontrada' } });
        }
        if (lesson.kind === 'quiz') {
          return res.status(400).json({
            error: { message: 'Este cierre se completa con el quiz.' },
          });
        }
        if (!(await studyAllowed(getDb(), profile.id, course))) {
          return res.status(403).json({ error: { message: 'Inscríbete para abrir este curso.' } });
        }
        await upsertProgress(profile.id, course.id, lesson.id, { completed: 1 });
        await onLessonCompleted(getDb(), {
          userId: profile.id,
          courseId: course.id,
          lessonId: lesson.id,
          moduleId: lesson.module_id,
        });
        const freshFound = await readableCourse(profile.id, course.id);
        const fresh = freshFound?.course || course;
        res.json(await bundle(profile.id, fresh));
      } catch (err) {
        res.status(500).json({ error: { message: dbMessage(err) } });
      }
    }
  );

  app.post(
    '/api/edu/courses/:id/lessons/:lessonId/write',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { profile, org } = await ensureWorkspace(req.user);
        const course = await ownedCourse(profile.id, req.params.id);
        if (!course) {
          return res.status(404).json({ error: { message: 'Curso no encontrado' } });
        }
        const db = getDb();
        const { data: lesson, error } = await db
          .from('edu_lessons')
          .select('*')
          .eq('id', req.params.lessonId)
          .eq('course_id', course.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!lesson || lesson.kind === 'quiz') {
          return res.status(404).json({ error: { message: 'Lección no encontrada' } });
        }
        const { data: moduleRow } = await db
          .from('edu_modules')
          .select('*')
          .eq('id', lesson.module_id)
          .maybeSingle();
        await fillLessonText({
          org,
          userId: profile.id,
          course,
          moduleRow,
          lesson,
        });
        const freshFound = await readableCourse(profile.id, course.id);
        const fresh = freshFound?.course || course;
        res.json(await bundle(profile.id, fresh));
      } catch (err) {
        res.status(500).json({ error: { message: dbMessage(err) } });
      }
    }
  );

  app.post(
    '/api/edu/courses/:id/lessons/:lessonId/quiz',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { profile } = await ensureWorkspace(req.user);
        const found = await readableCourse(profile.id, req.params.id);
        if (!found) {
          return res.status(404).json({ error: { message: 'Curso no encontrado' } });
        }
        const course = found.course;
        const db = getDb();
        const { data: lesson, error } = await db
          .from('edu_lessons')
          .select('*')
          .eq('id', req.params.lessonId)
          .eq('course_id', course.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!lesson || lesson.kind !== 'quiz') {
          return res.status(404).json({ error: { message: 'Quiz no encontrado' } });
        }
        const quiz = parseJson(lesson.quiz_json, null);
        const questions = quiz?.questions || [];
        const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
        let score = 0;
        const review = questions.map((q, i) => {
          const picked = Number(answers[i]);
          const ok = picked === q.answer;
          if (ok) score += 1;
          return {
            prompt: q.prompt,
            choices: q.choices,
            picked: Number.isInteger(picked) ? picked : null,
            answer: q.answer,
            why: q.why,
            ok,
          };
        });
        const needed = passNeeded(questions.length);
        const passed = score >= needed;
        if (!(await studyAllowed(getDb(), profile.id, course))) {
          return res.status(403).json({ error: { message: 'Inscríbete para abrir este curso.' } });
        }
        await upsertProgress(profile.id, course.id, lesson.id, {
          completed: passed ? 1 : 0,
          quiz_score: score,
        });
        if (passed) {
          await onLessonCompleted(getDb(), {
            userId: profile.id,
            courseId: course.id,
            lessonId: lesson.id,
            moduleId: lesson.module_id,
          });
        }
        const freshFound = await readableCourse(profile.id, course.id);
        const fresh = freshFound?.course || course;
        const view = await bundle(profile.id, fresh);
        res.json({
          score,
          total: questions.length,
          needed,
          passed,
          review,
          bundle: view,
        });
      } catch (err) {
        res.status(500).json({ error: { message: dbMessage(err) } });
      }
    }
  );

  app.post('/api/edu/courses/:id/certificate', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const found = await readableCourse(profile.id, req.params.id);
      if (!found) {
        return res.status(404).json({ error: { message: 'Curso no encontrado' } });
      }
      const course = found.course;
      const view = await bundle(profile.id, course);
      if (!allPassed(view)) {
        return res.status(400).json({
          error: { message: 'Termina las lecciones y aprueba los quizzes para el certificado.' },
        });
      }
      const db = getDb();
      const { data: existing } = await db
        .from('edu_certificates')
        .select('*')
        .eq('user_id', profile.id)
        .eq('course_id', course.id)
        .maybeSingle();
      if (existing) {
        const fixed = await repairCertificateName(existing, profile, req.user);
        return res.json({ certificate: certificatePayload(fixed) });
      }
      const name = accountLearnerName(profile, req.user) || 'Estudiante';
      const code = `EDU-${newId().slice(0, 8).toUpperCase()}`;
      const row = {
        id: newId(),
        user_id: profile.id,
        course_id: course.id,
        learner_name: name,
        code,
        issued_at: new Date().toISOString(),
      };
      const { error } = await db.from('edu_certificates').insert(row);
      if (error) {
        if (/duplicate|unique|already/i.test(error.message || '')) {
          const { data: again } = await db
            .from('edu_certificates')
            .select('*')
            .eq('user_id', profile.id)
            .eq('course_id', course.id)
            .maybeSingle();
          if (again) {
            const fixed = await repairCertificateName(again, profile, req.user);
            return res.json({ certificate: certificatePayload(fixed) });
          }
        }
        throw new Error(error.message);
      }
      res.status(201).json({ certificate: certificatePayload(row) });
    } catch (err) {
      res.status(500).json({ error: { message: dbMessage(err) } });
    }
  });

  app.post('/api/edu/courses/:id/certificate/email', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const found = await readableCourse(profile.id, req.params.id);
      if (!found) {
        return res.status(404).json({ error: { message: 'Curso no encontrado' } });
      }
      const course = found.course;
      const db = getDb();
      const { data: existing, error: certErr } = await db
        .from('edu_certificates')
        .select('*')
        .eq('user_id', profile.id)
        .eq('course_id', course.id)
        .maybeSingle();
      if (certErr) throw new Error(certErr.message);
      if (!existing) {
        return res.status(400).json({
          error: { message: 'Primero emite el certificado.' },
        });
      }
      const to = String(profile.email || req.user?.email || '').trim();
      if (!to) {
        return res.status(400).json({
          error: { message: 'Tu cuenta no tiene un correo para enviar el diploma.' },
        });
      }
      const waitKey = `${profile.id}:${course.id}`;
      const last = lastCertMail.get(waitKey) || 0;
      if (Date.now() - last < CERT_MAIL_COOLDOWN_MS) {
        return res.status(429).json({
          error: { message: 'Acabamos de enviarlo. Espera un momento para reenviarlo.' },
        });
      }
      const pdf = pdfFromBody(req.body);
      const cert = await repairCertificateName(existing, profile, req.user);
      const letter = certificateEmail({
        name: cert.learner_name,
        courseTitle: course.title,
        code: cert.code,
        issuedLabel: issuedLabel(cert.issued_at),
      });
      const safeCode = String(cert.code || 'certificado').replace(/[^\w-]+/g, '') || 'certificado';
      await sendAppMail({
        to,
        ...letter,
        attachments: [
          {
            filename: `Certificado-${safeCode}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      });
      lastCertMail.set(waitKey, Date.now());
      res.json({ ok: true, email: to });
    } catch (err) {
      const status = Number(err.status) || 500;
      res.status(status).json({ error: { message: err.message || 'No pude enviar el correo' } });
    }
  });
}

async function upsertProgress(userId, courseId, lessonId, fields) {
  const db = getDb();
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await db
    .from('edu_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (existing) {
    const { error } = await db.from('edu_progress').eq('id', existing.id).update({
      completed: fields.completed,
      quiz_score: fields.quiz_score == null ? existing.quiz_score : fields.quiz_score,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const payload = {
    id: newId(),
    user_id: userId,
    course_id: courseId,
    lesson_id: lessonId,
    completed: fields.completed ? 1 : 0,
    updated_at: now,
  };
  if (fields.quiz_score != null) payload.quiz_score = fields.quiz_score;
  const { error } = await db.from('edu_progress').insert(payload);
  if (error) {
    if (/duplicate|unique|already/i.test(error.message || '')) {
      const { data: again } = await db
        .from('edu_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle();
      if (again) {
        await db.from('edu_progress').eq('id', again.id).update({
          completed: fields.completed,
          quiz_score: fields.quiz_score == null ? again.quiz_score : fields.quiz_score,
          updated_at: now,
        });
        return;
      }
    }
    throw new Error(error.message);
  }
}
