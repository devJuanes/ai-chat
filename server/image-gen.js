import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { newId } from './db.js';

const STORAGE_DIR = path.join(config.root, 'storage', 'generated-images');

/** Verbos que ya implican dibujo/imagen */
const DRAW_VERB_RE =
  /(?:^|\b)(?:dibuja(?:r)?|pinta(?:r)?|ilustra(?:r)?)\b(?:\s+me)?(?:\s+(?:una?|un|la|an?))?\s+\S/i;

/** Pedidos explícitos de imagen/foto */
const EXPLICIT_IMAGE_RE =
  /(?:^|\b)(?:genera(?:r)?|crea(?:r)?|haz(?:me)?|diseña(?:r)?|quiero|necesito|puedes?\s+(?:hacer|generar|crear|dibujar)|generate|create|make|design)\b[\s\S]{0,40}?\b(?:imagen|ilustraci[oó]n|foto|fotograf[ií]a|dibujo|pintura|picture|image|illustration|drawing|photo)\b|(?:generate|create|draw|make|paint|design)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|illustration|drawing|photo)\b|text[\s-]?to[\s-]?image\b|(?:^|\b)(?:imagen|image)\s+(?:de|of|sobre|about|con)\s+\S/i;

const NEGATIVE_RE =
  /(?:c[oó]mo|how\s+to|explic[ae]|explain|qu[eé]\s+es|what\s+is|no\s+(?:puedas|generes)|don'?t\s+generate)/i;

/** Evita falsos positivos (crear landing/página/app, no imagen) */
const NON_IMAGE_OBJECT_RE =
  /\b(?:landing|p[aá]gina|website|sitio|app|aplicaci[oó]n|componente|html|css|react|vue|codigo|c[oó]digo|script|api|endpoint|tabla|documento|email|correo|copy|texto|plan|estrategia|prompt)\b/i;

const ASPECT_PATTERNS = [
  { re: /\b(9\s*[:/]\s*16|vertical|portrait|celular|m[oó]vil|stories?)\b/i, value: '9:16' },
  { re: /\b(16\s*[:/]\s*9|horizontal|landscape|widescreen|panor[aá]mic[ao]?)\b/i, value: '16:9' },
  { re: /\b(1\s*[:/]\s*1|cuadrad[ao]|square)\b/i, value: '1:1' },
  { re: /\b(4\s*[:/]\s*3)\b/i, value: '4:3' },
  { re: /\b(3\s*[:/]\s*2)\b/i, value: '3:2' },
  { re: /\b(2\s*[:/]\s*3)\b/i, value: '2:3' },
  { re: /\b(3\s*[:/]\s*4)\b/i, value: '3:4' },
  { re: /\b(21\s*[:/]\s*9)\b/i, value: '21:9' },
];

const STRIP_PREFIX_RE =
  /^(?:por\s+favor[,]?\s*|please[,]?\s*)?(?:generate|create|draw|make|paint|design|genera(?:r)?|crea(?:r)?|haz(?:me)?|dibuja(?:r)?|ilustra(?:r)?|pinta(?:r)?|diseña(?:r)?|quiero|necesito|puedes?\s+(?:hacer|generar|crear|dibujar))\b(?:\s+me)?(?:\s+(?:una?|un|la|an?))?\s*(?:imagen|ilustraci[oó]n|foto|fotograf[ií]a|dibujo|pintura|picture|image|illustration|drawing|photo)?(?:\s+(?:de|of|sobre|about|con|with|:))?\s*/i;

/**
 * ¿El mensaje pide generar una imagen?
 */
export function isImageGenerationRequest(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 2000) return false;
  if (NEGATIVE_RE.test(t) && !/\b(?:genera(?:r)?|crea(?:r)?|haz(?:me)?|dibuja(?:r)?)\b[\s\S]{0,30}\b(?:imagen|foto|image|picture)\b/i.test(t)) {
    return false;
  }
  if (DRAW_VERB_RE.test(t)) {
    // "dibuja una landing" es raro; si el objeto es claramente no-imagen, no
    if (NON_IMAGE_OBJECT_RE.test(t) && !/\b(?:imagen|foto|image|picture|ilustraci)/i.test(t)) {
      return false;
    }
    return true;
  }
  if (!EXPLICIT_IMAGE_RE.test(t)) return false;
  // "crea una imagen de una landing" → sí imagen; "crea una landing" ya no pasa EXPLICIT
  return true;
}

