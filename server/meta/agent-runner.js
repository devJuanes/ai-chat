import {
  loadProductsForBot,
  formatCatalogForPrompt,
  parseCommerceMarks,
  stripCommerceMarks,
  insertConversationNote,
  stageFromNoteType,
  STAGE_IDS,
  PIPELINE_STAGES,
} from './commerce.js';
import { getDb, newId } from '../db.js';
import { checkUsage, bumpUsage } from '../auth.js';
import { estimateTokens, completeUpstreamChat } from '../upstream.js';
import { loadSystemPrompt } from '../models.js';
import { decryptToken } from './crypto.js';
import {
  sendPageMessage,
  sendWhatsAppText,
  fetchMessengerUserProfile,
  fetchInstagramUserProfile,
  formatWhatsAppPhone,
} from './graph.js';
import { logMetaBotEvent } from './bot-logs.js';
import { enqueueDebouncedReply } from './reply-queue.js';

const HISTORY_LIMIT = 30;
const META_BOT_MODEL = 'matu-bot-3-5';
const LEAD_MARK_RE = /\[\[LEAD:([^=\]]+)=([^\]]*)\]\]/gi;
const LEAD_DONE_RE = /\[\[LEAD_COMPLETE\]\]/gi;
const HANDOFF_RE = /\[\[HANDOFF\]\]/gi;

const FALLBACK_REPLY =
  'Disculpa, tuve un problema técnico al responder. ¿Me lo puedes repetir o escribirlo de otra forma? En un momento te ayudo.';


const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram',
};

/** Detect meeting day/time signals in client or bot text */
function detectMeetingSignals(text) {
  const t = String(text || '').toLowerCase();
  const day =
    /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[nñ]ana|pasado ma[nñ]ana|hoy)\b/.test(
      t
    );
  const time =
    /\b(\d{1,2}\s*([:.]?\d{2})?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?|\d{1,2}\s*h(oras)?)\b/i.test(
      t
    ) || /\b(a las|para las)\s*\d/i.test(t);
  const intent =
    /\b(cita|reuni[oó]n|agend|llamada|videollamada|demo|demo\s*live|te llamo|nos vemos|quedamos)\b/i.test(
      t
    );
  return { day, time, intent, likely: (day && time) || (intent && (day || time)) };
}

function inferStageFromConversation(inbound, reply, currentStage) {
  const blob = `${inbound}\n${reply}`.toLowerCase();
  const meeting = detectMeetingSignals(blob);
  if (meeting.likely) return 'cita';
  if (
    /\b(no me interesa|no gracias|no quiero|cancel|fuera|spam)\b/i.test(blob)
  ) {
    return 'perdido';
  }
  if (
    /\b(compr(o|ar)|contratar|pag(o|ar)|factura|cotizaci[oó]n|propuesta|link de pago)\b/i.test(
      blob
    )
  ) {
    return 'cerrar';
  }
  if (
    /\b(lo pienso|duda|caro|despu[eé]s|m[aá]s adelante|no estoy seguro)\b/i.test(
      blob
    )
  ) {
    return 'en_duda';
  }
  if (
    /\b(precio|cu[aá]nto|interes|quiero|necesito|me interesa|info|informaci[oó]n)\b/i.test(
      blob
    )
  ) {
    return 'interesado';
  }
  return currentStage && STAGE_IDS.has(currentStage) ? currentStage : null;
}

function extractMeetingSummary(inbound, reply) {
  const blob = `${inbound} ${reply}`.replace(/\s+/g, ' ').trim();
  const dayMatch = blob.match(
    /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[nñ]ana|pasado ma[nñ]ana|hoy)\b/i
  );
  const timeMatch = blob.match(
    /\b(?:a las|para las)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?)/i
  );
  const parts = [];
  if (dayMatch) parts.push(dayMatch[1]);
  if (timeMatch) parts.push(timeMatch[1].trim());
  return parts.length ? parts.join(' · ') : blob.slice(0, 160);
}

/** Seed known channel contact fields into lead patch */
function seedChannelLeadFields({
  formBundle,
  leadData,
  channel,
  contactPhone,
  contactName,
  meetingSummary,
}) {
  const patch = {};
  if (!formBundle?.fields?.length) return patch;

  for (const f of formBundle.fields) {
    const key = f.field_key;
    if (leadData?.[key]) continue;

    if (
      f.field_type === 'phone' ||
      /^(phone|telefono|tel|whatsapp|celular|mobile)$/i.test(key)
    ) {
      if (channel === 'whatsapp' && contactPhone) {
        patch[key] = contactPhone;
      }
    }

    if (
      /^(name|nombre|full_name|cliente)$/i.test(key) &&
      contactName &&
      !looksLikeEmailLocal(contactName)
    ) {
      patch[key] = contactName;
    }

    if (
      meetingSummary &&
      /^(cita|meeting|reunion|reuni[oó]n|fecha|appointment|horario|agend)/i.test(
        key
      )
    ) {
      patch[key] = meetingSummary;
    }
  }

  // Always keep a free-form meeting note in lead data when we have one
  if (meetingSummary && !leadData?.cita_agendada && !patch.cita_agendada) {
    patch.cita_agendada = meetingSummary;
  }

  return patch;
}

