import { createClient } from '@devjuanes/matuclient';

const url = import.meta.env.VITE_MATUDB_URL || 'https://db.matudb.com';
const projectId = import.meta.env.VITE_MATUDB_PROJECT_ID || '';
const apiKey = import.meta.env.VITE_MATUDB_API_KEY || '';
const schema = import.meta.env.VITE_MATUDB_SCHEMA || 'main';

export const db = createClient({
  url,
  projectId,
  apiKey,
  schema,
  useSupabase: false,
});

export const COMPANY_NAME =
  import.meta.env.VITE_COMPANY_NAME || 'Matu AI SaaS';
export const COMPANY_URL =
  import.meta.env.VITE_COMPANY_URL || 'https://matubyte.com';
