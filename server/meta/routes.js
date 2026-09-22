import { getDb, newId } from '../db.js';
import { metaConfigured } from './config.js';
import { registerMetaOAuth } from './oauth.js';
import { registerMetaWebhook } from './webhook.js';
import { generateBotConfigFromBrief } from './bot-generator.js';
import { listBotModels } from '../models.js';

function publicConnection(row) {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    channel: row.channel,
    display_name: row.display_name,
    page_id: row.page_id,
    ig_user_id: row.ig_user_id,
    waba_id: row.waba_id,
    phone_number_id: row.phone_number_id,
    status: row.status,
    scopes: row.scopes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicBot(row) {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    company_name: row.company_name || '',
    objective: row.objective,
    instructions: row.instructions,
    business_context: row.business_context,
    products_services: row.products_services || '',
    welcome_message: row.welcome_message || '',
    form_id: row.form_id || null,
    tone: row.tone,
    model_id: row.model_id,
    language: row.language,
    active: row.active,
    handoff_keywords: row.handoff_keywords,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicForm(row) {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    description: row.description || '',
    active: row.active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function slugKey(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'campo';
}

export function registerMetaRoutes(app, deps) {
  const { authMiddleware, ensureWorkspace } = deps;

  registerMetaWebhook(app);
  registerMetaOAuth(app, deps);

  // ——— Connections ———
  app.get(
    '/api/meta/connections',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data, error } = await db
          .from('meta_connections')
          .select(
            'id, org_id, channel, display_name, page_id, ig_user_id, waba_id, phone_number_id, status, scopes, created_at, updated_at'
          )
          .eq('org_id', org.id)
          .order('updated_at', { ascending: false });
        if (error) throw new Error(error.message);
        return res.json({
          configured: metaConfigured(),
          connections: (data || []).map(publicConnection),
        });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'Error al listar conexiones' },
        });
      }
    }
  );

  app.delete(
    '/api/meta/connections/:id',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: row } = await db
          .from('meta_connections')
          .select('id, org_id')
          .eq('id', req.params.id)
          .maybeSingle();
        if (!row || row.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        await db
          .from('meta_connections')
          .eq('id', row.id)
          .update({
            status: 'disconnected',
            updated_at: new Date().toISOString(),
          });
        await db
          .from('bot_channel_bindings')
          .eq('meta_connection_id', row.id)
          .delete();
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudo desconectar' },
        });
      }
    }
  );

  // ——— Bots CRUD ———
  app.get('/api/bots/models', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const models = listBotModels(org?.plan_id || 'free');
      return res.json({ models });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al listar modelos' },
      });
    }
  });

  app.post(
    '/api/bots/generate',
    authMiddleware(true),
    async (req, res) => {
      try {
        await ensureWorkspace(req.user);
        const b = req.body || {};
        const agentName = String(b.name || '').trim();
        const companyName = String(b.company_name || '').trim();
        const brief = String(b.brief || b.description || '').trim();
        if (!agentName || !companyName || !brief) {
          return res.status(400).json({
            error: {
              message:
                'Nombre del agente, empresa y descripción son obligatorios',
            },
          });
        }
        const generated = await generateBotConfigFromBrief({
          agentName,
          companyName,
          brief,
          channels: Array.isArray(b.channels) ? b.channels : [],
        });
        return res.json({ generated });
      } catch (err) {
        console.error('[meta] bots/generate', err);
        return res.status(500).json({
          error: {
            message: err.message || 'No se pudo generar la configuración',
          },
        });
      }
    }
  );

  app.get('/api/bots', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: bots, error } = await db
        .from('bots')
        .select('*')
        .eq('org_id', org.id)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);

      const { data: bindings } = await db
        .from('bot_channel_bindings')
        .select('*')
        .eq('org_id', org.id);

      return res.json({
        bots: (bots || []).map(publicBot),
        bindings: bindings || [],
      });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al listar agentes' },
      });
    }
  });

  app.post('/api/bots', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) {
        return res.status(400).json({
          error: { message: 'El nombre del agente es obligatorio' },
        });
      }
      const id = newId();
      const row = {
        id,
        org_id: org.id,
        name,
        company_name: String(b.company_name || org.name || '').trim(),
        objective: String(b.objective || '').trim(),
        instructions: String(b.instructions || '').trim(),
        business_context: String(b.business_context || '').trim(),
        products_services: String(b.products_services || '').trim(),
        welcome_message: String(b.welcome_message || '').trim(),
        form_id: b.form_id || null,
        tone: String(b.tone || 'profesional y cercano').trim(),
        model_id: String(b.model_id || 'matu-bot-3-5').trim(),
        language: String(b.language || 'es').trim(),
        active: b.active !== false,
        handoff_keywords: String(
          b.handoff_keywords ||
            'humano,asesor,agente humano,hablar con alguien'
        ).trim(),
        created_by: req.user.id,
      };
      const db = getDb();
      const { error } = await db.from('bots').insert(row);
      if (error) throw new Error(error.message);
      return res.status(201).json({ bot: publicBot(row) });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo crear el agente' },
      });
    }
  });

  app.patch('/api/bots/:id', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: existing } = await db
        .from('bots')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (!existing || existing.org_id !== org.id) {
        return res.status(404).json({ error: { message: 'No encontrado' } });
      }
      const b = req.body || {};
      const patch = { updated_at: new Date().toISOString() };
      for (const key of [
        'name',
        'company_name',
        'objective',
        'instructions',
        'business_context',
        'products_services',
        'welcome_message',
        'tone',
        'model_id',
        'language',
        'handoff_keywords',
      ]) {
        if (b[key] != null) patch[key] = String(b[key]).trim();
      }
      if (b.form_id === null || b.form_id === '') patch.form_id = null;
      else if (b.form_id != null) patch.form_id = String(b.form_id);
      if (typeof b.active === 'boolean') patch.active = b.active;
      if (patch.name === '') {
        return res.status(400).json({
          error: { message: 'El nombre no puede estar vacío' },
        });
      }
      await db.from('bots').eq('id', existing.id).update(patch);
      return res.json({ bot: publicBot({ ...existing, ...patch }) });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo actualizar' },
      });
    }
  });

  app.delete('/api/bots/:id', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: existing } = await db
        .from('bots')
        .select('id, org_id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (!existing || existing.org_id !== org.id) {
        return res.status(404).json({ error: { message: 'No encontrado' } });
      }
      await db.from('bots').eq('id', existing.id).delete();
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo eliminar' },
      });
    }
  });

  // ——— Lead forms ———
  app.get('/api/lead-forms', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: forms, error } = await db
        .from('lead_forms')
        .select('*')
        .eq('org_id', org.id)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      const { data: fields } = await db
        .from('lead_form_fields')
        .select('*')
        .eq('org_id', org.id)
        .order('sort_order', { ascending: true });
      const byForm = {};
      for (const f of fields || []) {
        if (!byForm[f.form_id]) byForm[f.form_id] = [];
        byForm[f.form_id].push(f);
      }
      return res.json({
        forms: (forms || []).map((form) => ({
          ...publicForm(form),
          fields: byForm[form.id] || [],
        })),
      });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al listar formularios' },
      });
    }
  });

  app.post('/api/lead-forms', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) {
        return res.status(400).json({
          error: { message: 'El nombre del formulario es obligatorio' },
        });
      }
      const db = getDb();
      const formId = newId();
      const form = {
        id: formId,
        org_id: org.id,
        name,
        description: String(body.description || '').trim(),
        active: body.active !== false,
      };
      const { error } = await db.from('lead_forms').insert(form);
      if (error) throw new Error(error.message);

      const rawFields = Array.isArray(body.fields) ? body.fields : [];
      const fields = [];
      for (let i = 0; i < rawFields.length; i++) {
        const f = rawFields[i];
        const label = String(f.label || '').trim();
        if (!label) continue;
        const field = {
          id: newId(),
          form_id: formId,
          org_id: org.id,
          field_key: String(f.field_key || slugKey(label)).trim(),
          label,
          field_type: [
            'text',
            'email',
            'phone',
            'number',
            'select',
            'textarea',
          ].includes(f.field_type)
            ? f.field_type
            : 'text',
          required: f.required !== false,
          options: String(f.options || '').trim(),
          sort_order: Number.isFinite(f.sort_order) ? f.sort_order : i,
        };
        await db.from('lead_form_fields').insert(field);
        fields.push(field);
      }

      return res.status(201).json({ form: { ...publicForm(form), fields } });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo crear el formulario' },
      });
    }
  });

  app.patch('/api/lead-forms/:id', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: existing } = await db
        .from('lead_forms')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (!existing || existing.org_id !== org.id) {
        return res.status(404).json({ error: { message: 'No encontrado' } });
      }
      const body = req.body || {};
      const patch = { updated_at: new Date().toISOString() };
      if (body.name != null) patch.name = String(body.name).trim();
      if (body.description != null) {
        patch.description = String(body.description).trim();
      }
      if (typeof body.active === 'boolean') patch.active = body.active;
      await db.from('lead_forms').eq('id', existing.id).update(patch);

      if (Array.isArray(body.fields)) {
        await db.from('lead_form_fields').eq('form_id', existing.id).delete();
        for (let i = 0; i < body.fields.length; i++) {
          const f = body.fields[i];
          const label = String(f.label || '').trim();
          if (!label) continue;
          await db.from('lead_form_fields').insert({
            id: newId(),
            form_id: existing.id,
            org_id: org.id,
            field_key: String(f.field_key || slugKey(label)).trim(),
            label,
            field_type: [
              'text',
              'email',
              'phone',
              'number',
              'select',
              'textarea',
            ].includes(f.field_type)
              ? f.field_type
              : 'text',
            required: f.required !== false,
            options: String(f.options || '').trim(),
            sort_order: i,
          });
        }
      }

      const { data: fields } = await db
        .from('lead_form_fields')
        .select('*')
        .eq('form_id', existing.id)
        .order('sort_order', { ascending: true });

      return res.json({
        form: { ...publicForm({ ...existing, ...patch }), fields: fields || [] },
      });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo actualizar' },
      });
    }
  });

  app.delete('/api/lead-forms/:id', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: existing } = await db
        .from('lead_forms')
        .select('id, org_id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (!existing || existing.org_id !== org.id) {
        return res.status(404).json({ error: { message: 'No encontrado' } });
      }
      await db
        .from('bots')
        .eq('form_id', existing.id)
        .update({ form_id: null });
      await db.from('lead_forms').eq('id', existing.id).delete();
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo eliminar' },
      });
    }
  });

  app.get('/api/leads', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data, error } = await db
        .from('lead_submissions')
        .select('*')
        .eq('org_id', org.id)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return res.json({ leads: data || [] });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al listar leads' },
      });
    }
  });

  // ——— Bindings ———
  app.put(
    '/api/bots/:id/bindings',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: bot } = await db
          .from('bots')
          .select('*')
          .eq('id', req.params.id)
          .maybeSingle();
        if (!bot || bot.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'Agente no encontrado' } });
        }

        const connectionIds = Array.isArray(req.body?.connection_ids)
          ? req.body.connection_ids.map(String)
          : [];

        // Remove old bindings for this bot
        await db
          .from('bot_channel_bindings')
          .eq('bot_id', bot.id)
          .delete();

        const created = [];
        for (const cid of connectionIds) {
          const { data: conn } = await db
            .from('meta_connections')
            .select('*')
            .eq('id', cid)
            .eq('org_id', org.id)
            .eq('status', 'active')
            .maybeSingle();
          if (!conn) continue;

          // Clear any other bot bound to this connection
          await db
            .from('bot_channel_bindings')
            .eq('meta_connection_id', conn.id)
            .delete();

          const id = newId();
          const row = {
            id,
            bot_id: bot.id,
            meta_connection_id: conn.id,
            org_id: org.id,
            active: true,
          };
          await db.from('bot_channel_bindings').insert(row);
          created.push(row);
        }

        return res.json({ bindings: created });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudieron guardar canales' },
        });
      }
    }
  );

  // ——— Inbox ———
  app.get('/api/inbox', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const channel = String(req.query.channel || '').trim();
      let q = db
        .from('channel_threads')
        .select('*')
        .eq('org_id', org.id)
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (
        channel &&
        ['whatsapp', 'messenger', 'instagram'].includes(channel)
      ) {
        q = q.eq('channel', channel);
      }
      const { data: threads, error } = await q;
      if (error) throw new Error(error.message);

      const convIds = (threads || []).map((t) => t.conversation_id);
      let conversations = [];
      if (convIds.length) {
        const { data } = await db
          .from('conversations')
          .select(
            'id, title, preview, assignee, bot_id, source, updated_at, model_id'
          )
          .in('id', convIds);
        conversations = data || [];
      }
      const byId = Object.fromEntries(conversations.map((c) => [c.id, c]));

      return res.json({
        threads: (threads || []).map((t) => ({
          ...t,
          conversation: byId[t.conversation_id] || null,
        })),
      });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al cargar inbox' },
      });
    }
  });

  app.get(
    '/api/inbox/:conversationId',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: conv } = await db
          .from('conversations')
          .select('*')
          .eq('id', req.params.conversationId)
          .maybeSingle();
        if (!conv || conv.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        const { data: messages } = await db
          .from('messages')
          .select('id, role, content, model_id, created_at, external_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(200);

        const { data: thread } = await db
          .from('channel_threads')
          .select('*')
          .eq('conversation_id', conv.id)
          .maybeSingle();

        return res.json({
          conversation: conv,
          thread,
          messages: messages || [],
        });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'Error al cargar conversación' },
        });
      }
    }
  );

  app.post(
    '/api/inbox/:conversationId/assignee',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const assignee = String(req.body?.assignee || '').trim();
        if (!['bot', 'human'].includes(assignee)) {
          return res.status(400).json({
            error: { message: 'assignee debe ser bot o human' },
          });
        }
        const db = getDb();
        const { data: conv } = await db
          .from('conversations')
          .select('id, org_id')
          .eq('id', req.params.conversationId)
          .maybeSingle();
        if (!conv || conv.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        await db
          .from('conversations')
          .eq('id', conv.id)
          .update({
            assignee,
            updated_at: new Date().toISOString(),
          });
        return res.json({ ok: true, assignee });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudo cambiar assignee' },
        });
      }
    }
  );

  /** Human reply from inbox (sends via Meta + stores message). */
  app.post(
    '/api/inbox/:conversationId/reply',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const text = String(req.body?.content || '').trim();
        if (!text) {
          return res.status(400).json({
            error: { message: 'Escribe un mensaje' },
          });
        }
        const db = getDb();
        const { data: conv } = await db
          .from('conversations')
          .select('*')
          .eq('id', req.params.conversationId)
          .maybeSingle();
        if (!conv || conv.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        const { data: thread } = await db
          .from('channel_threads')
          .select('*')
          .eq('conversation_id', conv.id)
          .maybeSingle();
        if (!thread) {
          return res.status(400).json({
            error: { message: 'No es un hilo de canal Meta' },
          });
        }
        const { data: connection } = await db
          .from('meta_connections')
          .select('*')
          .eq('id', thread.meta_connection_id)
          .maybeSingle();
        if (!connection || connection.status !== 'active') {
          return res.status(400).json({
            error: { message: 'Conexión Meta inactiva' },
          });
        }

        const { decryptToken } = await import('./crypto.js');
        const { sendPageMessage, sendWhatsAppText } = await import(
          './graph.js'
        );
        const token = decryptToken(connection.access_token_enc);

        if (connection.channel === 'whatsapp') {
          await sendWhatsAppText({
            phoneNumberId: connection.phone_number_id,
            token,
            to: thread.external_user_id,
            text,
          });
        } else {
          await sendPageMessage({
            pageId: connection.page_id,
            pageToken: token,
            recipientId: thread.external_user_id,
            text,
          });
        }

        const id = newId();
        await db.from('messages').insert({
          id,
          conversation_id: conv.id,
          role: 'assistant',
          content: text,
          model_id: null,
        });
        await db
          .from('conversations')
          .eq('id', conv.id)
          .update({
            preview: text.slice(0, 120),
            assignee: 'human',
            updated_at: new Date().toISOString(),
          });
        await db
          .from('channel_threads')
          .eq('id', thread.id)
          .update({ last_message_at: new Date().toISOString() });

        return res.json({
          ok: true,
          message: {
            id,
            role: 'assistant',
            content: text,
            created_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error('[meta] inbox reply', err);
        return res.status(500).json({
          error: { message: err.message || 'No se pudo enviar' },
        });
      }
    }
  );
}
