import { config } from './config.js';
import { getDb, newId, periodYm } from './db.js';
import {
  decodeJwtPayload,
  matudbGetUser,
  userFromJwt,
} from './matudb-auth.js';

/**
 * Verifica el Bearer token de MatuDB.
 * 1) Decodifica JWT (fuente de verdad rápida)
 * 2) Confirma con GET /auth/user cuando sea posible
 */
export async function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const clean = token.trim();
  if (!clean || clean === 'undefined' || clean === 'null') return null;

  // 1) JWT local — MatuDB firma estos tokens al hacer login/register
  const fromJwt = userFromJwt(clean);
  if (fromJwt) {
    try {
      const payload = decodeJwtPayload(clean);
      const { user } = await matudbGetUser(
        clean,
        payload?.project_id || config.matudb.projectId
      );
      if (user?.id) {
        return {
          id: String(user.id),
          email: user.email || fromJwt.email,
          name:
            user.name ||
            fromJwt.name ||
            (user.email || fromJwt.email || 'Usuario').split('@')[0],
        };
      }
    } catch {
      /* usamos JWT si trae email */
    }
    if (!fromJwt.email) return null;
    return fromJwt;
  }

  // 2) Solo remoto (por si el JWT no se pudo decodificar)
  try {
    const { user } = await matudbGetUser(clean, config.matudb.projectId);
    if (user?.id) {
      return {
        id: String(user.id),
        email: user.email,
        name: user.name || user.email?.split('@')[0] || 'Usuario',
      };
    }
  } catch {
    /* noop */
  }

  return null;
}

export function authMiddleware(required = true) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : null;

    if (!token) {
      if (required) {
        return res
          .status(401)
          .json({ error: { message: 'Debes iniciar sesión' } });
      }
      req.user = null;
      return next();
    }

    try {
      const user = await verifyAccessToken(token);
      if (!user) {
        if (required) {
          return res.status(401).json({
            error: {
              message:
                'Sesión inválida. Cierra sesión e inicia de nuevo.',
            },
          });
        }
        req.user = null;
        return next();
      }
      req.user = user;
      req.accessToken = token;
      return next();
    } catch (err) {
      return res.status(401).json({
        error: { message: err.message || 'Error de autenticación' },
      });
    }
  };
}

/** Serialize ensureWorkspace per user to avoid slug/profile races on parallel /api/* boot. */
const workspaceLocks = new Map();

function withWorkspaceLock(userId, fn) {
  const key = String(userId);
  const prev = workspaceLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (workspaceLocks.get(key) === next) workspaceLocks.delete(key);
  });
  workspaceLocks.set(key, next);
  return next;
}

function isDuplicateError(err) {
  const msg = String(err?.message || err || '');
  return /duplicate|unique|already exists/i.test(msg);
}

async function loadProfileAndOrg(db, userId) {
  const { data: profile, error: profileReadErr } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileReadErr) {
    throw new Error(
      profileReadErr.message ||
        'No se pudo leer el perfil. ¿Ejecutaste docs/schema.sql?'
    );
  }
  if (!profile) return null;

  const { data: org } = await db
    .from('organizations')
    .select('*')
    .eq('id', profile.default_org_id)
    .maybeSingle();
  return { profile, org: org ?? null };
}