function looksLikeEmailLocal(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (s.includes('@')) return true;
  // email-local-part style: juanlandazuri07, juan.es.azuri.07
  if (/^[a-z0-9._-]{6,}$/i.test(s) && /\d/.test(s) && !/\s/.test(s)) {
    return true;
  }
  return false;
}

function resolveCompanyName(bot, org) {
  const fromBot = String(bot?.company_name || '').trim();
  if (fromBot && !looksLikeEmailLocal(fromBot)) return fromBot;
  const fromOrg = String(org?.name || '').trim();
  if (fromOrg && !looksLikeEmailLocal(fromOrg) && !/espacio$/i.test(fromOrg)) {
    return fromOrg;
  }
  return fromBot || 'nuestra empresa';
}

async function loadFormForBot(bot) {
  if (!bot?.form_id) return null;
  const db = getDb();
  const { data: form } = await db
    .from('lead_forms')
    .select('*')
    .eq('id', bot.form_id)
    .eq('active', true)
    .maybeSingle();
  if (!form) return null;
  const { data: fields } = await db
    .from('lead_form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order', { ascending: true });
  return { form, fields: fields || [] };
}

function buildAgentSystemPrompt({
  bot,
  companyName,
  channel,
  contactLabel,
  contactPhone,
  formBundle,
  leadData,
  catalogProducts,
  currentStage,
}) {
  const channelName = CHANNEL_LABEL[channel] || channel;
  const welcome = String(bot.welcome_message || '').trim();
  const knowledge = String(bot.company_knowledge || '').trim();
  const website = String(bot.company_website || '').trim();
  const catalogBlock = formatCatalogForPrompt(catalogProducts);
  const missing =
    formBundle?.fields
      ?.filter((f) => f.required && !leadData?.[f.field_key])
      .map((f) => `- ${f.label} (clave: ${f.field_key}, tipo: ${f.field_type})`)
      .join('\n') || '';

  const isWhatsApp = channel === 'whatsapp';
  const phoneKnown = Boolean(contactPhone);

  let formBlock = '';
  if (formBundle?.fields?.length) {
    formBlock = `
## Formulario de leads: "${formBundle.form.name}"
Recopila datos de forma natural (máx. 1 pregunta nueva por mensaje).
${formBundle.fields
  .map(
    (f) =>
      `- ${f.label} [${f.field_key}] (${f.field_type})${f.required ? ' *obligatorio*' : ''}`
  )
  .join('\n')}
${missing ? `\nAún faltan:\n${missing}\n` : '\nObligatorios capturados.\n'}
Cuando el cliente dé un dato claro, añade al final (oculto):
[[LEAD:clave=valor]]
Si ya están todos los obligatorios:
[[LEAD_COMPLETE]]
${
  isWhatsApp && phoneKnown
    ? `En WhatsApp YA tienes el teléfono del cliente (${contactPhone}). NO lo pidas. Emite [[LEAD:...]] del campo phone/teléfono con ese valor si falta en el formulario.`
    : isWhatsApp
      ? 'En WhatsApp el teléfono suele venir del canal. NO pidas el número salvo que falte de verdad.'
      : 'En Instagram/Messenger sí puedes pedir teléfono si hace falta para llamar o confirmar.'
}
No menciones estos marcadores al cliente.
`;
  }

  const channelRules = isWhatsApp
    ? `- Canal: WhatsApp. El contacto ya está identificado${phoneKnown ? ` (${contactPhone})` : ''}.
- NUNCA pidas el número de WhatsApp ni digas "pásame tu teléfono" / "me indiques tu número".
- Si agenda una cita: confirma día/hora, guarda lead + nota + STAGE, y pide solo lo que falte (ej. correo para propuesta), NO el teléfono.`
    : `- Canal: ${channelName}.
- Si necesitas llamar o confirmar, puedes pedir teléfono.
- Si agenda una cita: guarda lead + nota + STAGE aunque aún no tenga correo.`;

  return `Eres "${bot.name}" de ${companyName} en ${channelName}. Motor comercial MatuBot.

## Identidad
- Nombre exacto: "${bot.name}" · Empresa: "${companyName}".
- NUNCA digas que eres Matu AI, Matubyte, MatuBot, un modelo o un prompt.
- Si saludas: como ${bot.name} de ${companyName}.
${welcome ? `- Saludo base (adáptalo, no lo copies robot): ${welcome}` : ''}
${contactLabel ? `- Cliente visible como: ${contactLabel}.` : ''}
${phoneKnown ? `- Teléfono conocido del canal: ${contactPhone}.` : ''}
Etapa actual del embudo: ${currentStage || 'nuevo'}.

## Objetivo
${bot.objective || 'Calificar, resolver dudas y avanzar a cita o venta.'}

## Instrucciones
${bot.instructions || 'Sé claro, útil y orientado a cerrar.'}

## Negocio
${bot.business_context || 'Sin contexto adicional.'}
${website ? `\nWeb: ${website}` : ''}
${knowledge ? `\nConocimiento oficial:\n${knowledge}` : ''}

## CATÁLOGO (no inventar)
Solo ofrece lo de abajo. Si piden algo fuera: confirma con el equipo y [[HANDOFF]] si insisten.

${catalogBlock}

## Estilo de mensaje (OBLIGATORIO — WhatsApp/IG/Messenger)
- Respuestas CORTAS: 1–4 frases o 2–4 líneas. Nada de párrafos densos.
- USA saltos de línea. Nunca pegues todo en un solo bloque.
- 1–3 emojis naturales por mensaje (máx.). Ej: 👍 🙂 📅 ✅ 🙌 — no satures.
- Tono humano, cercano y comercial. Nada robótico.
- NO repitas ni parafrasees lo que el cliente acaba de decir. Avanza.
- NO digas "Entiendo que quieres X porque mencionaste Y…". Ve al punto.
- Una sola pregunta clara por mensaje cuando necesites un dato.
- Empuja el siguiente paso (dato que falte, cita, cotización o link del catálogo).

## Tono e idioma
Tono: ${bot.tone || 'cercano, humano y comercial'}.
Idioma: ${bot.language || 'es'}.

## Canal
${channelRules}

## Citas / reuniones (CRÍTICO)
Si el cliente confirma día y/o hora (ej. "miércoles a las 6 pm"):
1) Confirma en 1–2 líneas con emoji 📅.
2) Emite SIEMPRE:
[[STAGE:cita]]
[[NOTE:meeting|positive|Cita acordada|día y hora + canal]]
[[LEAD:cita_agendada=miércoles 6pm]] (ajusta al dato real)
3) Rellena cualquier campo del formulario de fecha/cita/horario con [[LEAD:...]].
4) En WhatsApp NO pidas teléfono. Pide correo u otro dato solo si hace falta para la propuesta.
5) No digas que "agendas" sin emitir las marcas: sin marcas no se guarda.

## Embudo Kanban (OBLIGATORIO)
Cuando el estado esté claro, incluye UNA marca:
[[STAGE:interesado]]
Valores: nuevo | interesado | en_duda | cita | cerrar | ganado | perdido
- Pregunta precio/beneficio → interesado
- Objeción / "lo pienso" → en_duda
- Día/hora de reunión → cita (siempre)
- Quiere pagar / cotización formal → cerrar
- Compró → ganado · Rechazó → perdido

## Notas
[[NOTE:tipo|sentimiento|titulo|detalle]]
tipos: sentiment, meeting, objection, win, lost, handoff, interest, custom
sentimiento: positive, neutral, negative, critical

## Handoff
Si pide humano o hay queja grave: calidez + [[HANDOFF]]. No digas "te paso con un asesor"; di que alguien del equipo le escribe.
${formBlock}`;
}

