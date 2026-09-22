import { config } from '../config.js';
import { graphBaseUrl } from './config.js';

async function graphFetch(path, { method = 'GET', token, body, query } = {}) {
  const url = new URL(
    path.startsWith('http') ? path : `${graphBaseUrl()}${path}`
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      text?.slice(0, 200) ||
      `Graph API ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.graph = json?.error || json;
    throw err;
  }
  return json;
}

/** OAuth redirect callback code exchange (requires redirect_uri). */
export async function exchangeCodeForToken(code) {
  return graphFetch('/oauth/access_token', {
    query: {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: `${config.publicAppUrl}/api/meta/oauth/callback`,
      code,
    },
  });
}

/** Embedded Signup session code — no redirect_uri. */
export async function exchangeEmbeddedSignupCode(code) {
  return graphFetch('/oauth/access_token', {
    query: {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      code,
    },
  });
}

export async function exchangeForLongLivedUserToken(shortToken) {
  return graphFetch('/oauth/access_token', {
    query: {
      grant_type: 'fb_exchange_token',
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortToken,
    },
  });
}

export async function debugToken(inputToken) {
  const appToken = `${config.meta.appId}|${config.meta.appSecret}`;
  return graphFetch('/debug_token', {
    token: appToken,
    query: { input_token: inputToken },
  });
}

export async function getMeAccounts(userToken) {
  return graphFetch('/me/accounts', {
    token: userToken,
    query: {
      fields:
        'id,name,access_token,instagram_business_account{id,username,name},tasks',
      limit: '100',
    },
  });
}

export async function subscribePageToApp(pageId, pageToken) {
  return graphFetch(`/${pageId}/subscribed_apps`, {
    method: 'POST',
    token: pageToken,
    query: {
      subscribed_fields:
        'messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads',
    },
  });
}

/** Messenger / Instagram (via Page) send text */
export async function sendPageMessage({
  pageId,
  pageToken,
  recipientId,
  text,
}) {
  return graphFetch(`/${pageId}/messages`, {
    method: 'POST',
    token: pageToken,
    body: {
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text: String(text).slice(0, 2000) },
    },
  });
}

/** WhatsApp Cloud API send text */
export async function sendWhatsAppText({
  phoneNumberId,
  token,
  to,
  text,
}) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: 'POST',
    token,
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to).replace(/\D/g, ''),
      type: 'text',
      text: { preview_url: false, body: String(text).slice(0, 4096) },
    },
  });
}

/** Messenger: first name of the person who messaged the Page */
export async function fetchMessengerUserProfile(psid, pageToken) {
  try {
    const data = await graphFetch(`/${psid}`, {
      token: pageToken,
      query: { fields: 'first_name,last_name,name' },
    });
    const first = String(data?.first_name || '').trim();
    const full = String(data?.name || '').trim();
    return {
      displayName: first || full.split(/\s+/)[0] || full || '',
      username: '',
      raw: data,
    };
  } catch {
    return { displayName: '', username: '', raw: null };
  }
}

/** Instagram Messaging: username of the person (IGSID) */
export async function fetchInstagramUserProfile(igsid, pageToken) {
  try {
    const data = await graphFetch(`/${igsid}`, {
      token: pageToken,
      query: { fields: 'name,username' },
    });
    const username = String(data?.username || '')
      .trim()
      .replace(/^@/, '');
    const name = String(data?.name || '').trim();
    return {
      displayName: username ? `@${username}` : name || '',
      username: username || '',
      raw: data,
    };
  } catch {
    return { displayName: '', username: '', raw: null };
  }
}

/** Format WhatsApp wa_id as a readable phone */
export function formatWhatsAppPhone(waId) {
  const digits = String(waId || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 10) return `+${digits}`;
  return digits;
}

/**
 * After Embedded Signup, exchange the code for a business token
 * and resolve WABA + phone number id.
 */
export async function resolveWhatsAppAssets(accessToken) {
  const me = await graphFetch('/me', {
    token: accessToken,
    query: { fields: 'id' },
  });

  let wabas = null;
  try {
    wabas = await graphFetch('/me/businesses', {
      token: accessToken,
      query: {
        fields:
          'id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}',
      },
    });
  } catch {
    /* fallback below */
  }

  const phones = [];
  for (const biz of wabas?.data || []) {
    for (const waba of biz.owned_whatsapp_business_accounts?.data || []) {
      for (const phone of waba.phone_numbers?.data || []) {
        phones.push({
          waba_id: waba.id,
          waba_name: waba.name,
          phone_number_id: phone.id,
          display_phone_number: phone.display_phone_number,
          verified_name: phone.verified_name,
          business_id: biz.id,
          business_name: biz.name,
        });
      }
    }
  }

  // Alternate: shared WABAs on the user
  if (!phones.length) {
    try {
      const shared = await graphFetch(
        `/${me.id}/whatsapp_business_accounts`,
        {
          token: accessToken,
          query: {
            fields: 'id,name,phone_numbers{id,display_phone_number,verified_name}',
          },
        }
      );
      for (const waba of shared?.data || []) {
        for (const phone of waba.phone_numbers?.data || []) {
          phones.push({
            waba_id: waba.id,
            waba_name: waba.name,
            phone_number_id: phone.id,
            display_phone_number: phone.display_phone_number,
            verified_name: phone.verified_name,
          });
        }
      }
    } catch {
      /* empty */
    }
  }

  return { userId: me.id, phones };
}

export async function subscribeWaba(wabaId, token) {
  return graphFetch(`/${wabaId}/subscribed_apps`, {
    method: 'POST',
    token,
  });
}
