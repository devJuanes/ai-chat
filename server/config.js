import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env'), override: true, quiet: true });

function trim(v, fallback = '') {
  return (v ?? fallback).toString().trim();
}

export const config = {
  root,
  port: Number(process.env.PORT || 8787),
  timezone: trim(process.env.APP_TIMEZONE, 'America/Bogota'),
  companyName: trim(process.env.COMPANY_NAME, 'Matu AI SaaS'),
  companyUrl: trim(process.env.COMPANY_URL, 'https://matubyte.com'),
  matudb: {
    url: trim(process.env.MATUDB_URL, 'https://db.matudb.com').replace(/\/$/, ''),
    projectId: trim(process.env.MATUDB_PROJECT_ID),
    apiKey: trim(process.env.MATUDB_API_KEY),
    serviceKey: trim(
      process.env.MATUDB_SERVICE_KEY || process.env.MATUDB_API_KEY
    ),
    schema: trim(process.env.MATUDB_SCHEMA, 'main'),
  },
  upstream: {
    apiKey: trim(process.env.UPSTREAM_API_KEY || process.env.MINIMAX_API_KEY),
    baseUrl: trim(
      process.env.UPSTREAM_BASE_URL,
      'https://api.minimax.io/v1'
    ).replace(/\/$/, ''),
    model: trim(process.env.UPSTREAM_MODEL, 'MiniMax-M3'),
  },
};