function stripInternalMarks(text) {
  return stripCommerceMarks(
    String(text || '')
      .replace(LEAD_MARK_RE, '')
      .replace(LEAD_DONE_RE, '')
      .replace(HANDOFF_RE, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function parseLeadMarks(text) {
  const data = {};
  let complete = false;
  const raw = String(text || '');
  let m;
  const re = new RegExp(LEAD_MARK_RE.source, 'gi');
  while ((m = re.exec(raw))) {
    const key = String(m[1] || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const val = String(m[2] || '').trim();
    if (key && val) data[key] = val;
  }
  if (LEAD_DONE_RE.test(raw)) complete = true;
  return { data, complete };
}

function wantsHandoff(text, keywordsCsv) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('[[handoff]]')) return true;
  const keys = String(keywordsCsv || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return keys.some((k) => lower.includes(k));
}

async function findConnectionByAsset({
  channel,
  pageId,
  phoneNumberId,
  igUserId,
}) {
  const db = getDb();
  let q = db
    .from('meta_connections')
    .select('*')
    .eq('channel', channel)
    .eq('status', 'active');

  if (channel === 'whatsapp' && phoneNumberId) {
    q = q.eq('phone_number_id', phoneNumberId);
  } else if (channel === 'instagram') {
    if (igUserId) q = q.eq('ig_user_id', igUserId);
    else if (pageId) q = q.eq('page_id', pageId);
    else return null;
  } else if (pageId) {
    q = q.eq('page_id', pageId);
  } else {
    return null;
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function getBinding(connectionId) {
  const db = getDb();
  const { data: binding } = await db
    .from('bot_channel_bindings')
    .select('*')
    .eq('meta_connection_id', connectionId)
    .eq('active', true)
    .maybeSingle();
  if (!binding) return null;

  const { data: bot } = await db
    .from('bots')
    .select('*')
    .eq('id', binding.bot_id)
    .eq('active', true)
    .maybeSingle();
  return bot ? { binding, bot } : null;
}

async function resolveContactIdentity({
  connection,
  externalUserId,
  contactNameHint,
  contactPhoneHint,
}) {
  const token = decryptToken(connection.access_token_enc);
  let contactName = String(contactNameHint || '').trim();
  let contactUsername = '';
  let contactPhone = String(contactPhoneHint || '').trim();

  if (connection.channel === 'whatsapp') {
    contactPhone = formatWhatsAppPhone(externalUserId) || contactPhone;
    // Inbox title: phone first; append WA profile name if useful
    contactName = contactPhone
      ? contactName && contactName !== contactPhone
        ? `${contactPhone} · ${contactName}`
        : contactPhone
      : contactName || externalUserId;
  } else if (connection.channel === 'instagram') {
    const profile = await fetchInstagramUserProfile(externalUserId, token);
    contactUsername = profile.username || '';
    contactName =
      profile.displayName ||
      contactName ||
      (contactUsername ? `@${contactUsername}` : '');
  } else if (connection.channel === 'messenger') {
    const profile = await fetchMessengerUserProfile(externalUserId, token);
    contactName = profile.displayName || contactName || '';
  }

  return { contactName, contactUsername, contactPhone };
}

async function getOrCreateThread({
  connection,
  bot,
  externalUserId,
  contactName,
  contactUsername,
  contactPhone,
  ownerUserId,
}) {
  const db = getDb();
  const { data: existing } = await db
    .from('channel_threads')
    .select('*')
    .eq('meta_connection_id', connection.id)
    .eq('external_user_id', externalUserId)
    .maybeSingle();

  if (existing) {
    const patch = { last_message_at: new Date().toISOString() };
    if (contactName && contactName !== existing.contact_name) {
      patch.contact_name = contactName;
    }
    if (contactUsername && contactUsername !== existing.contact_username) {
      patch.contact_username = contactUsername;
    }
    if (contactPhone && contactPhone !== existing.contact_phone) {
      patch.contact_phone = contactPhone;
    }
    await db.from('channel_threads').eq('id', existing.id).update(patch);
    if (contactName) {
      await db
        .from('conversations')
        .eq('id', existing.conversation_id)
        .update({ title: contactName });
    }
    const { data: conv } = await db
      .from('conversations')
      .select('*')
      .eq('id', existing.conversation_id)
      .maybeSingle();
    return { thread: { ...existing, ...patch }, conversation: conv };
  }

  const conversationId = newId();
  const title =
    contactName ||
    `${CHANNEL_LABEL[connection.channel] || connection.channel} · ${String(externalUserId).slice(-6)}`;

  await db.from('conversations').insert({
    id: conversationId,
    org_id: connection.org_id,
    user_id: ownerUserId,
    title,
    model_id: META_BOT_MODEL,
    preview: '',
    source: connection.channel,
    external_thread_id: externalUserId,
    bot_id: bot.id,
    assignee: 'bot',
  });

  const threadId = newId();
  await db.from('channel_threads').insert({
    id: threadId,
    org_id: connection.org_id,
    meta_connection_id: connection.id,
    bot_id: bot.id,
    conversation_id: conversationId,
    external_user_id: externalUserId,
    channel: connection.channel,
    contact_name: contactName || '',
    contact_username: contactUsername || '',
    contact_phone: contactPhone || '',
    last_message_at: new Date().toISOString(),
  });

  const { data: conv } = await db
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  const { data: thread } = await db
    .from('channel_threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();

  return { thread, conversation: conv };
}

async function alreadyProcessed(externalId) {
  if (!externalId) return false;
  const db = getDb();
  const { data } = await db
    .from('messages')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function orgOwnerUserId(orgId) {
  const db = getDb();
  const { data } = await db
    .from('organization_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  if (data?.user_id) return data.user_id;
  const { data: any } = await db
    .from('organization_members')
    .select('user_id')
    .eq('org_id', orgId)
    .limit(1)
    .maybeSingle();
  return any?.user_id || null;
}

async function sendOutbound({ connection, recipientId, text }) {
  const token = decryptToken(connection.access_token_enc);
  if (connection.channel === 'whatsapp') {
    return sendWhatsAppText({
      phoneNumberId: connection.phone_number_id,
      token,
      to: recipientId,
      text,
    });
  }
  return sendPageMessage({
    pageId: connection.page_id,
    pageToken: token,
    recipientId,
    text,
  });
}

/** Try send; one retry on transient failure. */
async function sendOutboundReliable({ connection, recipientId, text }) {
  try {
    return await sendOutbound({ connection, recipientId, text });
  } catch (err) {
    const msg = String(err?.message || err);
    const retryable = /timeout|ECONN|ETIMEDOUT|429|5\d\d|temporar|rate/i.test(
      msg
    );
    if (!retryable) throw err;
    await new Promise((r) => setTimeout(r, 700));
    return sendOutbound({ connection, recipientId, text });
  }
}

async function upsertLeadSubmission({
  orgId,
  formId,
  botId,
  threadId,
  conversationId,
  channel,
  contactName,
  externalUserId,
  patchData,
  markComplete,
}) {
  const db = getDb();
  const { data: existing } = await db
    .from('lead_submissions')
    .select('*')
    .eq('form_id', formId)
    .eq('thread_id', threadId)
    .maybeSingle();

  const merged = {
    ...(existing?.data || {}),
    ...patchData,
  };

  if (existing?.id) {
    await db
      .from('lead_submissions')
      .eq('id', existing.id)
      .update({
        data: merged,
        status:
          markComplete || existing.status === 'complete'
            ? 'complete'
            : 'partial',
        contact_name: contactName || existing.contact_name,
        updated_at: new Date().toISOString(),
      });
    return { id: existing.id, data: merged };
  }

  const id = newId();
  await db.from('lead_submissions').insert({
    id,
    org_id: orgId,
    form_id: formId,
    bot_id: botId,
    thread_id: threadId,
    conversation_id: conversationId,
    channel,
    contact_name: contactName || '',
    contact_external_id: externalUserId,
    data: merged,
    status: markComplete ? 'complete' : 'partial',
  });
  return { id, data: merged };
}

/**
 * Handle one inbound text message from Meta.
 */
export async function handleInboundMessage({
  channel,
  pageId,
  phoneNumberId,
  igUserId,
  externalUserId,
  contactName: contactNameHint,
  contactPhone: contactPhoneHint,
  text,
  externalMessageId,
  isMediaStub = false,
}) {
  const baseLog = {
    channel: channel || null,
    externalUserId: externalUserId || null,
    externalMessageId: externalMessageId || null,
  };

  if (!externalUserId) {
    await logMetaBotEvent({
      ...baseLog,
      stage: 'webhook',
      severity: 'warn',
      code: 'no_sender',
      message: 'Inbound sin sender id',
    });
    return { skipped: 'no_sender' };
  }

  let connection;
  try {
    connection = await findConnectionByAsset({
      channel,
      pageId,
      phoneNumberId,
      igUserId,
    });
  } catch (err) {
    await logMetaBotEvent({
      ...baseLog,
      stage: 'connection',
      severity: 'error',
      code: 'connection_lookup_failed',
      message: err.message || 'Error buscando conexión Meta',
      detail: { pageId, phoneNumberId, igUserId },
    });
    throw err;
  }

  if (!connection) {
    await logMetaBotEvent({
      ...baseLog,
      stage: 'connection',
      severity: 'error',
      code: 'no_connection',
      message:
        'No hay meta_connection activa para este canal/asset (phone_number_id / page_id / ig_user_id)',
      detail: { pageId, phoneNumberId, igUserId, channel },
    });
    return { skipped: 'no_connection' };
  }

  baseLog.orgId = connection.org_id;

  if (externalMessageId && (await alreadyProcessed(externalMessageId))) {
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      stage: 'dedupe',
      severity: 'info',
      code: 'duplicate',
      message: 'Mensaje Meta ya procesado (external_id)',
    });
    return { skipped: 'duplicate' };
  }

  const bound = await getBinding(connection.id);
  if (!bound) {
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      stage: 'bot',
      severity: 'error',
      code: 'no_bot',
      message:
        'Canal conectado pero sin bot activo vinculado (bot_channel_bindings / bots.active)',
      detail: { connectionId: connection.id },
    });
    return { skipped: 'no_bot' };
  }
  const { bot } = bound;

  const ownerUserId = await orgOwnerUserId(connection.org_id);
  if (!ownerUserId) {
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      botId: bot.id,
      stage: 'bot',
      severity: 'error',
      code: 'no_owner',
      message: 'Organización sin owner/member para atribuir el chat',
    });
    return { skipped: 'no_owner' };
  }

  const identity = await resolveContactIdentity({
    connection,
    externalUserId,
    contactNameHint,
    contactPhoneHint,
  });

  const { thread, conversation } = await getOrCreateThread({
    connection,
    bot,
    externalUserId,
    contactName: identity.contactName,
    contactUsername: identity.contactUsername,
    contactPhone: identity.contactPhone,
    ownerUserId,
  });
  if (!conversation) {
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      botId: bot.id,
      stage: 'conversation',
      severity: 'error',
      code: 'no_conversation',
      message: 'No se pudo crear/leer la conversación del hilo',
    });
    return { skipped: 'no_conversation' };
  }

  const db = getDb();
  const inboundContent = isMediaStub
    ? text ||
      '[El cliente envió un archivo multimedia. Pídele que describa su solicitud en texto.]'
    : String(text || '').trim();

  if (!inboundContent && !isMediaStub) {
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      botId: bot.id,
      conversationId: conversation.id,
      stage: 'webhook',
      severity: 'info',
      code: 'empty',
      message: 'Payload sin texto ni media usable',
    });
    return { skipped: 'empty' };
  }

  const userMsgId = newId();
  await db.from('messages').insert({
    id: userMsgId,
    conversation_id: conversation.id,
    role: 'user',
    content: inboundContent,
    model_id: null,
    tokens_in: 0,
    tokens_out: 0,
    external_id: externalMessageId || null,
  });

  await db
    .from('conversations')
    .eq('id', conversation.id)
    .update({
      preview: inboundContent.slice(0, 120),
      updated_at: new Date().toISOString(),
    });
  await db
    .from('channel_threads')
    .eq('id', thread.id)
    .update({ last_message_at: new Date().toISOString() });

  if (conversation.assignee === 'human') {
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      botId: bot.id,
      conversationId: conversation.id,
      stage: 'handoff',
      severity: 'info',
      code: 'assignee_human',
      message:
        'Chat en modo humano: inbound guardado, bot no responde hasta reasignar a bot',
    });
    return { ok: true, handoff: true, conversationId: conversation.id };
  }

  if (wantsHandoff(inboundContent, bot.handoff_keywords)) {
    await db
      .from('conversations')
      .eq('id', conversation.id)
      .update({ assignee: 'human' });
    const notice =
      'Claro, te conecto con alguien del equipo para darte una respuesta precisa. En un momento te escriben.';
    try {
      await sendOutboundReliable({
        connection,
        recipientId: externalUserId,
        text: notice,
      });
    } catch (err) {
      console.error('[meta] handoff send failed', err.message);
      await logMetaBotEvent({
        ...baseLog,
        orgId: connection.org_id,
        botId: bot.id,
        conversationId: conversation.id,
        stage: 'send',
        severity: 'error',
        code: 'handoff_send_failed',
        message: err.message || 'No se pudo enviar aviso de handoff',
      });
    }
    const aid = newId();
    await db.from('messages').insert({
      id: aid,
      conversation_id: conversation.id,
      role: 'assistant',
      content: notice,
      model_id: bot.model_id,
    });
    await logMetaBotEvent({
      ...baseLog,
      orgId: connection.org_id,
      botId: bot.id,
      conversationId: conversation.id,
      stage: 'handoff',
      severity: 'info',
      code: 'keyword_handoff',
      message: 'Handoff por palabra clave del cliente',
    });
    return { ok: true, handoff: true, conversationId: conversation.id };
  }

  const queueKey = `${connection.id}::${externalUserId}`;
  return enqueueDebouncedReply(queueKey, () =>
    generateAndSendBotReply({
      connection,
      bot,
      thread,
      conversationId: conversation.id,
      ownerUserId,
      externalUserId,
      externalMessageId,
      identity,
      inboundContent,
    })
  );
}

