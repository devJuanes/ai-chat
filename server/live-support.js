import { config } from './config.js';
import { getDb, newId, periodYm } from './db.js';
import { sendAppMail } from './email-verify.js';
import { completeUpstreamChat } from './upstream.js';

const OPEN = new Set(['pending', 'active']);

function rowsOf(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isAdmin(profile) {
  return profile?.is_admin === true || profile?.is_admin === 'true' || profile?.is_admin === 1;
}

function cleanBody(value) {
  const body = String(value || '').trim();
  if (body.length < 1) throw fail(400, 'Escribe un mensaje');
  if (body.length > 2000) throw fail(400, 'El mensaje es demasiado largo');
  return body;
}

export async function ensureLiveSupportSchema() {
  const db = getDb();
  const statements = [
    `CREATE TABLE IF NOT EXISTS support_live_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_by TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS support_live_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_name TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ];
  for (const sql of statements) {
    const { error } = await db.rpc(sql);
    if (error) console.warn('[live] schema', error.message || error);
  }
}

async function actor(req, ensureWorkspace) {
  const { profile } = await ensureWorkspace(req.user);
  return {
    id: profile.id,
    email: profile.email || '',
    name: profile.display_name || profile.email || 'Usuario',
    admin: isAdmin(profile),
  };
}

async function messagesOf(chatId) {
  const db = getDb();
  const { data, error } = await db
    .from('support_live_messages')
    .select('id, chat_id, sender, sender_name, body, created_at')
    .eq('chat_id', chatId)
    .limit(200);
  if (error) throw fail(500, error.message || 'No se pudieron leer los mensajes');
  const rows = rowsOf(data);
  rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return rows;
}

async function chatById(id) {
  const db = getDb();
  const { data, error } = await db
    .from('support_live_chats')
    .select('id, user_id, email, name, status, accepted_by, created_at, updated_at')
    .eq('id', id)
    .limit(1);
  if (error) throw fail(500, error.message || 'No se pudo leer el chat');
  return rowsOf(data)[0] || null;
}

async function openChatForUser(userId) {
  const db = getDb();
  const { data, error } = await db
    .from('support_live_chats')
    .select('id, user_id, email, name, status, accepted_by, created_at, updated_at')
    .eq('user_id', userId)
    .limit(20);
  if (error) throw fail(500, error.message || 'No se pudo leer tu chat');
  const rows = rowsOf(data).filter((row) => OPEN.has(row.status));
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows[0] || null;
}

async function addMessage(chatId, sender, senderName, body) {
  const db = getDb();
  const message = {
    id: newId(),
    chat_id: chatId,
    sender,
    sender_name: senderName || '',
    body,
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('support_live_messages').insert(message);
  if (error) throw fail(500, error.message || 'No se pudo enviar el mensaje');
  const { error: touchErr } = await db
    .from('support_live_chats')
    .eq('id', chatId)
    .update({ updated_at: message.created_at });
  if (touchErr) console.warn('[live] touch', touchErr.message || touchErr);
  return message;
}

async function queueFor(chat) {
  const db = getDb();
  const { data, error } = await db
    .from('support_live_chats')
    .select('id, status, created_at')
    .limit(200);
  if (error || !chat) return { position: 0, waiting: 0, active: 0 };
  const rows = rowsOf(data);
  const pending = rows
    .filter((row) => row.status === 'pending')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const ahead = pending.filter((row) => {
    const rowTime = new Date(row.created_at).getTime();
    const mine = new Date(chat.created_at).getTime();
    return row.id !== chat.id && (rowTime < mine || (rowTime === mine && row.id < chat.id));
  }).length;
  return {
    position: chat.status === 'pending' ? ahead + 1 : 0,
    waiting: pending.length,
    active: rows.filter((row) => row.status === 'active').length,
  };
}

async function notifyAdmin(me) {
  const to = config.mail.alertTo;
  if (!to) return;
  const when = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const subject = `Solicitud de soporte de ${me.name} — Matubyte`;
  const text = [
    'Hola.',
    '',
    `${me.name} (${me.email}) abrió un chat de soporte en Matu AI.`,
    `Fecha: ${when}.`,
    '',
    'Entra a la aplicación, sección Admin, y acepta el chat para atenderlo.',
  ].join('\n');
  const html = `<!DOCTYPE html><html lang="es-CO"><body style="font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px;">
    <h1 style="font-size:22px;">Solicitud de soporte</h1>
    <p><strong>${esc(me.name)}</strong> escribió desde Matu AI y espera a que una persona acepte el chat.</p>
    <p>Correo: ${esc(me.email)}<br />Fecha: ${esc(when)}</p>
    <p>Entra a la aplicación, abre Admin y acepta el chat para responderle.</p>
  </body></html>`;
  try {
    await sendAppMail({ to, subject, html, text });
  } catch (err) {
    console.warn('[live] alert', err?.message || err);
  }
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function assistWhileWaiting(chat) {
  const history = await messagesOf(chat.id);
  const transcript = history
    .filter((item) => item.sender !== 'admin')
    .slice(-8)
    .map((item) => `${item.sender === 'user' ? 'Persona' : 'Soporte'}: ${item.body}`)
    .join('\n');
  let reply = '';
  try {
    reply = await completeUpstreamChat({
      system:
        'Eres el primer contacto de soporte de Matu, de Matubyte, en Colombia. Hablas solo en español y en frases cortas. Escuchas la novedad, la resumes y pides un dato si falta. No prometas cambios de plan ni de cuenta. Cuando ya entendiste el caso, dile que una persona del equipo se va a conectar y que está en la cola. No digas que tú eres esa persona.',
      messages: [{ role: 'user', content: transcript || 'La persona acaba de abrir el chat.' }],
      maxTokens: 220,
    });
  } catch (err) {
    console.warn('[live] ai', err?.message || err);
    reply =
      'Ya anoté lo que cuentas. Una persona del equipo se va a conectar para seguir contigo. Si quieres, agrega un detalle más.';
  }
  reply = String(reply || '').trim().slice(0, 1200);
  if (!reply) {
    reply = 'Ya recibí tu mensaje. Una persona del equipo lo revisa en cuanto se conecte.';
  }
  return addMessage(chat.id, 'assistant', 'Matu', reply);
}

async function openFreshChat(me) {
  const existing = await openChatForUser(me.id);
  if (existing) {
    return { chat: existing, created: false, queue: await queueFor(existing) };
  }
  const db = getDb();
  const now = new Date().toISOString();
  const chat = {
    id: newId(),
    user_id: me.id,
    email: me.email,
    name: me.name,
    status: 'pending',
    accepted_by: '',
    created_at: now,
    updated_at: now,
  };
  const { error } = await db.from('support_live_chats').insert(chat);
  if (error) throw fail(500, error.message || 'No se pudo abrir el chat');
  await addMessage(
    chat.id,
    'assistant',
    'Matu',
    'Hola. ¿En qué puedo ayudarte? Cuéntame la novedad y, mientras llega una persona, la vamos viendo juntos.'
  );
  await notifyAdmin(me);
  return { chat, created: true, queue: await queueFor(chat) };
}

function sendError(res, err) {
  res.status(err.status || 500).json({
    error: { message: err.message || 'No se pudo completar' },
  });
}

export function registerLiveSupportRoutes(app, { authMiddleware, ensureWorkspace }) {
  app.get('/api/support/live', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      const chat = await openChatForUser(me.id);
      const messages = chat ? await messagesOf(chat.id) : [];
      const queue = chat ? await queueFor(chat) : { position: 0, waiting: 0, active: 0 };
      res.json({ chat, messages, queue });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/support/live/start', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      const opened = await openFreshChat(me);
      const messages = await messagesOf(opened.chat.id);
      res.status(opened.created ? 201 : 200).json({
        chat: opened.chat,
        messages,
        queue: opened.queue,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get('/api/admin/overview', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      if (!me.admin) throw fail(403, 'Solo un administrador puede ver esto');
      const db = getDb();
      const period = periodYm();
      const { data: people, error: peopleErr } = await db
        .from('profiles')
        .select('id, email, display_name, is_admin, created_at')
        .limit(200);
      if (peopleErr) throw fail(500, peopleErr.message || 'No se pudieron leer los usuarios');
      const { data: usage, error: usageErr } = await db
        .from('usage_counters')
        .select('user_id, messages_count, tokens_in, tokens_out, period_ym')
        .eq('period_ym', period)
        .limit(500);
      if (usageErr) console.warn('[admin] usage', usageErr.message || usageErr);
      const byUser = new Map();
      for (const row of rowsOf(usage)) {
        byUser.set(row.user_id, row);
      }
      const users = rowsOf(people)
        .map((person) => {
          const spent = byUser.get(person.id) || {};
          const tokens = (spent.tokens_in || 0) + (spent.tokens_out || 0);
          return {
            id: person.id,
            email: person.email,
            name: person.display_name || person.email,
            is_admin: isAdmin(person),
            created_at: person.created_at,
            messages: spent.messages_count || 0,
            tokens,
          };
        })
        .sort((a, b) => b.tokens - a.tokens || String(a.name).localeCompare(String(b.name), 'es'));
      res.json({ period, users });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get('/api/support/live/inbox', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      if (!me.admin) throw fail(403, 'Solo el equipo de soporte puede ver la bandeja');
      const db = getDb();
      const { data, error } = await db
        .from('support_live_chats')
        .select('id, user_id, email, name, status, accepted_by, created_at, updated_at')
        .limit(80);
      if (error) throw fail(500, error.message || 'No se pudo leer la bandeja');
      const chats = rowsOf(data)
        .filter((row) => OPEN.has(row.status))
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
          return new Date(a.created_at) - new Date(b.created_at);
        });
      const withMessages = await Promise.all(chats.map(async (chat) => {
        const messages = await messagesOf(chat.id);
        const last = messages[messages.length - 1] || null;
        return {
          ...chat,
          preview: last ? String(last.body || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '',
          incoming_at: messages
            .filter((row) => row.sender !== 'admin')
            .map((row) => row.created_at),
        };
      }));
      res.json({ chats: withMessages });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get('/api/support/live/:id', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      const chat = await chatById(req.params.id);
      if (!chat) throw fail(404, 'Ese chat no existe');
      if (!me.admin && chat.user_id !== me.id) throw fail(403, 'No puedes ver este chat');
      const messages = await messagesOf(chat.id);
      res.json({ chat, messages });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/support/live/:id/accept', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      if (!me.admin) throw fail(403, 'Solo el equipo de soporte puede aceptar');
      const chat = await chatById(req.params.id);
      if (!chat) throw fail(404, 'Ese chat no existe');
      if (chat.status === 'closed') throw fail(400, 'Este chat ya está cerrado');
      if (chat.status === 'pending') {
        const now = new Date().toISOString();
        const db = getDb();
        const { error } = await db
          .from('support_live_chats')
          .eq('id', chat.id)
          .update({
            status: 'active',
            accepted_by: me.id,
            updated_at: now,
          });
        if (error) throw fail(500, error.message || 'No se pudo aceptar el chat');
        chat.status = 'active';
        chat.accepted_by = me.id;
        chat.updated_at = now;
        await addMessage(chat.id, 'admin', me.name, 'Listo, ya estoy contigo. Cuéntame con calma.');
      }
      const messages = await messagesOf(chat.id);
      res.json({ chat, messages });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/support/live/:id/messages', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      const body = cleanBody(req.body?.message);
      const chat = await chatById(req.params.id);
      if (!chat) throw fail(404, 'Ese chat no existe');
      if (chat.status === 'closed') throw fail(400, 'Este chat ya está cerrado');
      const mine = chat.user_id === me.id;
      if (!mine && !me.admin) throw fail(403, 'No puedes escribir en este chat');
      if (me.admin && !mine && chat.status !== 'active') {
        throw fail(400, 'Acepta el chat antes de responder');
      }
      const fromAdmin = me.admin && !mine;
      const message = await addMessage(
        chat.id,
        fromAdmin ? 'admin' : 'user',
        me.name,
        body
      );
      let assistant = null;
      if (!fromAdmin && chat.status === 'pending') {
        assistant = await assistWhileWaiting(chat);
      }
      const queue = await queueFor(chat);
      res.status(201).json({ message, assistant, queue });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/support/live/:id/close', authMiddleware(true), async (req, res) => {
    try {
      const me = await actor(req, ensureWorkspace);
      if (!me.admin) throw fail(403, 'Solo el equipo de soporte puede cerrar el chat');
      const chat = await chatById(req.params.id);
      if (!chat) throw fail(404, 'Ese chat no existe');
      const now = new Date().toISOString();
      const db = getDb();
      const { error } = await db
        .from('support_live_chats')
        .eq('id', chat.id)
        .update({ status: 'closed', updated_at: now });
      if (error) throw fail(500, error.message || 'No se pudo cerrar el chat');
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });
}
