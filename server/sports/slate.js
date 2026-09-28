import { getDb } from '../db.js';
import { FINISHED } from './constants.js';
import { ensureFixtureForecast, ensureForecastsForDate } from './forecast.js';
import { addDays, dayBoundsUtc, zonedParts } from './time.js';
import { sportsTablesReady } from './sync.js';

const SPORT_LABEL = {
  football: 'Fútbol',
  basketball: 'Baloncesto',
  hockey: 'Hockey',
  nba: 'NBA',
};

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function logoFrom(fixture, side) {
  const column = side === 'home' ? fixture.home_logo : fixture.away_logo;
  if (column) return column;
  const raw = fixture.raw || {};
  const team = side === 'home' ? raw.teams?.home : raw.teams?.away || raw.teams?.visitors;
  return team?.logo || null;
}

const TEAM_STOP = new Set([
  'women',
  'woman',
  'united',
  'sport',
  'club',
  'athletic',
  'junior',
  'ladies',
  'girls',
  'boys',
  'town',
  'city',
  'real',
  'inter',
  'dynamo',
  'dinamo',
  'olympic',
  'nacional',
  'football',
  'soccer',
  'hockey',
]);

export function textMentionsTeam(text, teamName) {
  const name = norm(teamName);
  const t = norm(text);
  if (!name || !t) return false;
  if (name.length >= 4 && t.includes(name)) return true;
  const words = name.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !TEAM_STOP.has(word));
  return words.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
}

async function fixturesOn(date) {
  if (!(await sportsTablesReady())) return [];
  const bounds = dayBoundsUtc(date);
  const { data, error } = await getDb()
    .from('sports_fixtures')
    .select('*')
    .gte('kickoff_at', bounds.start.toISOString())
    .lte('kickoff_at', bounds.end.toISOString())
    .limit(250);
  if (error || !data?.length) return [];
  return data;
}

async function cardsFromFixtures(fixtures) {
  if (!fixtures.length) return [];
  const ids = fixtures.map((fixture) => fixture.id);
  const byFixture = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const { data: forecasts } = await getDb()
      .from('sports_forecasts')
      .select('fixture_id, win_prob, pick_label, confidence, summary, is_premium')
      .in('fixture_id', ids.slice(i, i + 80));
    for (const row of forecasts || []) byFixture.set(row.fixture_id, row);
  }
  return fixtures.map((fixture) => cardFrom(fixture, byFixture.get(fixture.id)));
}

const BOARD_SPORTS = new Set(['football', 'basketball', 'hockey', 'nba']);

/** Todos los partidos de un día, con el pronóstico guardado si existe. */
export async function listBoardMatches({ date, sport = '', q = '' } = {}) {
  if (!(await sportsTablesReady())) return [];
  const bounds = dayBoundsUtc(date);
  let query = getDb()
    .from('sports_fixtures')
    .select('*')
    .gte('kickoff_at', bounds.start.toISOString())
    .lte('kickoff_at', bounds.end.toISOString());
  if (BOARD_SPORTS.has(sport)) query = query.eq('sport', sport);
  const safe = String(q || '')
    .replace(/[%_,()]/g, '')
    .trim()
    .slice(0, 40);
  if (safe) {
    query = query.or(
      `home_team_name.ilike.%${safe}%,away_team_name.ilike.%${safe}%,league_name.ilike.%${safe}%`
    );
  }
  const { data, error } = await query.order('kickoff_at', { ascending: true }).limit(250);
  if (error) throw new Error(error.message || 'No se pudieron leer los partidos');
  return cardsFromFixtures(data || []);
}

/** Partidos abiertos de hoy (o mañana) cuyo equipo aparece en la pregunta. */
export async function findMentionedFixtures(userText) {
  const t = norm(userText);
  const today = zonedParts().date;
  const tomorrow = addDays(today, 1);
  const dates = /\bmanana\b|tomorrow/.test(t) ? [tomorrow] : /\bhoy\b/.test(t) ? [today] : [today, tomorrow];
  const found = [];
  for (const date of dates) {
    const rows = await fixturesOn(date);
    const hits = rows.filter(
      (row) => textMentionsTeam(t, row.home_team_name) || textMentionsTeam(t, row.away_team_name)
    );
    const open = hits.filter((row) => !FINISHED.has(row.status_short));
    found.push(...(open.length ? open : hits));
    if (found.length) break;
  }
  return found.slice(0, 4);
}

function wantsWholeSlate(text) {
  return /agenda|que hay|dame los|combinad|parlay/.test(norm(text));
}