export function extractImagePrompt(text) {
  let prompt = String(text || '').trim();
  prompt = prompt.replace(STRIP_PREFIX_RE, '').trim();
  for (const { re } of ASPECT_PATTERNS) {
    prompt = prompt.replace(re, ' ').trim();
  }
  prompt = prompt
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.:;\-–—]+\s*/, '')
    .replace(/^(?:de|of|sobre|about|con|with)\s+/i, '')
    .trim();
  if (!prompt || prompt.length < 2) {
    prompt = String(text || '').trim().slice(0, 500);
  }
  return prompt.slice(0, 1400);
}

export function extractAspectRatio(text) {
  const t = String(text || '');
  for (const { re, value } of ASPECT_PATTERNS) {
    if (re.test(t)) return value;
  }
  return '1:1';
}

function friendlyImageError(statusCode, statusMsg, httpStatus) {
  if (statusCode === 1002 || httpStatus === 429) {
    return 'El generador de imágenes está saturado. Espera un momento e inténtalo de nuevo.';
  }
  if (statusCode === 1008) {
    return 'No hay saldo suficiente para generar imágenes. Revisa la cuenta del modelo.';
  }
  if (statusCode === 1026) {
    return 'El prompt tiene contenido sensible. Prueba con otra descripción.';
  }
  if (statusCode === 1004 || statusCode === 2049 || httpStatus === 401) {
    return 'No se pudo autenticar con el generador de imágenes. Revisa UPSTREAM_API_KEY.';
  }
  return (
    String(statusMsg || '').slice(0, 200) ||
    `No se pudo generar la imagen (${httpStatus || statusCode || 'error'}).`
  );
}

/**
 * Llama a MiniMax image_generation y guarda PNG en disco.
 * Devuelve URL pública relativa (/api/generated-images/…).
 */
export async function generateAndStoreImage({
  prompt,
  aspectRatio = '1:1',
  signal,
} = {}) {
  if (!config.upstream.apiKey) {
    throw new Error(
      'UPSTREAM_API_KEY no está configurada. Agrégala a tu archivo .env.'
    );
  }

  const model = config.upstream.imageModel || 'image-01';
  const payload = {
    model,
    prompt: String(prompt || '').slice(0, 1500),
    aspect_ratio: aspectRatio || '1:1',
    response_format: 'base64',
    n: 1,
    prompt_optimizer: true,
  };

  let res;
  try {
    res = await fetch(`${config.upstream.baseUrl}/image_generation`, {
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
    throw new Error(
      'No pudimos conectar con el generador de imágenes. Revisa tu internet e inténtalo de nuevo.'
    );
  }

  const raw = await res.text().catch(() => '');
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  const statusCode = json?.base_resp?.status_code;
  if (!res.ok || (statusCode != null && statusCode !== 0)) {
    throw new Error(
      friendlyImageError(
        statusCode,
        json?.base_resp?.status_msg || json?.error?.message,
        res.status
      )
    );
  }

  const b64 = json?.data?.image_base64?.[0];
  if (!b64) {
    throw new Error('El generador no devolvió ninguna imagen.');
  }

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const id = newId();
  const filename = `${id}.png`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));

  return {
    id,
    filename,
    url: `/api/generated-images/${filename}`,
    prompt: payload.prompt,
    aspectRatio: payload.aspect_ratio,
  };
}

export function registerGeneratedImageRoutes(app) {
  app.get('/api/generated-images/:file', (req, res) => {
    const file = path.basename(String(req.params.file || ''));
    if (!file || !/^[\w-]+\.png$/i.test(file)) {
      return res.status(404).json({ error: { message: 'Imagen no encontrada' } });
    }
    const full = path.join(STORAGE_DIR, file);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ error: { message: 'Imagen no encontrada' } });
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('png');
    res.sendFile(full);
  });
}

export function formatImageAssistantMessage({ url, prompt }) {
  const alt = String(prompt || 'Imagen generada')
    .replace(/[\[\]]/g, '')
    .slice(0, 120);
  return `Aquí tienes la imagen que pediste:\n\n![${alt}](${url})`;
}
