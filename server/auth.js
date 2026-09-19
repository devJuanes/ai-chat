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

export async function ensureWorkspace(user) {
  const db = getDb();
  const { data: profile, error: profileReadErr } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileReadErr) {
    throw new Error(
      profileReadErr.message ||
        'No se pudo leer el perfil. ¿Ejecutaste docs/schema.sql?'
    );
  }

  if (profile) {
    const wanted = String(user.name || '').trim();
    const emailPrefix = String(user.email || profile.email || '').split('@')[0];
    if (
      wanted &&
      wanted !== profile.display_name &&
      (wanted !== emailPrefix ||
        !profile.display_name ||
        profile.display_name === emailPrefix)
    ) {
      await db
        .from('profiles')
        .eq('id', profile.id)
        .update({ display_name: wanted });
      profile.display_name = wanted;
    }

    const { data: org } = await db
      .from('organizations')
      .select('*')
      .eq('id', profile.default_org_id)
      .maybeSingle();
    return { profile, org: org ?? null };
  }

  const orgId = newId();
  const orgName = `${user.name || 'Mi'} Espacio`;
  const slug = `ws-${String(user.id).replace(/-/g, '').slice(0, 12)}`;

  const { error: orgErr } = await db.from('organizations').insert({
    id: orgId,
    name: orgName,
    slug,
    plan_id: 'free',
  });
  if (orgErr) {
    throw new Error(orgErr.message || 'No se pudo crear la organización');
  }

  const { error: profileErr } = await db.from('profiles').insert({
    id: user.id,
    email: user.email,
    display_name: user.name || user.email.split('@')[0],
    default_org_id: orgId,
  });
  if (profileErr) {
    throw new Error(profileErr.message || 'No se pudo crear el perfil');
  }

  const { error: memberErr } = await db.from('organization_members').insert({
    id: newId(),
    org_id: orgId,
    user_id: user.id,
    role: 'owner',
  });
  if (memberErr) {
    throw new Error(memberErr.message || 'No se pudo unir a la organización');
  }

  const { data: createdProfile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: createdOrg } = await db
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  return { profile: createdProfile, org: createdOrg };
}

export async function getPlanForOrg(org) {
  if (!org) {
    return {
      id: 'free',
      name: 'Free',
      monthly_message_limit: 40,
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
      monthly_message_limit: 40,
      monthly_token_limit: 80000,
      max_conversations: 20,
      models_allowed: 'matu,vo0,matu-apex,matu-dev-3-5',
    }
  );
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
    };
  }
  return counter;
}

export async function checkUsage(org, userId) {
  const plan = await getPlanForOrg(org);
  const counter = await getOrCreateCounter(org.id, userId);

  if (
    plan.monthly_message_limit >= 0 &&
    (counter.messages_count || 0) >= plan.monthly_message_limit
  ) {
    return {
      ok: false,
      error: `Límite mensual de mensajes alcanzado (${plan.monthly_message_limit}). Mejora tu plan.`,
      usage: counter,
      plan,
    };
  }

  const usedTokens = (counter.tokens_in || 0) + (counter.tokens_out || 0);
  if (plan.monthly_token_limit >= 0 && usedTokens >= plan.monthly_token_limit) {
    return {
      ok: false,
      error: 'Límite mensual de tokens alcanzado. Mejora tu plan.',
      usage: counter,
      plan,
    };
  }

  return { ok: true, usage: counter, plan };
}

export async function bumpUsage(org, userId, tokensIn = 0, tokensOut = 0) {
  const counter = await getOrCreateCounter(org.id, userId);
  const db = getDb();
  const next = {
    messages_count: (counter.messages_count || 0) + 1,
    tokens_in: (counter.tokens_in || 0) + tokensIn,
    tokens_out: (counter.tokens_out || 0) + tokensOut,
  };
  await db.from('usage_counters').eq('id', counter.id).update(next);
  return { ...counter, ...next };
}
