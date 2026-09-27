import { config } from '../config.js';

export function timeZone() {
  return config.timezone || 'America/Bogota';
}

export function zonedParts(date = new Date(), zone = timeZone()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const g = (type) => parts.find((p) => p.type === type)?.value || '00';
  const hour = g('hour') === '24' ? '00' : g('hour');
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    hour: Number(hour),
    minute: Number(g('minute')),
    second: Number(g('second')),
  };
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Convierte una hora de reloj en la zona configurada a un instante UTC. */
export function zonedDateTimeToUtc(isoDate, hour, minute, zone = timeZone()) {
  const [y, m, d] = isoDate.split('-').map(Number);
  let utc = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const p = zonedParts(new Date(utc), zone);
    const [py, pm, pd] = p.date.split('-').map(Number);
    const got = Date.UTC(py, pm - 1, pd, p.hour, p.minute, 0);
    const want = Date.UTC(y, m - 1, d, hour, minute, 0);
    const delta = want - got;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function msUntilNext(hour, minute, zone = timeZone()) {
  const now = new Date();
  const p = zonedParts(now, zone);
  let targetDate = p.date;
  const passed =
    p.hour > hour || (p.hour === hour && p.minute >= minute);
  if (passed) targetDate = addDays(p.date, 1);
  const target = zonedDateTimeToUtc(targetDate, hour, minute, zone);
  return Math.max(1500, target.getTime() - now.getTime());
}

export function dayBoundsUtc(isoDate, zone = timeZone()) {
  return {
    start: zonedDateTimeToUtc(isoDate, 0, 0, zone),
    end: zonedDateTimeToUtc(addDays(isoDate, 1), 0, 0, zone),
  };
}
