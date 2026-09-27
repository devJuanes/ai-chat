import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import { PROVIDERS } from './constants.js';
import { zonedParts } from './time.js';

const remainingMem = new Map();

function paramsKey(path, params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v != null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  const q = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return `${path}?${q}`;
}

function errorText(errors) {
  if (!errors) return '';
  if (Array.isArray(errors)) {
    return errors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join('; ');
  }
  if (typeof errors === 'object') {
    return Object.entries(errors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ');
  }
  return String(errors);
}

async function callsToday(provider, callDate) {
  const db = getDb();
  const { data, error } = await db
    .from('sports_api_calls')
    .select('id')
    .eq('provider', provider)
    .eq('call_date', callDate)
    .limit(200);
  if (error) throw new Error(error.message || 'No se pudo leer sports_api_calls');
  return (data || []).length;
}

async function recentOkCall(provider, key, reuseMinutes) {
  if (!reuseMinutes) return false;
  const db = getDb();
  const since = new Date(Date.now() - reuseMinutes * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('sports_api_calls')
    .select('id, created_at')
    .eq('provider', provider)
    .eq('params_key', key)
    .eq('ok', true)
    .gte('created_at', since)
    .limit(1);
  if (error) return false;
  return Boolean(data && data.length);
}

export function budgetLeft(provider) {
  const mem = remainingMem.get(provider);
  if (typeof mem === 'number') return mem;
  return null;
}

export async function sportsGet(provider, path, params = {}, options = {}) {
  const spec = PROVIDERS[provider];
  if (!spec) throw new Error(`Proveedor desconocido: ${provider}`);
  if (!config.sports.apiKey) {
    throw new Error('SPORTS_API_KEY no está configurada');
  }

  const key = paramsKey(path, params);
  const callDate = zonedParts().date;
  const reuseMinutes = options.reuseMinutes || 0;
  if (await recentOkCall(provider, key, reuseMinutes)) {
    return { skipped: true, response: [], results: 0 };
  }

  const mem = remainingMem.get(provider);
  if (typeof mem === 'number' && mem <= config.sports.reserve) {
    return { skipped: true, budget: true, response: [], results: 0 };
  }

  const used = await callsToday(provider, callDate);
  const limit = config.sports.dailyLimit || 100;
  if (used >= limit - (config.sports.reserve || 8)) {
    remainingMem.set(provider, 0);
    return { skipped: true, budget: true, response: [], results: 0 };
  }

  const url = new URL(spec.baseUrl + path);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }

  let res;
  let netError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      res = await fetch(url, {
        headers: { 'x-apisports-key': config.sports.apiKey },
        signal: AbortSignal.timeout(30000),
      });
      netError = null;
      break;
    } catch (err) {
      netError = err;
      res = null;
    }
  }
  if (!res) {
    throw new Error(netError?.message || 'Fallo de red con API-Sports');
  }

  const headerRemain = Number(res.headers.get('x-ratelimit-requests-remaining'));
  if (Number.isFinite(headerRemain)) remainingMem.set(provider, headerRemain);

  const json = await res.json().catch(() => ({}));
  const err = errorText(json?.errors);
  const ok = res.ok && !err;
  if (/limit|reached the request/i.test(err)) remainingMem.set(provider, 0);

  await getDb()
    .from('sports_api_calls')
    .insert({
      id: newId(),
      provider,
      endpoint: path,
      params_key: key,
      call_date: callDate,
      http_status: res.status,
      ok,
      results_count: Number(json?.results) || 0,
      remaining: Number.isFinite(headerRemain) ? headerRemain : null,
      error_text: err ? err.slice(0, 400) : null,
    });

  if (!ok) {
    console.warn(`[sports] ${provider} ${key} → ${res.status} ${err || 'error'}`);
    return { skipped: false, ok: false, response: [], results: 0, error: err };
  }

  return {
    skipped: false,
    ok: true,
    response: Array.isArray(json.response) ? json.response : [],
    results: Number(json.results) || 0,
    paging: json.paging || null,
  };
}

export async function sportsGetPages(provider, path, params, options = {}) {
  const first = await sportsGet(provider, path, { ...params, page: undefined }, options);
  if (first.skipped || !first.ok) return first;
  let rows = first.response || [];
  const total = Number(first.paging?.total) || 1;
  for (let page = 2; page <= Math.min(total, 4); page += 1) {
    const next = await sportsGet(
      provider,
      path,
      { ...params, page },
      { reuseMinutes: 0 }
    );
    if (next.budget) break;
    if (next.ok && next.response?.length) rows = rows.concat(next.response);
  }
  return { ...first, response: rows, results: rows.length };
}
