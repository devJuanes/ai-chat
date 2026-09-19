const GREETING_ONLY_RE =
  /^(hola|holi|hey|hi|hello|buenas|buen[oa]s?\s*d[ií]as?|buen\s*d[ií]a|qu[eé]\s*tal|que\s*tal|saludos|ey|oye)[\s!¡.?…]*$/i;

const GREETING_PREFIX_RE =
  /^(hola|holi|hey|hi|hello|buenas|buen[oa]s?\s*d[ií]as?|buen\s*d[ií]a|qu[eé]\s*tal|que\s*tal|saludos|ey|oye)[\s,!:.¡¿…-]+/i;

const THANKS_RE =
  /^(gracias|ok|vale|listo|perfecto|de\s*acuerdo|dale)[\s!¡.?…]*$/i;

const STOP = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'al',
  'a',
  'y',
  'o',
  'en',
  'por',
  'para',
  'con',
  'que',
  'qué',
  'como',
  'cómo',
  'mi',
  'me',
  'te',
  'se',
  'lo',
  'le',
  'es',
  'son',
  'quiero',
  'necesito',
  'puedes',
  'puedo',
  'hacer',
  'ayuda',
  'ayudame',
  'ayúdame',
  'porfa',
  'porfavor',
  'favor',
]);

export function heuristicTitle(text = '') {
  const raw = String(text).trim().replace(/\s+/g, ' ');
  if (!raw) return 'Nuevo chat';
  if (GREETING_ONLY_RE.test(raw)) return 'Saludo inicial';
  if (THANKS_RE.test(raw)) return 'Conversación breve';

  // Quitar saludo inicial si hay contenido después: "Hola quiero vender…" → tema real
  let cleaned = raw.replace(GREETING_PREFIX_RE, '').trim();
  if (!cleaned) cleaned = raw;

  cleaned = cleaned
    .replace(/^[#>*\-\d.\s]+/, '')
    .replace(/[¿?¡!]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return 'Nuevo chat';

  // Preferir palabras con significado
  const meaningful = words.filter((w) => !STOP.has(w.toLowerCase()));
  const pick = (meaningful.length >= 2 ? meaningful : words).slice(0, 6);
  let short = pick.join(' ');
  if (short.length > 42) short = short.slice(0, 40).trim() + '…';
  return titleCase(short) || 'Nuevo chat';
}

function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Genera un título corto. Heurística primero; upstream si hace falta.
 */
export async function generateChatTitle(userMessage, upstream) {
  const fallback = heuristicTitle(userMessage);
  if (!upstream?.apiKey || !userMessage?.trim()) return fallback;

  // Si es solo saludo, no gastar API
  if (GREETING_ONLY_RE.test(userMessage.trim())) return 'Saludo inicial';

  try {
    const res = await fetch(`${upstream.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${upstream.apiKey}`,
      },
      body: JSON.stringify({
        model: upstream.model,
        stream: false,
        thinking: { type: 'disabled' },
        max_completion_tokens: 28,
        messages: [
          {
            role: 'system',
            content:
              'Genera un título corto (3 a 6 palabras) en español que resuma el TEMA del mensaje del usuario. Sin comillas, sin puntos, sin emojis. Ignora saludos como "hola" y concéntrate en la intención (ej. vender software, plan de precios). Solo responde "Saludo inicial" si el mensaje es ÚNICAMENTE un saludo sin pedido.',
          },
          { role: 'user', content: userMessage.slice(0, 400) },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    let title = json.choices?.[0]?.message?.content || '';
    title = title
      .replace(/<\/?think(?:ing)?>/gi, '')
      .replace(/^["'«»]+|["'«»]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
    if (!title || title.length < 3) return fallback;
    // Si el modelo se equivoca con "Saludo inicial" pero había tema, usar heurística
    if (
      /^saludo inicial$/i.test(title) &&
      !GREETING_ONLY_RE.test(userMessage.trim())
    ) {
      return fallback;
    }
    return title;
  } catch {
    return fallback;
  }
}
