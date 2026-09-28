import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import { completeUpstreamChat } from '../upstream.js';
import { FINISHED, PROVIDERS } from './constants.js';
import { pairKey } from './normalize.js';
import { sportsTablesReady } from './sync.js';
import { dayBoundsUtc, zonedParts } from './time.js';
import { insertRow, updateWhere } from './writes.js';

const SYSTEM = `Eres MatuSports Pro, motor cuantitativo de Matu AI SaaS (MatuByte S.A.S.).
Generas un pronóstico interno para guardarlo en base de datos.

Reglas:
- Usa solo los datos del paquete. No inventes lesiones, alineaciones, cuotas, xG ni resultados.
- No hay cuotas en el paquete: no calcules edge, EV ni stake. no_bet debe ser true.
- Si la muestra es corta o faltan forma y H2H, baja la confianza y dilo.
- Las probabilidades son estimaciones, no certezas.
- Fútbol: home + draw + away = 1. Incluye btts y over (más de 2.5 goles) entre 0 y 1.
- Baloncesto, NBA y hockey: draw = null. home + away = 1. btts = null. over puede ser null si no hay línea.
- summary son 2 frases cortas: la sustentación de por qué ese lado, solo con el paquete. Si faltan forma y H2H, dilo en una frase.
- Responde únicamente JSON válido, sin markdown:
{"home":0.42,"draw":0.28,"away":0.30,"btts":0.55,"over":0.48,"pick":"home","confidence":"media","no_bet":true,"summary":"dos frases de sustentación","drivers":["factor 1","factor 2"]}
pick es home, draw o away. El porcentaje de ese lado es el que se guarda.`;

function clamp(n) {
  if (typeof n === 'string') n = n.replace('%', '').trim();
  let x = Number(n);
  if (!Number.isFinite(x)) return null;
  if (x > 1 && x <= 100) x = x / 100;
  if (x <= 0) return null;
  return Math.min(1, x);
}

function parseJson(text) {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : String(text || '');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(body.slice(start, end + 1));
}

function slateDateOf(kickoff) {
  if (!kickoff) return zonedParts().date;
  const parsed = new Date(kickoff);
  if (Number.isNaN(parsed.getTime())) return zonedParts().date;
  return zonedParts(parsed).date;
}

function choosePick(homeP, drawP, awayP, hasDraw) {
  const options = [
    { key: 'home', label: 'Victoria local', p: homeP },
    hasDraw ? { key: 'draw', label: 'Empate', p: drawP } : null,
    { key: 'away', label: 'Victoria visita', p: awayP },
  ].filter((item) => item && item.p != null);
  options.sort((a, b) => b.p - a.p);
  const best = options[0];
  return {
    pick_label: best?.label || 'Sin lado claro',
    win_prob: best?.p ?? null,
    is_premium: (best?.p || 0) >= 0.8,
  };
}

async function forecastsToday() {
  const start = dayBoundsUtc(zonedParts().date).start.toISOString();
  const { data, error } = await getDb()
    .from('sports_forecasts')
    .select('id, summary')
    .gte('created_at', start)
    .limit(200);
  if (error) return config.sports.forecastCap;
  return (data || []).filter((row) => row.summary && row.summary !== '__pending__').length;
}

async function loadSide(provider, teamId) {
  const db = getDb();
  const { data: form } = await db
    .from('sports_team_form')
    .select('team_name, played, wins, draws, losses, goals_for, goals_against, btts_rate, over_rate, summary')
    .eq('provider', provider)
    .eq('team_id', String(teamId))
    .limit(1);
  const { data: recent } = await db
    .from('sports_fixtures')
    .select('kickoff_at, home_team_name, away_team_name, home_score, away_score, league_name, status_short')
    .eq('provider', provider)
    .eq('home_team_id', String(teamId))
    .order('kickoff_at', { ascending: false })
    .limit(12);
  const { data: recentAway } = await db
    .from('sports_fixtures')
    .select('kickoff_at, home_team_name, away_team_name, home_score, away_score, league_name, status_short')
    .eq('provider', provider)
    .eq('away_team_id', String(teamId))
    .order('kickoff_at', { ascending: false })
    .limit(12);
  const games = [...(recent || []), ...(recentAway || [])]
    .sort((a, b) => String(b.kickoff_at).localeCompare(String(a.kickoff_at)))
    .slice(0, 5);
  return { form: form?.[0] || null, recent: games };
}

function packetFor(fixture, home, away, h2h) {
  return {
    deporte: fixture.sport,
    liga: fixture.league_name,
    pais: fixture.league_country,
    fecha: fixture.kickoff_at,
    estado: fixture.status_short,
    local: fixture.home_team_name,
    visita: fixture.away_team_name,
    marcador: [fixture.home_score, fixture.away_score],
    forma_local: home.form?.summary || null,
    forma_visita: away.form?.summary || null,
    ultimos_local: home.recent,
    ultimos_visita: away.recent,
    h2h: h2h?.summary || null,
    nota: 'Sin cuotas. No calcules valor de mercado.',
  };
}

