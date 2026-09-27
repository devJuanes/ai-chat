import { config } from '../config.js';
import { forecastPending } from './forecast.js';
import { runSportsIngest, sportsTablesReady } from './sync.js';
import { msUntilNext } from './time.js';

let started = false;
let booted = false;

async function bootWhenReady() {
  if (booted) return;
  if (!(await sportsTablesReady())) {
    setTimeout(bootWhenReady, 60000);
    return;
  }
  booted = true;
  await runSportsIngest({ kind: 'boot' });
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
    await forecastPending(1);
  } catch (err) {
    console.warn('[sports] pronóstico', err?.message || err);
  }
  setTimeout(forecastTick, 120000);
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

  arm(0, 5, () => runSportsIngest({ kind: 'midnight' }), 'carga del día');
  arm(
    12,
    10,
    () => runSportsIngest({ refreshOnly: true, kind: 'midday' }),
    'marcadores mediodía'
  );
  arm(
    22,
    10,
    () => runSportsIngest({ refreshOnly: true, kind: 'night' }),
    'marcadores noche'
  );

  setTimeout(() => {
    bootWhenReady().catch((err) => {
      console.warn('[sports] arranque', err?.message || err);
    });
  }, 8000);

  setTimeout(forecastTick, 25000);
}
