import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import { sportsGetPages } from './client.js';
import { FINISHED, PROVIDERS } from './constants.js';
import { normalizeFixture, pairKey, summarizeGames } from './normalize.js';
import { addDays, dayBoundsUtc, zonedParts } from './time.js';
import { insertRow, updateWhere } from './writes.js';

const ENRICH_CAP = {
  football: 18,
  basketball: 8,
  hockey: 6,
  nba: 12,
};

const h2hUnsupported = new Set();
const timezoneUnsupported = new Set();
let syncing = false;
let tablesWarned = false;

export function isSportsSyncing() {
  return syncing;
}

export async function sportsTablesReady() {
  const db = getDb();
  const { error } = await db.from('sports_fixtures').select('id').limit(1);
  if (error) {
    const message = String(error.message || error);
    const missing = /relation|does not exist|schema cache|could not find/i.test(message);
    if (missing && !tablesWarned) {
      tablesWarned = true;
      console.warn(
        '[sports] Faltan tablas. Ejecuta docs/migrations/sports-feed-v1.sql en MatuDB.',
        message
      );
    } else if (!missing) {
      console.warn('[sports] MatuDB no respondió', message);
    }
    return false;
  }
  return true;
}

function fixturePayload(row) {
  const now = new Date().toISOString();
  return {
    provider: row.provider,
    external_id: row.external_id,
    sport: row.sport,
    league_id: row.league_id,
    league_name: row.league_name,
    league_country: row.league_country,
    season: row.season,
    round: row.round,
    kickoff_at: row.kickoff_at,
    status_short: row.status_short,
    home_team_id: row.home_team_id,
    home_team_name: row.home_team_name,
    away_team_id: row.away_team_id,
    away_team_name: row.away_team_name,
    home_logo: row.home_logo || null,
    away_logo: row.away_logo || null,
    league_logo: row.league_logo || null,
    home_score: row.home_score,
    away_score: row.away_score,
    venue: row.venue,
    is_priority: Boolean(row.is_priority),
    raw: row.raw,
    fetched_at: now,
    updated_at: now,
  };
}

async function upsertFixtures(rows) {
  const clean = rows.filter(Boolean);
  if (!clean.length) return 0;
  const db = getDb();
  const provider = clean[0].provider;
  const existing = new Map();
  const ids = clean.map((r) => r.external_id);
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await db
      .from('sports_fixtures')
      .select('id, external_id')
      .eq('provider', provider)
      .in('external_id', chunk);
    if (error) throw new Error(error.message || 'No se pudo leer partidos');
    for (const row of data || []) existing.set(String(row.external_id), row.id);
  }

  let saved = 0;
  const fresh = [];
  for (const row of clean) {
    const payload = fixturePayload(row);
    const id = existing.get(row.external_id);
    if (id) {
      const { error } = await updateWhere('sports_fixtures', 'id', id, payload);
      if (error) console.warn('[sports] update partido', error.message || error);
      else saved += 1;
    } else {
      fresh.push({ ...payload, id: newId() });
    }
  }

  for (let i = 0; i < fresh.length; i += 40) {
    const chunk = fresh.slice(i, i + 40);
    const { error } = await insertRow('sports_fixtures', chunk);
    if (!error) {
      saved += chunk.length;
      continue;
    }
    for (const row of chunk) {
      const { error: one } = await insertRow('sports_fixtures', row);
      if (!one) saved += 1;
      else console.warn('[sports] insert partido', one.message || one);
    }
  }
  return saved;
}

async function fetchDate(provider, date) {
  const spec = PROVIDERS[provider];
  const params = { date };
  if (!timezoneUnsupported.has(provider)) params.timezone = config.timezone;
  let pack = await sportsGetPages(provider, spec.datePath, params, {
    reuseMinutes: 300,
  });
  if (!pack.ok && !pack.skipped && /timezone|parameter/i.test(pack.error || '')) {
    timezoneUnsupported.add(provider);
    pack = await sportsGetPages(
      provider,
      spec.datePath,
      { date },
      { reuseMinutes: 0 }
    );
  }
  if (pack.skipped) {
    console.log(`[sports] ${provider} ${date} ya estaba en caché de hoy`);
    return 0;
  }
  if (!pack.ok) return 0;
  const rows = [];
  for (const item of pack.response || []) {
    const row = normalizeFixture(provider, item);
    if (row) rows.push(row);
  }
  const saved = await upsertFixtures(rows);
  console.log(`[sports] ${provider} ${date}: ${rows.length} partidos, ${saved} guardados`);
  return saved;
}

