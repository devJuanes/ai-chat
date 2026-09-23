import { createHash } from 'node:crypto';
import { getDb, newId, periodYm } from './db.js';
import { config } from './config.js';
import {
  authMiddleware,
  ensureWorkspace,
  getPlanForOrg,
  listModelUsage,
  listUsageNotifications,
  markNotificationsRead,
} from './auth.js';
import { generateChatTitle } from './titles.js';
import {
  createVideoTask,
  getVideoTask,
  listVideoTasks,
  pingMoneyPrinter,
} from './moneyprinter.js';

const contactHits = new Map();
const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX = 5;

function contactRateOk(ipHash) {
  const now = Date.now();
  const row = contactHits.get(ipHash) || { n: 0, t: now };
  if (now - row.t > CONTACT_WINDOW_MS) {
    contactHits.set(ipHash, { n: 1, t: now });
    return true;
  }
  if (row.n >= CONTACT_MAX) return false;
  row.n += 1;
  contactHits.set(ipHash, row);
  return true;
}

function hashIp(ip) {
  return createHash('sha256')
    .update(String(ip || 'unknown'))
    .digest('hex')
    .slice(0, 32);
}

async function getUsage(orgId, userId) {
  const db = getDb();
  const ym = periodYm();
  const { data } = await db
    .from('usage_counters')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('period_ym', ym)
    .maybeSingle();
  return (
    data || {
      messages_count: 0,
      tokens_in: 0,
      tokens_out: 0,
      period_ym: ym,
    }
  );
}

export async function loadProjectContext(projectId, userId, excludeConvId) {
  if (!projectId) return '';
  const db = getDb();
  const { data: convs } = await db
    .from('conversations')
    .select('id, title')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(5);

  const bits = [];
  for (const c of convs || []) {
    if (c.id === excludeConvId) continue;
    const { data: msgs } = await db
      .from('messages')
      .select('role, content')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(4);
    if (!msgs?.length) continue;
    const lines = [...msgs]
      .reverse()
      .map((m) => `${m.role}: ${String(m.content).slice(0, 280)}`)
      .join('\n');
    bits.push(`### Chat: ${c.title}\n${lines}`);
  }
  if (!bits.length) return '';
  return `El usuario trabaja en un proyecto con chats relacionados. Usa este contexto si ayuda (no lo inventes):\n\n${bits.join('\n\n')}`;
}

