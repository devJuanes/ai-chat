/** Base del API Express. Vacío = mismo origen (Vite proxy en local). */
export const API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  ''
).replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/**
 * Parsea respuesta JSON. Si llega HTML u otra basura, error amable para el usuario.
 */
export async function readJsonResponse(res) {
  const text = await res.text();
  const trimmed = (text || '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<!doctype')
  ) {
    throw new Error(
      'No pudimos completar la solicitud. Inténtalo de nuevo en unos segundos.'
    );
  }
  let json = null;
  try {
    json = JSON.parse(trimmed);
  } catch {
    throw new Error(
      'No pudimos completar la solicitud. Inténtalo de nuevo en unos segundos.'
    );
  }
  return json;
}

export function assertAuthPayload(json, { mode = 'login' } = {}) {
  const token = json?.token;
  const user = json?.user;
  if (!token || typeof token !== 'string' || token.length < 20) {
    throw new Error(
      json?.error?.message ||
        (mode === 'register'
          ? 'No se pudo crear la cuenta'
          : 'Correo o contraseña incorrectos')
    );
  }
  if (!user?.id || !user?.email) {
    throw new Error(
      json?.error?.message ||
        (mode === 'register'
          ? 'Registro incompleto. Inténtalo de nuevo.'
          : 'Correo o contraseña incorrectos')
    );
  }
  return { token, user };
}
