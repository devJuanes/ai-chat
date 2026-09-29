import { getDb } from '../db.js';
import { FINISHED } from './constants.js';
import { pairKey } from './normalize.js';
import { sportsTablesReady } from './sync.js';
import { findMentionedFixtures, slateRequestFromText } from './slate.js';
import { dayBoundsUtc, zonedParts } from './time.js';

const SLIM =
  'id, provider, sport, league_name, league_country, kickoff_at, status_short, home_team_id, home_team_name, away_team_id, away_team_name, home_score, away_score, is_priority, venue';

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function lineFixture(row, forecast) {
  const score =
    row.home_score != null && row.away_score != null
      ? ` ${row.home_score}-${row.away_score}`
      : '';
  const when = row.kickoff_at ? String(row.kickoff_at).replace('T', ' ').slice(0, 16) : 'sin hora';
  const pick =
    forecast && Number(forecast.win_prob) > 0
      ? ` · ${forecast.pick_label || 'pick'} ${pct(forecast.win_prob)}`
      : '';
  return `- ${when} · ${row.league_name || row.sport} · ${row.home_team_name} vs ${row.away_team_name} · ${row.status_short || 'NS'}${score}${pick}`;
}

function wantsCombinada(text) {
  return /combinad|parlay|acumulad/.test(text);
}

function legCountFromText(text) {
  if (/cuadruple|cuádruple/.test(text)) return 4;
  if (/\btriple\b/.test(text)) return 3;
  if (/\bdoble\b/.test(text)) return 2;
  const named = text.match(/\b(\d{1,2})\s*(partidos|picks|selecciones|hilos|items|legs|equipos)/);
  const de = text.match(/\bde\s+(\d{1,2})\b/);
  const raw = Number((named || de)?.[1]);
  if (raw >= 2 && raw <= 8) return raw;
  return null;
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
    .select('home_prob, draw_prob, away_prob, btts_prob, over_prob, win_prob, pick_label, confidence, summary, drivers')
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
      `Pronóstico interno previo (estimación, no certeza): ${forecast.pick_label || 'sin mercado'} ${pct(forecast.win_prob)}. Contexto 1X2 local ${pct(forecast.home_prob)}, empate ${pct(forecast.draw_prob)}, visita ${pct(forecast.away_prob)}, ambos marcan ${pct(forecast.btts_prob)}, over ${pct(forecast.over_prob)}, confianza ${forecast.confidence || 'baja'}.`
    );
    if (forecast.summary) lines.push(`Lectura guardada: ${forecast.summary}`);
  } else {
    lines.push('Pronóstico interno: todavía no generado para este partido.');
  }
  lines.push(
    'Cuotas: no están en la base. Responde con la lectura de porcentaje. No calcules EV, stake ni Kelly, y no pidas la cuota para poder opinar.'
  );
  return lines.join('\n');
}

export async function buildSportsChatContext(userText) {
  if (!(await sportsTablesReady())) return '';
  const text = norm(userText).slice(0, 2500);
  const today = zonedParts().date;
  const request = slateRequestFromText(userText);
  const focusDate = request?.date || today;
  const from = dayBoundsUtc(focusDate).start.toISOString();
  const to = dayBoundsUtc(focusDate).end.toISOString();
  const db = getDb();
  const { data, error } = await db
    .from('sports_fixtures')
    .select(SLIM)
    .gte('kickoff_at', from)
    .lte('kickoff_at', to)
    .limit(300);
  if (error) return '';

  const slate = (data || [])
    .filter((row) => !FINISHED.has(row.status_short))
    .sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)));
  const forecastById = new Map();
  const ids = slate.map((row) => row.id);
  if (ids.length) {
    const { data: forecasts } = await db
      .from('sports_forecasts')
      .select('fixture_id, win_prob, pick_label, summary, confidence')
      .in('fixture_id', ids.slice(0, 200));
    for (const row of forecasts || []) {
      if (row.summary && row.summary !== '__pending__' && Number(row.win_prob) > 0) {
        forecastById.set(row.fixture_id, row);
      }
    }
  }
  const mentioned = await findMentionedFixtures(userText);

  const parts = [
    '## Datos deportivos verificados',
    `Fecha de la agenda: ${focusDate} (America/Bogota). Solo partidos de ese día que aún no han finalizado.`,
    'Habla como tipster. El pick guardado es el mercado (totales, ambos marcan, handicap, doble oportunidad o 1X2), no siempre el ganador. Sin cuota no hay edge, EV ni stake: la salida es la lectura de porcentaje. No armes tablas. Las tarjetas con logo las pinta el chat.',
    'No cites partidos de días anteriores ni marcadores finales como pronóstico.',
    '',
    '### Agenda del día',
  ];
  if (slate.length) parts.push(...slate.slice(0, 24).map((row) => lineFixture(row, forecastById.get(row.id))));
  else parts.push('Sin partidos abiertos cargados para esta fecha.');

  if (wantsCombinada(text)) {
    const ranked = slate
      .map((row) => ({ row, forecast: forecastById.get(row.id) }))
      .filter((item) => item.forecast)
      .sort((a, b) => Number(b.forecast.win_prob) - Number(a.forecast.win_prob))
      .slice(0, 12);
    const legs = legCountFromText(text);
    parts.push('', '### Combinada');
    if (!legs) {
      parts.push(
        'Pidió una combinada y no dijo cuántas selecciones. Pregunta solo cuántos partidos quiere, de 2 a 8. No pidas cuotas, bankroll, Kelly ni perfil de riesgo.'
      );
    } else {
      parts.push(
        `Arma ya la combinada de ${legs} selecciones con los porcentajes más altos de esta lista. Es una lectura de porcentaje, sin cuota. Cada línea lleva su pick y su %. La conjunta aproximada es el producto; di que asumes independencia. No calcules EV, stake ni Kelly. No digas que no puedes porque faltan las cuotas.`
      );
    }
    if (ranked.length) {
      parts.push(
        ...ranked.map(
          (item) =>
            `- ${pct(item.forecast.win_prob)} · ${item.forecast.pick_label || 'pick'} · ${item.row.home_team_name} vs ${item.row.away_team_name} · ${item.row.league_name || item.row.sport}`
        )
      );
    } else {
      parts.push('Todavía no hay porcentajes guardados para armar la combinada.');
    }
  }

  if (mentioned.length) {
    parts.push(
      '',
      '### Partido del equipo',
      'Habla de este partido: liga, hora, forma y el pronóstico guardado. La tarjeta ya está en el chat. Si no hay pronóstico interno, di que puede pulsar Generar pronóstico y no inventes el porcentaje.'
    );
    for (const fixture of mentioned) {
      parts.push(await detailBlock(fixture));
    }
  }

  const block = parts.join('\n');
  return block.length > 7000 ? `${block.slice(0, 7000)}\n…` : block;
}
