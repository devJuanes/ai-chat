import { getDb } from '../db.js';
import { FINISHED } from './constants.js';
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

export function slateRequestFromText(text) {
  const t = norm(text);
  const asks =
    /pronost|pick|tip|agenda|partidos|que hay|dame los|cuotas?/.test(t) ||
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
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function cardFrom(fixture, forecast) {
  const win = pct(forecast?.win_prob);
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
    pick: forecast?.pick_label || 'Pronóstico en proceso',
    winProb: win,
    premium: Boolean(forecast?.is_premium) || (win != null && win >= 80),
    confidence: forecast?.confidence || 'baja',
    summary: forecast?.summary && forecast.summary !== '__pending__' ? forecast.summary : '',
    priority: Boolean(fixture.is_priority),
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

  return open
    .map((fixture) => cardFrom(fixture, byFixture.get(fixture.id)))
    .sort((a, b) => {
      if (a.premium !== b.premium) return a.premium ? -1 : 1;
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return (b.winProb || 0) - (a.winProb || 0);
    })
    .slice(0, limit);
}

export async function buildSportsCardFence(userText) {
  const request = slateRequestFromText(userText);
  if (!request) return '';
  const cards = await loadSlateCards(request.date);
  if (!cards.length) return '';
  return `\`\`\`sports\n${JSON.stringify(cards)}\n\`\`\`\n\n`;
}
