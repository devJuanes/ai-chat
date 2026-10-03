import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import { checkUsage, bumpUsage } from '../auth.js';
import {
  completeUpstreamChat,
  estimateTokens,
  stripThinkTags,
} from '../upstream.js';

const MODEL_ID = 'edu-creator';
const running = new Set();

const SYSTEM = `Eres EduCreator, de Matu AI. Diseñas cursos para que una persona aprenda de verdad.
Escribes en español claro, con ejemplos concretos. No copies las fuentes: úsalas como brújula y cita el enlace si aporta.
No hagas la tarea del estudiante: enseña, muestra un ejemplo y deja un ejercicio corto.
Responde solo JSON válido, sin texto alrededor y sin bloques markdown.`;

export function isEduBuildRunning(courseId) {
  return running.has(courseId);
}

export function kickoffEduBuild({ courseId, org, userId }) {
  if (!courseId || running.has(courseId)) return false;
  running.add(courseId);
  runBuild({ courseId, org, userId })
    .catch((err) => {
      console.error('[edu]', courseId, err?.message || err);
    })
    .finally(() => running.delete(courseId));
  return true;
}

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function closeJson(slice) {
  let s = String(slice || '').trim().replace(/,\s*$/, '');
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
  }
  if (inStr) s = s.replace(/,?\s*"[^"]*$/, '');
  s = s.replace(/,\s*$/, '');
  const openers = [];
  inStr = false;
  esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{' || ch === '[') openers.push(ch);
    else if ((ch === '}' || ch === ']') && openers.length) openers.pop();
  }
  while (openers.length) {
    const open = openers.pop();
    s += open === '{' ? '}' : ']';
  }
  return s.replace(/,\s*([}\]])/g, '$1');
}

function extractJson(text) {
  const clean = stripThinkTags(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u201c\u201d]/g, '"');
  const sources = [clean];
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) sources.unshift(fenced[1]);

  let lastErr = null;
  for (const source of sources) {
    const start = source.indexOf('{');
    if (start < 0) continue;
    const end = source.lastIndexOf('}');
    const slices = [source.slice(start)];
    if (end > start) slices.unshift(source.slice(start, end + 1));
    for (const slice of slices) {
      const attempts = [slice, closeJson(slice)];
      for (const candidate of attempts) {
        try {
          return JSON.parse(candidate);
        } catch (err) {
          lastErr = err;
        }
      }
    }
  }

  console.warn('[edu] JSON no parseable:', lastErr?.message || 'sin objeto', clean.slice(0, 400));
  const err = new Error(
    'El modelo contestó, pero el formato se cortó. Reintenta: sigue desde lo que ya quedó escrito.'
  );
  err.cause = lastErr;
  throw err;
}

function isNetErr(err) {
  return /conectar con el modelo|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|network|socket/i.test(
    String(err?.message || err || '')
  );
}

async function withNetRetry(fn) {
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isNetErr(err) || attempt === 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw last;
}

function asMarkdown(text) {
  let clean = stripThinkTags(text || '').trim();
  const wrapped = clean.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  if (wrapped?.[1]) clean = wrapped[1].trim();
  return clean.replace(/^\s*json\s*/i, '').trim();
}

async function readCourse(courseId) {
  const db = getDb();
  const { data, error } = await db
    .from('edu_courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Curso no encontrado');
  return data;
}