async function ensureMembership(db, orgId, userId) {
  try {
    const { data: existing } = await db
      .from('organization_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return;

    const { error: memberErr } = await db.from('organization_members').insert({
      id: newId(),
      org_id: orgId,
      user_id: userId,
      role: 'owner',
    });
    if (memberErr && !isDuplicateError(memberErr)) {
      throw new Error(memberErr.message || 'No se pudo unir a la organización');
    }
  } catch (err) {
    if (isDuplicateError(err)) return;
    throw err;
  }
}

async function ensureWorkspaceUnlocked(user) {
  const db = getDb();
  const existing = await loadProfileAndOrg(db, user.id);

  if (existing) {
    const { profile } = existing;
    const wanted = String(user.name || '').trim();
    const emailPrefix = String(user.email || profile.email || '').split('@')[0];
    if (
      wanted &&
      wanted !== profile.display_name &&
      (wanted !== emailPrefix ||
        !profile.display_name ||
        profile.display_name === emailPrefix)
    ) {
      try {
        await db
          .from('profiles')
          .eq('id', profile.id)
          .update({ display_name: wanted });
        profile.display_name = wanted;
      } catch {
        /* non-fatal */
      }
    }
    return existing;
  }

  const orgName = `${user.name || 'Mi'} Espacio`;
  const slug = `ws-${String(user.id).replace(/-/g, '').slice(0, 12)}`;

  let org = null;
  try {
    const { data } = await db
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    org = data || null;
  } catch {
    org = null;
  }

  if (!org) {
    const orgId = newId();
    try {
      const { error: orgErr } = await db.from('organizations').insert({
        id: orgId,
        name: orgName,
        slug,
        plan_id: 'free',
      });
      if (orgErr) {
        if (!isDuplicateError(orgErr)) {
          throw new Error(orgErr.message || 'No se pudo crear la organización');
        }
      } else {
        const { data: createdOrg } = await db
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .maybeSingle();
        org = createdOrg || null;
      }
    } catch (err) {
      if (!isDuplicateError(err)) throw err;
    }

    if (!org) {
      const { data: raced } = await db
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      org = raced || null;
    }
  }

  if (!org) {
    throw new Error('No se pudo crear ni recuperar la organización');
  }

  const again = await loadProfileAndOrg(db, user.id);
  if (again) return again;

  try {
    const { error: profileErr } = await db.from('profiles').insert({
      id: user.id,
      email: user.email,
      display_name: user.name || user.email?.split('@')[0] || 'Usuario',
      default_org_id: org.id,
    });
    if (profileErr) {
      if (!isDuplicateError(profileErr)) {
        throw new Error(profileErr.message || 'No se pudo crear el perfil');
      }
      const raced = await loadProfileAndOrg(db, user.id);
      if (raced) return raced;
      throw new Error(profileErr.message || 'No se pudo crear el perfil');
    }
  } catch (err) {
    if (isDuplicateError(err)) {
      const raced = await loadProfileAndOrg(db, user.id);
      if (raced) return raced;
    }
    // If profile already exists under race, re-read; otherwise rethrow
    const raced = await loadProfileAndOrg(db, user.id);
    if (raced) return raced;
    throw err instanceof Error
      ? err
      : new Error(err?.message || 'No se pudo crear el perfil');
  }

  try {
    await ensureMembership(db, org.id, user.id);
  } catch (err) {
    if (!isDuplicateError(err)) {
      console.warn('[ensureWorkspace] membership', err?.message || err);
    }
  }

  const created = await loadProfileAndOrg(db, user.id);
  if (!created) {
    throw new Error('Perfil creado pero no se pudo leer');
  }
  return created;
}

export async function ensureWorkspace(user) {
  return withWorkspaceLock(user.id, () => ensureWorkspaceUnlocked(user));
}

export async function getPlanForOrg(org) {
  if (!org) {
    return {
      id: 'free',
      name: 'Free',
      monthly_message_limit: -1,
      monthly_token_limit: 80000,
      max_conversations: 20,
      models_allowed: 'matu,vo0,matu-apex,matu-dev-3-5',
    };
  }
  const db = getDb();
  const { data: plan } = await db
    .from('plans')
    .select('*')
    .eq('id', org.plan_id || 'free')
    .maybeSingle();
  return (
    plan || {
      id: 'free',
      name: 'Free',
      monthly_message_limit: -1,
      monthly_token_limit: 80000,
      max_conversations: 20,
      models_allowed: 'matu,vo0,matu-apex,matu-dev-3-5',
    }
  );
}

async function getProfileFlags(userId) {
  const db = getDb();
  try {
    const { data, error } = await db
      .from('profiles')
      .select('id, is_admin, email, display_name')
      .eq('id', userId)
      .maybeSingle();
    if (error && /is_admin|column/i.test(error.message || '')) {
      const { data: fallback } = await db
        .from('profiles')
        .select('id, email, display_name')
        .eq('id', userId)
        .maybeSingle();
      return { ...(fallback || { id: userId }), is_admin: false };
    }
    return data || { id: userId, is_admin: false };
  } catch {
    return { id: userId, is_admin: false };
  }
}

async function getOrCreateCounter(orgId, userId) {
  const db = getDb();
  const ym = periodYm();
  let { data: counter } = await db
    .from('usage_counters')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('period_ym', ym)
    .maybeSingle();

  if (!counter) {
    const id = newId();
    await db.from('usage_counters').insert({
      id,
      org_id: orgId,
      user_id: userId,
      period_ym: ym,
      messages_count: 0,
      tokens_in: 0,
      tokens_out: 0,
    });
    counter = {
      id,
      messages_count: 0,
      tokens_in: 0,
      tokens_out: 0,
      period_ym: ym,
    };
  }
  return counter;
}

async function getOrCreateModelUsage(orgId, userId, modelId) {
  const db = getDb();
  const ym = periodYm();
  const mid = String(modelId || 'matu').trim() || 'matu';
  const empty = {
    id: null,
    org_id: orgId,
    user_id: userId,
    model_id: mid,
    period_ym: ym,
    messages_count: 0,
    tokens_in: 0,
    tokens_out: 0,
    _missingTable: false,
  };

  try {
    const { data: row, error: selErr } = await db
      .from('usage_by_model')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('model_id', mid)
      .eq('period_ym', ym)
      .maybeSingle();

    if (selErr) {
      // Table missing or schema not migrated yet — don't block chat/bots
      return { ...empty, _missingTable: true };
    }
    if (row) return row;

    const id = newId();
    const insert = { ...empty, id, updated_at: new Date().toISOString() };
    delete insert._missingTable;
    const { error } = await db.from('usage_by_model').insert(insert);
    if (error) {
      if (/duplicate|unique|already/i.test(error.message || '')) {
        const { data: again } = await db
          .from('usage_by_model')
          .select('*')
          .eq('org_id', orgId)
          .eq('user_id', userId)
          .eq('model_id', mid)
          .eq('period_ym', ym)
          .maybeSingle();
        if (again) return again;
      }
      return { ...empty, id, _missingTable: true };
    }
    return insert;
  } catch {
    return { ...empty, _missingTable: true };
  }
}

/** Default token caps if plan_model_limits row is missing */
const DEFAULT_MODEL_CAPS = {
  free: {
    matu: 25000,
    vo0: 15000,
    'matu-apex': 20000,
    'matu-dev-3-5': 20000,
    'matu-space-ultra': 15000,
    'matu-commerce': 15000,
    'matu-marketing': 15000,
    'matu-bot-3-5': 40000,
    '*': 15000,
  },
  pro: {
    '*': 300000,
    'matu-bot-3-5': 500000,
  },
  team: {
    '*': -1,
  },
};

export async function getModelTokenLimit(planId, modelId) {
  const mid = String(modelId || 'matu').trim() || 'matu';
  const pid = planId || 'free';
  const db = getDb();
  try {
    const { data, error } = await db
      .from('plan_model_limits')
      .select('monthly_token_limit')
      .eq('plan_id', pid)
      .eq('model_id', mid)
      .maybeSingle();
    if (!error && data && typeof data.monthly_token_limit === 'number') {
      return data.monthly_token_limit;
    }
  } catch {
    /* table missing */
  }
  const pack = DEFAULT_MODEL_CAPS[pid] || DEFAULT_MODEL_CAPS.free;
  if (typeof pack[mid] === 'number') return pack[mid];
  return typeof pack['*'] === 'number' ? pack['*'] : 15000;
}

export async function listModelUsage(orgId, userId, planId) {
  const db = getDb();
  const ym = periodYm();
  let rows = [];
  try {
    const { data, error } = await db
      .from('usage_by_model')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('period_ym', ym);
    if (!error) rows = data || [];
  } catch {
    rows = [];
  }

  const byId = new Map(rows.map((r) => [r.model_id, r]));
  const modelIds = new Set([
    ...Object.keys(DEFAULT_MODEL_CAPS.free),
    ...rows.map((r) => r.model_id),
  ]);
  modelIds.delete('*');

  const out = [];
  for (const modelId of [...modelIds].sort()) {
    const row = byId.get(modelId);
    const limit = await getModelTokenLimit(planId, modelId);
    const tokensIn = row?.tokens_in || 0;
    const tokensOut = row?.tokens_out || 0;
    const used = tokensIn + tokensOut;
    out.push({
      model_id: modelId,
      period_ym: ym,
      messages_count: row?.messages_count || 0,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      tokens_total: used,
      monthly_token_limit: limit,
      pct:
        limit < 0
          ? 0
          : limit === 0
            ? 100
            : Math.min(100, Math.round((used / limit) * 100)),
    });
  }
  return out;
}

async function maybeNotifyThreshold({
  orgId,
  userId,
  modelId,
  used,
  limit,
}) {
  if (limit == null || limit < 0) return;
  if (limit === 0) return;
  const pct = Math.round((used / limit) * 100);
  const crossed = [30, 70, 90].filter((t) => pct >= t);
  if (!crossed.length) return;

  const db = getDb();
  const ym = periodYm();
  for (const threshold of crossed) {
    const title =
      threshold >= 90
        ? `Uso crítico · ${modelId}`
        : threshold >= 70
          ? `Uso alto · ${modelId}`
          : `Aviso de uso · ${modelId}`;
    const body = `Has consumido ~${threshold}% de la cuota mensual de tokens del modelo ${modelId} (${used.toLocaleString('es')}/${limit.toLocaleString('es')}).`;
    try {
      const { error } = await db.from('usage_notifications').insert({
        id: newId(),
        org_id: orgId,
        user_id: userId,
        period_ym: ym,
        model_id: modelId,
        threshold,
        title,
        body,
      });
      if (error && !/duplicate|unique|already/i.test(error.message || '')) {
        console.warn('[usage] notify', error.message);
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {object} org
 * @param {string} userId
 * @param {string} [modelId] — if omitted, only soft global token check (legacy)
 */
export async function checkUsage(org, userId, modelId = null) {
  try {
    const profile = await getProfileFlags(userId);
    const plan = await getPlanForOrg(org);
    const counter = await getOrCreateCounter(org.id, userId);

    // Admin = sin ningún tope (chat, Meta, cualquier modelo)
    if (profile.is_admin === true || profile.is_admin === 'true' || profile.is_admin === 1) {
      return {
        ok: true,
        usage: counter,
        plan,
        is_admin: true,
        unlimited: true,
      };
    }

    // Soft global token ceiling only when no model context
    if (!modelId) {
      const usedGlobal = (counter.tokens_in || 0) + (counter.tokens_out || 0);
      if (
        plan.monthly_token_limit >= 0 &&
        usedGlobal >= plan.monthly_token_limit
      ) {
        return {
          ok: false,
          error: 'Límite mensual global de tokens alcanzado. Mejora tu plan.',
          usage: counter,
          plan,
          is_admin: false,
        };
      }
    }

    if (modelId) {
      const modelLimit = await getModelTokenLimit(plan.id, modelId);
      if (modelLimit >= 0) {
        const row = await getOrCreateModelUsage(org.id, userId, modelId);
        const usedModel = (row.tokens_in || 0) + (row.tokens_out || 0);
        if (usedModel >= modelLimit) {
          return {
            ok: false,
            error: `Límite mensual de tokens del modelo «${modelId}» alcanzado (${modelLimit.toLocaleString('es')}). Mejora tu plan o usa otro modelo.`,
            usage: counter,
            plan,
            model_id: modelId,
            model_used: usedModel,
            model_limit: modelLimit,
            is_admin: false,
          };
        }
      }
    }

    return { ok: true, usage: counter, plan, is_admin: false };
  } catch (err) {
    // Nunca tumbar el chat/bot por un fallo de billing
    console.warn('[usage] checkUsage soft-fail', err.message);
    return { ok: true, usage: null, plan: null, soft_fail: true };
  }
}

export async function bumpUsage(
  org,
  userId,
  tokensIn = 0,
  tokensOut = 0,
  modelId = null
) {
  const counter = await getOrCreateCounter(org.id, userId);
  const db = getDb();
  const next = {
    messages_count: (counter.messages_count || 0) + 1,
    tokens_in: (counter.tokens_in || 0) + tokensIn,
    tokens_out: (counter.tokens_out || 0) + tokensOut,
  };
  await db.from('usage_counters').eq('id', counter.id).update(next);

  if (modelId) {
    const row = await getOrCreateModelUsage(org.id, userId, modelId);
    if (!row._missingTable) {
      const modelNext = {
        messages_count: (row.messages_count || 0) + 1,
        tokens_in: (row.tokens_in || 0) + tokensIn,
        tokens_out: (row.tokens_out || 0) + tokensOut,
        updated_at: new Date().toISOString(),
      };
      await db.from('usage_by_model').eq('id', row.id).update(modelNext);
      const plan = await getPlanForOrg(org);
      const limit = await getModelTokenLimit(plan.id, modelId);
      const used = modelNext.tokens_in + modelNext.tokens_out;
      await maybeNotifyThreshold({
        orgId: org.id,
        userId,
        modelId,
        used,
        limit,
      });
    }
  }

  return { ...counter, ...next };
}

export async function listUsageNotifications(userId, { unreadOnly = false } = {}) {
  const db = getDb();
  try {
    let q = db
      .from('usage_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (unreadOnly) q = q.is('read_at', null);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function markNotificationsRead(userId, ids = null) {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    let q = db
      .from('usage_notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null);
    if (ids?.length) q = q.in('id', ids);
    await q;
  } catch {
    /* ignore */
  }
}
