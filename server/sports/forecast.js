import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import { completeUpstreamChat } from '../upstream.js';
import { FINISHED, PROVIDERS } from './constants.js';
import { pairKey } from './normalize.js';
import { isSportsSyncing, sportsTablesReady } from './sync.js';
import { zonedDateTimeToUtc, zonedParts } from './time.js';

const SYSTEM = `Eres MatuSports Pro, motor cuantitativo de Matu AI SaaS (MatuByte S.A.S.).
Generas un pronóstico interno para guardarlo en base de datos.

Reglas:
- Usa solo los datos del paquete. No inventes lesiones, alineaciones, cuotas, xG ni resultados.
- No hay cuotas en el paquete: no calcules edge, EV ni stake. no_bet debe ser true.
- Si la muestra es corta o faltan forma y H2H, baja la confianza y dilo.
- Las probabilidades son estimaciones, no certezas.
- Fútbol: home + draw + away = 1. Incluye btts y over (más de 2.5 goles) entre 0 y 1.
- Baloncesto, NBA y hockey: draw = null. home + away = 1. btts = null. over puede ser null si no hay línea.
- Responde únicamente JSON válido, sin markdown:
{"home":0.42,"draw":0.28,"away":0.30,"btts":0.55,"over":0.48,"confidence":"baja","no_bet":true,"summary":"2 a 4 frases en español","drivers":["factor 1","factor 2"]}`;

function clamp(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

function parseJson(text) {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : String(text || '');
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(body.slice(start, end + 1));
}

async function forecastsToday() {
  const start = zonedDateTimeToUtc(zonedParts().date, 0, 0).toISOString();
  const { data, error } = await getDb()
    .from('sports_forecasts')
    .select('id')
    .gte('created_at', start)
    .limit(200);
  if (error) return config.sports.forecastCap;
  return (data || []).length;
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

async function writeForecast(fixture, payload) {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    fixture_id: fixture.id,
    model_id: 'matu-sports-pro',
    home_prob: payload.home_prob,
    draw_prob: payload.draw_prob,
    away_prob: payload.away_prob,
    btts_prob: payload.btts_prob,
    over_prob: payload.over_prob,
    confidence: payload.confidence,
    no_bet: true,
    summary: payload.summary,
    drivers: payload.drivers,
    raw_text: payload.raw_text,
    inputs: payload.inputs,
    updated_at: now,
  };
  const { data: existing } = await db
    .from('sports_forecasts')
    .select('id')
    .eq('fixture_id', fixture.id)
    .limit(1);
  if (existing?.[0]?.id) {
    await db.from('sports_forecasts').update(row).eq('id', existing[0].id);
    return;
  }
  await db.from('sports_forecasts').insert({ ...row, id: newId(), created_at: now });
}

export async function forecastPending(limit = 1) {
  if (!config.sports.enabled || !config.upstream.apiKey) return 0;
  if (isSportsSyncing()) return 0;
  if (!(await sportsTablesReady())) return 0;
  const cap = config.sports.forecastCap || 36;
  const done = await forecastsToday();
  if (done >= cap) return 0;

  const now = Date.now();
  const from = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 40 * 60 * 60 * 1000).toISOString();
  const db = getDb();
  const { data: fixtures, error } = await db
    .from('sports_fixtures')
    .select('*')
    .eq('is_priority', true)
    .gte('kickoff_at', from)
    .lte('kickoff_at', to)
    .limit(80);
  if (error || !fixtures?.length) return 0;

  const ids = fixtures.map((f) => f.id);
  const { data: existing } = await db
    .from('sports_forecasts')
    .select('fixture_id')
    .in('fixture_id', ids.slice(0, 80));
  const have = new Set((existing || []).map((r) => r.fixture_id));

  const pending = fixtures
    .filter((f) => !have.has(f.id) && !FINISHED.has(f.status_short))
    .sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)))
    .slice(0, Math.max(1, limit));

  let wrote = 0;
  for (const fixture of pending) {
    if (done + wrote >= cap) break;
    const spec = PROVIDERS[fixture.provider] || PROVIDERS.football;
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
      });
    } catch (err) {
      console.warn('[sports] pronóstico', err?.message || err);
      continue;
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
    await writeForecast(fixture, {
      home_prob: homeP,
      draw_prob: drawP,
      away_prob: awayP,
      btts_prob: hasDraw ? clamp(parsed?.btts) : null,
      over_prob: clamp(parsed?.over),
      confidence: ['baja', 'media', 'alta'].includes(parsed?.confidence)
        ? parsed.confidence
        : 'baja',
      summary: String(parsed?.summary || raw || 'Sin lectura estructurada').slice(0, 1200),
      drivers: Array.isArray(parsed?.drivers) ? parsed.drivers.slice(0, 5) : [],
      raw_text: String(raw || '').slice(0, 4000),
      inputs: packet,
    });
    wrote += 1;
    console.log(
      `[sports] pronóstico ${fixture.home_team_name} vs ${fixture.away_team_name}`
    );
  }
  return wrote;
}