async function patchCourse(courseId, fields) {
  const db = getDb();
  const { error } = await db
    .from('edu_courses')
    .eq('id', courseId)
    .update({ ...fields, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function logStep(courseId, text, extra = {}) {
  const course = await readCourse(courseId);
  const log = parseJson(course.log_json, []);
  const next = Array.isArray(log) ? log.slice(-39) : [];
  next.push({ at: new Date().toISOString(), text });
  await patchCourse(courseId, {
    log_json: JSON.stringify(next),
    activity: text,
    ...extra,
  });
}

async function askJson({ org, userId, user, maxTokens }) {
  const gate = await checkUsage(org, userId, MODEL_ID);
  if (!gate.ok) {
    const err = new Error(gate.error || 'Cuota de EduCreator agotada este mes');
    err.code = 'quota';
    throw err;
  }

  let prompt = user;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await withNetRetry(() =>
      completeUpstreamChat({
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
        signal: AbortSignal.timeout(100000),
      })
    );
    await bumpUsage(
      org,
      userId,
      estimateTokens(`${SYSTEM}\n${prompt}`),
      estimateTokens(text),
      MODEL_ID
    ).catch(() => {});
    try {
      return extractJson(text);
    } catch (err) {
      lastErr = err;
      prompt = `${user}\n\nLa respuesta anterior no era JSON válido. Responde únicamente el objeto JSON.`;
    }
  }
  console.warn('[edu] JSON inválido tras 2 intentos');
  throw lastErr || new Error('No pude leer la respuesta del modelo');
}

async function askText({ org, userId, user, maxTokens }) {
  const gate = await checkUsage(org, userId, MODEL_ID);
  if (!gate.ok) {
    const err = new Error(gate.error || 'Cuota de EduCreator agotada este mes');
    err.code = 'quota';
    throw err;
  }

  let prompt = user;
  let best = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await withNetRetry(() =>
      completeUpstreamChat({
        system: `${SYSTEM}
Cuando te pidan una lección, responde solo el markdown de esa lección. Sin JSON. Sin preámbulo.`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
        signal: AbortSignal.timeout(100000),
      })
    );
    await bumpUsage(
      org,
      userId,
      estimateTokens(prompt),
      estimateTokens(text),
      MODEL_ID
    ).catch(() => {});
    const clean = asMarkdown(text);
    if (clean.length > best.length) best = clean;
    if (clean.length >= 700) return clean.slice(0, 14000);
    prompt = `${user}\n\nLa respuesta anterior no sirve: estaba vacía o era JSON. Escribe la lección completa en markdown, lista para leer.`;
  }
  if (best.length >= 280) return best.slice(0, 14000);
  throw new Error('La lección llegó sin texto para leer');
}

async function researchTopic(topic) {
  const q = String(topic || '').slice(0, 180);
  const sources = [];
  const headers = { 'User-Agent': 'MatuAI-EduCreator/1.0 (https://matubyte.com)' };

  try {
    const searchRes = await fetch(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=1&format=json&srlimit=3`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    const searchJson = await searchRes.json();
    const hits = searchJson?.query?.search || [];
    for (const hit of hits.slice(0, 2)) {
      const title = String(hit.title || '').trim();
      if (!title) continue;
      try {
        const extRes = await fetch(
          `https://es.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=960&titles=${encodeURIComponent(title)}&format=json&utf8=1`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        const extJson = await extRes.json();
        const pages = Object.values(extJson?.query?.pages || {});
        const excerpt = String(pages[0]?.extract || hit.snippet || '')
          .replace(/<[^>]+>/g, '')
          .slice(0, 420);
        sources.push({
          title,
          url: `https://es.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          excerpt,
          image: pages[0]?.thumbnail?.source || '',
        });
      } catch {
        sources.push({
          title,
          url: `https://es.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          excerpt: '',
        });
      }
    }
  } catch {
    /* seguimos sin Wikipedia */
  }

  try {
    const ddg = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { headers, signal: AbortSignal.timeout(7000) }
    );
    const data = await ddg.json();
    if (data?.AbstractText) {
      sources.push({
        title: String(data.Heading || 'Referencia').slice(0, 160),
        url: String(data.AbstractURL || ''),
        excerpt: String(data.AbstractText).slice(0, 420),
      });
    }
  } catch {
    /* seguimos sin DuckDuckGo */
  }

  try {
    const gh = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=2&sort=stars`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'MatuAI-EduCreator/1.0',
        },
        signal: AbortSignal.timeout(7000),
      }
    );
    const data = await gh.json();
    for (const repo of (data.items || []).slice(0, 2)) {
      if (!repo?.html_url) continue;
      sources.push({
        title: String(repo.full_name || repo.name || 'Repositorio').slice(0, 160),
        url: repo.html_url,
        excerpt: String(repo.description || '').slice(0, 240),
      });
    }
  } catch {
    /* seguimos sin GitHub */
  }

  return sources.slice(0, 6);
}

const videoTried = new Set();
const videoJobs = new Map();

const VIDEO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'es',
};

const STOP_WORDS = new Set([
  'como', 'para', 'con', 'los', 'las', 'una', 'uno', 'del', 'que', 'por', 'mas',
  'desde', 'cero', 'curso', 'leccion', 'modulo', 'datos', 'usar', 'uso', 'sobre',
  'este', 'esta', 'esto', 'entre', 'hacia', 'donde', 'cuando', 'porque',
]);

function fold(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokens(text) {
  return fold(text)
    .split(/[^a-z0-9+#]+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function courseSubject(course) {
  const title = String(course?.title || '')
    .replace(/^curso de\s+/i, '')
    .trim();
  const asked = String(course?.prompt || '')
    .split(/[.\n]/)[0]
    .trim();
  const head = [title, asked].filter(Boolean).join(' ');
  const words = [];
  for (const word of tokens(head)) {
    if (words.includes(word)) continue;
    words.push(word);
    if (words.length >= 8) break;
  }
  return words.join(' ');
}

const GENERIC_KEYS = new Set([
  'filtrar', 'ordenar', 'buscar', 'crear', 'hacer', 'aprender', 'introduccion',
  'basico', 'parte', 'quiero', 'aprender', 'entender', 'basicas', 'basico',
]);

function lessonKeys(lessonTitle) {
  const words = tokens(lessonTitle).filter((word) => word.length >= 3);
  const specific = words.filter((word) => !GENERIC_KEYS.has(word));
  return specific.length ? specific : words;
}

function titleFits(videoTitle, lessonTitle, subject) {
  const title = fold(videoTitle);
  const lesson = lessonKeys(lessonTitle);
  const about = tokens(subject).filter((word) => !GENERIC_KEYS.has(word));
  if (!lesson.length || !lesson.some((word) => title.includes(word))) return false;
  if (about.length && !about.some((word) => title.includes(word))) return false;
  return true;
}

function textFits(text, lessonTitle, subject) {
  const blob = fold(text);
  const lesson = lessonKeys(lessonTitle);
  const about = tokens(subject);
  if (lesson.length && !lesson.some((word) => blob.includes(word))) return false;
  if (about.length && !about.some((word) => blob.includes(word))) return false;
  return true;
}

async function youtubeHits(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=es`;
  const res = await fetch(url, { headers: VIDEO_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const html = await res.text();
  const re = /"videoId":"([a-zA-Z0-9_-]{11})".{0,500}?"title":\{"runs":\[\{"text":"(.*?)"\}/g;
  const hits = [];
  const seen = new Set();
  let match;
  while ((match = re.exec(html)) && hits.length < 6) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    hits.push({
      id: match[1],
      title: match[2].replace(/\\u0026/g, '&').replace(/&amp;/g, '&'),
    });
  }
  return hits;
}

function cuesFromCaption(body) {
  const raw = String(body || '');
  if (!raw.trim()) return null;
  if (raw.includes('"events"')) {
    try {
      const data = JSON.parse(raw);
      return (data.events || [])
        .map((event) => ({
          start: Math.max(0, Math.floor((event.tStartMs || 0) / 1000)),
          text: (event.segs || []).map((seg) => seg.utf8 || '').join(''),
        }))
        .filter((cue) => cue.text.trim());
    } catch {
      return null;
    }
  }
  const cues = [];
  const re = /<text[^>]*start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = re.exec(raw))) {
    cues.push({
      start: Math.max(0, Math.floor(Number(match[1]) || 0)),
      text: match[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'"),
    });
  }
  return cues.length ? cues : null;
}

async function captionCues(youtubeId) {
  try {
    const watch = await fetch(`https://www.youtube.com/watch?v=${youtubeId}&hl=es`, {
      headers: VIDEO_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (!watch.ok) return null;
    const page = await watch.text();
    const raw = page.match(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]*lang=es[^"]*)"/);
    if (!raw) return null;
    const url = raw[1].replace(/\\u0026/g, '&');
    const caps = await fetch(url, { headers: VIDEO_HEADERS, signal: AbortSignal.timeout(5000) });
    if (!caps.ok) return null;
    return cuesFromCaption(await caps.text());
  } catch {
    return null;
  }
}

function startFor(cues, lessonTitle) {
  const keys = lessonKeys(lessonTitle);
  const hit = cues.find((cue) => keys.some((word) => fold(cue.text).includes(word)));
  if (!hit) return 0;
  return Math.max(0, hit.start - 2);
}

const COVER_LOOK = [
  [/derivad|calculo/, 'calculus chalkboard mathematics'],
  [/\bsql\b/, 'sql database code on computer'],
  [/\bgit\b/, 'software code on laptop screen'],
  [/docker|contenedor/, 'server room data center computers'],
  [/javascript/, 'javascript code on screen'],
  [/python/, 'python code on laptop'],
  [/react\b/, 'web developer code editor'],
  [/html|css|pagina web/, 'web design on computer'],
  [/contabil/, 'accounting calculator documents'],
  [/fotograf|camara/, 'camera photography'],
  [/excel|hoja de calculo/, 'spreadsheet on laptop'],
  [/cocina|receta/, 'cooking in a kitchen'],
  [/musica/, 'musical instrument close up'],
  [/ingles|idioma/, 'language learning books'],
  [/marketing/, 'marketing laptop workspace'],
  [/diseno grafico|diseno/, 'graphic design desk'],
  [/finanz|inversion/, 'finance charts on desk'],
  [/historia/, 'history books in library'],
  [/biolog/, 'biology microscope laboratory'],
  [/quimic/, 'chemistry laboratory glassware'],
  [/fisic/, 'physics experiment laboratory'],
  [/matematic|algebra|geometr/, 'mathematics chalkboard equations'],
];

const NATURE_ALT = /\b(forest|woods|bridge|ocean|sea|ship|sail|mountain|river|cliff|fog|mist|landscape|hiking|trail|coast)\b/;

function coverQuery(title, prompt) {
  const blob = fold(`${title || ''} ${prompt || ''}`);
  for (const [pattern, query] of COVER_LOOK) {
    if (pattern.test(blob)) return query;
  }
  const words = tokens(blob).filter((word) => !GENERIC_KEYS.has(word)).slice(0, 4);
  return words.join(' ') || 'student learning at a desk';
}

function photoScore(photo, query) {
  const alt = fold(photo?.alt || '');
  let score = 0;
  for (const word of query.split(/\s+/)) {
    if (word.length >= 3 && alt.includes(word)) score += 3;
  }
  if (NATURE_ALT.test(alt) && !NATURE_ALT.test(query)) score -= 6;
  return score;
}

export function coverNeedsPhoto(url) {
  return !String(url || '').includes('images.pexels.com');
}

const coverPools = new Map();
let coverWarned = false;

async function pexelsPool(query) {
  if (coverPools.has(query)) return coverPools.get(query);
  const key = config.pexels.apiKey;
  if (!key) {
    if (!coverWarned) {
      coverWarned = true;
      console.warn('[edu] Falta PEXELS_API_KEY. Las portadas no se pueden buscar en Pexels.');
    }
    return [];
  }
  const job = (async () => {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '15');
    url.searchParams.set('orientation', 'landscape');
    const res = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const photos = Array.isArray(json.photos) ? json.photos : [];
    return photos
      .map((photo) => ({
        src: photo?.src?.large || photo?.src?.landscape || photo?.src?.medium || '',
        score: photoScore(photo, query),
      }))
      .filter((item) => item.src)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.src);
  })().catch(() => []);
  coverPools.set(query, job);
  const found = await job;
  if (!found.length) coverPools.delete(query);
  return found;
}

export async function findCourseCover(title, prompt = '') {
  const query = coverQuery(title, prompt);
  const pool = await pexelsPool(query);
  if (!pool.length) return '';
  const seed = String(title || query);
  let pick = 0;
  for (let i = 0; i < seed.length; i += 1) pick = (pick + seed.charCodeAt(i)) % pool.length;
  return pool[pick];
}

function emptyVideo() {
  return { title: '', youtubeId: '', url: '', start: 0, checked: true, search: false };
}

export async function findVideo(lessonTitle, course = {}) {
  const lesson = String(lessonTitle || '').replace(/^\d+(?:\.\d+)*\s*/, '').trim();
  if (!lesson) return emptyVideo();
  const subject = courseSubject(course);
  const query = subject ? `cómo ${lesson} en ${subject}` : lesson;
  try {
    const hits = await youtubeHits(query);
    let fallback = null;
    let checked = 0;
    for (const hit of hits) {
      if (!titleFits(hit.title, lesson, subject)) continue;
      if (!fallback) fallback = hit;
      if (checked >= 2) break;
      checked += 1;
      const cues = await captionCues(hit.id);
      if (cues?.length && !textFits(cues.map((cue) => cue.text).join(' '), lesson, subject)) {
        continue;
      }
      return {
        title: hit.title.slice(0, 180),
        youtubeId: hit.id,
        url: `https://www.youtube.com/watch?v=${hit.id}`,
        start: cues?.length ? startFor(cues, lesson) : 0,
        checked: true,
        search: false,
      };
    }
    if (fallback) {
      return {
        title: fallback.title.slice(0, 180),
        youtubeId: fallback.id,
        url: `https://www.youtube.com/watch?v=${fallback.id}`,
        start: 0,
        checked: true,
        search: false,
      };
    }
  } catch {
    return { title: '', youtubeId: '', url: '', start: 0, checked: false, search: false };
  }
  return emptyVideo();
}

export function fillMissingVideos(courseId) {
  if (videoJobs.has(courseId)) return videoJobs.get(courseId);
  const job = saveMissingVideos(courseId).finally(() => videoJobs.delete(courseId));
  videoJobs.set(courseId, job);
  return job;
}

async function saveMissingVideos(courseId) {
  const db = getDb();
  const [{ data: course, error: courseErr }, { data, error }] = await Promise.all([
    db.from('edu_courses').select('id, title, prompt').eq('id', courseId).maybeSingle(),
    db.from('edu_lessons').select('id, title, kind, video_json').eq('course_id', courseId),
  ]);
  if (courseErr) throw new Error(courseErr.message);
  if (error) throw new Error(error.message);
  const pending = (data || []).filter((lesson) => {
    if (lesson.kind === 'quiz' || videoTried.has(lesson.id)) return false;
    return parseJson(lesson.video_json, {})?.checked !== true;
  });
  const queue = pending.slice();
  const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
    while (queue.length) {
      const lesson = queue.shift();
      if (!lesson) return;
      videoTried.add(lesson.id);
      const found = await findVideo(lesson.title, course || {});
      const { error: updErr } = await db.from('edu_lessons').eq('id', lesson.id).update({
        video_json: JSON.stringify(found || emptyVideo()),
      });
      if (updErr) console.error('[edu] video', lesson.id, updErr.message);
    }
  });
  await Promise.all(workers);
}

