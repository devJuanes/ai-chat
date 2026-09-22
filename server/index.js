import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import {
  authMiddleware,
  ensureWorkspace,
  checkUsage,
  bumpUsage,
  getPlanForOrg,
  verifyAccessToken,
} from './auth.js';
import { matudbLogin, matudbRegister } from './matudb-auth.js';
import { getDb, newId } from './db.js';
import {
  listPublicModels,
  loadSystemPrompt,
  getModel,
  isModelAllowed,
} from './models.js';
import {
  streamUpstreamChat,
  parseSseStream,
  estimateTokens,
  stripThinkTags,
} from './upstream.js';
import { registerExtraRoutes, loadProjectContext, generateChatTitle } from './extras.js';
import { buildTemplatePromptBlock } from './templates.js';
import {
  isImageGenerationRequest,
  extractImagePrompt,
  extractAspectRatio,
  generateAndStoreImage,
  formatImageAssistantMessage,
  registerGeneratedImageRoutes,
} from './image-gen.js';
import { registerMetaRoutes, metaConfigured } from './meta/index.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(
  express.json({
    limit: '4mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith('/api/meta/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    company: config.companyName,
    projectId: config.matudb.projectId,
    upstreamConfigured: Boolean(config.upstream.apiKey),
    upstreamModel: config.upstream.model,
    imageModel: config.upstream.imageModel,
    metaConfigured: metaConfigured(),
  });
});

registerExtraRoutes(app);
registerGeneratedImageRoutes(app);
registerMetaRoutes(app, { authMiddleware, ensureWorkspace });

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || email.split('@')[0]).trim();

    if (!email || !password || password.length < 8) {
      return res.status(400).json({
        error: { message: 'Email y contraseña (mín. 8) son requeridos' },
      });
    }

    const { user, token } = await matudbRegister({ email, password, name });
    if (!token || !user?.id) {
      return res.status(500).json({
        error: { message: 'MatuDB no devolvió sesión' },
      });
    }

    const verified = await verifyAccessToken(token);
    if (!verified) {
      return res.status(500).json({
        error: { message: 'Token de MatuDB no verificable' },
      });
    }

    // Asegura que el nombre del registro quede en el perfil
    verified.name = name || verified.name;
    const { profile } = await ensureWorkspace(verified);

    return res.status(201).json({
      token,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.display_name || name,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email y contraseña son requeridos' },
      });
    }

    let user;
    let token;
    try {
      ({ user, token } = await matudbLogin({ email, password }));
    } catch (err) {
      return res.status(401).json({
        error: {
          message:
            err.message ||
            'Correo o contraseña incorrectos. Si no tienes cuenta, regístrate.',
        },
      });
    }

    if (!token || !user?.id || !user?.email) {
      return res.status(401).json({
        error: { message: 'Correo o contraseña incorrectos' },
      });
    }

    const verified = await verifyAccessToken(token);
    if (!verified?.id) {
      return res.status(401).json({
        error: { message: 'Sesión inválida tras el login' },
      });
    }

    if (user.name) verified.name = user.name;
    const { profile } = await ensureWorkspace(verified);
    if (!profile?.id) {
      return res.status(500).json({
        error: { message: 'No se pudo preparar tu espacio de trabajo' },
      });
    }

    return res.json({
      token,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.display_name || user.name || verified.name,
      },
    });
  } catch (err) {
    return res.status(401).json({
      error: {
        message: err.message || 'Correo o contraseña incorrectos',
      },
    });
  }
});

app.get('/api/models', authMiddleware(false), async (req, res) => {
  let planId = 'free';
  let modelsAllowed = '';
  if (req.user) {
    try {
      const { org } = await ensureWorkspace(req.user);
      const plan = await getPlanForOrg(org);
      planId = plan.id;
      modelsAllowed = plan.models_allowed || '';
    } catch {
      /* use free */
    }
  }
  res.json({
    models: listPublicModels(planId, modelsAllowed),
    sizorOnly: false,
  });
});

