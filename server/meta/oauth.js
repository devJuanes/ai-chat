import { config } from '../config.js';
import { getDb, newId } from '../db.js';
import {
  META_OAUTH_SCOPES,
  metaConfigured,
  oauthRedirectUri,
} from './config.js';
import { encryptToken, signOAuthState, verifyOAuthState } from './crypto.js';
import {
  exchangeCodeForToken,
  exchangeEmbeddedSignupCode,
  exchangeForLongLivedUserToken,
  getMeAccounts,
  resolveWhatsAppAssets,
  subscribePageToApp,
  subscribeWaba,
} from './graph.js';

function frontRedirect(pathQuery) {
  const base = config.publicAppUrl || 'http://127.0.0.1:5173';
  return `${base}${pathQuery.startsWith('/') ? pathQuery : `/${pathQuery}`}`;
}

async function upsertConnection(row) {
  const db = getDb();
  // Find existing by unique asset
  let existing = null;
  if (row.channel === 'whatsapp' && row.phone_number_id) {
    const { data } = await db
      .from('meta_connections')
      .select('id')
      .eq('phone_number_id', row.phone_number_id)
      .maybeSingle();
    existing = data;
  } else if (row.channel === 'instagram' && row.ig_user_id) {
    const { data } = await db
      .from('meta_connections')
      .select('id')
      .eq('ig_user_id', row.ig_user_id)
      .maybeSingle();
    existing = data;
  } else if (row.page_id) {
    const { data } = await db
      .from('meta_connections')
      .select('id')
      .eq('page_id', row.page_id)
      .eq('channel', row.channel)
      .maybeSingle();
    existing = data;
  }

  const payload = {
    ...row,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    // Enforce same org
    const { data: cur } = await db
      .from('meta_connections')
      .select('org_id')
      .eq('id', existing.id)
      .maybeSingle();
    if (cur && cur.org_id !== row.org_id) {
      throw new Error(
        'Este activo de Meta ya está vinculado a otra organización'
      );
    }
    await db.from('meta_connections').eq('id', existing.id).update(payload);
    return existing.id;
  }

  const id = newId();
  await db.from('meta_connections').insert({ id, ...payload });
  return id;
}

/**
 * Persist Page + linked Instagram from /me/accounts.
 */
export async function persistPagesFromUserToken({
  orgId,
  userToken,
  scopes = '',
}) {
  const accounts = await getMeAccounts(userToken);
  const saved = [];

  for (const page of accounts?.data || []) {
    if (!page.id || !page.access_token) continue;

    try {
      await subscribePageToApp(page.id, page.access_token);
    } catch (err) {
      console.warn('[meta] subscribe page', page.id, err.message);
    }

    const messengerId = await upsertConnection({
      org_id: orgId,
      channel: 'messenger',
      display_name: page.name || `Page ${page.id}`,
      page_id: page.id,
      access_token_enc: encryptToken(page.access_token),
      scopes: scopes || META_OAUTH_SCOPES,
      status: 'active',
      meta_payload: { page_id: page.id, name: page.name },
    });
    saved.push({ id: messengerId, channel: 'messenger', name: page.name });

    const ig = page.instagram_business_account;
    if (ig?.id) {
      const igId = await upsertConnection({
        org_id: orgId,
        channel: 'instagram',
        display_name: ig.username
          ? `@${ig.username}`
          : ig.name || `IG ${ig.id}`,
        page_id: page.id,
        ig_user_id: ig.id,
        access_token_enc: encryptToken(page.access_token),
        scopes: scopes || META_OAUTH_SCOPES,
        status: 'active',
        meta_payload: {
          page_id: page.id,
          ig_user_id: ig.id,
          username: ig.username,
        },
      });
      saved.push({
        id: igId,
        channel: 'instagram',
        name: ig.username || ig.name,
      });
    }
  }

  return saved;
}

export async function persistWhatsAppFromToken({
  orgId,
  accessToken,
  scopes = '',
}) {
  const { phones } = await resolveWhatsAppAssets(accessToken);
  const saved = [];
  const tokenEnc = encryptToken(accessToken);

  for (const phone of phones) {
    try {
      if (phone.waba_id) await subscribeWaba(phone.waba_id, accessToken);
    } catch (err) {
      console.warn('[meta] subscribe waba', phone.waba_id, err.message);
    }

    const id = await upsertConnection({
      org_id: orgId,
      channel: 'whatsapp',
      display_name:
        phone.verified_name ||
        phone.display_phone_number ||
        `WA ${phone.phone_number_id}`,
      waba_id: phone.waba_id || null,
      phone_number_id: phone.phone_number_id,
      access_token_enc: tokenEnc,
      scopes: scopes || META_OAUTH_SCOPES,
      status: 'active',
      meta_payload: phone,
    });
    saved.push({
      id,
      channel: 'whatsapp',
      name: phone.display_phone_number || phone.verified_name,
    });
  }

  return saved;
}

