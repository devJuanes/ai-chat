import { getDb, newId } from '../db.js';

export function publicProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    description: row.description || '',
    price: row.price == null ? null : Number(row.price),
    currency: row.currency || 'COP',
    product_type: row.product_type || 'service',
    stock: row.stock == null ? null : Number(row.stock),
    image_url: row.image_url || '',
    purchase_link: row.purchase_link || '',
    tags: row.tags || '',
    hide_price: row.hide_price === true,
    active: row.active !== false,
    sort_order: row.sort_order || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function publicNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    conversation_id: row.conversation_id || null,
    bot_id: row.bot_id || null,
    channel: row.channel || '',
    contact_name: row.contact_name || '',
    contact_external_id: row.contact_external_id || '',
    note_type: row.note_type || 'custom',
    title: row.title,
    body: row.body || '',
    sentiment: row.sentiment || 'neutral',
    source: row.source || 'ai',
    meta: row.meta || null,
    created_at: row.created_at,
  };
}

export const PIPELINE_STAGES = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'interesado', label: 'Interesado' },
  { id: 'en_duda', label: 'En duda' },
  { id: 'cita', label: 'Cita' },
  { id: 'cerrar', label: 'Por cerrar' },
  { id: 'ganado', label: 'Ganado' },
  { id: 'perdido', label: 'Perdido' },
];

export const STAGE_IDS = new Set(PIPELINE_STAGES.map((s) => s.id));

export async function loadProductsForBot(bot, orgId) {
  const botId = typeof bot === 'string' ? bot : bot?.id;
  if (!botId) return [];
  const db = getDb();
  const mode =
    typeof bot === 'object' && bot?.catalog_mode
      ? bot.catalog_mode
      : (
          await db
            .from('bots')
            .select('catalog_mode')
            .eq('id', botId)
            .maybeSingle()
        ).data?.catalog_mode || 'all';

  if (mode === 'none') return [];

  if (mode === 'all') {
    const { data: all } = await db
      .from('catalog_products')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('sort_order', { ascending: true });
    return all || [];
  }

  // selected
  const { data: bindings } = await db
    .from('bot_product_bindings')
    .select('product_id')
    .eq('bot_id', botId)
    .eq('org_id', orgId);
  const ids = (bindings || []).map((b) => b.product_id);
  if (!ids.length) return [];
  const { data: products } = await db
    .from('catalog_products')
    .select('*')
    .in('id', ids)
    .eq('active', true)
    .order('sort_order', { ascending: true });
  return products || [];
}

export function formatCatalogForPrompt(products) {
  if (!products?.length) {
    return `NO HAY CATÁLOGO ASIGNADO.
Regla absoluta: no inventes productos, servicios, precios ni paquetes.
Si el cliente pide algo concreto, di que vas a confirmar con el equipo y usa [[HANDOFF]] si insiste en comprar algo que no conoces.
Puedes preguntar qué necesita, pero no ofrezcas ítems inventados.`;
  }
  return products
    .map((p, i) => {
      const hidePrice = p.hide_price === true;
      const price =
        hidePrice || p.price == null
          ? hidePrice
            ? 'NO mencionar precio al cliente (pide cotización / confirma con el equipo)'
            : 'precio a confirmar con el cliente'
          : `${p.currency || 'COP'} ${Number(p.price).toLocaleString('es-CO')}`;
      const stock =
        p.product_type === 'physical' && p.stock != null
          ? ` | stock: ${p.stock}`
          : '';
      const link = p.purchase_link ? ` | link: ${p.purchase_link}` : '';
      return `${i + 1}. [${p.id}] ${p.name} (${p.product_type}) — ${price}${stock}${link}
   ${String(p.description || '').slice(0, 280)}`;
    })
    .join('\n');
}

/** Map note types to pipeline stages when STAGE mark is missing */
export function stageFromNoteType(noteType) {
  const map = {
    interest: 'interesado',
    meeting: 'cita',
    objection: 'en_duda',
    win: 'ganado',
    lost: 'perdido',
    handoff: null,
    sentiment: null,
    custom: null,
  };
  return map[noteType] || null;
}

