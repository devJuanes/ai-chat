import { createClient } from '@devjuanes/matuclient';
import { config } from './config.js';

let admin = null;

export function getDb() {
  if (!admin) {
    const { url, projectId, serviceKey, schema } = config.matudb;
    if (!projectId || !serviceKey) {
      throw new Error('MATUDB_PROJECT_ID and MATUDB_SERVICE_KEY are required');
    }
    admin = createClient({
      url,
      projectId,
      apiKey: serviceKey,
      schema,
      useSupabase: false,
    });
  }
  return admin;
}

export function newId() {
  return crypto.randomUUID();
}

export function periodYm(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
