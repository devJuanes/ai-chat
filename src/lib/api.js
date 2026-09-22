import { apiUrl, readJsonResponse } from './apiBase';

export async function api(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No pudimos conectar. Revisa tu internet e inténtalo de nuevo.');
  }

  let json = null;
  try {
    json = await readJsonResponse(res);
  } catch (err) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    throw err;
  }

  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new Error(msg || 'Sesión inválida');
    }
    throw new Error(msg);
  }
  return json;
}

/**
 * POST /api/chat as SSE and invoke callbacks.
 */
export async function streamChat({
  token,
  conversationId,
  modelId,
  projectId,
  content,
  regenerateOf,
  continueOf,
  onMeta,
  onDelta,
  onDone,
  onError,
  signal,
}) {
  if (!token) {
    throw new Error('Debes iniciar sesión');
  }

  let res;
  try {
    res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId || undefined,
        model_id: modelId,
        project_id: projectId || undefined,
        content: content || undefined,
        regenerate_of: regenerateOf || undefined,
        continue_of: continueOf || undefined,
      }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') {
      throw new Error('Generación cancelada');
    }
    throw new Error(
      'No pudimos conectar con el servidor. Revisa que la app esté corriendo e inténtalo de nuevo.'
    );
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      message = j?.error?.message || message;
    } catch {
      /* noop */
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(message || 'Sesión inválida');
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      if (eventName === 'meta') onMeta?.(data);
      else if (eventName === 'delta') onDelta?.(data);
      else if (eventName === 'done') onDone?.(data);
      else if (eventName === 'error') onError?.(data);
      eventName = 'message';
    }
  }
}