async function writeForecast(fixture, forecastId, payload) {
  const picked = choosePick(
    payload.home_prob,
    payload.draw_prob,
    payload.away_prob,
    payload.draw_prob != null
  );
  const now = new Date().toISOString();
  const saved = await updateWhere('sports_forecasts', 'id', forecastId, {
    model_id: 'matu-sports-pro',
    home_prob: payload.home_prob,
    draw_prob: payload.draw_prob,
    away_prob: payload.away_prob,
    btts_prob: payload.btts_prob,
    over_prob: payload.over_prob,
    win_prob: picked.win_prob,
    pick_label: picked.pick_label,
    slate_date: slateDateOf(fixture.kickoff_at),
    is_premium: picked.is_premium,
    confidence: payload.confidence,
    no_bet: true,
    summary: payload.summary,
    drivers: JSON.stringify(payload.drivers || []),
    raw_text: payload.raw_text,
    inputs: JSON.stringify(payload.inputs || {}),
    updated_at: now,
  });
  if (saved?.error) {
    throw new Error(saved.error.message || 'No se pudo guardar el pronóstico');
  }
}

function forecastReady(row) {
  return Boolean(row?.summary) && row.summary !== '__pending__' && Number(row.win_prob) > 0;
}

async function claimForecast(fixture) {
  const db = getDb();
  const { data: existing } = await db
    .from('sports_forecasts')
    .select('id, summary, updated_at, win_prob')
    .eq('fixture_id', fixture.id)
    .limit(1);
  const row = existing?.[0];
  if (forecastReady(row)) return null;
  if (row?.summary === '__pending__') {
    const age = Date.now() - new Date(row.updated_at || 0).getTime();
    if (age < 45 * 1000) return null;
  }
  if (row) {
    await updateWhere('sports_forecasts', 'id', row.id, {
      summary: '__pending__',
      updated_at: new Date().toISOString(),
    });
    return row.id;
  }
  const id = newId();
  const now = new Date().toISOString();
  const { error } = await insertRow('sports_forecasts', {
    id,
    fixture_id: fixture.id,
    model_id: 'matu-sports-pro',
    no_bet: true,
    summary: '__pending__',
    confidence: 'baja',
    slate_date: slateDateOf(fixture.kickoff_at),
    pick_label: null,
    win_prob: null,
    is_premium: false,
    created_at: now,
    updated_at: now,
  });
  if (error) return null;
  return id;
}

