import { getDb, newId } from '../db.js';
import { checkUsage, bumpUsage } from '../auth.js';
import { loadSystemPrompt } from '../models.js';
import {
  completeUpstreamChat,
  estimateTokens,
} from '../upstream.js';
import { decryptToken } from './crypto.js';
import { sendPageMessage, sendWhatsAppText } from './graph.js';

const HISTORY_LIMIT = 30;

function buildAgentSystemPrompt({ bot, orgName, channel }) {
  const base = loadSystemPrompt(bot.model_id || 'matu-commerce');
  return `${base}

## Agente de canal (${channel})
Eres el agente "${bot.name}" de ${orgName || 'la empresa'}.
Objetivo principal: ${bot.objective || 'Ayudar al cliente y avanzar hacia una conversión.'}
Instrucciones: ${bot.instructions || 'Sé claro, útil y orientado a acción.'}
Contexto del negocio: ${bot.business_context || 'No hay contexto adicional.'}
Tono: ${bot.tone || 'profesional y cercano'}.
Idioma: ${bot.language || 'es'}.

Reglas del canal:
- Respuestas cortas (ideal 1–3 párrafos o bullets), sin markdown pesado ni bloques de código.
- No inventes precios ni stock; si falta info, pregunta.
- Si el usuario pide hablar con un humano, o coincide con handoff, responde brevemente que un asesor tomará el chat y termina con la línea exacta: [[HANDOFF]]
- No menciones que eres un modelo de IA genérico; actúa como agente del negocio.
`;
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

async function findConnectionByAsset({ channel, pageId, phoneNumberId, igUserId }) {
  const db = getDb();
  let q = db
    .from('meta_connections')
    .select('*')
    .eq('channel', channel)
    .eq('status', 'active');

  if (channel === 'whatsapp' && phoneNumberId) {
    q = q.eq('phone_number_id', phoneNumberId);
  } else if (channel === 'instagram' && (igUserId || pageId)) {
    // IG webhooks often use page_id; we may have stored both
    if (igUserId) q = q.eq('ig_user_id', igUserId);
    else q = q.eq('page_id', pageId);
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

async function getOrCreateThread({
  connection,
  bot,
  externalUserId,
  contactName,
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
    if (contactName && contactName !== existing.contact_name) {
      await db
        .from('channel_threads')
        .eq('id', existing.id)
        .update({ contact_name: contactName });
    }
    const { data: conv } = await db
      .from('conversations')
      .select('*')
      .eq('id', existing.conversation_id)
      .maybeSingle();
    return { thread: existing, conversation: conv };
  }

  const conversationId = newId();
  const title =
    contactName ||
    `${connection.channel} · ${String(externalUserId).slice(-6)}`;

  await db.from('conversations').insert({
    id: conversationId,
    org_id: connection.org_id,
    user_id: ownerUserId,
    title,
    model_id: bot.model_id || 'matu-commerce',
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
  const pageId = connection.page_id;
  return sendPageMessage({
    pageId,
    pageToken: token,
    recipientId,
    text,
  });
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
  contactName,
  text,
  externalMessageId,
  isMediaStub = false,
}) {
  if (!externalUserId) return { skipped: 'no_sender' };

  const connection = await findConnectionByAsset({
    channel,
    pageId,
    phoneNumberId,
    igUserId,
  });
  if (!connection) return { skipped: 'no_connection' };

  if (externalMessageId && (await alreadyProcessed(externalMessageId))) {
    return { skipped: 'duplicate' };
  }

  const bound = await getBinding(connection.id);
  if (!bound) return { skipped: 'no_bot' };
  const { bot } = bound;

  const ownerUserId = await orgOwnerUserId(connection.org_id);
  if (!ownerUserId) return { skipped: 'no_owner' };

  const { thread, conversation } = await getOrCreateThread({
    connection,
    bot,
    externalUserId,
    contactName,
    ownerUserId,
  });
  if (!conversation) return { skipped: 'no_conversation' };

  const db = getDb();
  const inboundContent = isMediaStub
    ? text ||
      '[El cliente envió un archivo multimedia. Pídele que describa su solicitud en texto.]'
    : String(text || '').trim();

  if (!inboundContent && !isMediaStub) return { skipped: 'empty' };

  // Persist inbound
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

  // Human takeover — store message but do not auto-reply
  if (conversation.assignee === 'human') {
    return { ok: true, handoff: true, conversationId: conversation.id };
  }

  // Keyword handoff from user
  if (wantsHandoff(inboundContent, bot.handoff_keywords)) {
    await db
      .from('conversations')
      .eq('id', conversation.id)
      .update({ assignee: 'human' });
    const notice =
      'Claro, un asesor humano tomará esta conversación en breve.';
    try {
      await sendOutbound({
        connection,
        recipientId: externalUserId,
        text: notice,
      });
    } catch (err) {
      console.error('[meta] handoff send failed', err.message);
    }
    const aid = newId();
    await db.from('messages').insert({
      id: aid,
      conversation_id: conversation.id,
      role: 'assistant',
      content: notice,
      model_id: bot.model_id,
    });
    return { ok: true, handoff: true, conversationId: conversation.id };
  }

  const { data: org } = await db
    .from('organizations')
    .select('*')
    .eq('id', connection.org_id)
    .maybeSingle();

  const limit = await checkUsage(org, ownerUserId);
  if (!limit.ok) {
    console.warn('[meta] usage limit', limit.error);
    return { skipped: 'usage_limit', error: limit.error };
  }

  const { data: history } = await db
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);

  const system = buildAgentSystemPrompt({
    bot,
    orgName: org?.name,
    channel: connection.channel,
  });

  let reply = '';
  try {
    reply = await completeUpstreamChat({
      system,
      messages: (history || []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
  } catch (err) {
    console.error('[meta] upstream error', err.message);
    return { error: err.message };
  }

  let handoff = false;
  if (reply.includes('[[HANDOFF]]')) {
    handoff = true;
    reply = reply.replace(/\[\[HANDOFF\]\]/g, '').trim();
    await db
      .from('conversations')
      .eq('id', conversation.id)
      .update({ assignee: 'human' });
  }

  if (!reply) {
    reply = 'Gracias por tu mensaje. ¿En qué puedo ayudarte?';
  }

  try {
    await sendOutbound({
      connection,
      recipientId: externalUserId,
      text: reply,
    });
  } catch (err) {
    console.error('[meta] send failed', err.message);
    return { error: `send_failed: ${err.message}` };
  }

  const tokensIn = estimateTokens(inboundContent);
  const tokensOut = estimateTokens(reply);
  const aid = newId();
  await db.from('messages').insert({
    id: aid,
    conversation_id: conversation.id,
    role: 'assistant',
    content: reply,
    model_id: bot.model_id,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  });

  await db
    .from('conversations')
    .eq('id', conversation.id)
    .update({
      preview: reply.slice(0, 120),
      updated_at: new Date().toISOString(),
    });

  await bumpUsage(org, ownerUserId, tokensIn, tokensOut);

  return {
    ok: true,
    conversationId: conversation.id,
    handoff,
    replyLength: reply.length,
  };
}