function lessonResources(title, markdown, sources) {
  const note = String(markdown || '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const items = [{ kind: 'doc', title: `Apunte · ${title}`, note }];
  const image = (sources || []).find((item) => item.image);
  if (image) {
    items.push({
      kind: 'image',
      title: image.title,
      url: image.image,
      note: 'Imagen de referencia',
    });
  }
  for (const source of (sources || []).filter((item) => item.url).slice(0, 4)) {
    const pdf = /\.pdf(\?|$)/i.test(source.url);
    items.push({
      kind: pdf ? 'pdf' : 'link',
      title: source.title,
      url: source.url,
      note: String(source.excerpt || 'Fuente consultada').slice(0, 180),
    });
  }
  return items;
}

function sourceBlock(sources) {
  if (!sources?.length) return 'No hay fuentes externas. Explica con rigor y sin inventar citas.';
  return sources
    .map(
      (s, i) =>
        `${i + 1}. ${s.title}${s.url ? ` — ${s.url}` : ''}${s.excerpt ? `\n${s.excerpt}` : ''}`
    )
    .join('\n');
}

function levelLine(level) {
  if (level === 'avanzado') return 'Nivel: profundidad. Asume bases y ve a matices, errores comunes y criterio.';
  if (level === 'intermedio') return 'Nivel: con bases. Conecta lo que ya sabe con lo que le falta.';
  return 'Nivel: desde cero. Define cada término la primera vez que aparece.';
}

function asOutline(raw) {
  const modules = Array.isArray(raw?.modules) ? raw.modules : [];
  const clean = modules.slice(0, 5).map((mod) => {
    const lessons = (Array.isArray(mod?.lessons) ? mod.lessons : [])
      .slice(0, 4)
      .map((lesson) => ({
        title: String(lesson?.title || 'Lección').slice(0, 140),
        goal: String(lesson?.goal || '').slice(0, 240),
      }))
      .filter((lesson) => lesson.title);
    return {
      title: String(mod?.title || 'Módulo').slice(0, 140),
      summary: String(mod?.summary || '').slice(0, 320),
      lessons,
    };
  }).filter((mod) => mod.lessons.length >= 1);

  if (!clean.length) {
    throw new Error('El mapa del curso llegó incompleto');
  }
  return {
    title: String(raw?.title || 'Curso').slice(0, 140),
    summary: String(raw?.summary || '').slice(0, 400),
    modules: clean,
  };
}

function asQuiz(raw) {
  const quiz = raw?.quiz || raw;
  const questions = (Array.isArray(quiz?.questions) ? quiz.questions : [])
    .slice(0, 4)
    .map((q) => {
      const choices = (Array.isArray(q?.choices) ? q.choices : [])
        .map((choice) => String(choice).slice(0, 220))
        .slice(0, 4);
      while (choices.length < 4) choices.push('Ninguna de las anteriores');
      let answer = Number(q?.answer);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) answer = 0;
      return {
        prompt: String(q?.prompt || '').slice(0, 360),
        choices,
        answer,
        why: String(q?.why || '').slice(0, 360),
      };
    })
    .filter((q) => q.prompt);

  if (questions.length < 3) {
    throw new Error('El quiz llegó incompleto');
  }

  return {
    title: String(quiz?.title || raw?.title || 'Quiz del módulo').slice(0, 140),
    questions,
  };
}