async function isFresh(table, filters) {
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  let q = getDb().from(table).select('id').gte('fetched_at', since).limit(1);
  for (const [key, value] of Object.entries(filters)) q = q.eq(key, value);
  const { data, error } = await q;
  if (error) return false;
  return Boolean(data?.length);
}

async function saveForm(provider, teamId, teamName, games) {
  const hasDraw = PROVIDERS[provider].hasDraw;
  const stats = summarizeGames(games, { teamId, hasDraw, last: 8 });
  const db = getDb();
  const payload = {
    provider,
    team_id: String(teamId),
    team_name: teamName,
    last_n: 8,
    played: stats.played,
    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,
    goals_for: stats.goals_for,
    goals_against: stats.goals_against,
    btts_rate: stats.btts_rate,
    over_rate: stats.over_rate,
    summary: stats.summary,
    raw: games.slice(0, 8),
    fetched_at: new Date().toISOString(),
  };
  const { data: existing } = await db
    .from('sports_team_form')
    .select('id')
    .eq('provider', provider)
    .eq('team_id', String(teamId))
    .limit(1);
  if (existing?.[0]?.id) {
    await updateWhere('sports_team_form', 'id', existing[0].id, payload);
  } else {
    await insertRow('sports_team_form', { ...payload, id: newId() });
  }
}

async function saveH2h(provider, fixture, games) {
  const hasDraw = PROVIDERS[provider].hasDraw;
  const stats = summarizeGames(games, {
    homeId: fixture.home_team_id,
    hasDraw,
    last: 10,
  });
  const [teamA, teamB] = pairKey(fixture.home_team_id, fixture.away_team_id);
  const db = getDb();
  const payload = {
    provider,
    team_a_id: teamA,
    team_b_id: teamB,
    home_team_id: fixture.home_team_id,
    away_team_id: fixture.away_team_id,
    last_n: 10,
    meetings: stats.played,
    home_wins: stats.wins,
    draws: stats.draws,
    away_wins: stats.losses,
    btts_count: stats.summary?.btts
      ? Number(String(stats.summary.btts).split('/')[0])
      : null,
    summary: {
      ...stats.summary,
      from_home: fixture.home_team_name,
      from_away: fixture.away_team_name,
    },
    raw: games.slice(0, 10),
    fetched_at: new Date().toISOString(),
  };
  const { data: existing } = await db
    .from('sports_h2h')
    .select('id')
    .eq('provider', provider)
    .eq('team_a_id', teamA)
    .eq('team_b_id', teamB)
    .limit(1);
  if (existing?.[0]?.id) {
    await updateWhere('sports_h2h', 'id', existing[0].id, payload);
  } else {
    await insertRow('sports_h2h', { ...payload, id: newId() });
  }
}

function gamesFromResponse(provider, response) {
  return (response || [])
    .map((item) => normalizeFixture(provider, item))
    .filter(Boolean)
    .sort((a, b) => String(b.kickoff_at).localeCompare(String(a.kickoff_at)));
}

async function fetchTeamForm(provider, fixture, side) {
  const teamId = side === 'home' ? fixture.home_team_id : fixture.away_team_id;
  const teamName = side === 'home' ? fixture.home_team_name : fixture.away_team_name;
  if (!teamId) return;
  if (await isFresh('sports_team_form', { provider, team_id: String(teamId) })) return;
  const spec = PROVIDERS[provider];
  if (!fixture.season) return;
  const params = { team: teamId, season: fixture.season };
  const pack = await sportsGetPages(provider, spec.teamPath, params, {
    reuseMinutes: 1200,
  });
  if (pack.skipped || !pack.ok) return;
  const games = gamesFromResponse(provider, pack.response).filter(
    (g) => g.home_score != null && g.away_score != null
  );
  await saveForm(provider, teamId, teamName, games);
}

