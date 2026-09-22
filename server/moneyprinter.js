import { config } from './config.js';

function headers() {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.moneyPrinter.apiKey) {
    h['x-api-key'] = config.moneyPrinter.apiKey;
  }
  return h;
}

function friendlyUpstreamError(err, status) {
  const raw = String(err?.message || err || '');
  if (/fetch failed|Failed to fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|AbortError|timed out/i.test(raw)) {
    return `MoneyPrinterTurbo no responde en ${config.moneyPrinter.baseUrl} (ocupado o caído). Reintenta en unos segundos.`;
  }
  if (status === 401 || status === 403) {
    return 'API key de MoneyPrinterTurbo inválida. Revisa MONEYPRINTER_API_KEY.';
  }
  if (status === 404) {
    return 'Tarea no encontrada en MoneyPrinterTurbo.';
  }
  if (status === 429) {
    return 'Cola de videos llena. Espera un momento e inténtalo de nuevo.';
  }
  return raw.slice(0, 280) || 'Error al hablar con MoneyPrinterTurbo';
}

async function mptFetch(path, { method = 'GET', body, signal, timeoutMs = 25000 } = {}) {
  const base = config.moneyPrinter.baseUrl;
  if (!base) {
    throw new Error('MONEYPRINTER_BASE_URL no está configurada.');
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    const msg =
      err?.name === 'AbortError'
        ? 'timed out'
        : err?.message || err;
    const e = new Error(friendlyUpstreamError({ message: String(msg) }));
    e.status = 503;
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  const text = await res.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error?.message ||
      (typeof json?.detail === 'string' ? json.detail : null) ||
      text ||
      `HTTP ${res.status}`;
    const e = new Error(friendlyUpstreamError({ message: String(msg) }, res.status));
    e.status = res.status;
    throw e;
  }
  return json;
}

/** Health check against MoneyPrinterTurbo /ping */
export async function pingMoneyPrinter() {
  const base = config.moneyPrinter.baseUrl;
  if (!base) return { ok: false, error: 'Sin MONEYPRINTER_BASE_URL' };
  try {
    const res = await fetch(`${base}/ping`, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text?.trim() };
  } catch (err) {
    return { ok: false, error: friendlyUpstreamError(err) };
  }
}

/**
 * Create a full video task.
 * @param {object} params - VideoParams subset (video_subject required)
 */
export async function createVideoTask(params = {}) {
  const subject = String(params.video_subject || '').trim();
  if (!subject) {
    throw new Error('Escribe un tema o guion para el video.');
  }

  // Edge TTS (azure_tts_v1): voice vacío → "Invalid voice ''".
  // Formato MoneyPrinterTurbo: {locale}-{Name}Neural-{Female|Male}
  const DEFAULT_VOICE = 'es-ES-ElviraNeural-Female';

  const voiceName =
    String(params.voice_name || '').trim() || DEFAULT_VOICE;

  const payload = {
    video_subject: subject,
    video_script: String(params.video_script || '').trim(),
    video_aspect: params.video_aspect || '9:16',
    video_source: params.video_source || 'pexels',
    video_language: params.video_language || 'es-ES',
    voice_name: voiceName,
    voice_rate: Number(params.voice_rate) || 1.0,
    voice_volume: Number(params.voice_volume) || 1.0,
    subtitle_enabled:
      params.subtitle_enabled === undefined ? true : Boolean(params.subtitle_enabled),
    video_count: Math.min(3, Math.max(1, Number(params.video_count) || 1)),
    paragraph_number: Math.min(5, Math.max(1, Number(params.paragraph_number) || 1)),
    bgm_type: params.bgm_type || 'random',
  };

  const json = await mptFetch('/api/v1/videos', { method: 'POST', body: payload });
  const data = json?.data || json;
  if (!data?.task_id) {
    throw new Error('MoneyPrinterTurbo no devolvió task_id');
  }
  return {
    task_id: data.task_id,
    request_id: data.request_id || null,
    params: data.params || payload,
  };
}

export async function getVideoTask(taskId) {
  const id = String(taskId || '').trim();
  if (!id) throw new Error('task_id requerido');
  const json = await mptFetch(`/api/v1/tasks/${encodeURIComponent(id)}`);
  const data = json?.data || json;

  const videos = Array.isArray(data?.videos) ? data.videos : [];
  const absoluteVideos = videos.map((u) => absolutizeVideoUrl(u));

  return {
    task_id: data?.task_id || id,
    state: data?.state,
    progress: data?.progress ?? 0,
    videos: absoluteVideos,
    error:
      data?.error ||
      data?.failed_stage ||
      (data?.state === -1
        ? 'La generación falló (revisa la voz TTS / logs de MoneyPrinterTurbo)'
        : null),
  };
}

function absolutizeVideoUrl(url) {
  const u = String(url || '');
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  const base = config.moneyPrinter.publicBaseUrl || config.moneyPrinter.baseUrl;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/${u}`;
}

export async function listVideoTasks({ page = 1, pageSize = 10 } = {}) {
  const q = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const json = await mptFetch(`/api/v1/tasks?${q}`);
  return json?.data || json;
}
