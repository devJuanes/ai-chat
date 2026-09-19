import { getDb, newId, periodYm } from './db.js';
import { config } from './config.js';
import {
  authMiddleware,
  ensureWorkspace,
  getPlanForOrg,
} from './auth.js';
import { generateChatTitle } from './titles.js';

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
  app.get('/api/me', authMiddleware(true), async (req, res) => {
    try {
      const { profile, org } = await ensureWorkspace(req.user);
      const plan = await getPlanForOrg(org);
      const usage = await getUsage(org.id, profile.id);
      res.json({
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.display_name,
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
          tokens_total:
            (usage.tokens_in || 0) + (usage.tokens_out || 0),
        },
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
}

export { generateChatTitle, getUsage };
