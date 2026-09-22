import { config } from '../config.js';

export function metaConfigured() {
  return Boolean(
    config.meta.appId &&
      config.meta.appSecret &&
      config.meta.verifyToken &&
      config.meta.tokenEncryptionKey
  );
}

export function graphBaseUrl() {
  return `https://graph.facebook.com/${config.meta.apiVersion}`;
}

export function oauthRedirectUri() {
  return `${config.publicAppUrl}/api/meta/oauth/callback`;
}

/** Scopes for Facebook Login for Business (Pages + IG + WhatsApp). */
export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_messages',
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
].join(',');
