import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const CATALOG = [
  {
    id: 'matu',
    name: 'Matu',
    tagline: 'Flagship de negocio',
    file: 'matu.md',
    plans: ['free', 'pro', 'team'],
  },
  {
    id: 'vo0',
    name: 'VO0',
    tagline: 'Respuestas relámpago',
    file: 'vo0.md',
    plans: ['free', 'pro', 'team'],
  },
  {
    id: 'vo5',
    name: 'VO5',
    tagline: 'Estrategia profunda',
    file: 'vo5.md',
    plans: ['pro', 'team'],
  },
  {
    id: 'matu-apex',
    name: 'Matu Forge',
    tagline: 'Ingeniero · ventas · ops (3 en 1)',
    file: 'matu-apex.md',
    plans: ['free', 'pro', 'team'],
  },
  {
    id: 'matu-dev-3-5',
    name: 'Matu Dev 3.5',
    tagline: 'UI/UX · diseño web · frontend elite',
    file: 'MatuDev3-5.md',
    plans: ['free', 'pro', 'team'],
  },
  {
    id: 'matu-space-ultra',
    name: 'Matu Space Ultra',
    tagline: 'Ingeniería · razonamiento · agente frontier',
    file: 'MatuSpaceUltra.md',
    plans: ['free', 'pro', 'team'],
  },
  {
    id: 'matu-commerce',
    name: 'Matu Commerce',
    tagline: 'E-commerce · CRM · revenue ops',
    file: 'MatuCommerce.md',
    plans: ['free', 'pro', 'team'],
  },
  {
    id: 'matu-marketing',
    name: 'Matu Marketing',
    tagline: 'Growth · copy · adquisición',
    file: 'MatuMarketing.md',
    plans: ['free', 'pro', 'team'],
  },
];

/** Modelos permitidos para organizaciones vinculadas desde Sizor */
export const SIZOR_MODEL_IDS = ['matu', 'matu-marketing', 'matu-commerce'];

const promptCache = new Map();

/** Modelos que siempre deben aparecer aunque el CSV del plan en DB esté viejo */
const ALWAYS_ON_FREE = new Set([
  'matu',
  'vo0',
  'matu-apex',
  'matu-dev-3-5',
  'matu-space-ultra',
  'matu-commerce',
  'matu-marketing',
]);

function formatNow() {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: config.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function ensureCatalogModels(list, planId) {
  const ids = new Set(list.map((m) => m.id));
  for (const m of CATALOG) {
    if (!m.plans.includes(planId)) continue;
    if (ALWAYS_ON_FREE.has(m.id) && !ids.has(m.id)) {
      list.push(m);
      ids.add(m.id);
    }
  }
  return list;
}

export function listPublicModels(
  planId = 'free',
  modelsAllowedCsv = '',
  opts = {}
) {
  const pid = planId || 'free';
  let list = CATALOG.filter((m) => m.plans.includes(pid));

  const allowed = (modelsAllowedCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length) {
    list = list.filter(
      (m) => allowed.includes(m.id) || ALWAYS_ON_FREE.has(m.id)
    );
  }

  list = ensureCatalogModels(list, pid);

  if (opts.sizorOnly) {
    const sizor = new Set(SIZOR_MODEL_IDS);
    list = list.filter((m) => sizor.has(m.id));
    // Si el plan no los tenía, forzar los dos de Sizor
    if (!list.length) {
      list = CATALOG.filter((m) => sizor.has(m.id));
    }
  }

  return list.map(({ id, name, tagline }) => ({ id, name, tagline }));
}

export function getModel(id) {
  return CATALOG.find((m) => m.id === id) ?? CATALOG[0];
}

export function loadSystemPrompt(modelId, extraContext = '', options = {}) {
  const model = getModel(modelId);
  const filePath = path.join(config.root, 'docs', 'models', model.file);
  let base = promptCache.get(model.id);
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (raw !== base) {
      base = raw;
      promptCache.set(model.id, raw);
    }
  } catch {
    base = base || `Eres ${model.name}, asistente de Matu AI SaaS.`;
  }

  const templateBlock = options.templateBlock
    ? `\n${options.templateBlock}\n`
    : '';

  return `${base}

## Contexto en vivo
Fecha y hora actuales: ${formatNow()} (${config.timezone}).
Empresa: ${config.companyName} — ${config.companyUrl}.
${extraContext ? `\n## Contexto del proyecto\n${extraContext}\n` : ''}${templateBlock}`;
}

export function isModelAllowed(modelId, planId, modelsAllowedCsv, opts = {}) {
  if (opts.sizorOnly) {
    return SIZOR_MODEL_IDS.includes(modelId);
  }
  if (ALWAYS_ON_FREE.has(modelId)) {
    const model = getModel(modelId);
    return model.plans.includes(planId || 'free');
  }
  const allowed = (modelsAllowedCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(modelId)) {
    return false;
  }
  const model = getModel(modelId);
  return model.plans.includes(planId || 'free');
}
