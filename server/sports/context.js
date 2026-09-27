import { getDb } from '../db.js';
import { FINISHED } from './constants.js';
import { pairKey } from './normalize.js';
import { sportsTablesReady } from './sync.js';
import { addDays, dayBoundsUtc, zonedParts } from './time.js';

const SLIM =
  'id, provider, sport, league_name, league_country, kickoff_at, status_short, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score, is_priority, venue';

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function mentions(text, team) {
  const name = norm(team);
  if (name.length < 4) return false;
  return text.includes(name);
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function lineFixture(row) {
  const score =
    row.home_score != null && row.away_score != null
      ? ` ${row.home_score}-${row.away_score}`
      : '';
  const when = row.kickoff_at ? String(row.kickoff_at).replace('T', ' ').slice(0, 16) : 'sin hora';
  return `- ${when} · ${row.league_name || row.sport} · ${row.home_team_name} vs ${row.away_team_name} · ${row.status_short || 'NS'}${score}`;
}

function formLine(label, form) {
  if (!form?.summary && !form?.played) return `${label}: sin forma en base.`;
  const s = form.summary || {};
  return `${label}: ${s.wins ?? form.wins ?? 0}G ${s.draws ?? form.draws ?? 0}E ${s.losses ?? form.losses ?? 0}P, a favor ${s.goals_for ?? form.goals_for ?? '—'} en contra ${s.goals_against ?? form.goals_against ?? '—'}, ambos marcan ${s.btts || '—'}, racha ${s.streak || '—'}.`;
}

async function recentForTeam(provider, teamId) {
  const db = getDb();
  const { data: home } = await db
    .from('sports_fixtures')
    .select('kickoff_at, league_name, home_team_name, away_team_name, home_score, away_score, status_short')
    .eq('provider', provider)
    .eq('home_team_id', String(teamId))
    .order('kickoff_at', { ascending: false })
    .limit(15);
  const { data: away } = await db
    .from('sports_fixtures')
    .select('kickoff_at, league_name, home_team_name, away_team_name, home_score, away_score, status_short')
    .eq('provider', provider)
    .eq('away_team_id', String(teamId))
    .order('kickoff_at', { ascending: false })
    .limit(15);
  return [...(home || []), ...(away || [])]
    .filter((row) => FINISHED.has(row.status_short) || row.home_score != null)
    .sort((a, b) => String(b.kickoff_at).localeCompare(String(a.kickoff_at)))
    .slice(0, 5);
}

async function detailBlock(fixture) {
  const db = getDb();
  const [teamA, teamB] = pairKey(fixture.home_team_id, fixture.away_team_id);
  const { data: forms } = await db
    .from('sports_team_form')
    .select('*')
    .eq('provider', fixture.provider)
    .in('team_id', [String(fixture.home_team_id), String(fixture.away_team_id)]);
  const homeForm = (forms || []).find((f) => String(f.team_id) === String(fixture.home_team_id));
  const awayForm = (forms || []).find((f) => String(f.team_id) === String(fixture.away_team_id));
  const { data: h2hRows } = await db
    .from('sports_h2h')
    .select('*')
    .eq('provider', fixture.provider)
    .eq('team_a_id', teamA)
    .eq('team_b_id', teamB)
    .limit(1);
  const { data: forecastRows } = await db
    .from('sports_forecasts')
    .select('home_prob, draw_prob, away_prob, btts_prob, over_prob, confidence, summary, drivers')
    .eq('fixture_id', fixture.id)
    .limit(1);
  const h2h = h2hRows?.[0];
  const forecast = forecastRows?.[0];
  const homeRecent = await recentForTeam(fixture.provider, fixture.home_team_id);
  const awayRecent = await recentForTeam(fixture.provider, fixture.away_team_id);

  const lines = [
    `### ${fixture.home_team_name} vs ${fixture.away_team_name}`,
    `${fixture.league_name || fixture.sport} · ${fixture.kickoff_at || 'sin hora'} · estado ${fixture.status_short || 'NS'}`,
    formLine('Forma local', homeForm),
    formLine('Forma visita', awayForm),
  ];
  if (h2h?.summary) {
    const s = h2h.summary;
    lines.push(
      `H2H (perspectiva del local de este partido): ${s.wins ?? h2h.home_wins ?? 0} victorias, ${s.draws ?? h2h.draws ?? 0} empates, ${s.losses ?? h2h.away_wins ?? 0} derrotas en ${s.played ?? h2h.meetings ?? 0} partidos. Ambos marcan ${s.btts || '—'}. Racha ${s.streak || '—'}.`
    );
  } else {
    lines.push('H2H: aún no cargado en la base.');
  }
  if (homeRecent.length) {
    lines.push(
      `Últimos de ${fixture.home_team_name} en base: ` +
        homeRecent
          .map(
            (g) =>
              `${g.home_team_name} ${g.home_score ?? '?'}-${g.away_score ?? '?'} ${g.away_team_name}`
          )
          .join('; ')
    );
  }
  if (awayRecent.length) {
    lines.push(
      `Últimos de ${fixture.away_team_name} en base: ` +
        awayRecent
          .map(
            (g) =>
              `${g.home_team_name} ${g.home_score ?? '?'}-${g.away_score ?? '?'} ${g.away_team_name}`
          )
          .join('; ')
    );
  }
  if (forecast) {
    lines.push(
      `Pronóstico interno previo (estimación, no certeza): local ${pct(forecast.home_prob)}, empate ${pct(forecast.draw_prob)}, visita ${pct(forecast.away_prob)}, ambos marcan ${pct(forecast.btts_prob)}, over ${pct(forecast.over_prob)}, confianza ${forecast.confidence || 'baja'}.`
    );
    if (forecast.summary) lines.push(`Lectura guardada: ${forecast.summary}`);
  } else {
    lines.push('Pronóstico interno: todavía no generado para este partido.');
  }
  lines.push('Cuotas: no están en la base. No calcules EV ni stake salvo que el usuario pegue un precio.');
  return lines.join('\n');
}

async function searchByPhrase(phrase) {
  const safe = phrase.replace(/[%_]/g, '').trim();
  if (safe.length < 4) return [];
  const db = getDb();
  const { data: home } = await db
    .from('sports_fixtures')
    .select(SLIM)
    .ilike('home_team_name', `%${safe}%`)
    .limit(6);
  const { data: away } = await db
    .from('sports_fixtures')
    .select(SLIM)
    .ilike('away_team_name', `%${safe}%`)
    .limit(6);
  return [...(home || []), ...(away || [])];
}

export async function buildSportsChatContext(userText) {
  if (!(await sportsTablesReady())) return '';
  const text = norm(userText).slice(0, 2500);
  const today = zonedParts().date;
  const from = dayBoundsUtc(addDays(today, -1)).start.toISOString();
  const to = dayBoundsUtc(addDays(today, 2)).end.toISOString();
  const db = getDb();
  const { data, error } = await db
    .from('sports_fixtures')
    .select(SLIM)
    .gte('kickoff_at', from)
    .lte('kickoff_at', to)
    .limit(300);
  if (error) return '';

  const slate = (data || []).slice().sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)));
  const matched = new Map();
  for (const row of slate) {
    if (mentions(text, row.home_team_name) || mentions(text, row.away_team_name)) {
      matched.set(row.id, row);
    }
  }

  if (!matched.size && text.length >= 4) {
    const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    const phrases = [];
    for (let i = 0; i < words.length - 1 && phrases.length < 3; i += 1) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
    if (words[0]) phrases.push(words.sort((a, b) => b.length - a.length)[0]);
    for (const phrase of phrases) {
      const found = await searchByPhrase(phrase);
      for (const row of found) matched.set(row.id, row);
      if (matched.size >= 3) break;
    }
  }

  const priority = slate.filter((row) => row.is_priority).slice(0, 24);
  const parts = [
    '## Datos deportivos verificados',
    'Fuente: base interna de Matu. No inventes cifras que no aparezcan aquí o en el mensaje del usuario. Sin cuotas no hay edge ni stake.',
    '',
    '### Agenda prioritaria (ayer a pasado mañana)',
  ];
  if (priority.length) parts.push(...priority.map(lineFixture));
  else parts.push('Sin partidos prioritarios cargados en esta ventana.');

  const focus = [...matched.values()].slice(0, 3);
  if (focus.length) {
    parts.push('', '### Partidos que coinciden con la pregunta');
    for (const fixture of focus) {
      parts.push(await detailBlock(fixture));
    }
  }

  const block = parts.join('\n');
  return block.length > 7000 ? `${block.slice(0, 7000)}\n…` : block;
}