app.get('/api/conversations', authMiddleware(true), async (req, res) => {
  try {
    const { profile } = await ensureWorkspace(req.user);
    const db = getDb();
    const archived = req.query.archived === '1';
    const projectId = req.query.project_id || null;

    let q = db
      .from('conversations')
      .select(
        'id, title, preview, model_id, project_id, pinned_at, share_token, archived_at, updated_at, created_at'
      )
      .eq('user_id', profile.id)
      .eq('source', 'app')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (archived) {
      // MatuDB may not support "not null" easily — filter in JS
    } else {
      q = q.is('archived_at', null);
    }
    if (projectId) q = q.eq('project_id', projectId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    let list = data || [];
    if (archived) {
      list = list.filter((c) => c.archived_at);
    }
    // Fijados primero
    list.sort((a, b) => {
      const ap = a.pinned_at ? 1 : 0;
      const bp = b.pinned_at ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    res.json({ conversations: list });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get(
  '/api/conversations/:id',
  authMiddleware(true),
  async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: conversation, error } = await db
        .from('conversations')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!conversation) {
        return res.status(404).json({ error: { message: 'No encontrado' } });
      }
      // Meta / canal chats viven en Inbox + Tablero, no en el historial de IA
      if (conversation.source && conversation.source !== 'app') {
        return res.status(404).json({
          error: {
            message:
              'Este chat es de un canal (WhatsApp / Instagram / Messenger). Ábrelo en Inbox.',
          },
        });
      }
      const { data: messages, error: msgErr } = await db
        .from('messages')
        .select('id, role, content, model_id, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (msgErr) throw new Error(msgErr.message);
      res.json({ conversation, messages: messages || [] });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  }
);

app.post('/api/conversations', authMiddleware(true), async (req, res) => {
  try {
    const { profile, org } = await ensureWorkspace(req.user);
    const plan = await getPlanForOrg(org);
    const db = getDb();

    const { data: existing } = await db
      .from('conversations')
      .select('id')
      .eq('user_id', profile.id)
      .eq('source', 'app')
      .is('archived_at', null);

    if (
      plan.max_conversations >= 0 &&
      (existing?.length || 0) >= plan.max_conversations
    ) {
      return res.status(403).json({
        error: {
          message: `Límite de conversaciones alcanzado (${plan.max_conversations}).`,
        },
      });
    }

    const modelId = getModel(req.body?.model_id || 'matu').id;
    const projectId = req.body?.project_id || null;
    if (projectId) {
      const { data: proj } = await db
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (!proj) {
        return res.status(400).json({ error: { message: 'Proyecto no válido' } });
      }
    }
    const id = newId();
    const row = {
      id,
      org_id: org.id,
      user_id: profile.id,
      title: 'Nuevo chat',
      model_id: modelId,
      project_id: projectId,
      preview: '',
    };
    const { error } = await db.from('conversations').insert(row);
    if (error) throw new Error(error.message);
    res.status(201).json({ conversation: row });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.delete(
  '/api/conversations/:id',
  authMiddleware(true),
  async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      await db
        .from('conversations')
        .eq('id', req.params.id)
        .eq('user_id', profile.id)
        .update({ archived_at: new Date().toISOString() });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  }
);

app.post('/api/chat', authMiddleware(true), async (req, res) => {
  const abort = new AbortController();
  req.on('close', () => abort.abort());

  try {
    const { profile, org } = await ensureWorkspace(req.user);
    const plan = await getPlanForOrg(org);
    const db = getDb();

    const content = String(req.body?.content || '').trim();
    const regenerateOf = req.body?.regenerate_of || null;
    const continueOf = req.body?.continue_of || null;
    if (!content && !regenerateOf && !continueOf) {
      return res.status(400).json({ error: { message: 'Mensaje vacío' } });
    }

    const modelId = getModel(req.body?.model_id || 'matu').id;
    if (!isModelAllowed(modelId, plan.id, plan.models_allowed)) {
      return res.status(403).json({
        error: { message: 'Este modelo no está disponible en tu plan.' },
      });
    }

    const limit = await checkUsage(org, profile.id);
    if (!limit.ok) {
      return res.status(429).json({ error: { message: limit.error } });
    }

    let conversationId = req.body?.conversation_id || null;
    let conversation = null;
    let userContent = content;
    const projectId = req.body?.project_id || null;

    if (conversationId) {
      const { data } = await db
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', profile.id)
        .maybeSingle();
      conversation = data;
      if (!conversation) {
        return res.status(404).json({ error: { message: 'Conversación no encontrada' } });
      }
    } else {
      let resolvedProjectId = projectId || null;
      if (resolvedProjectId) {
        const { data: proj } = await db
          .from('projects')
          .select('id')
          .eq('id', resolvedProjectId)
          .eq('user_id', profile.id)
          .maybeSingle();
        if (!proj) resolvedProjectId = null;
      }
      conversationId = newId();
      conversation = {
        id: conversationId,
        org_id: org.id,
        user_id: profile.id,
        title: 'Nuevo chat',
        model_id: modelId,
        project_id: resolvedProjectId,
        preview: '',
      };
      const { error } = await db.from('conversations').insert(conversation);
      if (error) throw new Error(error.message);
    }

    const needsTitle = !conversation.title || conversation.title === 'Nuevo chat';
    let chatTitle = conversation.title || 'Nuevo chat';
    if (needsTitle && userContent && !regenerateOf && !continueOf) {
      chatTitle = await generateChatTitle(userContent, config.upstream);
    }

    const projectContext = await loadProjectContext(
      conversation.project_id,
      profile.id,
      conversationId
    );

    let userMsgId = newId();
    let continueBase = '';
    let continueMsgId = null;

    if (continueOf) {
      if (!conversationId) {
        return res.status(400).json({
          error: { message: 'Se necesita una conversación para continuar' },
        });
      }

      let oldMsg = null;
      const wantedId =
        continueOf && continueOf !== 'last' && !String(continueOf).startsWith('local-')
          ? String(continueOf)
          : null;

      if (wantedId) {
        try {
          const { data } = await db
            .from('messages')
            .select('*')
            .eq('id', wantedId)
            .eq('conversation_id', conversationId)
            .maybeSingle();
          oldMsg = data;
        } catch {
          oldMsg = null;
        }
      }

      if (!oldMsg || oldMsg.role !== 'assistant') {
        try {
          const { data: recent } = await db
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(20);
          oldMsg =
            (recent || []).find((m) => m.role === 'assistant') || null;
        } catch {
          oldMsg = null;
        }
      }

      // Fallback sin order si el cliente MatuDB falla el sort
      if (!oldMsg || oldMsg.role !== 'assistant') {
        try {
          const { data: all } = await db
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .limit(40);
          const list = Array.isArray(all) ? all : [];
          oldMsg =
            [...list]
              .reverse()
              .find((m) => m.role === 'assistant') || null;
        } catch {
          oldMsg = null;
        }
      }

      if (!oldMsg || oldMsg.role !== 'assistant') {
        return res.status(400).json({
          error: {
            message:
              'No encontré el mensaje HTML para continuar. Abre el chat de nuevo e inténtalo.',
          },
        });
      }
      continueBase = oldMsg.content || '';
      continueMsgId = oldMsg.id;
      userMsgId = oldMsg.id;
      userContent = continueBase;
      modelId = getModel(oldMsg.model_id || modelId).id;
    } else if (regenerateOf) {
      const { data: oldMsg } = await db
        .from('messages')
        .select('*')
        .eq('id', regenerateOf)
        .eq('conversation_id', conversationId)
        .maybeSingle();
      if (!oldMsg || oldMsg.role !== 'assistant') {
        return res.status(400).json({ error: { message: 'Objetivo de regeneración inválido' } });
      }
      const { data: prior } = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      const idx = (prior || []).findIndex((m) => m.id === regenerateOf);
      const lastUser = [...(prior || [])]
        .slice(0, idx)
        .reverse()
        .find((m) => m.role === 'user');
      if (!lastUser) {
        return res.status(400).json({ error: { message: 'No hay mensaje de usuario para regenerar' } });
      }
      userContent = lastUser.content;
      userMsgId = lastUser.id;
      await db.from('messages').eq('id', regenerateOf).delete();
    } else {
      await db.from('messages').insert({
        id: userMsgId,
        conversation_id: conversationId,
        role: 'user',
        content: userContent,
        model_id: modelId,
      });
    }

    const { data: history } = await db
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40);

    const system = loadSystemPrompt(modelId, projectContext, {
      templateBlock: continueOf ? '' : buildTemplatePromptBlock(userContent),
    });
    const assistantId = continueMsgId || newId();

    const upstreamMessages = (history || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (continueOf && continueBase) {
      const tail = continueBase.slice(-1200);
      upstreamMessages.push({
        role: 'user',
        content: `El documento HTML anterior se cortó por longitud. Continúa EXACTAMENTE desde donde terminó.

Reglas:
- NO repitas nada de lo ya escrito.
- NO abras un fence \`\`\`html nuevo.
- NO escribas explicación ni comentarios fuera del código.
- Escribe solo la continuación del código.
- Cierra el documento con </html> y, si aplica, cierra el fence con \`\`\`.

Último fragmento ya generado (continúa justo después):
\`\`\`
${tail}
\`\`\``,
      });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent('meta', {
      conversation_id: conversationId,
      message_id: assistantId,
      user_message_id: userMsgId,
      model_id: modelId,
      title: chatTitle,
      project_id: conversation.project_id || null,
      continued: Boolean(continueOf),
    });

    let full = continueOf ? continueBase : '';

    // Generación de imagen cuando el usuario la pide en el chat
    const wantImage =
      !continueOf && isImageGenerationRequest(userContent);

    if (wantImage) {
      writeEvent('delta', { content: 'Generando imagen…' });
      try {
        const imagePrompt = extractImagePrompt(userContent);
        const aspectRatio = extractAspectRatio(userContent);
        const image = await generateAndStoreImage({
          prompt: imagePrompt,
          aspectRatio,
          signal: abort.signal,
        });
        full = formatImageAssistantMessage(image);
      } catch (err) {
        writeEvent('error', {
          message: err.message || 'No se pudo generar la imagen',
        });
        return res.end();
      }
    } else {
      try {
        const upstream = await streamUpstreamChat({
          system,
          messages: upstreamMessages,
          signal: abort.signal,
        });

        for await (const chunk of parseSseStream(upstream)) {
          full += chunk;
          writeEvent('delta', { content: chunk });
        }
      } catch (err) {
        if (!full || (continueOf && full === continueBase)) {
          writeEvent('error', {
            message: err.message || 'No se pudo generar la respuesta',
          });
          return res.end();
        }
      }
    }

    if (!full || (continueOf && full === continueBase)) {
      const fallback = continueOf
        ? ''
        : 'No pude generar una respuesta. Inténtalo de nuevo.';
      if (fallback) {
        full = fallback;
        writeEvent('delta', { content: full });
      }
    }

    full = stripThinkTags(full);

    const tokensIn = estimateTokens(
      continueOf ? `continue:${continueBase.slice(-400)}` : userContent
    );
    const tokensOut = estimateTokens(
      continueOf ? full.slice(continueBase.length) : full
    );

    if (continueOf) {
      await db
        .from('messages')
        .eq('id', assistantId)
        .update({
          content: full,
          tokens_out: (tokensOut || 0) + (estimateTokens(continueBase) || 0),
        });
    } else {
      await db.from('messages').insert({
        id: assistantId,
        conversation_id: conversationId,
        role: 'assistant',
        content: full,
        model_id: modelId,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
      });
    }

    await db
      .from('conversations')
      .eq('id', conversationId)
      .update({
        title: chatTitle,
        preview: full.slice(0, 80),
        model_id: modelId,
        updated_at: new Date().toISOString(),
      });

    await bumpUsage(org, profile.id, tokensIn, tokensOut).catch(() => {});

    writeEvent('done', {
      conversation_id: conversationId,
      message_id: assistantId,
      content: full,
      title: chatTitle,
      continued: Boolean(continueOf),
    });
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`
      );
      return res.end();
    }
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post(
  '/api/messages/:id/feedback',
  authMiddleware(true),
  async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const rating = req.body?.rating;
      if (rating !== 'up' && rating !== 'down') {
        return res.status(400).json({ error: { message: 'Valoración inválida' } });
      }
      const db = getDb();
      const id = newId();
      const { data: existing } = await db
        .from('message_feedback')
        .select('id')
        .eq('message_id', req.params.id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        await db
          .from('message_feedback')
          .eq('id', existing.id)
          .update({ rating, comment: req.body?.comment || null });
      } else {
        await db.from('message_feedback').insert({
          id,
          message_id: req.params.id,
          user_id: profile.id,
          rating,
          comment: req.body?.comment || null,
        });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  }
);

// Producción detrás de nginx: sirve el build de Vite (mismo origen que /api).
const distDir = path.join(config.root, 'dist');
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get(/^(?!\/(?:api|sites)(?:\/|$)).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
}

const host = process.env.HOST || '127.0.0.1';
app.listen(config.port, host, () => {
  console.log(
    `Matu AI → http://${host}:${config.port} | project=${config.matudb.projectId.slice(0, 8)}… | model=${config.upstream.model} | upstream=${config.upstream.apiKey ? 'ok' : 'missing'} | static=${fs.existsSync(indexHtml) ? 'dist' : 'off'}`
  );
});
