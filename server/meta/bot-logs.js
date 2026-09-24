import { getDb, newId } from '../db.js';

/**
 * Persist Meta bot ops events (errors / skips). Never throws — logging must
 * not break the reply path. Safe if the migration table is missing.
 */
export async function logMetaBotEvent({
  orgId = null,
  botId = null,
  conversationId = null,
  channel = null,
  externalUserId = null,
  externalMessageId = null,
  stage = 'unknown',
  severity = 'error',
  code,
  message = '',
  detail = null,
} = {}) {
  if (!code) return;
  try {
    const db = getDb();
    const { error } = await db.from('meta_bot_logs').insert({
      id: newId(),
      org_id: orgId || null,
      bot_id: botId || null,
      conversation_id: conversationId || null,
      channel: channel || null,
      external_user_id: externalUserId ? String(externalUserId) : null,
      external_message_id: externalMessageId
        ? String(externalMessageId)
        : null,
      stage: String(stage || 'unknown').slice(0, 64),
      severity: ['error', 'warn', 'info'].includes(severity)
        ? severity
        : 'error',
      code: String(code).slice(0, 120),
      message: String(message || '').slice(0, 2000),
      detail:
        detail && typeof detail === 'object'
          ? detail
          : detail
            ? { raw: String(detail).slice(0, 1000) }
            : null,
    });
    if (error) {
      console.warn('[meta/logs] insert failed', error.message);
    }
  } catch (err) {
    console.warn('[meta/logs] soft-fail', err?.message || err);
  }
}
