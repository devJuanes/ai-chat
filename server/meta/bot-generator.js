import { completeUpstreamChat } from '../upstream.js';

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No se pudo generar la configuración del agente');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Expand a free-text brief into bot config fields (hidden from create UI).
 */
export async function generateBotConfigFromBrief({
  agentName,
  companyName,
  brief,
  channels = [],
}) {
  const channelList =
    (channels.length ? channels : ['whatsapp']).join(', ') || 'whatsapp';

  const system = `Eres un diseñador experto de chatbots de ventas y atención al cliente para WhatsApp, Instagram y Facebook Messenger.
Devuelves SOLO un JSON válido (sin markdown) con estas claves string:
{
  "objective": "...",
  "instructions": "...",
  "business_context": "...",
  "products_services": "...",
  "welcome_message": "...",
  "tone": "...",
  "handoff_keywords": "humano,asesor,..."
}
Reglas:
- objective: 1–2 frases, orientado a vender / calificar / atender.
- instructions: pasos claros del agente (humano, entusiasta, natural).
- business_context: resume el negocio a partir del brief; no inventes datos críticos.
- products_services: lista o párrafos de oferta si el brief lo sugiere; si no, "Consultar con el cliente y usar el contexto del negocio".
- welcome_message: un saludo corto en 1ª persona usando el nombre del agente y la empresa.
- tone: 3–6 palabras (ej. "cálido, cercano y comercial").
- handoff_keywords: CSV en español para pedir humano.
- Español latinoamericano. Sin mencionar Matu AI ni proveedores.`;

  const user = `Agente: ${agentName}
Empresa: ${companyName}
Canales: ${channelList}
Brief del negocio / qué debe hacer el bot:
${brief}`;

  const raw = await completeUpstreamChat({
    system,
    messages: [{ role: 'user', content: user }],
  });

  const parsed = extractJsonObject(raw);
  return {
    objective: String(parsed.objective || '').trim(),
    instructions: String(parsed.instructions || '').trim(),
    business_context: String(parsed.business_context || '').trim(),
    products_services: String(parsed.products_services || '').trim(),
    welcome_message: String(parsed.welcome_message || '').trim(),
    tone: String(parsed.tone || 'cálido, cercano y comercial').trim(),
    handoff_keywords: String(
      parsed.handoff_keywords ||
        'humano,asesor,agente humano,hablar con alguien'
    ).trim(),
    model_id: 'matu-bot-3-5',
    language: 'es',
  };
}