export function registerExtraRoutes(app) {
  app.post('/api/contact', async (req, res) => {
    try {
      const body = req.body || {};
      // Honeypot
      if (String(body.website || '').trim()) {
        return res.json({ ok: true });
      }

      const name = String(body.name || '').trim().slice(0, 120);
      const email = String(body.email || '')
        .trim()
        .toLowerCase()
        .slice(0, 200);
      const phone = String(body.phone || '').trim().slice(0, 40);
      const company = String(body.company || '').trim().slice(0, 120);
      const subject = String(body.subject || '').trim().slice(0, 160);
      const message = String(body.message || '').trim().slice(0, 4000);
      let source = String(body.source || 'contacto').trim().toLowerCase();
      if (!['landing', 'contacto', 'other'].includes(source)) {
        source = 'other';
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res
          .status(400)
          .json({ error: { message: 'Email inválido' } });
      }
      if (!message || message.length < 10) {
        return res.status(400).json({
          error: { message: 'El mensaje debe tener al menos 10 caracteres' },
        });
      }
      if (!name) {
        return res
          .status(400)
          .json({ error: { message: 'El nombre es requerido' } });
      }

      const ip =
        req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '';
      const ipHash = hashIp(ip);
      if (!contactRateOk(ipHash)) {
        return res.status(429).json({
          error: { message: 'Demasiados mensajes. Intenta en unos minutos.' },
        });
      }

      const db = getDb();
      const row = {
        id: newId(),
        name,
        email,
        phone,
        company,
        subject,
        message,
        source,
        status: 'new',
        user_agent: String(req.headers['user-agent'] || '').slice(0, 400),
        ip_hash: ipHash,
        created_at: new Date().toISOString(),
      };

      const { error } = await db.from('contact_messages').insert(row);
      if (error) throw error;

      res.json({ ok: true, id: row.id });
    } catch (err) {
      console.error('[contact]', err.message || err);
      res.status(500).json({
        error: {
          message:
            err.message?.includes('contact_messages') ||
            err.message?.includes('does not exist')
              ? 'Formulario no disponible aún. Ejecuta la migración contact-messages.sql en MatuDB.'
              : 'No se pudo guardar el mensaje',
        },
      });
    }
  });

  app.get('/api/me', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const plan = await getPlanForOrg(org);
      const usage = await getUsage(org.id, profile.id);
      const byModel = await listModelUsage(org.id, profile.id, plan.id);
      const notifications = await listUsageNotifications(profile.id, {
        unreadOnly: false,
      });
      const unread = notifications.filter((n) => !n.read_at).length;
      res.json({
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.display_name,
          is_admin: Boolean(profile.is_admin),
        },
        organization: org
          ? { id: org.id, name: org.name, plan_id: org.plan_id }
          : null,
        plan: {
          id: plan.id,
          name: plan.name || plan.id,
          monthly_message_limit: plan.monthly_message_limit,
          monthly_token_limit: plan.monthly_token_limit,
          models_allowed: plan.models_allowed,
        },
        usage: {
          period_ym: usage.period_ym,
          messages_count: usage.messages_count || 0,
          tokens_in: usage.tokens_in || 0,
          tokens_out: usage.tokens_out || 0,
          tokens_total: (usage.tokens_in || 0) + (usage.tokens_out || 0),
          by_model: byModel,
          unlimited: Boolean(profile.is_admin),
        },
        notifications: {
          unread,
          items: notifications.slice(0, 20),
        },
      });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.get('/api/notifications', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const items = await listUsageNotifications(profile.id);
      res.json({
        unread: items.filter((n) => !n.read_at).length,
        items,
      });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/notifications/read', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
      await markNotificationsRead(profile.id, ids);
      const items = await listUsageNotifications(profile.id);
      res.json({
        ok: true,
        unread: items.filter((n) => !n.read_at).length,
        items,
      });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.get('/api/projects', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data, error } = await db
        .from('projects')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      res.json({ projects: data || [] });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/projects', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const name = String(req.body?.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: { message: 'Nombre requerido' } });
      }
      const icon = String(req.body?.icon || 'briefcase').trim().slice(0, 32);
      const color = String(req.body?.color || 'ink').trim().slice(0, 32);
      const id = newId();
      const row = {
        id,
        org_id: org.id,
        user_id: profile.id,
        name: name.slice(0, 80),
        description: String(req.body?.description || '').trim(),
        icon,
        color,
      };
      const db = getDb();
      const { error } = await db.from('projects').insert(row);
      if (error) throw new Error(error.message);
      res.status(201).json({ project: row });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.patch(
    '/api/conversations/:id',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { profile } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: conv } = await db
          .from('conversations')
          .select('*')
          .eq('id', req.params.id)
          .eq('user_id', profile.id)
          .maybeSingle();
        if (!conv) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }

        const patch = {};
        if (req.body?.title != null) patch.title = String(req.body.title).slice(0, 80);
        if (req.body?.project_id !== undefined) {
          patch.project_id = req.body.project_id || null;
        }
        if (req.body?.pin === true) patch.pinned_at = new Date().toISOString();
        if (req.body?.pin === false) patch.pinned_at = null;
        if (req.body?.archive === true) {
          patch.archived_at = new Date().toISOString();
        }
        if (req.body?.archive === false) patch.archived_at = null;
        if (req.body?.share === true && !conv.share_token) {
          patch.share_token = newId().replace(/-/g, '').slice(0, 16);
        }
        if (req.body?.share === false) patch.share_token = null;

        if (Object.keys(patch).length) {
          await db
            .from('conversations')
            .eq('id', conv.id)
            .update({ ...patch, updated_at: new Date().toISOString() });
        }

        const { data: updated } = await db
          .from('conversations')
          .select('*')
          .eq('id', conv.id)
          .single();

        res.json({
          conversation: updated,
          share_url: updated?.share_token
            ? `/s/${updated.share_token}`
            : null,
        });
      } catch (err) {
        res.status(500).json({ error: { message: err.message } });
      }
    }
  );

  app.delete(
    '/api/conversations/:id/hard',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { profile } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: conv } = await db
          .from('conversations')
          .select('id')
          .eq('id', req.params.id)
          .eq('user_id', profile.id)
          .maybeSingle();
        if (!conv) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        await db.from('messages').eq('conversation_id', conv.id).delete();
        await db.from('conversations').eq('id', conv.id).delete();
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: { message: err.message } });
      }
    }
  );

  app.get('/api/share/:token', async (req, res) => {
    try {
      const db = getDb();
      const { data: conversation } = await db
        .from('conversations')
        .select('id, title, preview, model_id, updated_at')
        .eq('share_token', req.params.token)
        .maybeSingle();
      if (!conversation) {
        return res.status(404).json({ error: { message: 'Enlace no válido' } });
      }
      const { data: messages } = await db
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      res.json({ conversation, messages: messages || [] });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.patch('/api/me', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const name = String(req.body?.name || '').trim();
      if (!name || name.length < 2) {
        return res
          .status(400)
          .json({ error: { message: 'Nombre inválido' } });
      }
      const db = getDb();
      await db
        .from('profiles')
        .eq('id', profile.id)
        .update({ display_name: name.slice(0, 80) });
      const usage = await getUsage(org.id, profile.id);
      const plan = await getPlanForOrg(org);
      res.json({
        user: { id: profile.id, email: profile.email, name: name.slice(0, 80) },
        organization: org
          ? { id: org.id, name: org.name, plan_id: org.plan_id }
          : null,
        plan: {
          id: plan.id,
          name: plan.name || plan.id,
          monthly_message_limit: plan.monthly_message_limit,
          monthly_token_limit: plan.monthly_token_limit,
          models_allowed: plan.models_allowed,
        },
        usage: {
          period_ym: usage.period_ym,
          messages_count: usage.messages_count || 0,
          tokens_in: usage.tokens_in || 0,
          tokens_out: usage.tokens_out || 0,
          tokens_total:
            (usage.tokens_in || 0) + (usage.tokens_out || 0),
        },
      });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  function slugify(text) {
    return (
      String(text || 'app')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'app'
    );
  }

  function publicSiteUrl(slug) {
    const base = (
      process.env.PUBLIC_APP_URL ||
      process.env.VITE_SITE_URL ||
      'https://ai.matubyte.com'
    ).replace(/\/$/, '');
    // Prefer dedicated MatuAI host for published apps
    const host = process.env.PUBLIC_SITES_HOST || 'https://ai.matubyte.com';
    return `${host.replace(/\/$/, '')}/sites/${slug}`;
  }

  /** Público: sirve el HTML publicado (producción). */
  app.get('/sites/:slug', async (req, res) => {
    try {
      const slug = slugify(req.params.slug);
      const db = getDb();
      const { data, error } = await db
        .from('published_sites')
        .select('html, name')
        .eq('slug', slug)
        .limit(1);
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.html) {
        return res
          .status(404)
          .type('html')
          .send(
            `<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem"><h1>Sitio no encontrado</h1><p>No hay una app publicada en <code>/sites/${slug}</code>.</p></body></html>`
          );
      }
      res
        .status(200)
        .type('html')
        .set('Cache-Control', 'public, max-age=60')
        .send(row.html);
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/sites', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const name = String(req.body?.name || '').trim().slice(0, 80);
      let slug = slugify(req.body?.slug || name);
      const html = String(req.body?.html || '').trim();
      const conversationId = req.body?.conversation_id || null;

      if (!name) {
        return res.status(400).json({ error: { message: 'Nombre requerido' } });
      }
      if (!html || html.length < 20) {
        return res.status(400).json({ error: { message: 'HTML inválido' } });
      }
      if (html.length > 3_500_000) {
        return res
          .status(400)
          .json({ error: { message: 'HTML demasiado grande' } });
      }

      const db = getDb();
      const id = newId();

      // Si el slug ya existe en la org, actualizar ese sitio
      const { data: existing } = await db
        .from('published_sites')
        .select('id, slug')
        .eq('org_id', org.id)
        .eq('slug', slug)
        .limit(1);
      const prev = Array.isArray(existing) ? existing[0] : existing;

      if (prev?.id) {
        const { error } = await db
          .from('published_sites')
          .eq('id', prev.id)
          .update({
            name,
            html,
            conversation_id: conversationId,
            updated_at: new Date().toISOString(),
          });
        if (error) throw new Error(error.message);
        const url = publicSiteUrl(slug);
        return res.json({
          site: { id: prev.id, name, slug, url },
          url,
        });
      }

      // Evitar choque global de slug: añadir sufijo corto
      const { data: clash } = await db
        .from('published_sites')
        .select('id')
        .eq('slug', slug)
        .limit(1);
      const taken = Array.isArray(clash) ? clash[0] : clash;
      if (taken?.id) {
        slug = `${slug}-${id.slice(0, 6)}`;
      }

      const row = {
        id,
        org_id: org.id,
        user_id: profile.id,
        conversation_id: conversationId,
        name,
        slug,
        html,
      };
      const { error } = await db.from('published_sites').insert(row);
      if (error) throw new Error(error.message);
      const url = publicSiteUrl(slug);
      res.status(201).json({ site: { id, name, slug, url }, url });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.get('/api/sites', authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data, error } = await db
        .from('published_sites')
        .select('id, name, slug, updated_at, created_at')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      const sites = (data || []).map((s) => ({
        ...s,
        url: publicSiteUrl(s.slug),
      }));
      res.json({ sites });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  // ── Imagine (MoneyPrinterTurbo video generation) ─────────────────

  app.get('/api/imagine/status', authMiddleware(true), async (_req, res) => {
    try {
      const ping = await pingMoneyPrinter();
      res.json({
        configured: Boolean(config.moneyPrinter.baseUrl),
        baseUrl: config.moneyPrinter.baseUrl,
        ...ping,
      });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });

  app.post('/api/imagine/videos', authMiddleware(true), async (req, res) => {
    try {
      await ensureWorkspace(req.user);
      const task = await createVideoTask(req.body || {});
      res.status(201).json({ task });
    } catch (err) {
      const status = /no está disponible|MONEYPRINTER_BASE_URL/i.test(
        err.message || ''
      )
        ? 503
        : /tema o guion|requerido/i.test(err.message || '')
          ? 400
          : 500;
      res.status(status).json({ error: { message: err.message } });
    }
  });

  app.get('/api/imagine/tasks/:taskId', authMiddleware(true), async (req, res) => {
    try {
      await ensureWorkspace(req.user);
      const task = await getVideoTask(req.params.taskId);
      res.json({ task });
    } catch (err) {
      const status = err.status === 404 ? 404 : err.status === 503 ? 503 : 500;
      console.error('[imagine] get task failed:', err.message);
      res.status(status).json({ error: { message: err.message } });
    }
  });

  app.get('/api/imagine/tasks', authMiddleware(true), async (req, res) => {
    try {
      await ensureWorkspace(req.user);
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.page_size) || 10;
      const data = await listVideoTasks({ page, pageSize });
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: { message: err.message } });
    }
  });
}

export { generateChatTitle, getUsage };
