import { getDb } from '../db.js';

const OPTIONAL = [
  'home_logo',
  'away_logo',
  'league_logo',
  'win_prob',
  'pick_label',
  'slate_date',
  'is_premium',
];

function messageOf(error) {
  return String(error?.message || error || '');
}

function isMissingColumn(error) {
  return /column|schema cache|could not find/i.test(messageOf(error));
}

function withoutOptional(row) {
  const next = { ...row };
  for (const key of OPTIONAL) delete next[key];
  return next;
}

/** Inserta. Si faltan columnas nuevas, reintenta sin ellas. */
export async function insertRow(table, row) {
  const db = getDb();
  const first = await db.from(table).insert(row);
  if (!first?.error || !isMissingColumn(first.error)) return first;
  const slim = Array.isArray(row) ? row.map(withoutOptional) : withoutOptional(row);
  return db.from(table).insert(slim);
}

/**
 * MatuDB (@devjuanes/matuclient) filtra antes de escribir:
 *   db.from(tabla).eq('id', id).update(payload)
 * update().eq() no existe y lanza "eq is not a function".
 */
export async function updateWhere(table, column, value, payload) {
  const db = getDb();
  const first = await db.from(table).eq(column, value).update(payload);
  if (!first?.error || !isMissingColumn(first.error)) return first;
  return db.from(table).eq(column, value).update(withoutOptional(payload));
}