async function forecastOne(fixture, { onDemand = false } = {}) {
  if (!onDemand) {
    const cap = config.sports.forecastCap || 36;
    if ((await forecastsToday()) >= cap) return false;
  }
  const forecastId = await claimForecast(fixture);
  if (!forecastId) return false;
  const spec = PROVIDERS[fixture.provider] || PROVIDERS.football;
  const db = getDb();
  const home = await loadSide(fixture.provider, fixture.home_team_id);
  const away = await loadSide(fixture.provider, fixture.away_team_id);
  const [teamA, teamB] = pairKey(fixture.home_team_id, fixture.away_team_id);
  const { data: h2hRows } = await db
    .from('sports_h2h')
    .select('summary, meetings, home_wins, draws, away_wins, btts_count')
    .eq('provider', fixture.provider)
    .eq('team_a_id', teamA)
    .eq('team_b_id', teamB)
    .limit(1);
  const packet = packetFor(fixture, home, away, h2hRows?.[0] || null);
  let raw = '';
  try {
    raw = await completeUpstreamChat({
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Pronóstico interno para ${fixture.home_team_name} vs ${fixture.away_team_name} (${spec.sport}).\n${JSON.stringify(packet)}`,
        },
      ],
      maxTokens: 700,
      signal: AbortSignal.timeout(onDemand ? 28000 : 45000),
    });
  } catch (err) {
    console.warn('[sports] pronóstico', fixture.home_team_name, err?.message || err);
    await getDb().from('sports_forecasts').eq('id', forecastId).delete();
    return false;
  }

  let parsed = null;
  try {
    parsed = parseJson(raw);
  } catch {
    parsed = null;
  }
  const hasDraw = spec.hasDraw;
  const homeP = clamp(parsed?.home);
  const drawP = hasDraw ? clamp(parsed?.draw) : null;
  const awayP = clamp(parsed?.away);
  if (homeP == null && awayP == null) {
    await getDb().from('sports_forecasts').eq('id', forecastId).delete();
    console.warn('[sports] pronóstico sin porcentaje', fixture.home_team_name);
    return false;
  }
  try {
    await writeForecast(fixture, forecastId, {
      home_prob: homeP,
      draw_prob: drawP,
      away_prob: awayP,
      btts_prob: hasDraw ? clamp(parsed?.btts) : null,
      over_prob: clamp(parsed?.over),
      confidence: ['baja', 'media', 'alta'].includes(parsed?.confidence)
        ? parsed.confidence
        : 'baja',
      summary: String(parsed?.summary || raw || 'Sin lectura estructurada').slice(0, 320),
      drivers: Array.isArray(parsed?.drivers) ? parsed.drivers.slice(0, 5) : [],
      raw_text: String(raw || '').slice(0, 4000),
      inputs: packet,
    });
  } catch (err) {
    console.warn('[sports] guardar', fixture.home_team_name, err?.message || err);
    await getDb().from('sports_forecasts').eq('id', forecastId).delete();
    return false;
  }
  console.log(
    `[sports] pronóstico ${fixture.home_team_name} vs ${fixture.away_team_name}`
  );
  return true;
}

async function runForecasts(fixtures, concurrency = 3) {
  const queue = [...fixtures];
  let wrote = 0;
  const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (queue.length) {
      const fixture = queue.shift();
      if (!fixture) break;
      if (await forecastOne(fixture)) wrote += 1;
    }
  });
  await Promise.all(workers);
  return wrote;
}

async function openFixturesBetween(fromIso, toIso) {
  const { data, error } = await getDb()
    .from('sports_fixtures')
    .select('*')
    .gte('kickoff_at', fromIso)
    .lte('kickoff_at', toIso)
    .limit(250);
  if (error || !data?.length) return [];
  return data.filter((fixture) => !FINISHED.has(fixture.status_short));
}

function sortSlate(fixtures) {
  return fixtures.slice().sort((a, b) => {
    if (Boolean(a.is_priority) !== Boolean(b.is_priority)) return a.is_priority ? -1 : 1;
    return String(a.kickoff_at).localeCompare(String(b.kickoff_at));
  });
}

async function forecastState(fixtures) {
  const ids = fixtures.map((fixture) => fixture.id);
  if (!ids.length) return { ready: 0, missing: [] };
  const { data: existing } = await getDb()
    .from('sports_forecasts')
    .select('fixture_id, summary, win_prob')
    .in('fixture_id', ids.slice(0, 200));
  const have = new Set((existing || []).filter(forecastReady).map((row) => row.fixture_id));
  const missing = sortSlate(fixtures).filter((fixture) => !have.has(fixture.id));
  return { ready: fixtures.length - missing.length, missing };
}

const forecastJobs = new Map();

/** Pronósticos del día que se va a mostrar, antes de pintar las tarjetas. */
export function ensureForecastsForDate(date, limit = 8) {
  const key = String(date);
  const running = forecastJobs.get(key);
  if (running) return running;
  const job = ensureForecastsForDateNow(date, limit).finally(() => {
    if (forecastJobs.get(key) === job) forecastJobs.delete(key);
  });
  forecastJobs.set(key, job);
  return job;
}

async function ensureForecastsForDateNow(date, limit) {
  if (!config.sports.enabled || !config.upstream.apiKey) return 0;
  if (!(await sportsTablesReady())) return 0;
  const bounds = dayBoundsUtc(date);
  const open = await openFixturesBetween(bounds.start.toISOString(), bounds.end.toISOString());
  const priority = open.filter((fixture) => fixture.is_priority);
  const { ready, missing } = await forecastState(priority);
  const batch = missing.slice(0, Math.max(0, limit - ready));
  if (!batch.length) return 0;
  return runForecasts(batch, 2);
}

const fixtureJobs = new Map();

/**
 * Un partido, cuando el usuario pulsa generar. Si ya está guardado, no vuelve a llamar al modelo.
 */
export function ensureFixtureForecast(fixtureId) {
  const key = String(fixtureId || '');
  const running = fixtureJobs.get(key);
  if (running) return running;
  const job = ensureFixtureForecastNow(key).finally(() => {
    if (fixtureJobs.get(key) === job) fixtureJobs.delete(key);
  });
  fixtureJobs.set(key, job);
  return job;
}

async function ensureFixtureForecastNow(fixtureId) {
  if (!config.sports.enabled || !config.upstream.apiKey) {
    throw new Error('El pronóstico no está disponible ahora');
  }
  const { data, error } = await getDb()
    .from('sports_fixtures')
    .select('*')
    .eq('id', fixtureId)
    .limit(1);
  if (error) throw new Error(error.message || 'No se pudo leer el partido');
  const fixture = data?.[0];
  if (!fixture) throw new Error('No encontré ese partido');
  if (FINISHED.has(fixture.status_short)) throw new Error('Ese partido ya terminó');
  const { data: existing } = await getDb()
    .from('sports_forecasts')
    .select('summary, win_prob')
    .eq('fixture_id', fixture.id)
    .limit(1);
  if (forecastReady(existing?.[0])) return fixture.id;
  const wrote = await forecastOne(fixture, { onDemand: true });
  if (!wrote) throw new Error('No pude generar el pronóstico. Inténtalo otra vez.');
  return fixture.id;
}

export function forecastsBusy() {
  return forecastJobs.size > 0;
}
