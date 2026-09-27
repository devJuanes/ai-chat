import { isPriorityFixture } from './constants.js';

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export function pairKey(idA, idB) {
  const a = String(idA);
  const b = String(idB);
  return a < b ? [a, b] : [b, a];
}

function footballStatus(short) {
  return text(short) || 'NS';
}

function nbaStatus(short) {
  const n = Number(short);
  if (n === 1) return 'NS';
  if (n === 2) return 'LIVE';
  if (n === 3) return 'FT';
  return text(short) || 'NS';
}

export function normalizeFixture(provider, item) {
  if (!item || typeof item !== 'object') return null;
  if (provider === 'football') return normalizeFootball(item);
  if (provider === 'nba') return normalizeNba(item);
  return normalizeApiSportsGame(provider, item);
}

function normalizeFootball(item) {
  const fixture = item.fixture || {};
  const league = item.league || {};
  const home = item.teams?.home || {};
  const away = item.teams?.away || {};
  const externalId = text(fixture.id);
  if (!externalId || !home.id || !away.id) return null;
  const leagueId = text(league.id);
  const leagueName = text(league.name);
  return {
    provider: 'football',
    external_id: externalId,
    sport: 'football',
    league_id: leagueId,
    league_name: leagueName,
    league_country: text(league.country),
    season: text(league.season),
    round: text(league.round),
    kickoff_at: text(fixture.date),
    status_short: footballStatus(fixture.status?.short),
    home_team_id: text(home.id),
    home_team_name: text(home.name) || 'Local',
    away_team_id: text(away.id),
    away_team_name: text(away.name) || 'Visita',
    home_score: num(item.goals?.home),
    away_score: num(item.goals?.away),
    venue: text(fixture.venue?.name),
    is_priority: isPriorityFixture('football', leagueId, leagueName),
    raw: item,
  };
}

function normalizeApiSportsGame(provider, item) {
  const home = item.teams?.home || {};
  const away = item.teams?.away || {};
  const externalId = text(item.id);
  if (!externalId || !home.id || !away.id) return null;
  const league = item.league || {};
  const leagueId = text(league.id);
  const leagueName = text(league.name);
  const country =
    text(item.country?.name) || text(league.country) || null;
  const kickoff = text(item.date) || null;
  const homeScore =
    num(item.scores?.home?.total) ??
    num(item.scores?.home) ??
    num(item.goals?.home);
  const awayScore =
    num(item.scores?.away?.total) ??
    num(item.scores?.away) ??
    num(item.goals?.away);
  return {
    provider,
    external_id: externalId,
    sport: provider,
    league_id: leagueId,
    league_name: leagueName,
    league_country: country,
    season: text(league.season),
    round: text(item.week || item.stage || league.round),
    kickoff_at: kickoff,
    status_short: footballStatus(item.status?.short),
    home_team_id: text(home.id),
    home_team_name: text(home.name) || 'Local',
    away_team_id: text(away.id),
    away_team_name: text(away.name) || 'Visita',
    home_score: homeScore,
    away_score: awayScore,
    venue: text(item.venue?.name || item.arena?.name),
    is_priority: isPriorityFixture(provider, leagueId, leagueName),
    raw: item,
  };
}

function normalizeNba(item) {
  const home = item.teams?.home || {};
  const away = item.teams?.visitors || item.teams?.away || {};
  const externalId = text(item.id);
  if (!externalId || !home.id || !away.id) return null;
  const leagueId = text(item.league) || 'standard';
  const leagueName = leagueId === 'standard' ? 'NBA' : `NBA ${leagueId}`;
  return {
    provider: 'nba',
    external_id: externalId,
    sport: 'nba',
    league_id: leagueId,
    league_name: leagueName,
    league_country: 'USA',
    season: text(item.season),
    round: text(item.stage),
    kickoff_at: text(item.date?.start || item.date),
    status_short: nbaStatus(item.status?.short),
    home_team_id: text(home.id),
    home_team_name: text(home.name) || text(home.nickname) || 'Local',
    away_team_id: text(away.id),
    away_team_name: text(away.name) || text(away.nickname) || 'Visita',
    home_score: num(item.scores?.home?.points),
    away_score: num(item.scores?.visitors?.points ?? item.scores?.away?.points),
    venue: text(item.arena?.name),
    is_priority: isPriorityFixture('nba', leagueId, leagueName),
    raw: item,
  };
}

function scored(row) {
  return row.home_score != null && row.away_score != null;
}

/**
 * Resume forma o H2H desde filas ya normalizadas.
 * `side` = 'home' | 'away' | null. null = perspectiva del teamId.
 */
export function summarizeGames(rows, { teamId = null, homeId = null, hasDraw = true, last = 8 } = {}) {
  const list = (rows || []).filter(scored).slice(0, last);
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  let btts = 0;
  const streak = [];

  for (const row of list) {
    const home = Number(row.home_score);
    const away = Number(row.away_score);
    if (home > 0 && away > 0) btts += 1;

    let perspectiveHome = true;
    if (teamId) {
      perspectiveHome = String(row.home_team_id) === String(teamId);
    } else if (homeId) {
      perspectiveHome = String(row.home_team_id) === String(homeId);
    }
    const mine = perspectiveHome ? home : away;
    const opp = perspectiveHome ? away : home;
    gf += mine;
    ga += opp;
    if (mine > opp) {
      wins += 1;
      streak.push('W');
    } else if (mine === opp) {
      draws += 1;
      streak.push('D');
    } else {
      losses += 1;
      streak.push('L');
    }
  }

  const played = list.length;
  const overCount = hasDraw
    ? list.filter((r) => Number(r.home_score) + Number(r.away_score) > 2.5).length
    : null;

  return {
    played,
    wins,
    draws: hasDraw ? draws : 0,
    losses,
    goals_for: gf,
    goals_against: ga,
    btts_rate: played ? Number((btts / played).toFixed(3)) : null,
    over_rate:
      hasDraw && played ? Number((overCount / played).toFixed(3)) : null,
    summary: {
      played,
      wins,
      draws: hasDraw ? draws : 0,
      losses,
      goals_for: gf,
      goals_against: ga,
      btts: played ? `${btts}/${played}` : null,
      over: hasDraw && played ? `${overCount}/${played}` : null,
      streak: streak.join(' '),
      avg_total: played ? Number(((gf + ga) / played).toFixed(2)) : null,
    },
  };
}