export function registerMetaOAuth(app, { authMiddleware, ensureWorkspace }) {
  /** Start Facebook Login for Business (Pages + IG + WA management). */
  app.get(
    '/api/meta/oauth/start',
    authMiddleware(true),
    async (req, res) => {
      try {
        if (!metaConfigured()) {
          return res.status(503).json({
            error: {
              message:
                'Meta no está configurado. Agrega META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN y META_TOKEN_ENCRYPTION_KEY.',
            },
          });
        }
        const { org } = await ensureWorkspace(req.user);
        const state = signOAuthState({
          orgId: org.id,
          userId: req.user.id,
          intent: 'pages',
        });
        const url = new URL(
          `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth`
        );
        url.searchParams.set('client_id', config.meta.appId);
        url.searchParams.set('redirect_uri', oauthRedirectUri());
        url.searchParams.set('state', state);
        url.searchParams.set('scope', META_OAUTH_SCOPES);
        url.searchParams.set('response_type', 'code');
        return res.json({ url: url.toString() });
      } catch (err) {
        return res.status(500).json({
          error: { message: err.message || 'No se pudo iniciar OAuth' },
        });
      }
    }
  );

  /** Public config for Embedded Signup (FB JS SDK). */
  app.get(
    '/api/meta/config',
    authMiddleware(true),
    async (_req, res) => {
      res.json({
        configured: metaConfigured(),
        appId: config.meta.appId || null,
        apiVersion: config.meta.apiVersion,
        embeddedSignupConfigId:
          config.meta.embeddedSignupConfigId || null,
        graphScopes: META_OAUTH_SCOPES,
      });
    }
  );

  /**
   * Embedded Signup completion: client posts { code } after WA signup.
   */
  app.post(
    '/api/meta/embedded-signup',
    authMiddleware(true),
    async (req, res) => {
      try {
        if (!metaConfigured()) {
          return res.status(503).json({
            error: { message: 'Meta no está configurado en el servidor' },
          });
        }
        const { org } = await ensureWorkspace(req.user);
        const code = String(req.body?.code || '').trim();
        if (!code) {
          return res.status(400).json({
            error: { message: 'Falta el código de Embedded Signup' },
          });
        }

        const tokenRes = await exchangeEmbeddedSignupCode(code);
        let accessToken = tokenRes.access_token;
        try {
          const long = await exchangeForLongLivedUserToken(accessToken);
          if (long.access_token) accessToken = long.access_token;
        } catch {
          /* short-lived ok for WA business tokens sometimes */
        }

        const wa = await persistWhatsAppFromToken({
          orgId: org.id,
          accessToken,
        });
        // Also try pages in case the token includes them
        let pages = [];
        try {
          pages = await persistPagesFromUserToken({
            orgId: org.id,
            userToken: accessToken,
          });
        } catch {
          /* WA-only token */
        }

        return res.json({
          ok: true,
          connections: [...wa, ...pages],
        });
      } catch (err) {
        console.error('[meta] embedded-signup', err);
        return res.status(500).json({
          error: {
            message: err.message || 'No se pudo completar Embedded Signup',
          },
        });
      }
    }
  );

  /** OAuth redirect callback from Facebook. */
  app.get('/api/meta/oauth/callback', async (req, res) => {
    const errDesc = req.query.error_description || req.query.error;
    if (errDesc) {
      return res.redirect(
        frontRedirect(
          `/bots?meta_error=${encodeURIComponent(String(errDesc))}`
        )
      );
    }

    const code = req.query.code;
    const state = verifyOAuthState(req.query.state);
    if (!code || !state?.orgId) {
      return res.redirect(
        frontRedirect('/bots?meta_error=state_invalido')
      );
    }

    try {
      const tokenRes = await exchangeCodeForToken(String(code));
      let accessToken = tokenRes.access_token;
      try {
        const long = await exchangeForLongLivedUserToken(accessToken);
        if (long.access_token) accessToken = long.access_token;
      } catch {
        /* keep short */
      }

      const pages = await persistPagesFromUserToken({
        orgId: state.orgId,
        userToken: accessToken,
        scopes: META_OAUTH_SCOPES,
      });

      let wa = [];
      try {
        wa = await persistWhatsAppFromToken({
          orgId: state.orgId,
          accessToken,
          scopes: META_OAUTH_SCOPES,
        });
      } catch (err) {
        console.warn('[meta] wa after oauth', err.message);
      }

      const count = pages.length + wa.length;
      return res.redirect(
        frontRedirect(`/bots?meta_connected=${count}`)
      );
    } catch (err) {
      console.error('[meta] oauth callback', err);
      return res.redirect(
        frontRedirect(
          `/bots?meta_error=${encodeURIComponent(err.message || 'oauth_failed')}`
        )
      );
    }
  });
}
