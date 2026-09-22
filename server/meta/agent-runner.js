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
import { decryptToken } from './crypto.js';
import {
  sendPageMessage,
  sendWhatsAppText,
  fetchMessengerUserProfile,
  fetchInstagramUserProfile,
  formatWhatsAppPhone,
} from './graph.js';

const HISTORY_LIMIT = 30;
const LEAD_MARK_RE = /\[\[LEAD:([^=\]]+)=([^\]]*)\]\]/gi;
const LEAD_DONE_RE = /\[\[LEAD_COMPLETE\]\]/gi;
const HANDOFF_RE = /\[\[HANDOFF\]\]/gi;

const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram',
};

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
  formBundle,
  leadData,
  catalogProducts,
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

  let formBlock = '';
  if (formBundle?.fields?.length) {
    formBlock = `
## Formulario de leads asignado: "${formBundle.form.name}"
Debes recopilar estos datos del cliente de forma natural (1–2 preguntas por mensaje):
${formBundle.fields
  .map(
    (f) =>
      `- ${f.label} [${f.field_key}] (${f.field_type})${f.required ? ' *obligatorio*' : ''}`
  )
  .join('\n')}
${missing ? `\nAún faltan:\n${missing}\n` : '\nTodos los campos obligatorios ya están capturados.\n'}
Cuando el cliente te dé un dato claro, añade UNA línea oculta al final de tu respuesta interna (el sistema la quitará antes de enviarla):
[[LEAD:clave=valor]]
Cuando todos los obligatorios estén listos, añade también:
[[LEAD_COMPLETE]]
No menciones estos marcadores al cliente.
`;
  }

  return `Eres un agente comercial senior de ${companyName} en ${channelName}.

## Identidad (obligatorio)
- Tu nombre es exactamente: "${bot.name}".
- Representas a la empresa: "${companyName}".
- NUNCA te presentes con correos, usernames técnicos, IDs, ni "Matu AI" / Matubyte a menos que "${companyName}" sea literalmente eso.
- Si saludas, saluda como ${bot.name} de ${companyName}.
${welcome ? `- Saludo sugerido (adáptalo, no lo copies roboticamente): ${welcome}` : ''}
${contactLabel ? `- El cliente aparece como: ${contactLabel}. Úsalo solo si ayuda; no inventes datos.` : ''}

## Objetivo
${bot.objective || 'Calificar el lead, responder dudas y avanzar hacia una venta o cita.'}

## Instrucciones operativas
${bot.instructions || 'Sé claro, útil y orientado a cerrar.'}

## Contexto del negocio
${bot.business_context || 'Sin contexto adicional.'}
${website ? `\nSitio web de referencia: ${website}` : ''}
${knowledge ? `\nConocimiento de la empresa (úsalo; no inventes fuera de esto):\n${knowledge}` : ''}

## CATÁLOGO OFICIAL (regla crítica — no fallar)
Solo puedes hablar, ofrecer o cotizar lo que aparece abajo.
Si el cliente pide algo que NO está en el catálogo: no inventes. Di que lo vas a confirmar con el equipo y, si insiste en comprar eso, usa [[HANDOFF]].
Nunca inventes "cursos", paquetes, precios ni stock que no estén listados.

${catalogBlock}

## Tono e idioma
Tono: ${bot.tone || 'profesional y cercano'}.
Idioma: ${bot.language || 'es'}.
Trata clientes que escriben mal o son ambiguos con paciencia: aclara con preguntas cortas.

## Escalado (handoff)
Si pide humano, hay queja grave, o pide algo fuera de catálogo: responde con calidez profesional.
NO digas "te paso con un asesor". Di algo como: "Te conecto con alguien del equipo para darte una respuesta precisa."
Luego termina con [[HANDOFF]].

## Notas internas y pipeline (OBLIGATORIO — el sistema las oculta)
TÚ calificas el lead y mueves el embudo. No esperes a un humano.

1) Notas: cuando pase algo relevante, añade:
[[NOTE:tipo|sentimiento|titulo|detalle]]
tipos: sentiment, meeting, objection, win, lost, handoff, interest, custom
sentimiento: positive, neutral, negative, critical
Ejemplos:
- Cliente grosero → [[NOTE:sentiment|critical|Cliente agresivo|Usó insultos / tono hostil]]
- Acordaron reunión → [[NOTE:meeting|positive|Reunión acordada|Quieren videollamada esta semana]]
- Muestra interés → [[NOTE:interest|positive|Interesado|Preguntó por el servicio y plazos]]
- No le interesa → [[NOTE:lost|negative|Sin interés|Dijo que no necesita el servicio]]

2) Embudo Kanban: en CADA respuesta donde el estado del cliente esté claro, incluye UNA marca:
[[STAGE:interesado]]
Valores válidos (elige solo uno): nuevo, interesado, en_duda, cita, cerrar, ganado, perdido
Reglas de decisión:
- Primer contacto / sin claridad → nuevo
- Pregunta por oferta, precio o beneficios → interesado
- Tiene objeciones o “lo pienso” → en_duda
- Acuerda reunión/cita → cita
- Listo para comprar / pide link de pago → cerrar
- Confirmó compra o cierre → ganado
- Rechazó o no volverá → perdido
Si el estado no cambió respecto al mensaje anterior, puedes omitir STAGE.

## Reglas del canal
- Respuestas cortas (1–3 frases o bullets). Sin markdown pesado ni código.
- Empuja al siguiente paso (dato, link de compra del catálogo, cita, o handoff).
- Si un producto del catálogo tiene link, puedes compartirlo cuando el cliente esté listo.
- Si el catálogo dice NO mencionar precio, no digas cifras: ofrece cotización o confirma con el equipo.
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
    model_id: bot.model_id || 'matu-bot-3-5',
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
  if (!conversation) return { skipped: 'no_conversation' };

  const db = getDb();
  const inboundContent = isMediaStub
    ? text ||
      '[El cliente envió un archivo multimedia. Pídele que describa su solicitud en texto.]'
    : String(text || '').trim();

  if (!inboundContent && !isMediaStub) return { skipped: 'empty' };

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
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT);

  const system = buildAgentSystemPrompt({
    bot,
    companyName,
    channel: connection.channel,
    contactLabel: identity.contactName,
    formBundle,
    leadData,
    catalogProducts,
  });

  let rawReply = '';
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
    return { error: err.message };
  }

  const { data: leadPatch, complete: leadComplete } = parseLeadMarks(rawReply);
  const { notes: aiNotes, stage: markedStage } = parseCommerceMarks(rawReply);
  let handoff = /\[\[HANDOFF\]\]/i.test(rawReply);
  let reply = stripInternalMarks(rawReply);
  let pipelineStage = markedStage && STAGE_IDS.has(markedStage) ? markedStage : null;

  if (formBundle && Object.keys(leadPatch).length) {
    await upsertLeadSubmission({
      orgId: connection.org_id,
      formId: formBundle.form.id,
      botId: bot.id,
      threadId: thread.id,
      conversationId: conversation.id,
      channel: connection.channel,
      contactName: identity.contactName,
      externalUserId,
      patchData: leadPatch,
      markComplete: leadComplete,
    });
    if (!pipelineStage) pipelineStage = 'interesado';
  } else if (formBundle && leadComplete) {
    await upsertLeadSubmission({
      orgId: connection.org_id,
      formId: formBundle.form.id,
      botId: bot.id,
      threadId: thread.id,
      conversationId: conversation.id,
      channel: connection.channel,
      contactName: identity.contactName,
      externalUserId,
      patchData: {},
      markComplete: true,
    });
    if (!pipelineStage) pipelineStage = 'interesado';
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
      conversationId: conversation.id,
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
        conversationId: conversation.id,
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
    reply = `Hola, soy ${bot.name} de ${companyName}. ¿En qué te puedo ayudar?`;
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
      updated_at: convPatch.updated_at,
      ...(convPatch.pipeline_stage
        ? { pipeline_stage: convPatch.pipeline_stage }
        : {}),
      ...(convPatch.assignee ? { assignee: convPatch.assignee } : {}),
    });

  await bumpUsage(org, ownerUserId, tokensIn, tokensOut);

  return {
    ok: true,
    conversationId: conversation.id,
    handoff,
    stage: convPatch.pipeline_stage || prevStage,
    replyLength: reply.length,
  };
}