export function slateRequestFromText(text) {
  const t = norm(text);
  const asks =
    /pronost|pick|tip|agenda|partidos|que hay|dame los|cuotas?|combinad|parlay/.test(t) ||
    /\b(hoy|manana)\b/.test(t);
  if (!asks) return null;
  const today = zonedParts().date;
  let date = today;
  if (/pasado manana/.test(t)) date = addDays(today, 2);
  else if (/\bmanana\b|tomorrow/.test(t)) date = addDays(today, 1);
  return { date, today };
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function cardFrom(fixture, forecast) {
  const win = pct(forecast?.win_prob);
  const summary =
    forecast?.summary && forecast.summary !== '__pending__' ? forecast.summary : '';
  const ready = win != null && Boolean(summary);
  return {
    id: fixture.id,
    sport: SPORT_LABEL[fixture.sport] || fixture.sport || 'Deporte',
    league: fixture.league_name || '',
    country: fixture.league_country || '',
    leagueLogo: fixture.league_logo || fixture.raw?.league?.logo || null,
    kickoff: fixture.kickoff_at,
    home: fixture.home_team_name,
    away: fixture.away_team_name,
    homeLogo: logoFrom(fixture, 'home'),
    awayLogo: logoFrom(fixture, 'away'),
    pick: ready ? forecast.pick_label || '' : '',
    winProb: ready ? win : null,
    premium: Boolean(forecast?.is_premium) || (ready && win >= 80),
    confidence: forecast?.confidence || 'baja',
    summary: ready ? summary : '',
    priority: Boolean(fixture.is_priority),
    ready,
    finished: FINISHED.has(fixture.status_short),
    homeScore: fixture.home_score,
    awayScore: fixture.away_score,
  };
}

export async function loadSlateCards(date, { limit = 20 } = {}) {
  if (!(await sportsTablesReady())) return [];
  const bounds = dayBoundsUtc(date);
  const db = getDb();
  const { data, error } = await db
    .from('sports_fixtures')
    .select('*')
    .gte('kickoff_at', bounds.start.toISOString())
    .lte('kickoff_at', bounds.end.toISOString())
    .limit(250);
  if (error || !data?.length) return [];

  const open = data.filter((fixture) => !FINISHED.has(fixture.status_short));
  if (!open.length) return [];
  const ids = open.map((fixture) => fixture.id);
  const { data: forecasts } = await db
    .from('sports_forecasts')
    .select('fixture_id, win_prob, pick_label, confidence, summary, is_premium')
    .in('fixture_id', ids.slice(0, 200));
  const byFixture = new Map((forecasts || []).map((row) => [row.fixture_id, row]));

  const ranked = open
    .map((fixture) => cardFrom(fixture, byFixture.get(fixture.id)))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return String(a.kickoff || '').localeCompare(String(b.kickoff || ''));
    });
  const saved = ranked.filter((card) => card.ready);
  const pending = ranked.filter((card) => !card.ready);
  if (!pending.length) return saved.slice(0, limit);
  return [...saved.slice(0, 8), ...pending.slice(0, Math.max(0, limit - 8))];
}

export async function loadFixtureCard(fixtureId) {
  if (!(await sportsTablesReady())) return null;
  const db = getDb();
  const { data, error } = await db.from('sports_fixtures').select('*').eq('id', fixtureId).limit(1);
  if (error || !data?.[0]) return null;
  const { data: forecasts } = await db
    .from('sports_forecasts')
    .select('fixture_id, win_prob, pick_label, confidence, summary, is_premium')
    .eq('fixture_id', fixtureId)
    .limit(1);
  return cardFrom(data[0], forecasts?.[0]);
}

export async function generateCardForecast(fixtureId) {
  await ensureFixtureForecast(fixtureId);
  const card = await loadFixtureCard(fixtureId);
  if (!card?.ready) throw new Error('No pude guardar el pronóstico');
  return card;
}

function fence(cards) {
  if (!cards.length) return '';
  return `\`\`\`sports\n${JSON.stringify(cards)}\n\`\`\`\n\n`;
}

export async function buildSportsCardFence(userText) {
  const mentioned = await findMentionedFixtures(userText);
  if (mentioned.length && !wantsWholeSlate(userText)) {
    return fence(await cardsFromFixtures(mentioned));
  }
  const request = slateRequestFromText(userText);
  if (!request) return '';
  ensureForecastsForDate(request.date, 8).catch((err) => {
    console.warn('[sports] top', err?.message || err);
  });
  return fence(await loadSlateCards(request.date, { limit: 24 }));
}