async function listModules(courseId) {
  const db = getDb();
  const { data, error } = await db
    .from('edu_modules')
    .select('*')
    .eq('course_id', courseId);
  if (error) throw new Error(error.message);
  return (data || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
}

async function lessonsOf(moduleId) {
  const db = getDb();
  const { data, error } = await db
    .from('edu_lessons')
    .select('*')
    .eq('module_id', moduleId);
  if (error) throw new Error(error.message);
  return (data || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
}

async function runBuild({ courseId, org, userId }) {
  try {
    const course = await readCourse(courseId);
    if (course.status === 'ready') return;

    let sources = parseJson(course.sources_json, []);
    if (!Array.isArray(sources) || !sources.length) {
      await logStep(courseId, 'Buscando documentos y referencias públicas…', {
        phase: 'investigando',
        status: 'building',
        error: '',
      });
      sources = await researchTopic(course.prompt);
      await patchCourse(courseId, { sources_json: JSON.stringify(sources) });
      await logStep(
        courseId,
        sources.length
          ? `Encontré ${sources.length} fuentes para orientar el curso.`
          : 'Sigo sin fuentes externas. El curso sale de una explicación propia.',
        { phase: 'investigando' }
      );
    }

    let modules = await listModules(courseId);
    if (!modules.length) {
      await logStep(courseId, 'Diseñando módulos, lecciones y el cierre de cada módulo…', {
        phase: 'mapa',
      });
      const outline = asOutline(
        await askJson({
          org,
          userId,
          maxTokens: 1800,
          user: `Arma el mapa de un curso.
Tema que la persona quiere aprender: ${course.prompt}
${levelLine(course.level)}

Fuentes (brújula, no para copiar):
${sourceBlock(sources)}

Devuelve JSON:
{
  "title": "título concreto del curso",
  "summary": "dos frases: qué va a saber hacer al terminar",
  "modules": [
    {
      "title": "módulo",
      "summary": "qué cubre",
      "lessons": [
        { "title": "lección", "goal": "qué entiende al terminar" }
      ]
    }
  ]
}
Elige la extensión según el tema. Algo simple, como preparar una limonada, puede ser 1 módulo y 1 o 2 lecciones. Un oficio o una herramienta amplia puede llegar a 4 o 5 módulos, con 2 a 4 lecciones cada uno. Nunca pases de 5 módulos ni de 4 lecciones por módulo. Orden de lo básico a lo que ya se puede hacer. Sin quiz en este JSON.`,
        })
      );

      const db = getDb();
      for (let i = 0; i < outline.modules.length; i += 1) {
        const mod = outline.modules[i];
        const plan = [
          ...mod.lessons.map((lesson) => lesson.title),
          'Quiz del módulo',
        ];
        const { error } = await db.from('edu_modules').insert({
          id: newId(),
          course_id: courseId,
          position: i,
          title: mod.title,
          summary: mod.summary,
          status: 'pending',
          plan_json: JSON.stringify(plan),
        });
        if (error) throw new Error(error.message);
      }
      await patchCourse(courseId, {
        title: outline.title,
        summary: outline.summary,
      });
      course.title = outline.title;
      course.summary = outline.summary;
      if (coverNeedsPhoto(course.cover_url)) {
        const cover_url = await findCourseCover(outline.title || course.prompt, course.prompt);
        if (cover_url) {
          try {
            await patchCourse(courseId, { cover_url });
            course.cover_url = cover_url;
          } catch (err) {
            if (!/cover_url|column/i.test(String(err?.message || err))) throw err;
          }
        }
      }
      await logStep(courseId, `Mapa listo: ${outline.title}.`, { phase: 'mapa' });
      modules = await listModules(courseId);
    } else if (!course.title) {
      await patchCourse(courseId, {
        title: course.title || 'Tu curso',
      });
    }

    for (const mod of modules) {
      if (mod.status === 'ready') continue;
      const existing = await lessonsOf(mod.id);
      const db = getDb();
      await db.from('edu_modules').eq('id', mod.id).update({ status: 'writing' });
      await logStep(courseId, `Escribiendo el módulo «${mod.title}»…`, {
        phase: 'escribiendo',
      });

      const plan = parseJson(mod.plan_json, []);
      const lessonTitles = (Array.isArray(plan) ? plan : [])
        .map((item) => String(item || '').trim())
        .filter((item) => item && !/^quiz/i.test(item));
      const titles = lessonTitles.length
        ? lessonTitles.slice(0, 4)
        : ['Para qué sirve', 'Cómo se hace', 'Practícalo'];

      for (let i = 0; i < titles.length; i += 1) {
        const title = titles[i];
        const prev = existing.find(
          (row) => row.kind !== 'quiz' && Number(row.position) === i
        );
        if (prev && String(prev.body_md || '').trim().length >= 280) {
          await logStep(courseId, `Ya estaba escrita: ${prev.title || title}.`, {
            phase: 'escribiendo',
          });
          continue;
        }
        await logStep(courseId, `Escribiendo «${title}»…`, { phase: 'escribiendo' });
        const markdown = await askText({
          org,
          userId,
          maxTokens: 2200,
          user: `Escribe la lección «${title}» del módulo «${mod.title}».
Curso: ${course.title || course.prompt}
De qué va el módulo: ${mod.summary || course.prompt}
${levelLine(course.level)}
Tema que la persona quiere aprender: ${course.prompt}

Fuentes, solo como brújula. No copies párrafos:
${sourceBlock(sources)}

Escribe para que se pueda leer, no un muro de texto. Español claro, frases cortas.
No repitas el título de la lección.
Usa markdown de verdad:
- Párrafos de 2 a 4 frases, separados por una línea en blanco.
- Un ## por cada parte: qué va a entender, el ejemplo, los pasos.
- Una lista cuando enumeres reglas, operadores o pasos.
- Cada consulta, comando o código va en un bloque con triple comilla y el lenguaje, por ejemplo \`\`\`sql. Nunca dejes el código suelto en el párrafo.
- Negrita solo en el término nuevo.
Entre 350 y 550 palabras.
Cierra con un apartado que empiece exactamente por "## Práctica" y un ejercicio concreto, sin la solución.
Si el tema es código, SQL o algo que se hace con las manos, el ejercicio es algo que la persona escribe o hace.
No uses JSON. No escribas el quiz. No saludes.`,
        });
        const video = await findVideo(title, course);
        const lessonRow = {
          course_id: courseId,
          module_id: mod.id,
          position: i,
          kind: 'lesson',
          title,
          body_md: markdown,
          resources_json: JSON.stringify(lessonResources(title, markdown, sources)),
          video_json: JSON.stringify(video || {}),
          quiz_json: '',
        };
        const { error } = prev
          ? await db.from('edu_lessons').eq('id', prev.id).update(lessonRow)
          : await db.from('edu_lessons').insert({ id: newId(), ...lessonRow });
        if (error) throw new Error(error.message);
        await logStep(courseId, `Lección lista para leer: ${title}.`, {
          phase: 'escribiendo',
        });
      }

      const prevQuiz = existing.find((row) => row.kind === 'quiz');
      const savedQuiz = parseJson(prevQuiz?.quiz_json, null);
      if (savedQuiz?.questions?.length >= 3) {
        await logStep(courseId, `El quiz de «${mod.title}» ya estaba.`, {
          phase: 'escribiendo',
        });
      } else {
      await logStep(courseId, `Armando el quiz de «${mod.title}»…`, {
        phase: 'escribiendo',
      });
      const quiz = asQuiz(
        await askJson({
          org,
          userId,
          maxTokens: 1400,
          user: `Escribe un quiz de 4 preguntas sobre el módulo «${mod.title}».
Lecciones: ${titles.join(' | ')}
Tema: ${course.prompt}
Solo JSON, sin markdown y sin bloques de código:
{
  "title": "Quiz: ${mod.title}",
  "questions": [
    { "prompt": "", "choices": ["", "", "", ""], "answer": 0, "why": "" }
  ]
}
answer es el índice correcto, de 0 a 3. why explica en una frase.`,
        })
      );

      const quizRow = {
        course_id: courseId,
        module_id: mod.id,
        position: titles.length,
        kind: 'quiz',
        title: quiz.title,
        body_md:
          'Cierra el módulo con este quiz. Necesitas aprobar para seguir. Si fallas, puedes intentarlo otra vez.',
        resources_json: '[]',
        video_json: '{}',
        quiz_json: JSON.stringify(quiz),
      };
      const { error: quizErr } = prevQuiz
        ? await db.from('edu_lessons').eq('id', prevQuiz.id).update(quizRow)
        : await db.from('edu_lessons').insert({ id: newId(), ...quizRow });
      if (quizErr) throw new Error(quizErr.message);
      }

      await db.from('edu_modules').eq('id', mod.id).update({ status: 'ready' });
      await logStep(courseId, `Módulo listo: ${mod.title}. El quiz quedó al final.`, {
        phase: 'escribiendo',
      });
    }

    if (sources.length) {
      const db = getDb();
      const { data: firstRows } = await db
        .from('edu_lessons')
        .select('*')
        .eq('course_id', courseId);
      const firstMod = modules[0];
      const first = (firstRows || []).find(
        (row) =>
          row.module_id === firstMod?.id &&
          row.kind === 'lesson' &&
          Number(row.position) === 0
      );
      if (first) {
        const resources = parseJson(first.resources_json, []);
        const extras = sources
          .filter((s) => s.url)
          .map((s) => ({
            kind: 'link',
            title: s.title,
            url: s.url,
            note: 'Fuente consultada al armar el curso',
          }));
        const seen = new Set();
        const merged = [];
        for (const item of [...(Array.isArray(resources) ? resources : []), ...extras]) {
          const key = `${item.kind}|${item.title}|${item.url || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(item);
          if (merged.length >= 8) break;
        }
        await db.from('edu_lessons').eq('id', first.id).update({
          resources_json: JSON.stringify(merged),
        });
      }
    }

    await logStep(courseId, 'Curso listo. Ya puedes estudiarlo.', {
      status: 'ready',
      phase: 'listo',
      error: '',
    });
  } catch (err) {
    const message = isNetErr(err)
      ? 'Se cortó la conexión con el modelo. Lo que ya se escribió se conserva. Pulsa Reintentar.'
      : err?.message || 'No se pudo crear el curso';
    try {
      const modules = await listModules(courseId);
      const ready = modules.some((mod) => mod.status === 'ready');
      if (err?.code === 'quota' && ready) {
        await logStep(
          courseId,
          'La cuota de este mes se acabó. Puedes estudiar lo que ya quedó armado.',
          { status: 'ready', phase: 'listo', error: '' }
        );
        return;
      }
      await patchCourse(courseId, {
        status: 'failed',
        phase: 'error',
        activity: 'No se pudo terminar el curso',
        error: message.slice(0, 400),
      });
    } catch (inner) {
      console.error('[edu] no pude guardar el error', inner?.message || inner);
    }
  }
}

export async function fillLessonText({ org, userId, course, moduleRow, lesson }) {
  const markdown = await askText({
    org,
    userId,
    maxTokens: 2200,
    user: `Escribe la lección «${lesson.title}» del módulo «${moduleRow?.title || 'Módulo'}».
Curso: ${course.title || course.prompt}
Tema: ${course.prompt}
${levelLine(course.level)}

Escribe para que se pueda leer, no un muro de texto. Español claro, frases cortas.
No repitas el título. Párrafos cortos, ## para cada parte, listas si enumeras, y el código en un bloque \`\`\`sql.
Cierra con "## Práctica" y un ejercicio sin la solución.
No uses JSON. No escribas un quiz.`,
  });
  const video = await findVideo(lesson.title, course);
  const db = getDb();
  const { error } = await db.from('edu_lessons').eq('id', lesson.id).update({
    body_md: markdown,
    resources_json: JSON.stringify(
      lessonResources(lesson.title, markdown, parseJson(course.sources_json, []))
    ),
    video_json: JSON.stringify(video || {}),
  });
  if (error) throw new Error(error.message);
  return markdown;
}