async function fetchH2h(provider, fixture) {
  if (h2hUnsupported.has(provider)) return;
  const [teamA, teamB] = pairKey(fixture.home_team_id, fixture.away_team_id);
  if (
    await isFresh('sports_h2h', {
      provider,
      team_a_id: teamA,
      team_b_id: teamB,
    })
  ) {
    return;
  }
  const spec = PROVIDERS[provider];
  const h2h = `${fixture.home_team_id}-${fixture.away_team_id}`;
  const params = { h2h };
  const pack = await sportsGetPages(provider, spec.h2hPath, params, {
    reuseMinutes: 1200,
  });
  if (pack.skipped || pack.budget) return;
  if (!pack.ok) {
    if (/parameter|h2h|endpoint|do not exist/i.test(pack.error || '')) {
      h2hUnsupported.add(provider);
    }
    return;
  }
  const games = gamesFromResponse(provider, pack.response);
  await saveH2h(provider, fixture, games);
}

async function enrichPriority(dates) {
  const db = getDb();
  const first = dayBoundsUtc(dates[0]).start.toISOString();
  const last = dayBoundsUtc(dates[dates.length - 1]).end.toISOString();
  const { data, error } = await db
    .from('sports_fixtures')
    .select('*')
    .eq('is_priority', true)
    .gte('kickoff_at', first)
    .lte('kickoff_at', last)
    .limit(250);
  if (error) throw new Error(error.message || 'No se pudo leer prioridad');

  const rows = (data || []).slice().sort((a, b) => {
    const af = FINISHED.has(a.status_short) ? 1 : 0;
    const bf = FINISHED.has(b.status_short) ? 1 : 0;
    if (af !== bf) return af - bf;
    return String(a.kickoff_at).localeCompare(String(b.kickoff_at));
  });

  const used = { football: 0, basketball: 0, hockey: 0, nba: 0 };
  for (const fixture of rows) {
    const provider = fixture.provider;
    if (!ENRICH_CAP[provider]) continue;
    if (used[provider] >= ENRICH_CAP[provider]) continue;
    const [teamA, teamB] = pairKey(fixture.home_team_id, fixture.away_team_id);
    const h2hFresh = await isFresh('sports_h2h', {
      provider,
      team_a_id: teamA,
      team_b_id: teamB,
    });
    const homeFresh = await isFresh('sports_team_form', {
      provider,
      team_id: String(fixture.home_team_id),
    });
    const awayFresh = await isFresh('sports_team_form', {
      provider,
      team_id: String(fixture.away_team_id),
    });
    if (h2hFresh && homeFresh && awayFresh) continue;
    try {
      await fetchH2h(provider, fixture);
      await fetchTeamForm(provider, fixture, 'home');
      await fetchTeamForm(provider, fixture, 'away');
    } catch (err) {
      console.warn('[sports] enriquecer', fixture.home_team_name, err?.message || err);
    }
    used[provider] += 1;
  }
  console.log('[sports] enriquecidos', used);
}

/**
 * Guarda partidos. refreshOnly solo actualiza el día en curso (marcadores).
 * El pase completo trae ayer, hoy y mañana, y luego H2H/forma de ligas top.
 */
export async function runSportsIngest({ refreshOnly = false, kind = 'ingest' } = {}) {
  if (!config.sports.enabled) return { skipped: true, reason: 'disabled' };
  if (!config.sports.apiKey) {
    console.warn('[sports] SPORTS_API_KEY vacía');
    return { skipped: true, reason: 'no-key' };
  }
  if (syncing) return { skipped: true, reason: 'busy' };
  if (!(await sportsTablesReady())) return { skipped: true, reason: 'no-tables' };

  syncing = true;
  const db = getDb();
  const runId = newId();
  const today = zonedParts().date;
  const dates = refreshOnly ? [today] : [today, addDays(today, 1)];
  try {
    await db.from('sports_sync_runs').insert({
      id: runId,
      kind,
      status: 'running',
      detail: { dates },
    });
    let saved = 0;
    for (const provider of Object.keys(PROVIDERS)) {
      for (const date of dates) {
        saved += await fetchDate(provider, date);
      }
    }
    if (!refreshOnly) await enrichPriority(dates);
    await updateWhere('sports_sync_runs', 'id', runId, {
      status: 'ok',
      finished_at: new Date().toISOString(),
      detail: { dates, saved },
    });
    return { ok: true, saved, dates };
  } catch (err) {
    console.warn('[sports] ingest', err?.message || err);
    await updateWhere('sports_sync_runs', 'id', runId, {
      status: 'error',
      finished_at: new Date().toISOString(),
      detail: { dates, error: String(err?.message || err).slice(0, 400) },
    });
    return { ok: false, error: err?.message || String(err) };
  } finally {
    syncing = false;
  }
}