async function generateAndSendBotReply({
  connection,
  bot,
  thread,
  conversationId,
  ownerUserId,
  externalUserId,
  externalMessageId,
  identity,
  inboundContent,
}) {
  const db = getDb();
  const baseLog = {
    orgId: connection.org_id,
    botId: bot.id,
    conversationId,
    channel: connection.channel,
    externalUserId,
    externalMessageId,
  };

  const { data: conversation } = await db
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conversation) {
    await logMetaBotEvent({
      ...baseLog,
      stage: 'conversation',
      severity: 'error',
      code: 'conversation_missing',
      message: 'Conversación desapareció antes de generar respuesta',
    });
    return { skipped: 'no_conversation' };
  }

  // Re-check handoff in case another msg flipped assignee during debounce
  if (conversation.assignee === 'human') {
    await logMetaBotEvent({
      ...baseLog,
      stage: 'handoff',
      severity: 'info',
      code: 'assignee_human_after_debounce',
      message: 'Assignee pasó a human durante debounce; no se genera IA',
    });
    return { ok: true, handoff: true, conversationId };
  }

  const { data: org } = await db
    .from('organizations')
    .select('*')
    .eq('id', connection.org_id)
    .maybeSingle();

  let limit = { ok: true };
  try {
    limit = await checkUsage(org, ownerUserId, META_BOT_MODEL);
  } catch (err) {
    console.warn('[meta] checkUsage threw', err.message);
    limit = { ok: true, soft_fail: true };
  }
  if (!limit.ok) {
    console.warn(
      '[meta] usage over quota — responding anyway',
      limit.error || ''
    );
    await logMetaBotEvent({
      ...baseLog,
      stage: 'usage',
      severity: 'warn',
      code: 'usage_quota',
      message:
        limit.error ||
        'Cuota de tokens/mensajes agotada; se responde igual (no silenciar cliente)',
      detail: {
        model: META_BOT_MODEL,
        model_used: limit.model_used,
        model_limit: limit.model_limit,
      },
    });
  }

  const formBundle = await loadFormForBot(bot);
  let leadData = {};
  if (formBundle) {
    const { data: sub } = await db
      .from('lead_submissions')
      .select('data, status')
      .eq('form_id', formBundle.form.id)
      .eq('thread_id', thread.id)
      .maybeSingle();
    leadData = sub?.data || {};
  }

  const companyName = resolveCompanyName(bot, org);
  const catalogProducts = await loadProductsForBot(bot, connection.org_id);
  const { data: history } = await db
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);

  const currentStage = conversation.pipeline_stage || 'nuevo';
  const opsPrompt = buildAgentSystemPrompt({
    bot,
    companyName,
    channel: connection.channel,
    contactLabel: identity.contactName,
    contactPhone: identity.contactPhone || thread.contact_phone || '',
    formBundle,
    leadData,
    catalogProducts,
    currentStage,
  });

  let system = opsPrompt;
  try {
    const matuCore = loadSystemPrompt(META_BOT_MODEL, '', {});
    system = `${matuCore}

---
## Capas operativas de este agente (tienen prioridad sobre lo genérico)
${opsPrompt}`;
  } catch (err) {
    console.warn('[meta] MatuBot prompt load failed', err.message);
    await logMetaBotEvent({
      ...baseLog,
      stage: 'llm',
      severity: 'warn',
      code: 'prompt_load_failed',
      message: err.message || 'No se cargó prompt MatuBot; se usa ops prompt',
    });
  }

  let rawReply = '';
  let usedFallback = false;
  try {
    rawReply = await completeUpstreamChat({
      system,
      messages: (history || []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
  } catch (err) {
    console.error('[meta] upstream error', err.message);
    await logMetaBotEvent({
      ...baseLog,
      stage: 'llm',
      severity: 'error',
      code: 'upstream_error',
      message: err.message || 'Fallo del modelo upstream',
    });
    rawReply = FALLBACK_REPLY;
    usedFallback = true;
  }

  const { data: leadPatch, complete: leadComplete } = parseLeadMarks(rawReply);
  const { notes: aiNotes, stage: markedStage } = parseCommerceMarks(rawReply);
  let handoff = /\[\[HANDOFF\]\]/i.test(rawReply);
  let reply = stripInternalMarks(rawReply);
  reply = reply
    .replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚ¿¡])/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let pipelineStage =
    markedStage && STAGE_IDS.has(markedStage) ? markedStage : null;

  const meetingFromInbound = detectMeetingSignals(inboundContent);
  const meetingFromReply = detectMeetingSignals(reply);
  const meetingLikely = meetingFromInbound.likely || meetingFromReply.likely;
  const meetingSummary = meetingLikely
    ? extractMeetingSummary(inboundContent, reply)
    : '';

  if (!pipelineStage) {
    pipelineStage = inferStageFromConversation(
      inboundContent,
      reply,
      currentStage
    );
  }
  if (meetingLikely) pipelineStage = 'cita';

  const seeded = seedChannelLeadFields({
    formBundle,
    leadData,
    channel: connection.channel,
    contactPhone:
      identity.contactPhone ||
      thread.contact_phone ||
      (connection.channel === 'whatsapp'
        ? formatWhatsAppPhone(externalUserId)
        : '') ||
      '',
    contactName: identity.contactName,
    meetingSummary,
  });
  const mergedLeadPatch = { ...seeded, ...leadPatch };

  if (formBundle && Object.keys(mergedLeadPatch).length) {
    await upsertLeadSubmission({
      orgId: connection.org_id,
      formId: formBundle.form.id,
      botId: bot.id,
      threadId: thread.id,
      conversationId,
      channel: connection.channel,
      contactName: identity.contactName,
      externalUserId,
      patchData: mergedLeadPatch,
      markComplete: leadComplete,
    });
    if (!pipelineStage || pipelineStage === 'nuevo') {
      pipelineStage = meetingLikely ? 'cita' : 'interesado';
    }
  } else if (formBundle && leadComplete) {
    await upsertLeadSubmission({
      orgId: connection.org_id,
      formId: formBundle.form.id,
      botId: bot.id,
      threadId: thread.id,
      conversationId,
      channel: connection.channel,
      contactName: identity.contactName,
      externalUserId,
      patchData: seeded,
      markComplete: true,
    });
    if (!pipelineStage || pipelineStage === 'nuevo') {
      pipelineStage = meetingLikely ? 'cita' : 'interesado';
    }
  } else if (formBundle && Object.keys(seeded).length) {
    await upsertLeadSubmission({
      orgId: connection.org_id,
      formId: formBundle.form.id,
      botId: bot.id,
      threadId: thread.id,
      conversationId,
      channel: connection.channel,
      contactName: identity.contactName,
      externalUserId,
      patchData: seeded,
      markComplete: false,
    });
  }

  if (meetingLikely && !aiNotes.some((n) => n.noteType === 'meeting')) {
    aiNotes.push({
      noteType: 'meeting',
      sentiment: 'positive',
      title: 'Cita acordada',
      body: meetingSummary || 'Cliente confirmó día/hora de reunión',
    });
  }

  for (const n of aiNotes) {
    const allowedTypes = new Set([
      'sentiment',
      'meeting',
      'objection',
      'win',
      'lost',
      'handoff',
      'interest',
      'custom',
    ]);
    const allowedSent = new Set([
      'positive',
      'neutral',
      'negative',
      'critical',
    ]);
    const noteType = allowedTypes.has(n.noteType) ? n.noteType : 'custom';
    await insertConversationNote({
      orgId: connection.org_id,
      conversationId,
      botId: bot.id,
      channel: connection.channel,
      contactName: identity.contactName,
      externalUserId,
      noteType,
      title: n.title || 'Nota',
      body: n.body || '',
      sentiment: allowedSent.has(n.sentiment) ? n.sentiment : 'neutral',
      source: 'ai',
    });
    if (n.sentiment === 'critical' || noteType === 'handoff') {
      handoff = true;
    }
    if (!pipelineStage) {
      const inferred = stageFromNoteType(noteType);
      if (inferred && STAGE_IDS.has(inferred)) pipelineStage = inferred;
    }
  }

  const prevStage = conversation.pipeline_stage || 'nuevo';
  const convPatch = {
    updated_at: new Date().toISOString(),
  };
  if (pipelineStage && STAGE_IDS.has(pipelineStage)) {
    convPatch.pipeline_stage = pipelineStage;
    if (pipelineStage !== prevStage) {
      const label =
        PIPELINE_STAGES.find((s) => s.id === pipelineStage)?.label ||
        pipelineStage;
      await insertConversationNote({
        orgId: connection.org_id,
        conversationId,
        botId: bot.id,
        channel: connection.channel,
        contactName: identity.contactName,
        externalUserId,
        noteType: 'custom',
        title: `Embudo → ${label}`,
        body: `El agente movió el chat de ${prevStage} a ${pipelineStage}`,
        sentiment:
          pipelineStage === 'ganado'
            ? 'positive'
            : pipelineStage === 'perdido'
              ? 'negative'
              : 'neutral',
        source: 'ai',
      });
    }
  }
  if (handoff) {
    convPatch.assignee = 'human';
  }

  if (!reply) {
    reply = `Hola, soy ${bot.name} de ${companyName}. 🙂\n\n¿En qué te puedo ayudar?`;
  }

  try {
    await sendOutboundReliable({
      connection,
      recipientId: externalUserId,
      text: reply,
    });
  } catch (err) {
    console.error('[meta] send failed', err.message);
    await logMetaBotEvent({
      ...baseLog,
      stage: 'send',
      severity: 'error',
      code: 'send_failed',
      message: err.message || 'Graph API rechazó el envío',
      detail: { graph: err.graph || null, status: err.status || null },
    });

    // Last resort: shorter fallback so the customer is never left hanging
    if (!usedFallback) {
      try {
        await sendOutboundReliable({
          connection,
          recipientId: externalUserId,
          text: FALLBACK_REPLY,
        });
        reply = FALLBACK_REPLY;
        usedFallback = true;
        await logMetaBotEvent({
          ...baseLog,
          stage: 'fallback',
          severity: 'warn',
          code: 'fallback_sent_after_send_fail',
          message: 'Se envió mensaje de fallback tras fallo de Graph',
        });
      } catch (err2) {
        await logMetaBotEvent({
          ...baseLog,
          stage: 'send',
          severity: 'error',
          code: 'send_failed_fatal',
          message: err2.message || 'Fallback también falló al enviar',
        });
        return { error: `send_failed: ${err.message}` };
      }
    } else {
      return { error: `send_failed: ${err.message}` };
    }
  }

  const tokensIn = estimateTokens(inboundContent);
  const tokensOut = estimateTokens(reply);
  const aid = newId();
  await db.from('messages').insert({
    id: aid,
    conversation_id: conversationId,
    role: 'assistant',
    content: reply,
    model_id: META_BOT_MODEL,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  });

  await db
    .from('conversations')
    .eq('id', conversationId)
    .update({
      preview: reply.slice(0, 120),
      model_id: META_BOT_MODEL,
      updated_at: convPatch.updated_at,
      ...(convPatch.pipeline_stage
        ? { pipeline_stage: convPatch.pipeline_stage }
        : {}),
      ...(convPatch.assignee ? { assignee: convPatch.assignee } : {}),
    });

  await bumpUsage(
    org,
    ownerUserId,
    tokensIn,
    tokensOut,
    META_BOT_MODEL
  ).catch(async (err) => {
    console.warn('[meta] bumpUsage', err.message);
    await logMetaBotEvent({
      ...baseLog,
      stage: 'usage',
      severity: 'warn',
      code: 'bump_usage_failed',
      message: err.message || 'No se pudo registrar uso de tokens',
    });
  });

  if (usedFallback) {
    await logMetaBotEvent({
      ...baseLog,
      stage: 'fallback',
      severity: 'warn',
      code: 'fallback_reply',
      message: 'Se respondió con mensaje de fallback (IA o envío falló)',
    });
  }

  return {
    ok: true,
    conversationId,
    handoff,
    stage: convPatch.pipeline_stage || prevStage,
    replyLength: reply.length,
    fallback: usedFallback,
  };
}
