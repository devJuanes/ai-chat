import { config } from '../config.js';
import { verifyMetaSignature } from './crypto.js';
import { handleInboundMessage } from './agent-runner.js';
import { logMetaBotEvent } from './bot-logs.js';

function extractTextFromMessengerMessage(msg) {
  if (!msg) return { text: '', isMedia: false };
  if (typeof msg.text === 'string' && msg.text.trim()) {
    return { text: msg.text.trim(), isMedia: false };
  }
  if (msg.attachments?.length) {
    return {
      text: '[El cliente envió un archivo multimedia. Pídele que describa su solicitud en texto.]',
      isMedia: true,
    };
  }
  if (msg.sticker_id) {
    return { text: '[El cliente envió un sticker.]', isMedia: true };
  }
  return { text: '', isMedia: false };
}

function extractWhatsAppText(message) {
  if (!message) return { text: '', isMedia: false };
  if (message.type === 'text' && message.text?.body) {
    return { text: String(message.text.body).trim(), isMedia: false };
  }
  if (message.type === 'button' && message.button?.text) {
    return { text: String(message.button.text).trim(), isMedia: false };
  }
  if (message.type === 'interactive') {
    const t =
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title;
    if (t) return { text: String(t).trim(), isMedia: false };
  }
  if (
    ['image', 'audio', 'video', 'document', 'sticker', 'location'].includes(
      message.type
    )
  ) {
    return {
      text: '[El cliente envió un archivo multimedia. Pídele que describa su solicitud en texto.]',
      isMedia: true,
    };
  }
  return { text: '', isMedia: false };
}

async function processMessengerLikeEntry(entry, channelHint) {
  const pageId = entry.id;
  for (const event of entry.messaging || []) {
    if (event.message?.is_echo) continue;
    if (!event.sender?.id) continue;

    const { text, isMedia } = extractTextFromMessengerMessage(event.message);
    if (!text && !isMedia) {
      await logMetaBotEvent({
        channel: channelHint === 'instagram' ? 'instagram' : 'messenger',
        externalUserId: event.sender.id,
        externalMessageId: event.message?.mid || null,
        stage: 'webhook',
        severity: 'info',
        code: 'unsupported_or_empty',
        message: 'Evento Messenger/IG sin texto ni adjunto usable',
        detail: { pageId, hasPostback: Boolean(event.postback) },
      });
      continue;
    }

    const channel =
      channelHint === 'instagram' ? 'instagram' : 'messenger';

    try {
      await handleInboundMessage({
        channel,
        pageId,
        igUserId: channel === 'instagram' ? pageId : undefined,
        externalUserId: event.sender.id,
        text,
        externalMessageId: event.message?.mid || null,
        isMediaStub: isMedia,
      });
    } catch (err) {
      console.error('[meta/webhook] messenger handler', err.message);
      await logMetaBotEvent({
        channel,
        externalUserId: event.sender.id,
        externalMessageId: event.message?.mid || null,
        stage: 'webhook',
        severity: 'error',
        code: 'handler_exception',
        message: err.message || 'Excepción en handler Messenger/IG',
        detail: { pageId },
      });
    }
  }
}

async function processWhatsAppEntry(entry) {
  for (const change of entry.changes || []) {
    if (change.field !== 'messages') continue;
    const value = change.value || {};
    const phoneNumberId = value.metadata?.phone_number_id;
    const contacts = value.contacts || [];
    for (const message of value.messages || []) {
      const contact = contacts.find((c) => c.wa_id === message.from);
      const profileName = String(contact?.profile?.name || '').trim();
      const { text, isMedia } = extractWhatsAppText(message);
      if (!text && !isMedia) {
        await logMetaBotEvent({
          channel: 'whatsapp',
          externalUserId: message.from,
          externalMessageId: message.id || null,
          stage: 'webhook',
          severity: 'info',
          code: 'unsupported_or_empty',
          message: `WhatsApp tipo no manejado: ${message.type || 'unknown'}`,
          detail: { phoneNumberId, type: message.type || null },
        });
        continue;
      }
      try {
        await handleInboundMessage({
          channel: 'whatsapp',
          phoneNumberId,
          externalUserId: message.from,
          contactName: profileName,
          contactPhone: message.from,
          text,
          externalMessageId: message.id || null,
          isMediaStub: isMedia,
        });
      } catch (err) {
        console.error('[meta/webhook] whatsapp handler', err.message);
        await logMetaBotEvent({
          channel: 'whatsapp',
          externalUserId: message.from,
          externalMessageId: message.id || null,
          stage: 'webhook',
          severity: 'error',
          code: 'handler_exception',
          message: err.message || 'Excepción en handler WhatsApp',
          detail: { phoneNumberId },
        });
      }
    }
  }
}

/**
 * Register GET verify + POST webhook. Must receive rawBody on POST
 * (set via express.json verify hook in index.js).
 */
export function registerMetaWebhook(app) {
  app.get('/api/meta/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (
      mode === 'subscribe' &&
      token &&
      token === config.meta.verifyToken
    ) {
      return res.status(200).send(String(challenge));
    }
    return res.sendStatus(403);
  });

  app.post('/api/meta/webhook', (req, res) => {
    const raw =
      req.rawBody ||
      (Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body || {})));

    const sig = req.headers['x-hub-signature-256'];
    if (config.meta.appSecret && !verifyMetaSignature(raw, sig)) {
      return res.sendStatus(401);
    }

    // Ack immediately; process async
    res.sendStatus(200);

    let body = req.body;
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf8'));
      } catch {
        logMetaBotEvent({
          stage: 'webhook',
          severity: 'error',
          code: 'invalid_json',
          message: 'Webhook body no es JSON válido',
        });
        return;
      }
    }

    setImmediate(async () => {
      try {
        const object = body?.object;
        if (object === 'page') {
          for (const entry of body.entry || []) {
            await processMessengerLikeEntry(entry, 'messenger');
          }
        } else if (object === 'instagram') {
          for (const entry of body.entry || []) {
            await processMessengerLikeEntry(entry, 'instagram');
          }
        } else if (object === 'whatsapp_business_account') {
          for (const entry of body.entry || []) {
            await processWhatsAppEntry(entry);
          }
        }
      } catch (err) {
        console.error('[meta/webhook] process error', err);
        await logMetaBotEvent({
          stage: 'webhook',
          severity: 'error',
          code: 'process_exception',
          message: err?.message || 'Error procesando webhook Meta',
        });
      }
    });
  });
}
