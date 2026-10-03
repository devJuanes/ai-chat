import { config } from '../config.js';
import { ensureForecastsForDate, forecastsBusy } from './forecast.js';
import { runSportsIngest, sportsTablesReady } from './sync.js';
import { addDays, msUntilNext, zonedParts } from './time.js';

let started = false;
let booted = false;

async function bootWhenReady() {
  if (booted) return;
  if (!(await sportsTablesReady())) {
    setTimeout(bootWhenReady, 60000);
    return;
  }
  booted = true;
  await loadAndForecast({ kind: 'boot' });
}

/** Carga los partidos y, enseguida, el modelo escribe los pronósticos del día. */
async function loadAndForecast({ refreshOnly = false, kind = 'ingest' } = {}) {
  await runSportsIngest({ refreshOnly, kind });
  if (!config.sports.forecasts) return;
  const today = zonedParts().date;
  const todayWrote = await ensureForecastsForDate(today, 8);
  console.log(`[sports] pronósticos top ${today}: ${todayWrote}`);
  if (refreshOnly) return;
  const tomorrow = addDays(today, 1);
  const tomorrowWrote = await ensureForecastsForDate(tomorrow, 4);
  console.log(`[sports] pronósticos top ${tomorrow}: ${tomorrowWrote}`);
}

function arm(hour, minute, fn, label) {
  const wait = msUntilNext(hour, minute);
  setTimeout(async () => {
    try {
      await fn();
    } catch (err) {
      console.warn(`[sports] ${label}`, err?.message || err);
    }
    arm(hour, minute, fn, label);
  }, wait);
  console.log(
    `[sports] ${label} a las ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${config.timezone}) en ${Math.round(wait / 60000)} min`
  );
}

async function forecastTick() {
  try {
    if (!forecastsBusy()) await ensureForecastsForDate(zonedParts().date, 8);
  } catch (err) {
    console.warn('[sports] pronóstico', err?.message || err);
  }
  setTimeout(forecastTick, 30000);
}

export function startSportsScheduler() {
  if (started) return;
  started = true;
  if (!config.sports.enabled) {
    console.log('[sports] sync desactivado');
    return;
  }
  if (!config.sports.apiKey) {
    console.warn('[sports] falta SPORTS_API_KEY; no se cargan partidos');
    return;
  }

  arm(0, 5, () => loadAndForecast({ kind: 'midnight' }), 'carga del día');
  arm(
    12,
    10,
    () => loadAndForecast({ refreshOnly: true, kind: 'midday' }),
    'marcadores mediodía'
  );
  arm(
    22,
    10,
    () => loadAndForecast({ refreshOnly: true, kind: 'night' }),
    'marcadores noche'
  );

  setTimeout(() => {
    bootWhenReady().catch((err) => {
      console.warn('[sports] arranque', err?.message || err);
    });
  }, 8000);

  if (config.sports.forecasts) setTimeout(forecastTick, 25000);
  else console.log('[sports] pronósticos desactivados');
}