export async function insertConversationNote(payload) {
  const db = getDb();
  const id = newId();
  const row = {
    id,
    org_id: payload.orgId,
    conversation_id: payload.conversationId || null,
    bot_id: payload.botId || null,
    channel: payload.channel || '',
    contact_name: payload.contactName || '',
    contact_external_id: payload.externalUserId || '',
    note_type: payload.noteType || 'custom',
    title: String(payload.title || 'Nota').slice(0, 120),
    body: String(payload.body || '').slice(0, 2000),
    sentiment: payload.sentiment || 'neutral',
    source: payload.source || 'ai',
    meta: payload.meta || null,
  };
  const { error } = await db.from('conversation_notes').insert(row);
  if (error) {
    console.error('[meta] note insert', error.message);
    return null;
  }
  return row;
}

/**
 * Parse AI internal marks for notes + pipeline.
 * [[NOTE:type|sentiment|title|body]]
 * [[STAGE:interesado]]
 */
export function parseCommerceMarks(text) {
  const notes = [];
  let stage = null;
  const raw = String(text || '');

  const noteRe = /\[\[NOTE:([^|\]]*)\|([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\]/gi;
  let m;
  while ((m = noteRe.exec(raw))) {
    notes.push({
      noteType: String(m[1] || 'custom').trim().toLowerCase() || 'custom',
      sentiment: String(m[2] || 'neutral').trim().toLowerCase() || 'neutral',
      title: String(m[3] || 'Nota').trim(),
      body: String(m[4] || '').trim(),
    });
  }

  const stageRe = /\[\[STAGE:([a-z_]+)\]\]/i;
  const sm = raw.match(stageRe);
  if (sm && STAGE_IDS.has(sm[1])) stage = sm[1];

  return { notes, stage };
}

export function stripCommerceMarks(text) {
  return String(text || '')
    .replace(/\[\[NOTE:[^\]]*\]\]/gi, '')
    .replace(/\[\[STAGE:[a-z_]+\]\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function registerCommerceRoutes(app, deps) {
  const { authMiddleware, ensureWorkspace } = deps;

  // ——— Products ———
  app.get('/api/catalog/products', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data, error } = await db
        .from('catalog_products')
        .select('*')
        .eq('org_id', org.id)
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return res.json({ products: (data || []).map(publicProduct) });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al listar productos' },
      });
    }
  });

  app.post('/api/catalog/products', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) {
        return res.status(400).json({
          error: { message: 'El nombre es obligatorio' },
        });
      }
      const id = newId();
      const row = {
        id,
        org_id: org.id,
        name,
        description: String(b.description || '').trim(),
        price:
          b.price === '' || b.price == null || Number.isNaN(Number(b.price))
            ? null
            : Number(b.price),
        currency: String(b.currency || 'COP').trim() || 'COP',
        product_type: ['physical', 'digital', 'service'].includes(b.product_type)
          ? b.product_type
          : 'service',
        stock:
          b.stock === '' || b.stock == null || Number.isNaN(Number(b.stock))
            ? null
            : Number(b.stock),
        image_url: String(b.image_url || '').trim(),
        purchase_link: String(b.purchase_link || '').trim(),
        tags: String(b.tags || '').trim(),
        hide_price: b.hide_price === true,
        active: b.active !== false,
        sort_order: Number(b.sort_order) || 0,
      };
      const db = getDb();
      const { error } = await db.from('catalog_products').insert(row);
      if (error) throw new Error(error.message);
      return res.status(201).json({ product: publicProduct(row) });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'No se pudo crear el producto' },
      });
    }
  });

  app.patch(
    '/api/catalog/products/:id',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: existing } = await db
          .from('catalog_products')
          .select('*')
          .eq('id', req.params.id)
          .maybeSingle();
        if (!existing || existing.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        const b = req.body || {};
        const patch = { updated_at: new Date().toISOString() };
        if (b.name != null) patch.name = String(b.name).trim();
        if (b.description != null) patch.description = String(b.description).trim();
        if (b.currency != null) patch.currency = String(b.currency).trim() || 'COP';
        if (b.product_type != null && ['physical', 'digital', 'service'].includes(b.product_type)) {
          patch.product_type = b.product_type;
        }
        if (b.image_url != null) patch.image_url = String(b.image_url).trim();
        if (b.purchase_link != null) {
          patch.purchase_link = String(b.purchase_link).trim();
        }
        if (b.tags != null) patch.tags = String(b.tags).trim();
        if (typeof b.active === 'boolean') patch.active = b.active;
        if (typeof b.hide_price === 'boolean') patch.hide_price = b.hide_price;
        if (b.sort_order != null) patch.sort_order = Number(b.sort_order) || 0;
        if (b.price !== undefined) {
          patch.price =
            b.price === '' || b.price == null || Number.isNaN(Number(b.price))
              ? null
              : Number(b.price);
        }
        if (b.stock !== undefined) {
          patch.stock =
            b.stock === '' || b.stock == null || Number.isNaN(Number(b.stock))
              ? null
              : Number(b.stock);
        }
        if (patch.name === '') {
          return res.status(400).json({
            error: { message: 'El nombre no puede estar vacío' },
          });
        }
        await db.from('catalog_products').eq('id', existing.id).update(patch);
        return res.json({ product: publicProduct({ ...existing, ...patch }) });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudo actualizar' },
        });
      }
    }
  );

  app.delete(
    '/api/catalog/products/:id',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: existing } = await db
          .from('catalog_products')
          .select('id, org_id')
          .eq('id', req.params.id)
          .maybeSingle();
        if (!existing || existing.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        await db.from('catalog_products').eq('id', existing.id).delete();
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudo eliminar' },
        });
      }
    }
  );

  // Bot ↔ products
  app.get(
    '/api/bots/:id/products',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: bot } = await db
          .from('bots')
          .select('id, org_id')
          .eq('id', req.params.id)
          .maybeSingle();
        if (!bot || bot.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        const { data: bindings } = await db
          .from('bot_product_bindings')
          .select('product_id')
          .eq('bot_id', bot.id);
        return res.json({
          product_ids: (bindings || []).map((b) => b.product_id),
        });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'Error' },
        });
      }
    }
  );

  app.put(
    '/api/bots/:id/products',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const db = getDb();
        const { data: bot } = await db
          .from('bots')
          .select('id, org_id')
          .eq('id', req.params.id)
          .maybeSingle();
        if (!bot || bot.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        const ids = Array.isArray(req.body?.product_ids)
          ? req.body.product_ids.map(String)
          : [];
        await db.from('bot_product_bindings').eq('bot_id', bot.id).delete();
        if (ids.length) {
          const rows = ids.map((product_id) => ({
            id: newId(),
            bot_id: bot.id,
            product_id,
            org_id: org.id,
          }));
          const { error } = await db.from('bot_product_bindings').insert(rows);
          if (error) throw new Error(error.message);
        }
        return res.json({ ok: true, product_ids: ids });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudieron guardar productos' },
        });
      }
    }
  );

  // ——— Notes ———
  app.get('/api/conversation-notes', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const range = String(req.query.range || 'week');
      const noteType = String(req.query.type || '').trim();
      const channel = String(req.query.channel || '').trim();

      let since = null;
      const now = Date.now();
      if (range === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        since = d.toISOString();
      } else if (range === 'week') {
        since = new Date(now - 7 * 86400000).toISOString();
      } else if (range === 'month') {
        since = new Date(now - 30 * 86400000).toISOString();
      }

      let q = db
        .from('conversation_notes')
        .select('*')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (since) q = q.gte('created_at', since);
      if (noteType) q = q.eq('note_type', noteType);
      if (channel) q = q.eq('channel', channel);

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return res.json({ notes: (data || []).map(publicNote) });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al listar notas' },
      });
    }
  });

  app.get('/api/bots-metrics', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const range = String(req.query.range || 'today');
      let since;
      if (range === 'week') {
        since = new Date(Date.now() - 7 * 86400000).toISOString();
      } else if (range === 'month') {
        since = new Date(Date.now() - 30 * 86400000).toISOString();
      } else {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        since = d.toISOString();
      }

      const { data: convs } = await db
        .from('conversations')
        .select('id, pipeline_stage, bot_id, source, updated_at, created_at')
        .eq('org_id', org.id)
        .neq('source', 'app')
        .gte('updated_at', since);

      const list = convs || [];
      const byStage = {};
      for (const s of PIPELINE_STAGES) byStage[s.id] = 0;
      for (const c of list) {
        const st = c.pipeline_stage || 'nuevo';
        byStage[st] = (byStage[st] || 0) + 1;
      }

      // Timeline: chats touched per day in range
      const dayMap = {};
      const days =
        range === 'month' ? 30 : range === 'week' ? 7 : range === 'today' ? 1 : 14;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = { date: key, conversations: 0, notes: 0, won: 0, lost: 0 };
      }
      for (const c of list) {
        const key = String(c.updated_at || '').slice(0, 10);
        if (dayMap[key]) dayMap[key].conversations += 1;
        if (c.pipeline_stage === 'ganado' && dayMap[key]) dayMap[key].won += 1;
        if (c.pipeline_stage === 'perdido' && dayMap[key]) dayMap[key].lost += 1;
      }

      const { data: notes } = await db
        .from('conversation_notes')
        .select('note_type, sentiment, created_at')
        .eq('org_id', org.id)
        .gte('created_at', since);

      const noteStats = {
        critical: 0,
        meetings: 0,
        wins: 0,
        lost: 0,
        interest: 0,
        objection: 0,
      };
      const byNoteType = {};
      for (const n of notes || []) {
        if (n.sentiment === 'critical') noteStats.critical += 1;
        if (n.note_type === 'meeting') noteStats.meetings += 1;
        if (n.note_type === 'win') noteStats.wins += 1;
        if (n.note_type === 'lost') noteStats.lost += 1;
        if (n.note_type === 'interest') noteStats.interest += 1;
        if (n.note_type === 'objection') noteStats.objection += 1;
        byNoteType[n.note_type] = (byNoteType[n.note_type] || 0) + 1;
        const key = String(n.created_at || '').slice(0, 10);
        if (dayMap[key]) dayMap[key].notes += 1;
      }

      const timeline = Object.values(dayMap);

      return res.json({
        range,
        since,
        conversations: list.length,
        by_stage: byStage,
        by_note_type: byNoteType,
        notes: noteStats,
        timeline,
        funnel: {
          wrote: list.length,
          interested:
            (byStage.interesado || 0) +
            (byStage.cerrar || 0) +
            (byStage.cita || 0),
          unsure: byStage.en_duda || 0,
          not_interested: byStage.perdido || 0,
          won: byStage.ganado || 0,
        },
      });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error en métricas' },
      });
    }
  });

  // ——— Pipeline ———
  app.get('/api/pipeline', authMiddleware(true), async (req, res) => {
    try {
      const { org } = await ensureWorkspace(req.user);
      const db = getDb();
      const { data: convs } = await db
        .from('conversations')
        .select(
          'id, title, preview, bot_id, source, assignee, pipeline_stage, updated_at'
        )
        .eq('org_id', org.id)
        .neq('source', 'app')
        .order('updated_at', { ascending: false })
        .limit(300);

      const columns = PIPELINE_STAGES.map((s) => ({
        ...s,
        cards: (convs || []).filter(
          (c) => (c.pipeline_stage || 'nuevo') === s.id
        ),
      }));
      return res.json({ stages: PIPELINE_STAGES, columns });
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || 'Error al cargar pipeline' },
      });
    }
  });

  app.patch(
    '/api/pipeline/:conversationId',
    authMiddleware(true),
    async (req, res) => {
      try {
        const { org } = await ensureWorkspace(req.user);
        const stage = String(req.body?.stage || '').trim();
        if (!STAGE_IDS.has(stage)) {
          return res.status(400).json({ error: { message: 'Etapa inválida' } });
        }
        const db = getDb();
        const { data: conv } = await db
          .from('conversations')
          .select('id, org_id, pipeline_stage, bot_id, title')
          .eq('id', req.params.conversationId)
          .maybeSingle();
        if (!conv || conv.org_id !== org.id) {
          return res.status(404).json({ error: { message: 'No encontrado' } });
        }
        await db
          .from('conversations')
          .eq('id', conv.id)
          .update({
            pipeline_stage: stage,
            updated_at: new Date().toISOString(),
          });
        const label =
          PIPELINE_STAGES.find((s) => s.id === stage)?.label || stage;
        await insertConversationNote({
          orgId: org.id,
          conversationId: conv.id,
          botId: conv.bot_id,
          noteType: stage === 'ganado' ? 'win' : stage === 'perdido' ? 'lost' : 'custom',
          title: `Movido a ${label}`,
          body: `Pipeline: ${conv.pipeline_stage || 'nuevo'} → ${stage}`,
          sentiment:
            stage === 'ganado'
              ? 'positive'
              : stage === 'perdido'
                ? 'negative'
                : 'neutral',
          source: 'human',
        });
        return res.json({ ok: true, stage });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudo mover' },
        });
      }
    }
  );
}
