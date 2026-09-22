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
    /** MiniMax image-01 (generación de imágenes en chat) */
    imageModel: trim(process.env.UPSTREAM_IMAGE_MODEL, 'image-01'),
  },
  /** MoneyPrinterTurbo (Imagine — generación de videos) */
  moneyPrinter: {
    baseUrl: trim(
      process.env.MONEYPRINTER_BASE_URL,
      'http://127.0.0.1:8080'
    ).replace(/\/$/, ''),
    /** URL pública para links de video (si vacío, usa baseUrl) */
    publicBaseUrl: trim(process.env.MONEYPRINTER_PUBLIC_URL).replace(
      /\/$/,
      ''
    ),
    apiKey: trim(process.env.MONEYPRINTER_API_KEY),
  },
  publicAppUrl: trim(
    process.env.PUBLIC_APP_URL,
    'http://127.0.0.1:5173'
  ).replace(/\/$/, ''),
  /** Meta platform (WhatsApp / Messenger / Instagram) */
  meta: {
    appId: trim(process.env.META_APP_ID),
    appSecret: trim(process.env.META_APP_SECRET),
    verifyToken: trim(process.env.META_VERIFY_TOKEN),
    apiVersion: trim(process.env.META_API_VERSION, 'v21.0'),
    embeddedSignupConfigId: trim(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID),
    tokenEncryptionKey: trim(process.env.META_TOKEN_ENCRYPTION_KEY),
  },
};
