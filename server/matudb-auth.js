import { config } from './config.js';

function authBase(projectId = config.matudb.projectId) {
  return `${config.matudb.url}/api/projects/${projectId}/auth`;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: config.matudb.apiKey,
  };
}

export async function matudbRegister({ email, password, name }) {
  const res = await fetch(`${authBase()}/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password, name }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(
      json.message || json.error?.message || json.error || 'No se pudo registrar'
    );
  }
  // MatuDB client shape: { data: { user, token } }
  const user = json.data?.user ?? json.user;
  const token = json.data?.token ?? json.token ?? json.data?.session?.access_token;
  if (!token || !(user?.id || user?.user_id)) {
    throw new Error(
      json.message || 'MatuDB no devolvió una sesión válida al registrar'
    );
  }
  return {
    user: {
      ...user,
      id: user.id || user.user_id,
    },
    token,
  };
}

export async function matudbLogin({ email, password }) {
  const res = await fetch(`${authBase()}/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(
      json.message ||
        json.error?.message ||
        json.error ||
        'Correo o contraseña incorrectos'
    );
  }
  const user = json.data?.user ?? json.user;
  const token = json.data?.token ?? json.token ?? json.data?.session?.access_token;
  if (!token || !(user?.id || user?.user_id)) {
    throw new Error(json.message || 'Correo o contraseña incorrectos');
  }
  return {
    user: {
      ...user,
      id: user.id || user.user_id,
    },
    token,
  };
}

export async function matudbGetUser(token, projectId) {
  const pid = projectId || config.matudb.projectId;
  const res = await fetch(`${authBase(pid)}/user`, {
    headers: {
      ...authHeaders(),
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { user: null, status: res.status, raw: json };
  }
  return {
    user: json.data?.user ?? json.data ?? json.user,
    status: res.status,
    raw: json,
  };
}

export function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json = Buffer.from(padded + pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Usuario desde un JWT de MatuDB.
 * Acepta claims `id` o `sub`.
 */
export function userFromJwt(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  const id = payload.id || payload.sub || payload.user_id;
  const email = payload.email || payload.user_email || null;
  if (!id) return null;

  // Email puede faltar en el JWT; verifyAccessToken confirma con /auth/user
  return {
    id: String(id),
    email: email ? String(email) : '',
    name:
      payload.name ||
      (email ? String(email).split('@')[0] : 'Usuario'),
    projectId: payload.project_id || config.matudb.projectId,
  };
}
