import { config } from './config.js';

function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Filtra bloques de razonamiento interno del modelo
 * (<think>...</think>, <thinking>...</thinking>) en streaming.
 */
export function createThinkFilter() {
  let buffer = '';
  let inThink = false;

  const OPEN = /<think(?:ing)?>/i;
  const CLOSE = /<\/think(?:ing)?>/i;

  function feed(chunk) {
    if (!chunk) return '';
    buffer += chunk;
    let out = '';

    while (buffer.length > 0) {
      if (inThink) {
        const end = buffer.match(CLOSE);
        if (!end || end.index === undefined) {
          // Guardar solo el final por si el cierre llega partido
          if (buffer.length > 32) buffer = buffer.slice(-32);
          break;
        }
        buffer = buffer.slice(end.index + end[0].length);
        inThink = false;
        continue;
      }

      const start = buffer.match(OPEN);
      if (!start || start.index === undefined) {
        // Puede haber un '<' incompleto al final
        const lt = buffer.lastIndexOf('<');
        if (lt !== -1 && lt > buffer.length - 20) {
          out += buffer.slice(0, lt);
          buffer = buffer.slice(lt);
          break;
        }
        out += buffer;
        buffer = '';
        break;
      }

      out += buffer.slice(0, start.index);
      buffer = buffer.slice(start.index + start[0].length);
      inThink = true;
    }

    return out;
  }

  function flush() {
    if (inThink) {
      buffer = '';
      inThink = false;
      return '';
    }
    const rest = buffer;
    buffer = '';
    return rest.replace(/<\/?think(?:ing)?>/gi, '');
  }

  return { feed, flush };
}

/** Quita think tags de un texto completo (no streaming). */
export function stripThinkTags(text) {
  if (!text) return '';
  return text
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<\/?think(?:ing)?>/gi, '')
    .trim();
}

/**
 * Stream a chat completion from the configured upstream runtime.
 * Public surface never exposes vendor names — only Matu model ids.
 */
export async function streamUpstreamChat({ system, messages, signal }) {
  if (!config.upstream.apiKey) {
    throw new Error(
      'UPSTREAM_API_KEY no está configurada. Agrégala a tu archivo .env.'
    );
  }

  const payload = {
    model: config.upstream.model,
    stream: true,
    messages: [
      { role: 'system', content: system },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ],
    max_completion_tokens: 24576,
    // MiniMax-M3: desactiva thinking para que no filtre <think> al usuario
    thinking: { type: 'disabled' },
  };

  let res;
  try {
    res = await fetch(`${config.upstream.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.upstream.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') {
      throw new Error('Generación cancelada');
    }
    const raw = String(err?.message || err || '');
    if (/fetch failed|Failed to fetch|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(raw)) {
      throw new Error(
        'No pudimos conectar con el modelo. Revisa tu internet o inténtalo de nuevo en unos segundos.'
      );
    }
    throw new Error(raw || 'No se pudo generar la respuesta');
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let friendly = errText || `Error del modelo (${res.status})`;
    try {
      const j = JSON.parse(errText);
      friendly = j?.error?.message || j?.message || friendly;
    } catch {
      /* texto plano */
    }
    if (res.status === 429) {
      throw new Error('El modelo está saturado. Espera un momento e inténtalo de nuevo.');
    }
    if (res.status >= 500) {
      throw new Error('El modelo no respondió. Inténtalo de nuevo en unos segundos.');
    }
    throw new Error(friendly.slice(0, 240));
  }

  return res;
}

export async function* parseSseStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const think = createThinkFilter();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') {
        if (data === '[DONE]') {
          const rest = think.flush();
          if (rest) yield rest;
          return;
        }
        continue;
      }
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          const clean = think.feed(delta);
          if (clean) yield clean;
        }
      } catch {
        /* skip malformed chunks */
      }
    }
  }

  const rest = think.flush();
  if (rest) yield rest;
}

/**
 * Non-streaming chat completion for channel bots (WhatsApp / Messenger / IG).
 * Accumulates the SSE stream from the upstream so callers get a single string.
 */
export async function completeUpstreamChat({ system, messages, signal }) {
  const res = await streamUpstreamChat({ system, messages, signal });
  let text = '';
  for await (const chunk of parseSseStream(res)) {
    text += chunk;
  }
  return stripThinkTags(text);
}

export { estimateTokens };
